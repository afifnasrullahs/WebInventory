// Product List Page
const ProductListPage = {
  items: [],
  sets: [],
  jokiServices: [],
  sort: { sortBy: 'name', sortDir: 'asc' },

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>List Produk</h1>
          <p class="page-header-subtitle">Daftar semua produk: item, set, dan layanan joki</p>
        </div>
      </div>
      <div class="table-wrapper">
        <div class="table-toolbar">
          <input type="text" class="form-control search-input" id="productListSearch" placeholder="Cari nama produk...">
          <select class="form-control" id="productListSort" style="width:240px;min-width:240px;">
            <option value="name:asc">Nama: A → Z</option>
            <option value="name:desc">Nama: Z → A</option>
            <option value="price:asc">Harga: kecil → besar</option>
            <option value="price:desc">Harga: besar → kecil</option>
            <option value="stock:asc">Stok: kecil → besar</option>
            <option value="stock:desc">Stok: besar → kecil</option>
            <option value="type:asc">Tipe: A → Z</option>
            <option value="type:desc">Tipe: Z → A</option>
          </select>
        </div>
        <div id="productListTable">${App.loading()}</div>
      </div>
    `;

    document.getElementById('productListSearch').addEventListener('input', () => this.renderTable());
    document.getElementById('productListSort').addEventListener('change', () => {
      const [sortBy, sortDir] = (document.getElementById('productListSort').value || 'name:asc').split(':');
      this.sort = { sortBy, sortDir };
      this.renderTable();
    });
    document.getElementById('productListSort').value = `${this.sort.sortBy}:${this.sort.sortDir}`;
    await this.loadData();
  },

  async loadData() {
    try {
      const [itemsRes, setsRes, jokiServicesRes] = await Promise.all([
        API.getItems(),
        API.getSets(),
        API.getJokiServices(),
      ]);
      this.items = itemsRes.data || [];
      this.sets = setsRes.data || [];
      this.jokiServices = jokiServicesRes.data || [];
      this.renderTable();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  getRows() {
    return [
      ...this.items.map((item) => ({
        type: 'Item',
        name: item.name,
        price: item.price,
        quantity: item.send_quantity || 1,
        stock: item.stock,
      })),
      ...this.sets.map((set) => ({
        type: 'Set',
        name: set.name,
        price: set.price,
        quantity: (set.items || []).reduce((total, item) => total + (item.quantity || 0), 0),
        stock: set.calculated_stock,
      })),
      ...this.jokiServices.map((service) => ({
        type: 'Joki',
        name: service.name,
        price: service.price,
        quantity: '-',
        stock: '-',
      })),
    ];
  },

  renderTable() {
    const el = document.getElementById('productListTable');
    const search = (document.getElementById('productListSearch')?.value || '').trim().toLowerCase();
    const rows = this.getRows().filter((row) => {
      if (!search) return true;
      return `${row.type} ${row.name}`.toLowerCase().includes(search);
    });

    const { sortBy, sortDir } = this.sort || { sortBy: 'name', sortDir: 'asc' };
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === 'type') return dir * String(a.type || '').localeCompare(String(b.type || ''), 'id-ID');
      if (sortBy === 'name') return dir * String(a.name || '').localeCompare(String(b.name || ''), 'id-ID');
      if (sortBy === 'price') return dir * ((Number(a.price) || 0) - (Number(b.price) || 0));
      if (sortBy === 'stock') {
        const av = a.stock === '-' ? null : Number(a.stock);
        const bv = b.stock === '-' ? null : Number(b.stock);
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // push unknown stock to bottom
        if (bv === null) return -1;
        return dir * (av - bv);
      }
      return 0;
    });

    if (!rows.length) {
      el.innerHTML = `<div class="empty-state"><i class="bx bx-search-alt"></i><h3>Produk tidak ditemukan</h3><p>Coba kata kunci lain.</p></div>`;
      return;
    }

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Tipe</th>
            <th>Nama Produk</th>
            <th>Quantity</th>
            <th>Stok</th>
            <th>Harga</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><span class="badge ${this.getTypeBadgeClass(row.type)}">${row.type}</span></td>
              <td><strong>${row.name}</strong></td>
              <td>${row.quantity}</td>
              <td>${row.stock}</td>
              <td class="price">${App.formatPrice(row.price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  getTypeBadgeClass(type) {
    if (type === 'Item') return 'badge-item';
    if (type === 'Set') return 'badge-set';
    return 'badge-joki';
  },
};
