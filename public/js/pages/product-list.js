// Product List Page
const ProductListPage = {
  items: [],
  sets: [],
  jokiServices: [],

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
        </div>
        <div id="productListTable">${App.loading()}</div>
      </div>
    `;

    document.getElementById('productListSearch').addEventListener('input', () => this.renderTable());
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
