// Items Page
const ItemsPage = {
  items: [],

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Items</h1>
          <p class="page-header-subtitle">Kelola inventory produk</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" id="importYummytrackBtn"><i class="bx bx-cloud-download"></i>Import Yummytrack</button>
          <button class="btn btn-primary" id="addItemBtn"><i class="bx bx-plus"></i>Tambah Item</button>
        </div>
      </div>
      <div class="table-wrapper">
        <div class="table-toolbar">
          <input type="text" class="form-control search-input" id="itemSearch" placeholder="Cari item...">
        </div>
        <div id="itemsTable">${App.loading()}</div>
      </div>
    `;
    document.getElementById('addItemBtn').addEventListener('click', () => this.showForm());
    document.getElementById('importYummytrackBtn').addEventListener('click', () => this.showYummytrackImportForm());
    document.getElementById('itemSearch').addEventListener('input', this.debounce(() => this.loadData(), 300));
    await this.loadData();
  },

  async loadData() {
    try {
      const search = document.getElementById('itemSearch')?.value || '';
      const res = await API.getItems(search);
      this.items = res.data;
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderTable() {
    const el = document.getElementById('itemsTable');
    if (!this.items.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-package"></i><h3>Belum ada item</h3><p>Tambahkan item pertama untuk memulai</p></div>`;
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nama Item</th>
            <th>Harga</th>
            <th>Jumlah Kirim</th>
            <th>Stok Inventory</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${this.items.map((item) => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td class="price">${App.formatPrice(item.price)}</td>
              <td><span class="badge badge-item">${item.send_quantity || 1}</span></td>
              <td>${App.stockBadge(item.stock)}</td>
              <td style="font-size:12px;color:var(--text-muted)">${App.formatDate(item.created_at)}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-icon btn-secondary" onclick="ItemsPage.showForm('${item.id}')" title="Edit"><i class="bx bx-edit-alt"></i></button>
                  <button class="btn btn-icon btn-danger" onclick="ItemsPage.deleteItem('${item.id}', '${item.name}')" title="Hapus"><i class="bx bx-trash"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  showForm(editId = null) {
    const item = editId ? this.items.find((i) => i.id === editId) : null;
    const title = item ? 'Edit Item' : 'Tambah Item';

    App.openModal(title, `
      <div class="form-group">
        <label>Nama Item</label>
        <input type="text" class="form-control" id="itemName" placeholder="e.g. Dismantle Fang" value="${item?.name || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Harga (IDR)</label>
          <input type="number" class="form-control" id="itemPrice" placeholder="Harga per transaksi" value="${item?.price || ''}">
          <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;">Harga yang otomatis terisi saat transaksi</small>
        </div>
        <div class="form-group">
          <label>Jumlah Item Dikirim</label>
          <input type="number" class="form-control" id="itemSendQty" placeholder="Jumlah per transaksi" min="1" value="${item?.send_quantity || 1}">
          <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;">Jumlah item yang dikirim per transaksi</small>
        </div>
      </div>
      <div class="form-group">
        <label>Stok Inventory</label>
        <input type="number" class="form-control" id="itemStock" placeholder="Total stok di inventory" min="0" value="${item?.stock ?? ''}">
        <small style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;">Total jumlah item yang tersedia di inventory</small>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="saveItemBtn">${item ? 'Update' : 'Simpan'}</button>
    `);

    document.getElementById('saveItemBtn').addEventListener('click', () => this.saveItem(editId));
  },

  async saveItem(editId) {
    const name = document.getElementById('itemName').value.trim();
    const price = document.getElementById('itemPrice').value;
    const send_quantity = document.getElementById('itemSendQty').value;
    const stock = document.getElementById('itemStock').value;

    if (!name || !price) {
      App.toast('Nama dan harga harus diisi', 'error');
      return;
    }

    try {
      const payload = {
        name,
        price: parseFloat(price),
        send_quantity: parseInt(send_quantity) || 1,
        stock: parseInt(stock) || 0,
      };

      if (editId) {
        await API.updateItem(editId, payload);
        App.toast('Item berhasil diupdate');
      } else {
        await API.createItem(payload);
        App.toast('Item berhasil ditambahkan');
      }
      App.closeModal();
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async deleteItem(id, name) {
    App.openModal('Hapus Item', `
      <p>Yakin ingin menghapus <strong>${name}</strong>?</p>
      <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Item yang sudah dihapus tidak bisa dikembalikan.</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmDeleteBtn"><i class="bx bx-trash"></i>Hapus</button>
    `);

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
      try {
        await API.deleteItem(id);
        App.toast('Item berhasil dihapus');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  showYummytrackImportForm() {
    App.openModal('Import Yummytrack', `
      <div class="form-group">
        <label>X-API-Key</label>
        <input type="password" class="form-control" id="yummytrackApiKey" placeholder="Masukkan X-API-Key">
      </div>
      <div style="padding:12px 14px;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);background:var(--bg-input);font-size:13px;color:var(--text-secondary);">
        Isi hanya <strong>X-API-Key</strong> untuk request import. Hanya item bertipe <strong>inventory</strong> yang akan diimport. Harga diset 0 dan jumlah kirim diset 1, stok diambil dari amount.
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="runYummytrackImportBtn"><i class="bx bx-cloud-download"></i>Import</button>
    `, 'md');

    document.getElementById('runYummytrackImportBtn').addEventListener('click', async () => {
      const apiKey = document.getElementById('yummytrackApiKey').value.trim();
      if (!apiKey) {
        App.toast('X-API-Key harus diisi', 'error');
        return;
      }

      try {
        const res = await API.importYummytrackPetsVps(apiKey);
        App.toast(`Import selesai: ${res.data.imported} baru, ${res.data.updated} diperbarui`);
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
};
