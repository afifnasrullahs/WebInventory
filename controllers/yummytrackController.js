const supabase = require('../config/database');

const YUMMYTRACK_URL = process.env.YUMMYTRACK_PETS_VPS_URL || 'https://yummytrackstat.com/api/yummytrack/pets-vps';

const tryParseJson = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;

  const text = String(value).trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (firstError) {
    const firstObject = text.indexOf('{');
    const lastObject = text.lastIndexOf('}');
    if (firstObject !== -1 && lastObject > firstObject) {
      try {
        return JSON.parse(text.slice(firstObject, lastObject + 1));
      } catch (secondError) {
        // fall through
      }
    }

    const firstArray = text.indexOf('[');
    const lastArray = text.lastIndexOf(']');
    if (firstArray !== -1 && lastArray > firstArray) {
      try {
        return JSON.parse(text.slice(firstArray, lastArray + 1));
      } catch (thirdError) {
        // fall through
      }
    }

    return null;
  }
};

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
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('yummytrack_token')
      .single();

    if (configError || !config?.yummytrack_token) {
      return res.status(401).json({
        success: false,
        error: 'Token belum diset',
      });
    }

    const upstreamRes = await fetch(YUMMYTRACK_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.yummytrack_token}`,
        'X-API-Key': config.yummytrack_token,
        Accept: 'application/json',
      },
    });

    const rawBody = await upstreamRes.text();
    const payload = tryParseJson(rawBody);

    if (!payload) {
      return res.status(502).json({
        success: false,
        error: 'Invalid JSON returned by Yummytrack',
        details: rawBody.slice(0, 200),
      });
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: payload.error || payload.message || 'Failed to fetch Yummytrack data',
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