// Activity / Absensi Page
const ActivityPage = {
  logs: [],
  filterStatus: '',
  sort: { sortBy: 'created_at', sortDir: 'desc' },

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Laporan Aktivitas</h1>
          <p class="page-header-subtitle">Absensi sederhana untuk host/admin</p>
        </div>
        <button class="btn btn-primary" id="addActivityBtn"><i class="bx bx-plus"></i>Tambah Aktivitas</button>
      </div>
      <div class="table-wrapper" style="margin-bottom:16px;">
        <div class="table-toolbar">
          <select class="form-control" id="activityStatus" style="width:190px;min-width:190px;">
            <option value="">Semua</option>
            <option value="pending">Belum di-ACC</option>
            <option value="approved">Sudah di-ACC</option>
          </select>
          <select class="form-control" id="activitySort" style="width:240px;min-width:240px;">
            <option value="created_at:desc">Terbaru</option>
            <option value="created_at:asc">Terlama</option>
            <option value="activity_date:desc">Tanggal: terbaru</option>
            <option value="activity_date:asc">Tanggal: terlama</option>
            <option value="name:asc">Nama: A → Z</option>
            <option value="name:desc">Nama: Z → A</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <div id="activityTable">${App.loading()}</div>
      </div>
    `;

    document.getElementById('addActivityBtn').addEventListener('click', () => this.showForm());
    document.getElementById('activityStatus').addEventListener('change', () => {
      this.filterStatus = document.getElementById('activityStatus').value;
      this.loadData();
    });
    document.getElementById('activitySort').addEventListener('change', () => {
      const [sortBy, sortDir] = (document.getElementById('activitySort').value || 'created_at:desc').split(':');
      this.sort = { sortBy, sortDir };
      this.loadData();
    });

    document.getElementById('activityStatus').value = this.filterStatus || '';
    document.getElementById('activitySort').value = `${this.sort.sortBy}:${this.sort.sortDir}`;

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getActivities({
        status: this.filterStatus,
        sortBy: this.sort.sortBy,
        sortDir: this.sort.sortDir,
      });
      this.logs = res.data || [];
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  roleBadge(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'admin') return `<span class="badge badge-done">admin</span>`;
    return `<span class="badge badge-pending">host</span>`;
  },

  approvedBadge(approved) {
    return approved
      ? `<span class="badge badge-done">Approved</span>`
      : `<span class="badge badge-pending">Pending</span>`;
  },

  renderTable() {
    const el = document.getElementById('activityTable');
    if (!this.logs.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-notepad"></i><h3>Belum ada aktivitas</h3><p>Tambahkan laporan aktivitas pertama.</p></div>`;
      return;
    }

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>Role</th>
            <th>Apa yang dikerjakan</th>
            <th>Jam Kerja</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${this.logs.map((row) => `
            <tr>
              <td style="font-size:12px;color:var(--text-muted)">${this.formatDateOnly(row.activity_date || row.created_at)}</td>
              <td><strong>${String(row.name || '-')}</strong></td>
              <td>${this.roleBadge(row.role)}</td>
              <td style="white-space:normal;word-break:break-word;max-width:520px;">${this.escapeHtml(row.work_done || '')}</td>
              <td>${row.work_hours === null || row.work_hours === undefined ? '—' : `<span class="badge badge-item">${Number(row.work_hours).toFixed(1)} jam</span>`}</td>
              <td>${this.approvedBadge(row.approved)}</td>
              <td>
                <div class="actions">
                  ${row.approved ? '' : `
                    <button class="btn btn-sm btn-success" onclick="ActivityPage.approve('${row.id}')" title="ACC Kehadiran">
                      <i class="bx bx-check"></i>ACC
                    </button>
                  `}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  formatDateOnly(dateLike) {
    try {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '-';
    }
  },

  escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  showForm() {
    App.openModal('Tambah Laporan Aktivitas', `
      <div class="detail-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
        <div class="detail-item">
          <label>Tanggal</label>
          <p>${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div class="detail-item">
          <label>Jam kerja (opsional)</label>
          <input type="number" class="form-control" id="actHours" placeholder="e.g. 6" min="0" step="0.5">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nama</label>
          <select class="form-control" id="actName">
            <option value="vie">vie</option>
            <option value="mpi">mpi</option>
          </select>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select class="form-control" id="actRole">
            <option value="host">host</option>
            <option value="admin">admin</option>
          </select>
          <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;">Host untuk vie, Admin untuk mpi</small>
        </div>
      </div>
      <div class="form-group">
        <label>Apa yang dikerjakan</label>
        <textarea class="form-control" id="actWork" rows="4" placeholder="Tulis aktivitas hari ini..."></textarea>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="saveActivityBtn">Simpan</button>
    `, 'lg');

    const syncRole = () => {
      const name = document.getElementById('actName').value;
      const roleSelect = document.getElementById('actRole');
      roleSelect.value = name === 'vie' ? 'host' : 'admin';
    };
    document.getElementById('actName').addEventListener('change', syncRole);
    syncRole();

    document.getElementById('saveActivityBtn').addEventListener('click', () => this.save());
  },

  async save() {
    const name = document.getElementById('actName').value;
    const role = document.getElementById('actRole').value;
    const work_done = document.getElementById('actWork').value.trim();
    const work_hours = document.getElementById('actHours').value;

    if (!work_done) {
      App.toast('Apa yang dikerjakan wajib diisi', 'error');
      return;
    }

    try {
      await API.createActivity({
        name,
        role,
        work_done,
        work_hours: work_hours === '' ? undefined : work_hours,
      });
      App.toast('Aktivitas berhasil disimpan');
      App.closeModal();
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  approve(id) {
    App.openModal('ACC Kehadiran', `
      <p style="margin-bottom:10px;">Masukkan kode untuk ACC kehadiran.</p>
      <div class="form-group">
        <label>Kode</label>
        <input type="password" class="form-control" id="approveCode" placeholder="Masukkan kode">
        <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;">Hanya owner / yang tahu kode yang bisa ACC</small>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-success" id="confirmApproveBtn"><i class="bx bx-check"></i>ACC</button>
    `);

    document.getElementById('confirmApproveBtn').addEventListener('click', async () => {
      const code = document.getElementById('approveCode').value.trim();
      if (!code) {
        App.toast('Kode wajib diisi', 'error');
        return;
      }
      try {
        await API.approveActivity(id, code);
        App.toast('Kehadiran berhasil di-ACC');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },
};

