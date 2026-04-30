const supabase = require('../config/database');

const WORKERS = [
  { name: 'vie', role: 'host' },
  { name: 'mpi', role: 'admin' },
];

const BASE_SALARY = 50000;

function toDateKey(dateLike) {
  // normalized YYYY-MM-DD in local time is tricky; use ISO date from Date object
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function calcBonusRate(revenue) {
  return revenue >= 1000000 ? 0.08 : 0.07;
}

// GET /api/income
// Returns: revenueByDay + incomeByWorker (per-day + totals), only counting days where worker has approved activity.
exports.getReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Optional date range filtering (YYYY-MM-DD). Applied by created_at for txns/joki and activity_date for logs.
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

    // Fetch minimal fields
    let txnQ = supabase
      .from('transactions')
      .select('created_at,total_price,status')
      .eq('status', 'done');
    let jokiQ = supabase
      .from('joki_orders')
      .select('created_at,price,status')
      .eq('status', 'done');
    let actQ = supabase
      .from('activity_logs')
      .select('activity_date,name,role,approved')
      .eq('approved', true);

    if (fromDate) {
      txnQ = txnQ.gte('created_at', fromDate.toISOString());
      jokiQ = jokiQ.gte('created_at', fromDate.toISOString());
      actQ = actQ.gte('activity_date', from);
    }
    if (toDate) {
      txnQ = txnQ.lte('created_at', toDate.toISOString());
      jokiQ = jokiQ.lte('created_at', toDate.toISOString());
      actQ = actQ.lte('activity_date', to);
    }

    const [txnsRes, jokisRes, actsRes] = await Promise.all([txnQ, jokiQ, actQ]);
    if (txnsRes.error) throw txnsRes.error;
    if (jokisRes.error) throw jokisRes.error;
    if (actsRes.error) throw actsRes.error;

    const revenueByDay = new Map(); // date -> revenue
    const addRevenue = (dateKey, amount) => {
      if (!dateKey) return;
      revenueByDay.set(dateKey, (revenueByDay.get(dateKey) || 0) + (Number(amount) || 0));
    };

    (txnsRes.data || []).forEach((t) => addRevenue(toDateKey(t.created_at), t.total_price));
    (jokisRes.data || []).forEach((j) => addRevenue(toDateKey(j.created_at), j.price));

    // Attendance by worker+day (unique)
    const attendance = new Map(); // `${name}|${date}` -> true
    (actsRes.data || []).forEach((a) => {
      const name = String(a.name || '').trim().toLowerCase();
      const role = String(a.role || '').trim().toLowerCase();
      const dateKey = String(a.activity_date || '').slice(0, 10);
      const isWorker = WORKERS.some((w) => w.name === name && w.role === role);
      if (!isWorker || !dateKey) return;
      attendance.set(`${name}|${dateKey}`, true);
    });

    // Build per-day rows where at least one worker is present (approved)
    const allDates = Array.from(revenueByDay.keys()).sort(); // YYYY-MM-DD

    const perDay = allDates.map((date) => {
      const revenue = revenueByDay.get(date) || 0;
      const rate = calcBonusRate(revenue);
      const bonus = revenue * rate;
      const rows = {};

      WORKERS.forEach((w) => {
        const present = attendance.has(`${w.name}|${date}`);
        rows[w.name] = present
          ? {
              present: true,
              base_salary: BASE_SALARY,
              bonus_rate: rate,
              bonus_amount: bonus,
              total_income: BASE_SALARY + bonus,
            }
          : {
              present: false,
              base_salary: 0,
              bonus_rate: rate,
              bonus_amount: 0,
              total_income: 0,
            };
      });

      return {
        date,
        revenue,
        bonus_rate: rate,
        bonus_amount: bonus,
        workers: rows,
      };
    });

    // Totals per worker (only days present)
    const totals = {};
    WORKERS.forEach((w) => {
      const daysPresent = perDay.filter((d) => d.workers[w.name]?.present);
      const totalBase = daysPresent.reduce((s, d) => s + (d.workers[w.name].base_salary || 0), 0);
      const totalBonus = daysPresent.reduce((s, d) => s + (d.workers[w.name].bonus_amount || 0), 0);
      totals[w.name] = {
        name: w.name,
        role: w.role,
        days_present: daysPresent.length,
        base_salary_total: totalBase,
        bonus_total: totalBonus,
        income_total: totalBase + totalBonus,
      };
    });

    res.json({
      success: true,
      data: {
        from: from || null,
        to: to || null,
        rules: {
          base_salary: BASE_SALARY,
          bonus_lt_1jt: 0.07,
          bonus_gte_1jt: 0.08,
        },
        totals,
        per_day: perDay,
      },
    });
  } catch (err) {
    next(err);
  }
};

