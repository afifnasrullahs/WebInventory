// Income Report Page (Vie & MPI)
const IncomePage = {
  report: null,
  from: '',
  to: '',

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Pendapatan Vie & MPI</h1>
          <p class="page-header-subtitle">Dihitung dari revenue harian (transaksi done + joki done) dan hanya untuk hari yang absensi sudah di-ACC</p>
        </div>
      </div>

      <div class="table-wrapper" style="margin-bottom:16px;">
        <div class="table-toolbar" style="justify-content:space-between;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">
            <div class="form-group" style="margin-bottom:0;">
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;">Dari</label>
              <input type="date" class="form-control" id="incomeFrom" style="width:180px;min-width:180px;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;">Sampai</label>
              <input type="date" class="form-control" id="incomeTo" style="width:180px;min-width:180px;">
            </div>
            <button class="btn btn-secondary" id="incomeApplyBtn" style="height:38px;"><i class="bx bx-filter"></i>Terapkan</button>
            <button class="btn btn-secondary" id="incomeResetBtn" style="height:38px;">Reset</button>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            <span>Gaji tetap: <strong style="color:var(--text-primary)">Rp50.000</strong> / hari hadir</span>
            <span style="margin:0 8px;color:var(--border-strong)">•</span>
            <span>Bonus: <strong style="color:var(--text-primary)">7%</strong> jika revenue &lt; 1jt, <strong style="color:var(--text-primary)">8%</strong> jika ≥ 1jt</span>
          </div>
        </div>
      </div>

      <div class="stats-grid" id="incomeTotals">
        ${App.loading()}
      </div>

      <div class="table-wrapper">
        <div id="incomeTable">${App.loading()}</div>
      </div>
    `;

    document.getElementById('incomeFrom').value = this.from || '';
    document.getElementById('incomeTo').value = this.to || '';

    document.getElementById('incomeApplyBtn').addEventListener('click', () => {
      this.from = document.getElementById('incomeFrom').value;
      this.to = document.getElementById('incomeTo').value;
      this.loadData();
    });
    document.getElementById('incomeResetBtn').addEventListener('click', () => {
      this.from = '';
      this.to = '';
      document.getElementById('incomeFrom').value = '';
      document.getElementById('incomeTo').value = '';
      this.loadData();
    });

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getIncomeReport({ from: this.from, to: this.to });
      this.report = res.data;
      this.renderTotals();
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
      document.getElementById('incomeTotals').innerHTML = '';
      document.getElementById('incomeTable').innerHTML = `<div class="empty-state"><i class="bx bx-error-circle"></i><h3>Gagal memuat</h3><p>${err.message}</p></div>`;
    }
  },

  renderTotals() {
    const el = document.getElementById('incomeTotals');
    const totals = this.report?.totals || {};
    const vie = totals.vie || { days_present: 0, base_salary_total: 0, bonus_total: 0, income_total: 0 };
    const mpi = totals.mpi || { days_present: 0, base_salary_total: 0, bonus_total: 0, income_total: 0 };

    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon purple"><i class="bx bx-user"></i></div>
        <div class="stat-info">
          <h3>${App.formatPrice(vie.income_total || 0)}</h3>
          <p>Total Vie (host) — ${vie.days_present || 0} hari ACC</p>
          <div style="margin-top:8px;font-size:12px;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap;">
            <span>Gaji: <strong style="color:var(--text-primary)">${App.formatPrice(vie.base_salary_total || 0)}</strong></span>
            <span>Bonus: <strong style="color:var(--text-primary)">${App.formatPrice(vie.bonus_total || 0)}</strong></span>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="bx bx-user"></i></div>
        <div class="stat-info">
          <h3>${App.formatPrice(mpi.income_total || 0)}</h3>
          <p>Total MPI (admin) — ${mpi.days_present || 0} hari ACC</p>
          <div style="margin-top:8px;font-size:12px;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap;">
            <span>Gaji: <strong style="color:var(--text-primary)">${App.formatPrice(mpi.base_salary_total || 0)}</strong></span>
            <span>Bonus: <strong style="color:var(--text-primary)">${App.formatPrice(mpi.bonus_total || 0)}</strong></span>
          </div>
        </div>
      </div>
    `;
  },

  renderTable() {
    const el = document.getElementById('incomeTable');
    const rows = this.report?.per_day || [];
    if (!rows.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-calendar"></i><h3>Belum ada data</h3><p>Pastikan ada transaksi/joki done dan absensi sudah di-ACC.</p></div>`;
      return;
    }

    const fmtPct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Revenue</th>
            <th>Rate Bonus</th>
            <th>Vie (host)</th>
            <th>MPI (admin)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const vie = r.workers?.vie || {};
            const mpi = r.workers?.mpi || {};
            const cell = (w) => w.present
              ? `<div style="display:flex;flex-direction:column;gap:4px;">
                  <div><strong>${App.formatPrice(w.total_income || 0)}</strong> <span style="color:var(--text-muted);font-size:12px;">(ACC)</span></div>
                  <div style="font-size:12px;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap;">
                    <span>Gaji: <strong style="color:var(--text-primary)">${App.formatPrice(w.base_salary || 0)}</strong></span>
                    <span>Bonus: <strong style="color:var(--text-primary)">${App.formatPrice(w.bonus_amount || 0)}</strong></span>
                  </div>
                </div>`
              : `<span style="color:var(--text-muted);font-size:13px;">Tidak dihitung (belum ACC)</span>`;

            return `
              <tr>
                <td style="font-size:12px;color:var(--text-muted)">${this.formatDateOnly(r.date)}</td>
                <td class="price">${App.formatPrice(r.revenue || 0)}</td>
                <td><span class="badge badge-item">${fmtPct(r.bonus_rate)}</span></td>
                <td>${cell(vie)}</td>
                <td>${cell(mpi)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  formatDateOnly(dateStr) {
    try {
      const d = new Date(`${dateStr}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return dateStr || '-';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr || '-';
    }
  },
};

