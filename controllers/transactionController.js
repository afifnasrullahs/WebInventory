const supabase = require('../config/database');

const enrichTransactions = async (transactions) => {
  if (!transactions.length) return transactions;

  const txnIds = transactions.map((txn) => txn.id);
  const { data: details, error: detailsError } = await supabase
    .from('transaction_details')
    .select('id, transaction_id, type, ref_id, quantity')
    .in('transaction_id', txnIds)
    .order('id', { ascending: true });

  if (detailsError) throw detailsError;

  const detailIds = details.map((detail) => detail.id);
  const itemIds = [
    ...new Set([
      ...details.filter((detail) => detail.type === 'item').map((detail) => detail.ref_id),
    ]),
  ];

  const [itemsRes, breakdownRes] = await Promise.all([
    itemIds.length ? supabase.from('items').select('id, name').in('id', itemIds) : Promise.resolve({ data: [] }),
    detailIds.length
      ? supabase
          .from('transaction_item_breakdown')
          .select('transaction_detail_id, quantity, items(name)')
          .in('transaction_detail_id', detailIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (breakdownRes.error) throw breakdownRes.error;

  const itemNames = new Map((itemsRes.data || []).map((item) => [item.id, item.name]));
  const summaryByTxn = new Map(txnIds.map((id) => [id, []]));
  const summaryByDetail = new Map(detailIds.map((id) => [id, []]));

  (breakdownRes.data || []).forEach((row) => {
    const itemName = row.items?.name || 'Unknown';
    const detailSummary = summaryByDetail.get(row.transaction_detail_id) || [];
    const existing = detailSummary.find((entry) => entry.name === itemName);

    if (existing) {
      existing.quantity += row.quantity;
    } else {
      detailSummary.push({ name: itemName, quantity: row.quantity, type: 'item' });
    }

    summaryByDetail.set(row.transaction_detail_id, detailSummary);
  });

  details.forEach((detail) => {
    const detailSummary = summaryByDetail.get(detail.id) || [];

    if (detail.type === 'item' && !detailSummary.length) {
      summaryByTxn.get(detail.transaction_id).push({
        name: itemNames.get(detail.ref_id) || 'Deleted Item',
        quantity: detail.quantity,
        type: 'item',
      });
      return;
    }

    summaryByTxn.get(detail.transaction_id).push(
      ...detailSummary.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        type: 'item',
      }))
    );
  });

  return transactions.map((txn) => ({
    ...txn,
    summary: summaryByTxn.get(txn.id) || [],
  }));
};

// POST /api/transactions — Calls RPC for atomic create
exports.create = async (req, res, next) => {
  try {
    const { buyer_name, roblox_username, items } = req.body;

    if (!buyer_name || !roblox_username || !items || !items.length) {
      return res.status(400).json({ success: false, error: 'buyer_name, roblox_username and items are required' });
    }

    // Validate input shape
    for (const item of items) {
      if (!item.type || !item.ref_id || !item.quantity) {
        return res.status(400).json({
          success: false,
          error: 'Each item must have type, ref_id, and quantity',
        });
      }
    }

    const { data, error } = await supabase.rpc('create_transaction', {
      p_buyer_name: buyer_name.trim(),
      p_roblox_username: roblox_username.trim(),
      p_items: items,
    });

    if (error) {
      // Extract custom error message from PostgreSQL
      const msg = error.message || 'Transaction failed';
      return res.status(400).json({ success: false, error: msg });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions
exports.getAll = async (req, res, next) => {
  try {
    const { status, sortBy, sortDir } = req.query;
    const allowedSort = new Set(['created_at', 'total_price']);
    const column = allowedSort.has(sortBy) ? sortBy : 'created_at';
    const ascending = `${sortDir}`.toLowerCase() === 'asc';

    let query = supabase.from('transactions').select('*').order(column, { ascending });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const enriched = await enrichTransactions(data || []);
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (req.body.buyer_name !== undefined) updates.buyer_name = req.body.buyer_name.trim();
    if (req.body.roblox_username !== undefined) updates.roblox_username = req.body.roblox_username.trim();

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, error: 'Tidak ada data yang diubah' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Transaction not found' });

    const [enriched] = await enrichTransactions([data]);
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id/full — Cancel then recreate transaction atomically
exports.updateFull = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { buyer_name, roblox_username, items } = req.body;

    if (!buyer_name || !roblox_username || !items || !items.length) {
      return res.status(400).json({ success: false, error: 'buyer_name, roblox_username and items are required' });
    }

    // Validate items
    for (const item of items) {
      if (!item.type || !item.ref_id || !item.quantity) {
        return res.status(400).json({ success: false, error: 'Each item must have type, ref_id, and quantity' });
      }
    }

    // 1) Cancel existing transaction (restores stock)
    const { data: cancelData, error: cancelError } = await supabase.rpc('cancel_transaction', {
      p_txn_id: id,
    });

    if (cancelError) {
      const msg = cancelError.message || 'Cancel failed';
      return res.status(400).json({ success: false, error: msg });
    }

    // 2) Create new transaction with supplied payload
    const { data: createRes, error: createError } = await supabase.rpc('create_transaction', {
      p_buyer_name: buyer_name.trim(),
      p_roblox_username: roblox_username.trim(),
      p_items: items,
    });

    if (createError) {
      const msg = createError.message || 'Re-create transaction failed';
      return res.status(400).json({ success: false, error: msg });
    }

    // Fetch the newly created transaction row to return enriched data
    const newId = createRes?.id || null;
    if (!newId) {
      return res.json({ success: true, data: createRes });
    }

    const { data: txnRow, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', newId)
      .single();

    if (txnError) throw txnError;

    const [enriched] = await enrichTransactions([txnRow]);
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions/:id
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get transaction
    const { data: txn, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (txnError) throw txnError;
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

    // Get details with breakdown
    const { data: details, error: detError } = await supabase
      .from('transaction_details')
      .select('*, transaction_item_breakdown(id, item_id, quantity, items(id, name))')
      .eq('transaction_id', id)
      .order('type');

    if (detError) throw detError;

    // Resolve ref_name for each detail
    for (const detail of details) {
      if (detail.type === 'item') {
        const { data: item } = await supabase.from('items').select('name').eq('id', detail.ref_id).single();
        detail.ref_name = item?.name || 'Deleted Item';
      } else {
        const { data: set } = await supabase.from('sets').select('name').eq('id', detail.ref_id).single();
        detail.ref_name = set?.name || 'Deleted Set';
      }

      // Format breakdown
      detail.breakdown = (detail.transaction_item_breakdown || []).map((b) => ({
        item_id: b.item_id,
        item_name: b.items?.name || 'Unknown',
        quantity: b.quantity,
      }));
      delete detail.transaction_item_breakdown;
    }

    txn.details = details;
    delete txn.tiktok_username;
    res.json({ success: true, data: txn });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check current status
    const { data: txn } = await supabase.from('transactions').select('status').eq('id', id).single();
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });
    if (txn.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Hanya transaksi pending yang bisa diupdate' });
    }
    if (status !== 'done') {
      return res.status(400).json({ success: false, error: 'Status hanya bisa diubah ke done' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'done' })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id/cancel — Calls RPC for atomic cancel
exports.cancel = async (req, res, next) => {
  try {
    const { data, error } = await supabase.rpc('cancel_transaction', {
      p_txn_id: req.params.id,
    });

    if (error) {
      const msg = error.message || 'Cancel failed';
      return res.status(400).json({ success: false, error: msg });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
