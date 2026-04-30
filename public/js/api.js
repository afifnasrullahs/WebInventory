// API Client Wrapper
const API = {
  baseUrl: '/api',

  buildQuery(params = {}) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && `${v}` !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return qs ? `?${qs}` : '';
  },

  sanitizeHeaderValue(value, headerName = 'header') {
    const str = String(value ?? '').trim();
    // Browser fetch headers only allow ISO-8859-1 code points.
    const hasInvalid = /[^\u0000-\u00FF]/.test(str);
    if (hasInvalid) {
      throw new Error(`Nilai ${headerName} mengandung karakter tidak valid. Coba paste ulang tanpa karakter khusus.`);
    }
    return str;
  },

  async request(method, endpoint, data = null, requestOptions = {}) {
    const isGet = method === 'GET';
    const url = isGet
      ? `${this.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : `${this.baseUrl}${endpoint}`;

    const safeHeaders = { 'Content-Type': 'application/json' };
    const customHeaders = requestOptions.headers || {};
    Object.entries(customHeaders).forEach(([k, v]) => {
      safeHeaders[k] = this.sanitizeHeaderValue(v, k);
    });

    const options = {
      method,
      cache: isGet ? 'no-store' : 'default',
      ...requestOptions,
      headers: safeHeaders,
    };
    if (data) options.body = JSON.stringify(data);

    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let json = {};

      if (text) {
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          throw new Error(text);
        }
      }

      if (!res.ok) throw new Error(json.error || 'Request failed');
      return json;
    } catch (err) {
      throw err;
    }
  },

  // Items
  getItems(search = '', opts = {}) {
    const q = this.buildQuery({ search, sortBy: opts.sortBy, sortDir: opts.sortDir });
    return this.request('GET', `/items${q}`);
  },
  createItem(data) { return this.request('POST', '/items', data); },
  updateItem(id, data) { return this.request('PUT', `/items/${id}`, data); },
  deleteItem(id) { return this.request('DELETE', `/items/${id}`); },

  // Sets
  getSets(opts = {}) {
    const q = this.buildQuery({ sortBy: opts.sortBy, sortDir: opts.sortDir });
    return this.request('GET', `/sets${q}`);
  },
  createSet(data) { return this.request('POST', '/sets', data); },
  getSet(id) { return this.request('GET', `/sets/${id}`); },
  updateSet(id, data) { return this.request('PUT', `/sets/${id}`, data); },
  deleteSet(id) { return this.request('DELETE', `/sets/${id}`); },
  addSetItem(setId, data) { return this.request('POST', `/sets/${setId}/items`, data); },
  removeSetItem(setId, itemId) { return this.request('DELETE', `/sets/${setId}/items/${itemId}`); },

  // Transactions
  createTransaction(data) { return this.request('POST', '/transactions', data); },
  getTransactions(status = '', opts = {}) {
    const q = this.buildQuery({ status, sortBy: opts.sortBy, sortDir: opts.sortDir });
    return this.request('GET', `/transactions${q}`);
  },
  getTransaction(id) { return this.request('GET', `/transactions/${id}`); },
  updateTransaction(id, data) { return this.request('PUT', `/transactions/${id}`, data); },
  updateTransactionFull(id, data) { return this.request('PUT', `/transactions/${id}/full`, data); },
  updateTransactionStatus(id, status) { return this.request('PUT', `/transactions/${id}/status`, { status }); },
  cancelTransaction(id) { return this.request('PUT', `/transactions/${id}/cancel`); },
  deleteTransaction(id) { return this.request('DELETE', `/transactions/${id}`); },

  // Joki Services
  getJokiServices(opts = {}) {
    const q = this.buildQuery({ sortBy: opts.sortBy, sortDir: opts.sortDir });
    return this.request('GET', `/joki/services${q}`);
  },
  createJokiService(data) { return this.request('POST', '/joki/services', data); },
  updateJokiService(id, data) { return this.request('PUT', `/joki/services/${id}`, data); },
  deleteJokiService(id) { return this.request('DELETE', `/joki/services/${id}`); },

  // Joki Orders
  getJokiOrders(status = '', opts = {}) {
    const q = this.buildQuery({ status, sortBy: opts.sortBy, sortDir: opts.sortDir });
    return this.request('GET', `/joki/orders${q}`);
  },
  createJokiOrder(data) { return this.request('POST', '/joki/orders', data); },
  getJokiOrder(id) { return this.request('GET', `/joki/orders/${id}`); },
  updateJokiOrder(id, data) { return this.request('PUT', `/joki/orders/${id}`, data); },
  updateJokiOrderStatus(id, status) { return this.request('PUT', `/joki/orders/${id}/status`, { status }); },
  cancelJokiOrder(id) { return this.request('PUT', `/joki/orders/${id}/cancel`); },
  deleteJokiOrder(id) { return this.request('DELETE', `/joki/orders/${id}`); },

  // Yummytrack import
  importYummytrackPetsVps(apiKey) {
    return this.request('GET', '/yummytrack/pets-vps', null, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
    });
  },

  // Activity / Absensi
  getActivities(opts = {}) {
    const q = this.buildQuery({
      status: opts.status,
      sortBy: opts.sortBy,
      sortDir: opts.sortDir,
      limit: opts.limit,
    });
    return this.request('GET', `/activities${q}`);
  },
  createActivity(data) { return this.request('POST', '/activities', data); },
  approveActivity(id, code) { return this.request('PUT', `/activities/${id}/approve`, { code }); },

  // Income report
  getIncomeReport(opts = {}) {
    const q = this.buildQuery({ from: opts.from, to: opts.to });
    return this.request('GET', `/income${q}`);
  },
};
