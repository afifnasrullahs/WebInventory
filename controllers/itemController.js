const supabase = require('../config/database');

// GET /api/items
exports.getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = supabase.from('items').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/items
exports.create = async (req, res, next) => {
  try {
    const { name, price, send_quantity, stock } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name.trim(),
        price: parseFloat(price),
        send_quantity: parseInt(send_quantity) || 1,
        stock: parseInt(stock) || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/items/:id
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
    if (req.body.send_quantity !== undefined) updates.send_quantity = parseInt(req.body.send_quantity);
    if (req.body.stock !== undefined) updates.stock = parseInt(req.body.stock);

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Item not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/items/:id
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if item is used in any set
    const { data: setItems } = await supabase
      .from('set_items')
      .select('id')
      .eq('item_id', id)
      .limit(1);

    if (setItems && setItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete item that is part of a set. Remove it from all sets first.',
      });
    }

    const { data, error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Item not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
