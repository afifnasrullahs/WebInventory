// Transactions Page
const TransactionsPage = {
  transactions: [],
  allItems: [],
  allSets: [],
  currentFilter: '',
  txnItems: [],

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
      const res = await API.getTransactions(this.currentFilter);
      this.transactions = res.data;
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderTable() {
    const el = document.getElementById('txnTable');
    if (!this.transactions.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-receipt"></i><h3>Tidak ada transaksi</h3><p>Buat transaksi pertama untuk memulai</p></div>`;
      return;
    }

    el.innerHTML = `
      <table>
        <thead><tr><th>Buyer</th><th>Total</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody>
          ${this.transactions.map((txn) => `
            <tr>
              <td><strong>${txn.buyer_name}</strong></td>
              <td class="price">${App.formatPrice(txn.total_price)}</td>
              <td>${App.statusBadge(txn.status)}</td>
              <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(txn.created_at)}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="TransactionsPage.showDetail('${txn.id}')"><i class="bx bx-show"></i>Detail</button>
                  ${txn.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="TransactionsPage.markDone('${txn.id}')" title="Selesai"><i class="bx bx-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="TransactionsPage.cancelTxn('${txn.id}')" title="Cancel"><i class="bx bx-x"></i></button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async showCreateForm() {
    this.txnItems = [];

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
        <label>Username Buyer</label>
        <input type="text" class="form-control" id="txnBuyerName" placeholder="Username pembeli">
      </div>

      <hr style="border-color:var(--border-subtle);margin:18px 0;">

      <h4 class="section-title"><i class="bx bx-cart-add"></i>Tambah Produk</h4>
      <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;margin-bottom:18px;">
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
    document.getElementById('txnAddProductBtn').addEventListener('click', () => this.addProduct());
    document.getElementById('submitTxnBtn').addEventListener('click', () => this.submitTransaction());
  },

  updateProductSelect() {
    const type = document.getElementById('txnProductType').value;
    const select = document.getElementById('txnProductSelect');

    if (type === 'item') {
      select.innerHTML = this.allItems.map((i) =>
        `<option value="${i.id}" data-price="${i.price}" data-stock="${i.stock}" data-sendqty="${i.send_quantity || 1}">${i.name} (Stok: ${i.stock})</option>`
      ).join('');
    } else {
      select.innerHTML = this.allSets.map((s) =>
        `<option value="${s.id}" data-price="${s.price}" data-stock="${s.calculated_stock}" data-sendqty="1">${s.name} (Stok: ${s.calculated_stock})</option>`
      ).join('');
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
    if (!buyer_name) {
      App.toast('Username buyer harus diisi', 'error');
      return;
    }
    if (!this.txnItems.length) {
      App.toast('Tambahkan minimal 1 produk', 'error');
      return;
    }

    try {
      await API.createTransaction({
        buyer_name,
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

  async showDetail(id) {
    try {
      const res = await API.getTransaction(id);
      const txn = res.data;

      const detailsHtml = txn.details.map((d) => `
        <div class="txn-item-row" style="flex-direction:column;align-items:stretch;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-${d.type}">${d.type}</span>
              <strong>${d.ref_name || d.ref_id}</strong>
            </div>
            <span class="price">${d.quantity} × ${App.formatPrice(d.price)} = ${App.formatPrice(d.quantity * d.price)}</span>
          </div>
          ${d.breakdown && d.breakdown.length ? `
            <div class="breakdown-list">
              ${d.breakdown.map((b) => `
                <div class="breakdown-item">
                  <span class="item-name"><i class="bx bx-subdirectory-right" style="font-size:14px;"></i>${b.item_name || b.item_id}</span>
                  <span>×${b.quantity}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('');

      App.openModal('Detail Transaksi', `
        <div class="detail-grid">
          <div class="detail-item"><label>Buyer</label><p>${txn.buyer_name}</p></div>
          <div class="detail-item"><label>Status</label><p>${App.statusBadge(txn.status)}</p></div>
          <div class="detail-item"><label>Total</label><p class="price">${App.formatPrice(txn.total_price)}</p></div>
          <div class="detail-item"><label>Tanggal</label><p>${App.formatDate(txn.created_at)}</p></div>
        </div>
        <h4 class="section-title"><i class="bx bx-list-ul"></i>Detail Item</h4>
        <div class="txn-items-list">${detailsHtml}</div>
      `, `<button class="btn btn-secondary" onclick="App.closeModal()">Tutup</button>`, 'lg');
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
};
