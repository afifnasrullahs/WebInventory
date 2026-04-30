const supabase = require('../config/database');

const ensureTransactionDetails = async (txnId, items) => {
  if (!txnId || !Array.isArray(items) || !items.length) return;

  const { data: existing, error: countErr } = await supabase
    .from('transaction_details')
    .select('id')
    .eq('transaction_id', txnId)
    .limit(1);
  if (countErr) throw countErr;
  if (existing && existing.length) return; // Already created by RPC.

  const setIds = [...new Set(items.filter((i) => i.type === 'set').map((i) => i.ref_id))];
  const itemIds = [...new Set(items.filter((i) => i.type === 'item').map((i) => i.ref_id))];

  const [setsRes, itemDefaultsRes] = await Promise.all([
    setIds.length
      ? supabase
          .from('set_items')
          .select('set_id,item_id,quantity')
          .in('set_id', setIds)
      : Promise.resolve({ data: [] }),
    itemIds.length
      ? supabase
          .from('items')
          .select('id,send_quantity')
          .in('id', itemIds)
      : Promise.resolve({ data: [] }),
  ]);
  if (setsRes.error) throw setsRes.error;
  if (itemDefaultsRes.error) throw itemDefaultsRes.error;

  const itemSendDefault = new Map((itemDefaultsRes.data || []).map((r) => [r.id, r.send_quantity || 1]));
  const setItemsBySet = new Map();
  (setsRes.data || []).forEach((row) => {
    const arr = setItemsBySet.get(row.set_id) || [];
    arr.push(row);
    setItemsBySet.set(row.set_id, arr);
  });

  for (const entry of items) {
    const qty = parseInt(entry.quantity) || 1;
    const price = Number(entry.price) || 0;

    const { data: detail, error: detailErr } = await supabase
      .from('transaction_details')
      .insert({
        transaction_id: txnId,
        type: entry.type,
        ref_id: entry.ref_id,
        quantity: qty,
        price,
      })
      .select('id')
      .single();
    if (detailErr) throw detailErr;

    if (entry.type === 'item') {
      const sendAmount = parseInt(entry.send_amount) || itemSendDefault.get(entry.ref_id) || 1;
      const { error: brErr } = await supabase
        .from('transaction_item_breakdown')
        .insert({
          transaction_detail_id: detail.id,
          item_id: entry.ref_id,
          quantity: qty * sendAmount,
        });
      if (brErr) throw brErr;
      continue;
    }

    const setRows = setItemsBySet.get(entry.ref_id) || [];
    if (!setRows.length) continue;

    const breakdownRows = setRows.map((si) => ({
      transaction_detail_id: detail.id,
      item_id: si.item_id,
      quantity: qty * (parseInt(si.quantity) || 1),
    }));
    const { error: setBrErr } = await supabase
      .from('transaction_item_breakdown')
      .insert(breakdownRows);
    if (setBrErr) throw setBrErr;
  }
};

const cancelTransactionWithRestore = async (txnId) => {
  // 1) Try DB RPC first (atomic if function is correct).
  const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_transaction', {
    p_txn_id: txnId,
  });

  if (!rpcError) {
    return rpcData;
  }

  // 2) Fallback path: manual restore + cancel for environments
  // where DB function is outdated/incomplete.
  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .select('id,status,buyer_name,total_price,created_at')
    .eq('id', txnId)
    .single();
  if (txnErr) throw txnErr;
  if (!txn) {
    const e = new Error('Transaksi tidak ditemukan');
    e.status = 404;
    throw e;
  }
  if (txn.status !== 'pending') {
    const e = new Error('Hanya transaksi pending yang bisa di-cancel');
    e.status = 400;
    throw e;
  }

  const { data: details, error: detailsErr } = await supabase
    .from('transaction_details')
    .select('id')
    .eq('transaction_id', txnId);
  if (detailsErr) throw detailsErr;

  const detailIds = (details || []).map((d) => d.id);

  if (detailIds.length) {
    const { data: breakdown, error: brErr } = await supabase
      .from('transaction_item_breakdown')
      .select('item_id,quantity')
      .in('transaction_detail_id', detailIds);
    if (brErr) throw brErr;

    const qtyByItem = new Map();
    (breakdown || []).forEach((row) => {
      const key = row.item_id;
      qtyByItem.set(key, (qtyByItem.get(key) || 0) + (parseInt(row.quantity) || 0));
    });

    for (const [itemId, qty] of qtyByItem.entries()) {
      const { data: itemRow, error: itemGetErr } = await supabase
        .from('items')
        .select('stock')
        .eq('id', itemId)
        .single();
      if (itemGetErr) throw itemGetErr;

      const newStock = (parseInt(itemRow?.stock) || 0) + qty;
      const { error: itemUpdErr } = await supabase
        .from('items')
        .update({ stock: newStock })
        .eq('id', itemId);
      if (itemUpdErr) throw itemUpdErr;
    }
  }

  const { data: updatedTxn, error: updErr } = await supabase
    .from('transactions')
    .update({ status: 'cancelled' })
    .eq('id', txnId)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (updErr) throw updErr;

  return {
    id: updatedTxn.id,
    buyer_name: updatedTxn.buyer_name,
    total_price: updatedTxn.total_price,
    status: updatedTxn.status,
    created_at: updatedTxn.created_at,
  };
};

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
  const setIds = [
    ...new Set([
      ...details.filter((detail) => detail.type === 'set').map((detail) => detail.ref_id),
    ]),
  ];

  const [itemsRes, setsRes, breakdownRes] = await Promise.all([
    itemIds.length ? supabase.from('items').select('id, name').in('id', itemIds) : Promise.resolve({ data: [] }),
    setIds.length ? supabase.from('sets').select('id, name').in('id', setIds) : Promise.resolve({ data: [] }),
    detailIds.length
      ? supabase
          .from('transaction_item_breakdown')
          .select('transaction_detail_id, quantity, items(name)')
          .in('transaction_detail_id', detailIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (setsRes.error) throw setsRes.error;
  if (breakdownRes.error) throw breakdownRes.error;

  const itemNames = new Map((itemsRes.data || []).map((item) => [item.id, item.name]));
  const setNames = new Map((setsRes.data || []).map((set) => [set.id, set.name]));
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

    // Fallback: if no breakdown row, still show original detail so UI "Item / Qty" is never empty.
    if (!detailSummary.length) {
      if (detail.type === 'item') {
        summaryByTxn.get(detail.transaction_id).push({
          name: itemNames.get(detail.ref_id) || 'Deleted Item',
          quantity: detail.quantity,
          type: 'item',
        });
      } else {
        summaryByTxn.get(detail.transaction_id).push({
          name: setNames.get(detail.ref_id) || 'Deleted Set',
          quantity: detail.quantity,
          type: 'set',
        });
      }
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

    await ensureTransactionDetails(data?.id, items);

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
    const cancelData = await cancelTransactionWithRestore(id);

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

    await ensureTransactionDetails(createRes?.id, items);

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
    const data = await cancelTransactionWithRestore(req.params.id);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/transactions/:id
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: txn, error: getErr } = await supabase
      .from('transactions')
      .select('id,status')
      .eq('id', id)
      .single();
    if (getErr) throw getErr;
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

    if (txn.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Hanya transaksi berstatus cancelled yang bisa dihapus',
      });
    }

    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
