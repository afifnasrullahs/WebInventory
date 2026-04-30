// Dashboard Page
const DashboardPage = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p class="page-header-subtitle">Overview sistem inventory & transaksi</p>
        </div>
      </div>
      <div class="stats-grid" id="statsGrid">
        ${App.loading()}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <h3 class="section-title"><i class="bx bx-receipt"></i>Transaksi Terbaru</h3>
          <div class="card" id="recentTransactions">${App.loading()}</div>
        </div>
        <div>
          <h3 class="section-title"><i class="bx bx-joystick"></i>Joki Terbaru</h3>
          <div class="card" id="recentJoki">${App.loading()}</div>
        </div>
      </div>
    `;
    await this.loadData();
  },

  async loadData() {
    try {
      const [itemsRes, setsRes, txnRes, jokiRes] = await Promise.all([
        API.getItems(),
        API.getSets(),
        API.getTransactions(),
        API.getJokiOrders(),
      ]);

      const items = itemsRes.data;
      const sets = setsRes.data;
      const txns = txnRes.data;
      const jokis = jokiRes.data;

      const pendingTxn = txns.filter((t) => t.status === 'pending').length;
      const activeJoki = jokis.filter((j) => j.status === 'pending' || j.status === 'in_progress').length;
      const revenueTransactions = txns
        .filter((t) => t.status === 'done')
        .reduce((s, t) => s + (parseFloat(t.total_price) || 0), 0);
      const revenueJoki = jokis
        .filter((j) => j.status === 'done')
        .reduce((s, j) => s + (parseFloat(j.price) || 0), 0);
      const totalRevenue = revenueTransactions + revenueJoki;

      document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon purple"><i class="bx bx-package"></i></div>
          <div class="stat-info"><h3>${items.length}</h3><p>Total Items</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="bx bx-collection"></i></div>
          <div class="stat-info"><h3>${sets.length}</h3><p>Total Sets</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="bx bx-time-five"></i></div>
          <div class="stat-info"><h3>${pendingTxn}</h3><p>Pending Transaksi</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rose"><i class="bx bx-joystick"></i></div>
          <div class="stat-info"><h3>${activeJoki}</h3><p>Active Joki</p></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon emerald"><i class="bx bx-wallet"></i></div>
          <div class="stat-info"><h3>${App.formatPrice(totalRevenue)}</h3><p>Revenue (Done)</p></div>
        </div>
      `;

      // Recent transactions
      const recentTxn = txns.slice(0, 5);
      document.getElementById('recentTransactions').innerHTML = recentTxn.length
        ? `<table><thead><tr><th>Buyer</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>
          ${recentTxn.map((t) => `<tr>
            <td>${t.buyer_name}</td>
            <td class="price">${App.formatPrice(t.total_price)}</td>
            <td>${App.statusBadge(t.status)}</td>
            <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(t.created_at)}</td>
          </tr>`).join('')}
          </tbody></table>`
        : '<div class="empty-state"><i class="bx bx-receipt"></i><p>Belum ada transaksi</p></div>';

      // Recent joki
      const recentJoki = jokis.slice(0, 5);
      document.getElementById('recentJoki').innerHTML = recentJoki.length
        ? `<table><thead><tr><th>Customer</th><th>Service</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>
          ${recentJoki.map((j) => `<tr>
            <td>${j.customer_name}</td>
            <td>${j.service_name}</td>
            <td>${App.statusBadge(j.status)}</td>
            <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(j.created_at)}</td>
          </tr>`).join('')}
          </tbody></table>`
        : '<div class="empty-state"><i class="bx bx-joystick"></i><p>Belum ada order joki</p></div>';
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },
};
