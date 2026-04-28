const supabase = require('../config/database');

// POST /api/transactions — Calls RPC for atomic create
exports.create = async (req, res, next) => {
  try {
    const { buyer_name, items } = req.body;

    if (!buyer_name || !items || !items.length) {
      return res.status(400).json({ success: false, error: 'buyer_name and items are required' });
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
      p_items: items,
    });

    if (error) {
      // Extract custom error message from PostgreSQL
      const msg = error.message || 'Transaction failed';
      return res.status(400).json({ success: false, error: msg });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions
exports.getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
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
