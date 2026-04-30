const supabase = require('../config/database');
const { sendDiscordWebhook } = require('../utils/discordWebhook');

// ============ SERVICES ============

// GET /api/joki/services
exports.getAllServices = async (req, res, next) => {
  try {
    const { sortBy, sortDir } = req.query;
    const allowedSort = new Set(['created_at', 'price', 'name']);
    const column = allowedSort.has(sortBy) ? sortBy : 'created_at';
    const ascending = `${sortDir}`.toLowerCase() === 'asc';

    const { data, error } = await supabase
      .from('joki_services')
      .select('*')
      .order(column, { ascending });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/joki/services
exports.createService = async (req, res, next) => {
  try {
    const { name, price, description } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('joki_services')
      .insert({ name: name.trim(), price: parseFloat(price), description: description || null })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/joki/services/:id
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
    if (req.body.description !== undefined) updates.description = req.body.description;

    const { data, error } = await supabase
      .from('joki_services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Joki service not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/joki/services/:id
exports.deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check active orders
    const { data: activeOrders } = await supabase
      .from('joki_orders')
      .select('id')
      .eq('joki_service_id', id)
      .in('status', ['pending', 'in_progress'])
      .limit(1);

    if (activeOrders && activeOrders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete service with active orders',
      });
    }

    const { data, error } = await supabase
      .from('joki_services')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Joki service not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============ ORDERS ============

// GET /api/joki/orders
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, sortBy, sortDir } = req.query;
    const allowedSort = new Set(['created_at', 'price']);
    const column = allowedSort.has(sortBy) ? sortBy : 'created_at';
    const ascending = `${sortDir}`.toLowerCase() === 'asc';

    let query = supabase
      .from('joki_orders')
      .select('*, joki_services(name)')
      .order(column, { ascending });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten service name
    const result = data.map((o) => ({
      ...o,
      service_name: o.joki_services?.name || 'Unknown',
      joki_services: undefined,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/joki/orders
exports.createOrder = async (req, res, next) => {
  try {
    const { joki_service_id, customer_name, game_username, game_password, tiktok_usn, price, notes } = req.body;

    if (!joki_service_id || !customer_name || !game_username || !game_password || !tiktok_usn) {
      return res.status(400).json({
        success: false,
        error: 'joki_service_id, customer_name, game_username, game_password, and tiktok_usn are required',
      });
    }

    // Get service for default price
    const { data: service } = await supabase
      .from('joki_services')
      .select('name, price')
      .eq('id', joki_service_id)
      .single();

    if (!service) {
      return res.status(404).json({ success: false, error: 'Joki service not found' });
    }

    const finalPrice = price !== undefined ? parseFloat(price) : parseFloat(service.price);

    const { data, error } = await supabase
      .from('joki_orders')
      .insert({
        joki_service_id,
        customer_name: customer_name.trim(),
        game_username: game_username.trim(),
        game_password,
        tiktok_usn: tiktok_usn.trim(),
        price: finalPrice,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget Discord notify (do not block order creation)
    const webhookUrl = process.env.DISCORD_JOKI_WEBHOOK_URL;
    if (webhookUrl) {
      sendDiscordWebhook(webhookUrl, {
        content: `📩 **Order Joki Masuk**`,
        embeds: [
          {
            title: 'Order Joki Baru',
            color: 0x5865f2,
            fields: [
              { name: 'Customer', value: String(customer_name || '-'), inline: true },
              { name: 'TikTok USN', value: `@${String(tiktok_usn || '').replace(/^@+/, '') || '-'}`, inline: true },
              { name: 'Layanan', value: String(service?.name || '-'), inline: true },
              { name: 'Harga', value: `IDR ${Number(finalPrice || 0).toLocaleString('id-ID')}`, inline: true },
              { name: 'Status', value: 'pending', inline: true },
              { name: 'Order ID', value: String(data.id), inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }).catch((e) => {
        // Avoid crashing requests if Discord fails
        console.warn('[discord] failed to send joki notify:', e?.message || e);
      });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/joki/orders/:id
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('joki_orders')
      .select('*, joki_services(name, description)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Joki order not found' });

    data.service_name = data.joki_services?.name || 'Unknown';
    data.service_description = data.joki_services?.description || '';
    delete data.joki_services;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/joki/orders/:id
exports.updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { joki_service_id, customer_name, game_username, game_password, tiktok_usn, price, notes } = req.body;

    if (!joki_service_id || !customer_name || !game_username || !game_password || !tiktok_usn) {
      return res.status(400).json({
        success: false,
        error: 'joki_service_id, customer_name, game_username, game_password, and tiktok_usn are required',
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from('joki_orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (existingError) throw existingError;
    if (!existing) return res.status(404).json({ success: false, error: 'Joki order not found' });

    if (existing.status === 'done' || existing.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Tidak bisa edit order yang sudah selesai atau sudah di-cancel',
      });
    }

    // Get service for default price (and validate service exists)
    const { data: service } = await supabase
      .from('joki_services')
      .select('price')
      .eq('id', joki_service_id)
      .single();

    if (!service) {
      return res.status(404).json({ success: false, error: 'Joki service not found' });
    }

    const finalPrice = price !== undefined && price !== null && `${price}` !== ''
      ? parseFloat(price)
      : parseFloat(service.price);

    const updates = {
      joki_service_id,
      customer_name: customer_name.trim(),
      game_username: game_username.trim(),
      game_password,
      tiktok_usn: tiktok_usn.trim(),
      price: finalPrice,
      notes: notes || null,
    };

    const { data, error } = await supabase
      .from('joki_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Joki order not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/joki/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data: order } = await supabase.from('joki_orders').select('status').eq('id', id).single();
    if (!order) return res.status(404).json({ success: false, error: 'Joki order not found' });

    const validTransitions = {
      pending: ['in_progress'],
      in_progress: ['done'],
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Tidak bisa mengubah status dari "${order.status}" ke "${status}"`,
      });
    }

    const { data, error } = await supabase
      .from('joki_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/joki/orders/:id/cancel
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: order } = await supabase.from('joki_orders').select('status').eq('id', id).single();
    if (!order) return res.status(404).json({ success: false, error: 'Joki order not found' });

    if (order.status === 'done' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Tidak bisa cancel order yang sudah selesai atau sudah di-cancel',
      });
    }

    const { data, error } = await supabase
      .from('joki_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
