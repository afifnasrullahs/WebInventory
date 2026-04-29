// API Client Wrapper
const API = {
  baseUrl: '/api',

  async request(method, endpoint, data = null, requestOptions = {}) {
    const isGet = method === 'GET';
    const url = isGet
      ? `${this.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : `${this.baseUrl}${endpoint}`;

    const options = {
      method,
      cache: isGet ? 'no-store' : 'default',
      ...requestOptions,
      headers: { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) },
    };
    if (data) options.body = JSON.stringify(data);

    try {
      const res = await fetch(url, options);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      return json;
    } catch (err) {
      throw err;
    }
  },

  // Items
  getItems(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request('GET', `/items${q}`);
  },
  createItem(data) { return this.request('POST', '/items', data); },
  updateItem(id, data) { return this.request('PUT', `/items/${id}`, data); },
  deleteItem(id) { return this.request('DELETE', `/items/${id}`); },

  // Sets
  getSets() { return this.request('GET', '/sets'); },
  createSet(data) { return this.request('POST', '/sets', data); },
  getSet(id) { return this.request('GET', `/sets/${id}`); },
  updateSet(id, data) { return this.request('PUT', `/sets/${id}`, data); },
  deleteSet(id) { return this.request('DELETE', `/sets/${id}`); },
  addSetItem(setId, data) { return this.request('POST', `/sets/${setId}/items`, data); },
  removeSetItem(setId, itemId) { return this.request('DELETE', `/sets/${setId}/items/${itemId}`); },

  // Transactions
  createTransaction(data) { return this.request('POST', '/transactions', data); },
  getTransactions(status = '') {
    const q = status ? `?status=${status}` : '';
    return this.request('GET', `/transactions${q}`);
  },
  getTransaction(id) { return this.request('GET', `/transactions/${id}`); },
  updateTransaction(id, data) { return this.request('PUT', `/transactions/${id}`, data); },
  updateTransactionStatus(id, status) { return this.request('PUT', `/transactions/${id}/status`, { status }); },
  cancelTransaction(id) { return this.request('PUT', `/transactions/${id}/cancel`); },

  // Joki Services
  getJokiServices() { return this.request('GET', '/joki/services'); },
  createJokiService(data) { return this.request('POST', '/joki/services', data); },
  updateJokiService(id, data) { return this.request('PUT', `/joki/services/${id}`, data); },
  deleteJokiService(id) { return this.request('DELETE', `/joki/services/${id}`); },

  // Joki Orders
  getJokiOrders(status = '') {
    const q = status ? `?status=${status}` : '';
    return this.request('GET', `/joki/orders${q}`);
  },
  createJokiOrder(data) { return this.request('POST', '/joki/orders', data); },
  getJokiOrder(id) { return this.request('GET', `/joki/orders/${id}`); },
  updateJokiOrderStatus(id, status) { return this.request('PUT', `/joki/orders/${id}/status`, { status }); },
  cancelJokiOrder(id) { return this.request('PUT', `/joki/orders/${id}/cancel`); },

  // Yummytrack import
  importYummytrackPetsVps() {
    return this.request('GET', '/yummytrack/pets-vps');
  },

  saveYummytrackToken(token, apiKey) {
    return this.request('PUT', '/config/yummytrack-token', { token }, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
    });
  },
};
