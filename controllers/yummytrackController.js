const supabase = require('../config/database');

const YUMMYTRACK_URL =
  'https://itemku-autochat-api-production.up.railway.app/api/yummytrack/pets-vps';

const extractInventoryItems = (payload) => {
  const source = payload?.data ?? payload;
  const items = source?.items || source || [];

  return items
    .filter((item) => item?.type === 'inventory' && item?.name)
    .map((item) => ({
      name: item.name.trim(),
      price: 0,
      send_quantity: 1,
      stock: Number(item.amount) || 0,
    }));
};

exports.importPetsVps = async (req, res, next) => {
  try {
    const apiKey = req.get('X-API-Key');

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'X-API-Key is required' });
    }

    const upstreamRes = await fetch(YUMMYTRACK_URL, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
      },
    });

    const payload = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: payload?.error || 'Failed to fetch from upstream',
      });
    }

    const inventoryItems = extractInventoryItems(payload);

    let inserted = 0;
    let updated = 0;

    for (const item of inventoryItems) {
      const { data: existing, error: existingError } = await supabase
        .from('items')
        .select('id, price, send_quantity, stock')
        .eq('name', item.name)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('items')
          .update({ stock: item.stock })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        updated += 1;
      } else {
        const { error: insertError } = await supabase
          .from('items')
          .insert(item);

        if (insertError) throw insertError;
        inserted += 1;
      }
    }

    res.json({
      success: true,
      data: {
        total: inventoryItems.length,
        imported: inserted,
        updated,
      },
    });
  } catch (err) {
    next(err);
  }
};