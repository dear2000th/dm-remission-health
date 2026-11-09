const API = (function () {
  let authToken = localStorage.getItem('dm_remis_token') || null;

  async function request(endpoint, options = {}) {
    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          setToken(null);
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }

      return data;
    } catch (err) {
      console.error('API Error:', err.message);
      throw err;
    }
  }

  function setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem('dm_remis_token', token);
    } else {
      localStorage.removeItem('dm_remis_token');
    }
  }

  function getToken() {
    return authToken;
  }

  return {
    setToken,
    getToken,
    login: (username, password) => request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    getMe: () => request('/api/auth/me'),
    getPatients: (q = '') => request(`/api/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getPatient: (id) => request(`/api/patients/${id}`),
    createPatient: (data) => request('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    updatePatient: (id, data) => request(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    getRecords: (patientId, week = null) => request(`/api/patients/${patientId}/records${week ? `?week=${week}` : ''}`),
    saveRecord: (patientId, data) => request(`/api/patients/${patientId}/records`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    resetBlocks: (patientId, target = 'all') => request(`/api/patients/${patientId}/reset-blocks`, {
      method: 'POST',
      body: JSON.stringify({ target })
    }),
    getAnalytics: (patientId) => request(`/api/patients/${patientId}/analytics`),
    getUsers: (q = '') => request(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getUser: (id) => request(`/api/users/${id}`),
    createUser: (data) => request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    updateUser: (id, data) => request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    deleteUser: (id) => request(`/api/users/${id}`, {
      method: 'DELETE'
    }),
    getAuditLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/audit-logs${qs ? `?${qs}` : ''}`);
    }
  };
})();
