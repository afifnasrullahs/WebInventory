const supabase = require('../config/database');

exports.saveYummytrackToken = async (req, res, next) => {
  try {
    const authKey = req.get('X-API-Key');
    const { token } = req.body || {};

    if (!authKey) {
      return res.status(401).json({ success: false, error: 'X-API-Key is required' });
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('config')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const tokenValue = token.trim();

    if (existing) {
      const { error: updateError } = await supabase
        .from('config')
        .update({ yummytrack_token: tokenValue, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('config')
        .insert({ yummytrack_token: tokenValue });

      if (insertError) throw insertError;
    }

    res.json({
      success: true,
      ok: true,
      message: 'Token berhasil disimpan',
      token_preview: `${tokenValue.slice(0, 10)}...`,
    });
  } catch (err) {
    next(err);
  }
};