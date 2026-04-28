const supabase = require('../config/database');

// GET /api/sets
exports.getAll = async (req, res, next) => {
  try {
    const { data: sets, error } = await supabase
      .from('sets')
      .select('*, set_items(id, quantity, item_id, items(id, name, price, stock))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Post-process: calculate stock & format items
    const result = sets.map((set) => {
      const items = (set.set_items || []).map((si) => ({
        item_id: si.items?.id || si.item_id,
        item_name: si.items?.name || 'Unknown',
        item_price: si.items?.price,
        item_stock: si.items?.stock || 0,
        quantity: si.quantity,
      }));

      const calculated_stock = items.length > 0
        ? Math.min(...items.map((i) => Math.floor(i.item_stock / i.quantity)))
        : 0;

      return {
        id: set.id,
        name: set.name,
        price: set.price,
        created_at: set.created_at,
        items,
        items_count: items.length,
        calculated_stock,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/sets
exports.create = async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('sets')
      .insert({ name: name.trim(), price: parseFloat(price) })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/sets/:id
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: set, error } = await supabase
      .from('sets')
      .select('*, set_items(id, quantity, item_id, items(id, name, price, stock))')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!set) return res.status(404).json({ success: false, error: 'Set not found' });

    const items = (set.set_items || []).map((si) => ({
      set_item_id: si.id,
      item_id: si.items?.id || si.item_id,
      item_name: si.items?.name || 'Unknown',
      item_price: si.items?.price,
      item_stock: si.items?.stock || 0,
      quantity: si.quantity,
    }));

    set.items = items;
    set.calculated_stock = items.length > 0
      ? Math.min(...items.map((i) => Math.floor(i.item_stock / i.quantity)))
      : 0;
    delete set.set_items;

    res.json({ success: true, data: set });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sets/:id
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);

    const { data, error } = await supabase
      .from('sets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Set not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sets/:id
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sets')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Set not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/sets/:id/items
exports.addItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { item_id, quantity } = req.body;

    if (!item_id || !quantity) {
      return res.status(400).json({ success: false, error: 'item_id and quantity are required' });
    }

    // Verify set exists
    const { data: set } = await supabase.from('sets').select('id').eq('id', id).single();
    if (!set) return res.status(404).json({ success: false, error: 'Set not found' });

    // Verify item exists
    const { data: item } = await supabase.from('items').select('id').eq('id', item_id).single();
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

    // Upsert
    const { data, error } = await supabase
      .from('set_items')
      .upsert(
        { set_id: id, item_id, quantity: parseInt(quantity) },
        { onConflict: 'set_id,item_id' }
      )
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sets/:id/items/:itemId
exports.removeItem = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const { data, error } = await supabase
      .from('set_items')
      .delete()
      .eq('set_id', id)
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Item not found in this set' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
