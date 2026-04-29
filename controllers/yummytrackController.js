const supabase = require('../config/database');

const YUMMYTRACK_URL =
  process.env.YUMMYTRACK_PETS_VPS_URL ||
  'https://itemku-autochat-api-production.up.railway.app/api/yummytrack/pets-vps';

const extractInventoryItems = (payload) => {
  const source = payload?.data ?? payload;
  const items = Array.isArray(source)
    ? source
    : Array.isArray(source?.items)
      ? source.items
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return items
    .filter((item) => item && item.type === 'inventory' && item.name)
    .map((item) => ({
      name: String(item.name).trim(),
      price: 0,
      send_quantity: 1,
      stock: Number.isFinite(Number(item.amount)) ? parseInt(item.amount, 10) : 0,
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

    let payload;
    try {
      payload = await upstreamRes.json();
    } catch (parseError) {
      return res.status(502).json({
        success: false,
        error: 'Invalid JSON returned by Yummytrack',
      });
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: payload?.error || 'Failed to fetch data',
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
        source: payload.source || payload.data?.source || 'yummytrackstat',
        imported: inserted,
        updated,
        skipped: (() => {
          const source = payload?.data ?? payload;
          const items = Array.isArray(source)
            ? source
            : Array.isArray(source?.items)
              ? source.items
              : Array.isArray(payload?.items)
                ? payload.items
                : [];
          return items.filter((item) => item.type !== 'inventory' || !item.name).length;
        })(),
      },
    });
  } catch (err) {
    next(err);
  }
};