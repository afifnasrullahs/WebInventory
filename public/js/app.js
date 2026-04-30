// SPA Router & Utilities
const App = {
  currentPage: null,

  pages: {
    '/': DashboardPage,
    '/items': ItemsPage,
    '/sets': SetsPage,
    '/transactions': TransactionsPage,
    '/joki': JokiPage,
    '/products': ProductListPage,
    '/activity': ActivityPage,
    '/income': IncomePage,
  },

  init() {
    this.bindEvents();
    this.navigate();
  },

  bindEvents() {
    window.addEventListener('hashchange', () => this.navigate());

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', () => App.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) App.closeModal();
    });

    // ESC key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') App.closeModal();
    });
  },

  isModalOpen() {
    return document.getElementById('modalOverlay')?.classList.contains('active');
  },

  // ========== NAVIGATION ==========
  navigate() {
    const hash = window.location.hash.slice(1) || '/';
    const page = this.pages[hash];

    if (!page) {
      window.location.hash = '/';
      return;
    }

    // Update active nav
    document.querySelectorAll('.nav-item').forEach((item) => {
      const href = item.getAttribute('href').slice(1);
      item.classList.toggle('active', href === hash);
    });

    this.currentPage = page;
    page.render();
  },

  // ========== MODAL ==========
  openModal(title, bodyHtml, footerHtml = '', size = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    const modal = document.getElementById('modal');
    modal.className = 'modal' + (size ? ` modal-${size}` : '');
    document.getElementById('modalOverlay').classList.add('active');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  // ========== TOAST ==========
  toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = {
      success: 'bx-check-circle',
      error: 'bx-error-circle',
      info: 'bx-info-circle',
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="bx ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-fadeout');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  // ========== HELPERS ==========
  formatPrice(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  stockBadge(stock) {
    const level = stock <= 0 ? 'low' : stock <= 10 ? 'medium' : 'high';
    return `<span class="badge-stock ${level}">${stock}</span>`;
  },

  statusBadge(status) {
    const labels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      done: 'Done',
      cancelled: 'Cancelled',
    };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
  },

  loading() {
    return '<div class="loading"><span style="color:var(--text-muted);font-size:13px;">Memuat data...</span></div>';
  },
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
