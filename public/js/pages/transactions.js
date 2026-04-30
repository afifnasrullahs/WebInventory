// Transactions Page
const TransactionsPage = {
  transactions: [],
  allItems: [],
  allSets: [],
  currentFilter: '',
  searchQuery: '',
  txnItems: [],
  productSearchQuery: '',
  sort: { sortBy: 'created_at', sortDir: 'desc' },
  summaryHydratedIds: new Set(),

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Transaksi</h1>
          <p class="page-header-subtitle">Kelola transaksi penjualan</p>
        </div>
        <button class="btn btn-primary" id="createTxnBtn"><i class="bx bx-plus"></i>Buat Transaksi</button>
      </div>
      <div class="table-wrapper" style="margin-bottom:20px;">
        <div class="table-toolbar">
          <input type="text" class="form-control search-input" id="txnSearch" placeholder="Cari transaksi, username, atau item...">
          <select class="form-control" id="txnSort" style="width:240px;min-width:240px;">
            <option value="created_at:desc">Terbaru</option>
            <option value="created_at:asc">Terlama</option>
            <option value="total_price:asc">Total: kecil → besar</option>
            <option value="total_price:desc">Total: besar → kecil</option>
          </select>
        </div>
      </div>
      <div class="filter-tabs" id="txnFilters">
        <button class="filter-tab active" data-status="">Semua</button>
        <button class="filter-tab" data-status="pending">Pending</button>
        <button class="filter-tab" data-status="done">Done</button>
        <button class="filter-tab" data-status="cancelled">Cancelled</button>
      </div>
      <div class="table-wrapper">
        <div id="txnTable">${App.loading()}</div>
      </div>
    `;

    document.getElementById('createTxnBtn').addEventListener('click', () => this.showCreateForm());
    document.getElementById('txnSearch').addEventListener('input', () => this.renderTable());
    document.getElementById('txnSort').addEventListener('change', () => {
      const [sortBy, sortDir] = (document.getElementById('txnSort').value || 'created_at:desc').split(':');
      this.sort = { sortBy, sortDir };
      this.loadData();
    });
    document.getElementById('txnFilters').addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-tab')) {
        document.querySelectorAll('#txnFilters .filter-tab').forEach((t) => t.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.status;
        this.loadData();
      }
    });

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getTransactions(this.currentFilter, this.sort);
      this.transactions = res.data;
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  getVisibleTransactions() {
    const search = (document.getElementById('txnSearch')?.value || '').trim().toLowerCase();
    this.searchQuery = search;

    if (!search) {
      return this.transactions;
    }

    return this.transactions.filter((txn) => {
      const summaryText = (txn.summary || []).map((item) => `${item.name} ${item.quantity}`).join(' ').toLowerCase();
      return [
        txn.buyer_name,
        txn.roblox_username,
        txn.status,
        summaryText,
      ].some((value) => (value || '').toLowerCase().includes(search));
    });
  },

  renderSummary(txn) {
    const summary = txn.summary || [];
    if (!summary.length) {
      return '<span style="color:var(--text-muted);font-size:13px;">-</span>';
    }

    return `
      <div style="display:flex;flex-direction:column;gap:4px;max-width:420px;">
        ${summary.map((item) => `
          <div style="display:flex;align-items:center;gap:6px;min-width:0;">
            <span style="color:var(--text-muted);flex-shrink:0;">-</span>
            <span style="white-space:normal;word-break:break-word;">${item.name}</span>
            <span style="color:var(--accent-secondary);font-weight:700;flex-shrink:0;">×${item.quantity}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderTable() {
    const el = document.getElementById('txnTable');
    const transactions = this.getVisibleTransactions();

    if (!transactions.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-receipt"></i><h3>Tidak ada transaksi</h3><p>Buat transaksi pertama untuk memulai</p></div>`;
      return;
    }

    el.innerHTML = `
      <table>
        <thead><tr><th>Buyer</th><th>Roblox</th><th>Item / Qty</th><th>Total</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody>
          ${transactions.map((txn) => `
            <tr>
              <td><strong>${txn.buyer_name}</strong></td>
              <td>@${txn.roblox_username || '-'}</td>
              <td>${this.renderSummary(txn)}</td>
              <td class="price">${App.formatPrice(txn.total_price)}</td>
              <td>${App.statusBadge(txn.status)}</td>
              <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(txn.created_at)}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="TransactionsPage.showEditForm('${txn.id}')"><i class="bx bx-edit-alt"></i>Edit</button>
                  ${txn.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="TransactionsPage.markDone('${txn.id}')" title="Selesai"><i class="bx bx-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="TransactionsPage.cancelTxn('${txn.id}')" title="Cancel"><i class="bx bx-x"></i></button>
                  ` : ''}
                  ${txn.status === 'cancelled' ? `
                    <button class="btn btn-sm btn-danger" onclick="TransactionsPage.deleteCancelledTxn('${txn.id}')" title="Hapus Permanen">
                      <i class="bx bx-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Fallback: hydrate missing summaries from transaction detail endpoint.
    // This handles legacy rows where list summary can be empty.
    const missingIds = transactions
      .filter((txn) => !(txn.summary || []).length && !this.summaryHydratedIds.has(txn.id))
      .map((txn) => txn.id);
    if (missingIds.length) {
      this.hydrateMissingSummaries(missingIds);
    }
  },

  async hydrateMissingSummaries(ids) {
    if (!ids?.length) return;
    ids.forEach((id) => this.summaryHydratedIds.add(id));

    try {
      const responses = await Promise.all(
        ids.map((id) => API.getTransaction(id).catch(() => null))
      );

      const byId = new Map(this.transactions.map((t) => [t.id, t]));

      responses.forEach((res) => {
        const txn = res?.data;
        if (!txn?.id) return;

        const details = txn.details || [];
        const summary = [];

        details.forEach((d) => {
          const breakdown = d.breakdown || [];
          if (breakdown.length) {
            breakdown.forEach((b) => {
              summary.push({
                name: b.item_name || 'Unknown',
                quantity: b.quantity || 0,
                type: 'item',
              });
            });
            return;
          }

          summary.push({
            name: d.ref_name || (d.type === 'set' ? 'Set' : 'Item'),
            quantity: d.quantity || 0,
            type: d.type || 'item',
          });
        });

        const local = byId.get(txn.id);
        if (local && summary.length) {
          local.summary = summary;
        }
      });

      this.renderTable();
    } catch (_) {
      // Keep silent; table still renders with "-"
    }
  },

  async showCreateForm() {
    this.txnItems = [];
    this.productSearchQuery = '';

    try {
      const [itemsRes, setsRes] = await Promise.all([API.getItems(), API.getSets()]);
      this.allItems = itemsRes.data;
      this.allSets = setsRes.data;
    } catch (err) {
      App.toast(err.message, 'error');
      return;
    }

    App.openModal('Buat Transaksi', `
      <div class="form-group">
        <label>Nama Buyer</label>
        <input type="text" class="form-control" id="txnBuyerName" placeholder="Nama pembeli">
      </div>
      <div class="form-group">
        <label>Username Roblox</label>
        <input type="text" class="form-control" id="txnRobloxUsername" placeholder="Username Roblox">
      </div>

      <hr style="border-color:var(--border-subtle);margin:18px 0;">

      <h4 class="section-title"><i class="bx bx-cart-add"></i>Tambah Produk</h4>
      <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;margin-bottom:18px;">
        <div class="form-group" style="margin-bottom:10px;">
          <input type="text" class="form-control search-input" id="txnProductSearch" placeholder="Cari produk yang ingin ditambahkan...">
        </div>
        <div class="form-row" style="grid-template-columns: 100px 1fr auto; align-items:end;">
          <div class="form-group" style="margin-bottom:0">
            <label style="font-size:11px">Tipe</label>
            <select class="form-control" id="txnProductType" style="width:100%">
              <option value="item">Item</option>
              <option value="set">Set</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label style="font-size:11px">Pilih Produk</label>
            <select class="form-control" id="txnProductSelect">
              ${this.allItems.map((i) => `<option value="${i.id}" data-price="${i.price}" data-stock="${i.stock}" data-sendqty="${i.send_quantity || 1}">${i.name} (Stok: ${i.stock})</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-sm btn-primary" id="txnAddProductBtn" style="height:38px;"><i class="bx bx-plus"></i></button>
        </div>
      </div>

      <h4 class="section-title"><i class="bx bx-list-ul"></i>Produk Dipilih</h4>
      <div id="txnItemsList" class="txn-items-list"><p style="color:var(--text-muted);font-size:13px;">Belum ada produk dipilih</p></div>

      <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:14px;color:var(--text-secondary)">Total Harga:</span>
        <span class="price" style="font-size:22px;color:var(--accent-secondary)" id="txnTotalPrice">${App.formatPrice(0)}</span>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="submitTxnBtn"><i class="bx bx-check"></i>Buat Transaksi</button>
    `, 'lg');

    document.getElementById('txnProductType').addEventListener('change', () => this.updateProductSelect());
    document.getElementById('txnProductSearch').addEventListener('input', (e) => {
      this.productSearchQuery = e.target.value.trim().toLowerCase();
      this.updateProductSelect();
    });
    document.getElementById('txnAddProductBtn').addEventListener('click', () => this.addProduct());
    document.getElementById('submitTxnBtn').addEventListener('click', () => this.submitTransaction());
  },

  getFilteredProducts(type) {
    const products = type === 'item' ? this.allItems : this.allSets;
    if (!this.productSearchQuery) return products;
    return products.filter((product) => (product.name || '').toLowerCase().includes(this.productSearchQuery));
  },

  updateProductSelect() {
    const type = document.getElementById('txnProductType').value;
    const select = document.getElementById('txnProductSelect');
    const previousValue = select.value;
    const filteredProducts = this.getFilteredProducts(type);

    if (type === 'item') {
      select.innerHTML = filteredProducts.map((i) =>
        `<option value="${i.id}" data-price="${i.price}" data-stock="${i.stock}" data-sendqty="${i.send_quantity || 1}">${i.name} (Stok: ${i.stock})</option>`
      ).join('');
    } else {
      select.innerHTML = filteredProducts.map((s) =>
        `<option value="${s.id}" data-price="${s.price}" data-stock="${s.calculated_stock}" data-sendqty="1">${s.name} (Stok: ${s.calculated_stock})</option>`
      ).join('');
    }

    if (filteredProducts.length) {
      const stillExists = filteredProducts.some((product) => product.id === previousValue);
      select.value = stillExists ? previousValue : filteredProducts[0].id;
    }
  },

  addProduct() {
    const type = document.getElementById('txnProductType').value;
    const select = document.getElementById('txnProductSelect');
    const option = select.options[select.selectedIndex];

    if (!option || !option.value) {
      App.toast('Pilih produk terlebih dahulu', 'error');
      return;
    }

    const existing = this.txnItems.find((i) => i.ref_id === option.value && i.type === type);
    if (existing) {
      App.toast('Produk sudah ada dalam daftar', 'info');
      return;
    }

    const sendQty = parseInt(option.dataset.sendqty) || 1;
    const price = parseFloat(option.dataset.price);

    this.txnItems.push({
      type,
      ref_id: option.value,
      name: option.textContent.split(' (')[0],
      quantity: 1,
      send_amount: sendQty,
      price: price,
      stock: parseInt(option.dataset.stock),
    });

    this.renderTxnItems();
  },

  renderTxnItems() {
    const el = document.getElementById('txnItemsList');
    if (!this.txnItems.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Belum ada produk dipilih</p>';
      document.getElementById('txnTotalPrice').textContent = App.formatPrice(0);
      return;
    }

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 70px 90px 100px 30px;gap:8px;padding:6px 12px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;">
        <span>Produk</span>
        <span>Qty Beli</span>
        <span>Jml Kirim</span>
        <span>Harga</span>
        <span></span>
      </div>
      ${this.txnItems.map((item, idx) => `
      <div class="txn-item-row" style="display:grid;grid-template-columns:1fr 70px 90px 100px 30px;gap:8px;align-items:center;">
        <div class="item-info" style="min-width:0;">
          <span class="badge badge-${item.type}">${item.type}</span>
          <span class="item-name">${item.name}</span>
        </div>
        <input type="number" class="form-control" value="${item.quantity}" min="1"
          onchange="TransactionsPage.updateField(${idx}, 'quantity', this.value)"
          title="Jumlah pembelian" style="padding:6px 8px;text-align:center;font-size:13px;">
        ${item.type === 'item' ? `
          <input type="number" class="form-control" value="${item.send_amount}" min="1"
            onchange="TransactionsPage.updateField(${idx}, 'send_amount', this.value)"
            title="Jumlah item yang dikirim per pembelian" style="padding:6px 8px;text-align:center;font-size:13px;">
        ` : `
          <span style="text-align:center;font-size:12px;color:var(--text-muted)">—</span>
        `}
        <input type="number" class="form-control" value="${item.price}" min="0"
          onchange="TransactionsPage.updateField(${idx}, 'price', this.value)"
          title="Harga per pembelian (bisa di-override)" style="padding:6px 8px;text-align:right;font-size:13px;">
        <button class="item-remove" onclick="TransactionsPage.removeProduct(${idx})" title="Hapus" style="justify-self:center;"><i class="bx bx-x"></i></button>
      </div>
      <div style="padding:0 12px 8px;display:flex;gap:16px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);">
        <span>Subtotal: <strong style="color:var(--text-primary)">${App.formatPrice(item.quantity * item.price)}</strong></span>
        ${item.type === 'item' ? `<span>Stok dikurangi: <strong style="color:var(--status-pending)">${item.quantity * item.send_amount}</strong></span>` : ''}
      </div>
    `).join('')}
    `;

    this.updateTotal();
  },

  updateField(idx, field, val) {
    if (field === 'price') {
      this.txnItems[idx][field] = parseFloat(val) || 0;
    } else {
      this.txnItems[idx][field] = parseInt(val) || 1;
    }
    this.renderTxnItems();
  },

  removeProduct(idx) {
    this.txnItems.splice(idx, 1);
    this.renderTxnItems();
  },

  updateTotal() {
    const total = this.txnItems.reduce((s, i) => s + i.price * i.quantity, 0);
    document.getElementById('txnTotalPrice').textContent = App.formatPrice(total);
  },

  async submitTransaction() {
    const buyer_name = document.getElementById('txnBuyerName').value.trim();
    const roblox_username = document.getElementById('txnRobloxUsername').value.trim();
    if (!buyer_name) {
      App.toast('Nama buyer harus diisi', 'error');
      return;
    }
    if (!roblox_username) {
      App.toast('Username Roblox harus diisi', 'error');
      return;
    }
    if (!this.txnItems.length) {
      App.toast('Tambahkan minimal 1 produk', 'error');
      return;
    }

    try {
      await API.createTransaction({
        buyer_name,
        roblox_username,
        items: this.txnItems.map((i) => ({
          type: i.type,
          ref_id: i.ref_id,
          quantity: i.quantity,
          price: i.price,
          send_amount: i.type === 'item' ? i.send_amount : undefined,
        })),
      });
      App.toast('Transaksi berhasil dibuat!');
      App.closeModal();
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async showEditForm(id) {
    try {
      const res = await API.getTransaction(id);
      const txn = res.data;

      // Load catalog
      const [itemsRes, setsRes] = await Promise.all([API.getItems(), API.getSets()]);
      this.allItems = itemsRes.data;
      this.allSets = setsRes.data;
      this.productSearchQuery = '';

      // Build txnItems from txn.details
      this.txnItems = (txn.details || []).map((d) => {
        if (d.type === 'item') {
          // send_amount is derived from breakdown: sent total / quantity
          const totalSent = (d.breakdown || []).reduce((s, b) => s + (b.quantity || 0), 0);
          const send_amount = Math.max(1, Math.floor(totalSent / (d.quantity || 1)) || 1);
          return {
            type: 'item',
            ref_id: d.ref_id,
            name: d.ref_name || 'Item',
            quantity: d.quantity || 1,
            send_amount,
            price: d.price || 0,
            stock: 0,
          };
        }

        return {
          type: 'set',
          ref_id: d.ref_id,
          name: d.ref_name || 'Set',
          quantity: d.quantity || 1,
          send_amount: 1,
          price: d.price || 0,
          stock: 0,
        };
      });

      App.openModal('Edit Transaksi', `
        <div class="form-group">
          <label>Nama Buyer</label>
          <input type="text" class="form-control" id="txnBuyerName" value="${txn.buyer_name || ''}" placeholder="Nama pembeli">
        </div>
        <div class="form-group">
          <label>Username Roblox</label>
          <input type="text" class="form-control" id="txnRobloxUsername" value="${txn.roblox_username || ''}" placeholder="Username Roblox">
        </div>

        <hr style="border-color:var(--border-subtle);margin:18px 0;">

        <h4 class="section-title"><i class="bx bx-cart-add"></i>Tambah / Ubah Produk</h4>
        <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;margin-bottom:18px;">
          <div class="form-group" style="margin-bottom:10px;">
            <input type="text" class="form-control search-input" id="txnProductSearch" placeholder="Cari produk yang ingin ditambahkan...">
          </div>
          <div class="form-row" style="grid-template-columns: 100px 1fr auto; align-items:end;">
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:11px">Tipe</label>
              <select class="form-control" id="txnProductType" style="width:100%">
                <option value="item">Item</option>
                <option value="set">Set</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:11px">Pilih Produk</label>
              <select class="form-control" id="txnProductSelect">
                ${this.allItems.map((i) => `<option value="${i.id}" data-price="${i.price}" data-stock="${i.stock}" data-sendqty="${i.send_quantity || 1}">${i.name} (Stok: ${i.stock})</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-sm btn-primary" id="txnAddProductBtn" style="height:38px;"><i class="bx bx-plus"></i></button>
          </div>
        </div>

        <h4 class="section-title"><i class="bx bx-list-ul"></i>Produk Dipilih</h4>
        <div id="txnItemsList" class="txn-items-list"></div>

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;color:var(--text-secondary)">Total Harga:</span>
          <span class="price" style="font-size:22px;color:var(--accent-secondary)" id="txnTotalPrice">${App.formatPrice(0)}</span>
        </div>
      `, `
        <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
        <button class="btn btn-primary" id="submitTxnBtn"><i class="bx bx-check"></i>Simpan Perubahan</button>
      `, 'lg');

      // Render current items
      this.renderTxnItems();

      document.getElementById('txnProductType').addEventListener('change', () => this.updateProductSelect());
      document.getElementById('txnProductSearch').addEventListener('input', (e) => {
        this.productSearchQuery = e.target.value.trim().toLowerCase();
        this.updateProductSelect();
      });
      document.getElementById('txnAddProductBtn').addEventListener('click', () => this.addProduct());
      document.getElementById('submitTxnBtn').addEventListener('click', () => this.submitTransactionEdit(id));
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async submitTransactionEdit(id) {
    const buyer_name = document.getElementById('txnBuyerName').value.trim();
    const roblox_username = document.getElementById('txnRobloxUsername').value.trim();

    if (!buyer_name) {
      App.toast('Nama buyer harus diisi', 'error');
      return;
    }
    if (!roblox_username) {
      App.toast('Username Roblox harus diisi', 'error');
      return;
    }
    if (!this.txnItems.length) {
      App.toast('Tambahkan minimal 1 produk', 'error');
      return;
    }

    try {
      await API.updateTransactionFull(id, {
        buyer_name,
        roblox_username,
        items: this.txnItems.map((i) => ({
          type: i.type,
          ref_id: i.ref_id,
          quantity: i.quantity,
          price: i.price,
          send_amount: i.type === 'item' ? i.send_amount : undefined,
        })),
      });
      App.toast('Transaksi berhasil diupdate');
      App.closeModal();
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async markDone(id) {
    try {
      await API.updateTransactionStatus(id, 'done');
      App.toast('Transaksi ditandai selesai');
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async cancelTxn(id) {
    App.openModal('Cancel Transaksi', `
      <p>Yakin ingin cancel transaksi ini?</p>
      <p style="color:var(--status-done);font-size:13px;margin-top:8px;"><i class="bx bx-info-circle"></i> Stok akan dikembalikan secara otomatis.</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmCancelTxnBtn"><i class="bx bx-x"></i>Cancel Transaksi</button>
    `);

    document.getElementById('confirmCancelTxnBtn').addEventListener('click', async () => {
      try {
        await API.cancelTransaction(id);
        App.toast('Transaksi di-cancel, stok dikembalikan');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  deleteCancelledTxn(id) {
    App.openModal('Hapus Transaksi Cancelled', `
      <p>Yakin ingin menghapus transaksi ini secara permanen?</p>
      <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Aksi ini tidak bisa dibatalkan.</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmDeleteCancelledTxnBtn"><i class="bx bx-trash"></i>Hapus</button>
    `);

    document.getElementById('confirmDeleteCancelledTxnBtn').addEventListener('click', async () => {
      try {
        await API.deleteTransaction(id);
        App.toast('Transaksi cancelled berhasil dihapus');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },
};
