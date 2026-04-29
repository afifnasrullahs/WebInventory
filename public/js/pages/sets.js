// Sets Page
const SetsPage = {
  sets: [],
  allItems: [],
  pendingSetItems: [], // items to add when creating a new set
  searchQuery: '',
  setItemSearchQuery: '',

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Sets / Bundle</h1>
          <p class="page-header-subtitle">Kelola paket bundle produk</p>
        </div>
        <button class="btn btn-primary" id="addSetBtn"><i class="bx bx-plus"></i>Tambah Set</button>
      </div>
      <div class="table-wrapper" style="margin-bottom:20px;">
        <div class="table-toolbar">
          <input type="text" class="form-control search-input" id="setSearch" placeholder="Cari set atau item dalam set...">
        </div>
      </div>
      <div id="setsContainer">${App.loading()}</div>
    `;
    document.getElementById('addSetBtn').addEventListener('click', () => this.showForm());
    document.getElementById('setSearch').addEventListener('input', () => this.renderSets());
    await this.loadData();
  },

  async loadData() {
    try {
      const [setsRes, itemsRes] = await Promise.all([API.getSets(), API.getItems()]);
      this.sets = setsRes.data;
      this.allItems = itemsRes.data;
      this.renderSets();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderSets() {
    const el = document.getElementById('setsContainer');
    const search = (document.getElementById('setSearch')?.value || '').trim().toLowerCase();
    this.searchQuery = search;
    const filteredSets = !search
      ? this.sets
      : this.sets.filter((set) => {
          const text = [set.name, ...(set.items || []).map((item) => item.item_name)].join(' ').toLowerCase();
          return text.includes(search);
        });

    if (!filteredSets.length) {
      el.innerHTML = `<div class="card"><div class="empty-state"><i class="bx bx-collection"></i><h3>Belum ada set</h3><p>Buat set/bundle pertama untuk memulai</p></div></div>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nama Set</th><th>Harga</th><th>Stok Set</th><th>Items dalam Set</th><th>Aksi</th></tr></thead>
          <tbody>
            ${filteredSets.map((set) => {
              const items = set.items || [];
              return `
                <tr>
                  <td><strong>${set.name}</strong></td>
                  <td class="price">${App.formatPrice(set.price)}</td>
                  <td>${App.stockBadge(set.calculated_stock)}</td>
                  <td>
                    <div class="set-items-tags">
                      ${items.length ? items.map((i) => `
                        <span class="set-item-tag">${i.item_name}<span class="tag-qty">×${i.quantity}</span></span>
                      `).join('') : '<span style="color:var(--text-muted);font-size:13px;">Belum ada item</span>'}
                    </div>
                  </td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-sm btn-secondary" onclick="SetsPage.showForm('${set.id}')" title="Edit Set"><i class="bx bx-edit-alt"></i>Edit</button>
                      <button class="btn btn-icon btn-danger" onclick="SetsPage.deleteSet('${set.id}', '${set.name}')" title="Hapus"><i class="bx bx-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  showForm(editId = null) {
    const set = editId ? this.sets.find((s) => s.id === editId) : null;
    const title = set ? 'Edit Set' : 'Tambah Set';

    // If creating, start with empty items list
    if (!editId) {
      this.pendingSetItems = [];
    } else {
      // Load existing items for editing
      this.pendingSetItems = (set.items || []).map((i) => ({
        item_id: i.item_id,
        item_name: i.item_name,
        quantity: i.quantity,
      }));
    }
    this.setItemSearchQuery = '';

    App.openModal(title, `
      <div class="form-group">
        <label>Nama Set</label>
        <input type="text" class="form-control" id="setName" placeholder="e.g. Paket Lengkap" value="${set?.name || ''}">
      </div>
      <div class="form-group">
        <label>Harga Set (IDR)</label>
        <input type="number" class="form-control" id="setPrice" placeholder="Harga set" value="${set?.price || ''}">
      </div>

      <hr style="border-color:var(--border-subtle);margin:20px 0 16px;">

      <h4 class="section-title"><i class="bx bx-list-check"></i>Items dalam Set</h4>
      <div id="setItemsListInForm" class="txn-items-list" style="margin-bottom:16px;"></div>

      <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;">
        <p style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Tambah Item ke Set</p>
        <div class="form-group" style="margin-bottom:10px;">
          <input type="text" class="form-control search-input" id="setItemSearch" placeholder="Cari item untuk ditambahkan...">
        </div>
        <div class="form-row" style="grid-template-columns:1fr 100px auto;align-items:end;">
          <div class="form-group" style="margin-bottom:0">
            <select class="form-control" id="setItemSelect">
              <option value="">-- Pilih Item --</option>
              ${this.getAvailableItems().map((i) => `<option value="${i.id}" data-name="${i.name}">${i.name} (Stok: ${i.stock})</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <input type="number" class="form-control" id="setItemQty" placeholder="Qty" min="1" value="1">
          </div>
          <button class="btn btn-sm btn-primary" id="addItemToSetFormBtn" style="height:38px;"><i class="bx bx-plus"></i></button>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" id="saveSetBtn">${set ? 'Update' : 'Simpan'}</button>
    `, 'lg');

    this.renderSetItemsInForm();

    document.getElementById('setItemSearch').addEventListener('input', (e) => {
      this.setItemSearchQuery = e.target.value.trim().toLowerCase();
      this.renderAvailableItemsOptions();
    });
    document.getElementById('addItemToSetFormBtn').addEventListener('click', () => this.addItemToForm());
    document.getElementById('saveSetBtn').addEventListener('click', () => this.saveSet(editId));
  },

  getAvailableItems() {
    const usedIds = this.pendingSetItems.map((i) => i.item_id);
    return this.allItems.filter((i) => !usedIds.includes(i.id));
  },

  getFilteredAvailableItems() {
    const availableItems = this.getAvailableItems();
    if (!this.setItemSearchQuery) return availableItems;
    return availableItems.filter((item) => item.name.toLowerCase().includes(this.setItemSearchQuery));
  },

  renderAvailableItemsOptions() {
    const select = document.getElementById('setItemSelect');
    if (!select) return;

    const filteredItems = this.getFilteredAvailableItems();
    select.innerHTML = `<option value="">-- Pilih Item --</option>
      ${filteredItems.map((i) => `<option value="${i.id}" data-name="${i.name}">${i.name} (Stok: ${i.stock})</option>`).join('')}`;
  },

  renderSetItemsInForm() {
    const el = document.getElementById('setItemsListInForm');
    if (!this.pendingSetItems.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">Belum ada item. Tambahkan item di bawah.</p>';
    } else {
      el.innerHTML = this.pendingSetItems.map((item, idx) => `
        <div class="txn-item-row">
          <div class="item-info">
            <span class="badge badge-item">Item</span>
            <span class="item-name">${item.item_name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-muted)">Qty:</span>
            <input type="number" class="form-control qty-input" value="${item.quantity}" min="1"
              onchange="SetsPage.updatePendingQty(${idx}, this.value)" style="width:70px;">
          </div>
          <button class="item-remove" onclick="SetsPage.removePendingItem(${idx})" title="Hapus"><i class="bx bx-x"></i></button>
        </div>
      `).join('');
    }

    // Update available items in select
    this.renderAvailableItemsOptions();
  },

  addItemToForm() {
    const select = document.getElementById('setItemSelect');
    const qtyInput = document.getElementById('setItemQty');
    const option = select.options[select.selectedIndex];

    if (!option || !option.value) {
      App.toast('Pilih item terlebih dahulu', 'error');
      return;
    }

    this.pendingSetItems.push({
      item_id: option.value,
      item_name: option.dataset.name,
      quantity: parseInt(qtyInput.value) || 1,
    });

    qtyInput.value = 1;
    this.renderSetItemsInForm();
  },

  updatePendingQty(idx, val) {
    this.pendingSetItems[idx].quantity = parseInt(val) || 1;
  },

  removePendingItem(idx) {
    this.pendingSetItems.splice(idx, 1);
    this.renderSetItemsInForm();
  },

  async saveSet(editId) {
    const name = document.getElementById('setName').value.trim();
    const price = document.getElementById('setPrice').value;

    if (!name || !price) {
      App.toast('Nama dan harga harus diisi', 'error');
      return;
    }

    try {
      let setId = editId;

      if (editId) {
        // Update set info
        await API.updateSet(editId, { name, price: parseFloat(price) });

        // Get current items in set
        const setRes = await API.getSet(editId);
        const currentItems = setRes.data.items || [];

        // Remove items not in pending list
        for (const ci of currentItems) {
          if (!this.pendingSetItems.find((p) => p.item_id === ci.item_id)) {
            await API.removeSetItem(editId, ci.item_id);
          }
        }

        // Add/update items
        for (const pi of this.pendingSetItems) {
          await API.addSetItem(editId, { item_id: pi.item_id, quantity: pi.quantity });
        }

        App.toast('Set berhasil diupdate');
      } else {
        // Create set
        const res = await API.createSet({ name, price: parseFloat(price) });
        setId = res.data.id;

        // Add items to set
        for (const pi of this.pendingSetItems) {
          await API.addSetItem(setId, { item_id: pi.item_id, quantity: pi.quantity });
        }

        App.toast('Set berhasil ditambahkan');
      }

      App.closeModal();
      await this.loadData();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async deleteSet(id, name) {
    App.openModal('Hapus Set', `
      <p>Yakin ingin menghapus set <strong>${name}</strong>?</p>
      <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Semua item dalam set akan dikeluarkan (item tidak dihapus dari inventory).</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-danger" id="confirmDeleteSetBtn"><i class="bx bx-trash"></i>Hapus</button>
    `);

    document.getElementById('confirmDeleteSetBtn').addEventListener('click', async () => {
      try {
        await API.deleteSet(id);
        App.toast('Set berhasil dihapus');
        App.closeModal();
        await this.loadData();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },
};
