const supabase = require('../config/database');

const ALLOWED_WORKERS = [
  { name: 'vie', role: 'host' },
  { name: 'mpi', role: 'admin' },
];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isAllowedWorker(name, role) {
  const n = normalizeName(name);
  const r = normalizeRole(role);
  return ALLOWED_WORKERS.some((w) => w.name === n && w.role === r);
}

// GET /api/activities
exports.getAll = async (req, res, next) => {
  try {
    const { status, sortBy, sortDir, limit } = req.query;
    const allowedSort = new Set(['created_at', 'activity_date', 'name', 'role', 'work_hours', 'approved']);
    const column = allowedSort.has(sortBy) ? sortBy : 'created_at';
    const ascending = `${sortDir}`.toLowerCase() === 'asc';

    let query = supabase.from('activity_logs').select('*').order(column, { ascending });

    if (status === 'approved') query = query.eq('approved', true);
    if (status === 'pending') query = query.eq('approved', false);

    const nLimit = parseInt(limit);
    if (!Number.isNaN(nLimit) && nLimit > 0) {
      query = query.limit(Math.min(200, nLimit));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
};

// POST /api/activities
exports.create = async (req, res, next) => {
  try {
    const { name, role, work_done, work_hours } = req.body || {};
    const n = normalizeName(name);
    const r = normalizeRole(role);
    const work = String(work_done || '').trim();

    if (!n || !r || !work) {
      return res.status(400).json({ success: false, error: 'Nama, role, dan apa yang dikerjakan wajib diisi' });
    }

    if (!isAllowedWorker(n, r)) {
      return res.status(400).json({
        success: false,
        error: 'Pekerja tidak valid. Hanya host (vie) dan admin (mpi) yang diperbolehkan.',
      });
    }

    let hours = null;
    if (work_hours !== undefined && work_hours !== null && `${work_hours}` !== '') {
      hours = parseFloat(work_hours);
      if (Number.isNaN(hours) || hours < 0) {
        return res.status(400).json({ success: false, error: 'Jam kerja tidak valid' });
      }
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        name: n,
        role: r,
        work_done: work,
        work_hours: hours,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PUT /api/activities/:id/approve
exports.approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code } = req.body || {};

    if (String(code || '').trim() !== 'mishop') {
      return res.status(403).json({ success: false, error: 'Kode ACC salah' });
    }

    const { data: row, error: getErr } = await supabase
      .from('activity_logs')
      .select('id, approved')
      .eq('id', id)
      .single();

    if (getErr) throw getErr;
    if (!row) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    if (row.approved) return res.json({ success: true, data: row });

    const { data, error } = await supabase
      .from('activity_logs')
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

