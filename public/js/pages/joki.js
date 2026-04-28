// Joki Page
const JokiPage = {
  services: [],
  orders: [],
  activeTab: 'orders',
  orderFilter: '',

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Joki</h1>
          <p class="page-header-subtitle">Kelola layanan dan order joki</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary" id="manageServicesBtn"><i class="bx bx-cog"></i>Kelola Layanan</button>
          <button class="btn btn-primary" id="createJokiOrderBtn"><i class="bx bx-plus"></i>Buat Order</button>
        </div>
      </div>
      <div class="page-tabs">
        <button class="page-tab active" data-tab="orders">Orders</button>
        <button class="page-tab" data-tab="services">Layanan Joki</button>
      </div>
      <div id="jokiContent">${App.loading()}</div>
    `;

    document.getElementById('manageServicesBtn').addEventListener('click', () => {
      this.activeTab = 'services';
      this.updateTabs();
      this.renderContent();
    });

    document.getElementById('createJokiOrderBtn').addEventListener('click', () => this.showCreateOrder());

    document.querySelectorAll('.page-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.updateTabs();
        this.renderContent();
      });
    });

    await this.loadData();
  },

  updateTabs() {
    document.querySelectorAll('.page-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === this.activeTab);
    });
  },

  async loadData() {
    try {
      const [servicesRes, ordersRes] = await Promise.all([
        API.getJokiServices(),
        API.getJokiOrders(this.orderFilter),
      ]);
      this.services = servicesRes.data;
      this.orders = ordersRes.data;
      this.renderContent();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderContent() {
    if (this.activeTab === 'orders') {
      this.renderOrders();
    } else {
      this.renderServices();
    }
  },

  renderOrders() {
    const el = document.getElementById('jokiContent');
    el.innerHTML = `
      <div class="filter-tabs" id="jokiOrderFilters">
        <button class="filter-tab ${this.orderFilter === '' ? 'active' : ''}" data-status="">Semua</button>
        <button class="filter-tab ${this.orderFilter === 'pending' ? 'active' : ''}" data-status="pending">Pending</button>
        <button class="filter-tab ${this.orderFilter === 'in_progress' ? 'active' : ''}" data-status="in_progress">In Progress</button>
        <button class="filter-tab ${this.orderFilter === 'done' ? 'active' : ''}" data-status="done">Done</button>
        <button class="filter-tab ${this.orderFilter === 'cancelled' ? 'active' : ''}" data-status="cancelled">Cancelled</button>
      </div>
      <div class="table-wrapper" id="jokiOrdersTable">
        ${this.orders.length ? `
          <table>
            <thead><tr><th>Customer</th><th>TikTok USN</th><th>Layanan</th><th>Harga</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
            <tbody>
              ${this.orders.map((o) => `
                <tr>
                  <td><strong>${o.customer_name}</strong></td>
                  <td>@${o.tiktok_usn}</td>
                  <td>${o.service_name}</td>
                  <td class="price">${App.formatPrice(o.price)}</td>
                  <td>${App.statusBadge(o.status)}</td>
                  <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(o.created_at)}</td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-sm btn-secondary" onclick="JokiPage.showOrderDetail('${o.id}')"><i class="bx bx-show"></i></button>
                      ${o.status === 'pending' ? `
                        <button class="btn btn-sm btn-warning" onclick="JokiPage.advanceStatus('${o.id}', 'in_progress')" title="Start"><i class="bx bx-play"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="JokiPage.cancelOrder('${o.id}')" title="Cancel"><i class="bx bx-x"></i></button>
                      ` : ''}
                      ${o.status === 'in_progress' ? `
                        <button class="btn btn-sm btn-success" onclick="JokiPage.advanceStatus('${o.id}', 'done')" title="Complete"><i class="bx bx-check"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="JokiPage.cancelOrder('${o.id}')" title="Cancel"><i class="bx bx-x"></i></button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="empty-state"><i class="bx bx-joystick"></i><h3>Tidak ada order joki</h3><p>Buat order pertama untuk memulai</p></div>`}
      </div>
    `;

    document.getElementById('jokiOrderFilters').addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-tab')) {
        this.orderFilter = e.target.dataset.status;
        this.loadData();
      }
    });
  },

  renderServices() {
    const el = document.getElementById('jokiContent');
    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-primary btn-sm" onclick="JokiPage.showServiceForm()"><i class="bx bx-plus"></i>Tambah Layanan</button>
      </div>
      <div class="table-wrapper">
        ${this.services.length ? `
          <table>
            <thead><tr><th>Nama Layanan</th><th>Harga</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
            <tbody>
              ${this.services.map((s) => `
                <tr>
                  <td><strong>${s.name}</strong></td>
                  <td class="price">${App.formatPrice(s.price)}</td>
                  <td style="color:var(--text-secondary);font-size:13px;">${s.description || '-'}</td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-icon btn-secondary" onclick="JokiPage.showServiceForm('${s.id}')" title="Edit"><i class="bx bx-edit-alt"></i></button>
                      <button class="btn btn-icon btn-danger" onclick="JokiPage.deleteService('${s.id}', '${s.name}')" title="Hapus"><i class="bx bx-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="empty-state"><i class="bx bx-cog"></i><h3>Belum ada layanan joki</h3><p>Tambahkan layanan pertama</p></div>`}
      </div>
    `;
  },

  // Service Forms
  showServiceForm(editId = null) {
    const service = editId ? this.services.find((s) => s.id === editId) : null;
    const title = service ? 'Edit Layanan Joki' : 'Tambah Layanan Joki';

    App.openModal(title, `
      <div class="form-group">
        <label>Nama Layanan</label>
        <input type="text" class="form-control" id="svcName" placeholder="e.g. Joki Level" value="${service?.name || ''}">
      </div>
      <div class="form-group">
        <label>Harga (IDR)</label>
        <input type="number" class="form-control" id="svcPrice" placeholder="0" value="${service?.price || ''}">
      </div>
      <div class="form-group">
        <label>Deskripsi</label>
        <textarea class="form-control" id="svcDescription" rows="3" placeholder="Deskripsi layanan...">${service?.description || ''}</textarea>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="saveSvcBtn">${service ? 'Update' : 'Simpan'}</button>
    `);

    document.getElementById('saveSvcBtn').addEventListener('click', async () => {
      const name = document.getElementById('svcName').value.trim();
      const price = document.getElementById('svcPrice').value;
      const description = document.getElementById('svcDescription').value.trim();

      if (!name || !price) {
        App.toast('Nama dan harga harus diisi', 'error');
        return;
      }

      try {
        if (editId) {
          await API.updateJokiService(editId, { name, price: parseFloat(price), description });
          App.toast('Layanan berhasil diupdate');
        } else {
          await API.createJokiService({ name, price: parseFloat(price), description });
          App.toast('Layanan berhasil ditambahkan');
        }
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  async deleteService(id, name) {
    App.openModal('Hapus Layanan', `
      <p>Yakin ingin menghapus layanan <strong>${name}</strong>?</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmDelSvcBtn"><i class="bx bx-trash"></i>Hapus</button>
    `);

    document.getElementById('confirmDelSvcBtn').addEventListener('click', async () => {
      try {
        await API.deleteJokiService(id);
        App.toast('Layanan berhasil dihapus');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  // Create Order
  async showCreateOrder() {
    if (!this.services.length) {
      try {
        const res = await API.getJokiServices();
        this.services = res.data;
      } catch (err) {}
    }

    if (!this.services.length) {
      App.toast('Tambahkan layanan joki terlebih dahulu', 'error');
      return;
    }

    App.openModal('Buat Order Joki', `
      <div class="form-group">
        <label>Layanan Joki</label>
        <select class="form-control" id="jokiServiceSelect">
          ${this.services.map((s) => `<option value="${s.id}" data-price="${s.price}">${s.name} — ${App.formatPrice(s.price)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nama Customer</label>
        <input type="text" class="form-control" id="jokiCustomerName" placeholder="Nama customer">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Username Game</label>
          <input type="text" class="form-control" id="jokiGameUsername" placeholder="Username login">
        </div>
        <div class="form-group">
          <label>Password Game</label>
          <input type="text" class="form-control" id="jokiGamePassword" placeholder="Password login">
        </div>
      </div>
      <div class="form-group">
        <label>TikTok USN</label>
        <input type="text" class="form-control" id="jokiTiktokUsn" placeholder="@username_tiktok">
      </div>
      <div class="form-group">
        <label>Harga Override (opsional)</label>
        <input type="number" class="form-control" id="jokiPriceOverride" placeholder="Kosongkan untuk harga default">
      </div>
      <div class="form-group">
        <label>Catatan</label>
        <textarea class="form-control" id="jokiNotes" rows="2" placeholder="Catatan tambahan..."></textarea>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="submitJokiOrderBtn"><i class="bx bx-check"></i>Buat Order</button>
    `, 'lg');

    document.getElementById('submitJokiOrderBtn').addEventListener('click', async () => {
      const joki_service_id = document.getElementById('jokiServiceSelect').value;
      const customer_name = document.getElementById('jokiCustomerName').value.trim();
      const game_username = document.getElementById('jokiGameUsername').value.trim();
      const game_password = document.getElementById('jokiGamePassword').value.trim();
      const tiktok_usn = document.getElementById('jokiTiktokUsn').value.trim();
      const priceOverride = document.getElementById('jokiPriceOverride').value;
      const notes = document.getElementById('jokiNotes').value.trim();

      if (!customer_name || !game_username || !game_password || !tiktok_usn) {
        App.toast('Semua field wajib harus diisi', 'error');
        return;
      }

      const data = { joki_service_id, customer_name, game_username, game_password, tiktok_usn, notes };
      if (priceOverride) data.price = parseFloat(priceOverride);

      try {
        await API.createJokiOrder(data);
        App.toast('Order joki berhasil dibuat!');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  // Order Detail
  async showOrderDetail(id) {
    try {
      const res = await API.getJokiOrder(id);
      const o = res.data;

      App.openModal('Detail Order Joki', `
        <div class="detail-grid">
          <div class="detail-item"><label>Customer</label><p>${o.customer_name}</p></div>
          <div class="detail-item"><label>Status</label><p>${App.statusBadge(o.status)}</p></div>
          <div class="detail-item"><label>Layanan</label><p>${o.service_name}</p></div>
          <div class="detail-item"><label>Harga</label><p class="price">${App.formatPrice(o.price)}</p></div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><label>Username Game</label><p>${o.game_username}</p></div>
          <div class="detail-item"><label>Password Game</label><p>${o.game_password}</p></div>
          <div class="detail-item"><label>TikTok USN</label><p>@${o.tiktok_usn}</p></div>
          <div class="detail-item"><label>Tanggal</label><p>${App.formatDate(o.created_at)}</p></div>
        </div>
        ${o.notes ? `<div class="detail-item" style="margin-top:8px"><label>Catatan</label><p>${o.notes}</p></div>` : ''}
      `, `<button class="btn btn-secondary" onclick="App.closeModal()">Tutup</button>`, 'lg');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async advanceStatus(id, newStatus) {
    try {
      await API.updateJokiOrderStatus(id, newStatus);
      const labels = { in_progress: 'dimulai', done: 'selesai' };
      App.toast(`Order berhasil ${labels[newStatus]}`);
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async cancelOrder(id) {
    App.openModal('Cancel Order Joki', `
      <p>Yakin ingin cancel order ini?</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmCancelJokiBtn"><i class="bx bx-x"></i>Cancel Order</button>
    `);

    document.getElementById('confirmCancelJokiBtn').addEventListener('click', async () => {
      try {
        await API.cancelJokiOrder(id);
        App.toast('Order joki di-cancel');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },
};
