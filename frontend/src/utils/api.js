// File: frontend/src/utils/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const DEFAULT_TIMEOUT_MS = 30000;

// Generic fetch wrapper with error handling and timeout
const fetchAPI = async (endpoint, options = {}) => {
  const { timeout = DEFAULT_TIMEOUT_MS, responseType, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP error! status: ${response.status}`);
      // Callers need the status to tell "no permission" (403) apart from
      // "backend down" — treating them the same locked non-admin users out
      // with a false "System Offline" (issue #58)
      error.status = response.status;
      throw error;
    }

    if (responseType === 'blob') {
      return response;
    }

    const data = await response.json();

    // When caller requests pagination metadata, return it alongside the data
    if (options.returnMeta) {
      return {
        data,
        meta: {
          total: parseInt(response.headers.get('X-Total-Count') || '0', 10),
          hasMore: response.headers.get('X-Has-More') === 'true',
        },
      };
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const msg = `Request timed out (${endpoint})`;
      console.error(msg);
      throw new Error(msg);
    }
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// People API
export const peopleAPI = {
  getAll: ({ limit = 100, offset = 0, ...rest } = {}) =>
    fetchAPI(`/people${buildQuery({ limit, offset, ...rest })}`, { returnMeta: true }),

  getById: (id) => fetchAPI(`/people/${id}`),

  create: (personData) => fetchAPI('/people', {
    method: 'POST',
    body: JSON.stringify(personData),
  }),
  
  update: (id, personData) => fetchAPI(`/people/${id}`, {
    method: 'PUT',
    body: JSON.stringify(personData),
  }),
  
  delete: (id) => fetchAPI(`/people/${id}`, {
    method: 'DELETE',
  }),
};

// Businesses API
export const businessesAPI = {
  getAll: (params = {}) => fetchAPI(`/businesses${buildQuery(params)}`),
  
  create: (businessData) => fetchAPI('/businesses', {
    method: 'POST',
    body: JSON.stringify(businessData),
  }),
  
  update: (id, businessData) => fetchAPI(`/businesses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(businessData),
  }),
  
  delete: (id) => fetchAPI(`/businesses/${id}`, {
    method: 'DELETE',
  }),
};

// Tools API
export const toolsAPI = {
  // Bulk import: one request rather than one per row, so a few hundred tools
  // don't trip the rate limiter.
  bulkImport: (payload) => fetchAPI('/tools/bulk-import', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getAll: () => fetchAPI('/tools'),
  
  create: (toolData) => fetchAPI('/tools', {
    method: 'POST',
    body: JSON.stringify(toolData),
  }),
  
  update: (id, toolData) => fetchAPI(`/tools/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toolData),
  }),
  
  delete: (id) => fetchAPI(`/tools/${id}`, {
    method: 'DELETE',
  }),
};

// Todos API
export const todosAPI = {
  getAll: (params = {}) => fetchAPI(`/todos${buildQuery(params)}`),
  
  create: (todoData) => fetchAPI('/todos', {
    method: 'POST',
    body: JSON.stringify(todoData),
  }),
  
  update: (id, updates) => fetchAPI(`/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  
  delete: (id) => fetchAPI(`/todos/${id}`, {
    method: 'DELETE',
  }),
};

// Cases API
export const casesAPI = {
  getAll: (params = {}) => fetchAPI(`/cases${buildQuery(params)}`),
  
  create: (caseData) => fetchAPI('/cases', {
    method: 'POST',
    body: JSON.stringify(caseData),
  }),
  
  update: (id, caseData) => fetchAPI(`/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(caseData),
  }),
  
  delete: (id) => fetchAPI(`/cases/${id}`, {
    method: 'DELETE',
  }),
};

// Projects API (issue #83) — the hard isolation boundary; cases nest inside a project.
export const projectsAPI = {
  getAll: () => fetchAPI('/projects'),

  create: (projectData) => fetchAPI('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  }),

  update: (id, projectData) => fetchAPI(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(projectData),
  }),

  delete: (id) => fetchAPI(`/projects/${id}`, {
    method: 'DELETE',
  }),
};

// Custom Fields API
export const customFieldsAPI = {
  getAll: () => fetchAPI('/settings/custom-fields'),
  
  create: (fieldData) => fetchAPI('/settings/custom-fields', {
    method: 'POST',
    body: JSON.stringify(fieldData),
  }),
  
  update: (id, fieldData) => fetchAPI(`/settings/custom-fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fieldData),
  }),
  
  delete: (id) => fetchAPI(`/settings/custom-fields/${id}`, {
    method: 'DELETE',
  }),
};

// Model Options API
// Running version + whether a newer release exists. The check runs on the
// server; the browser never contacts GitHub.
export const versionAPI = {
  get: () => fetchAPI('/version'),
};

export const updateSettingsAPI = {
  get: () => fetchAPI('/settings/updates'),
  update: (payload) => fetchAPI('/settings/updates', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
};

// Geocoding provider config (issue #62). The API key is write-only server
// side — get() reports only whether one is stored, never its value.
export const geocodingSettingsAPI = {
  get: () => fetchAPI('/settings/geocoding'),
  update: (payload) => fetchAPI('/settings/geocoding', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
};

export const modelOptionsAPI = {
  getAll: () => fetchAPI('/settings/model-options'),
  
  create: (optionData) => fetchAPI('/settings/model-options', {
    method: 'POST',
    body: JSON.stringify(optionData),
  }),
  
  update: (id, optionData) => fetchAPI(`/settings/model-options/${id}`, {
    method: 'PUT',
    body: JSON.stringify(optionData),
  }),
  
  delete: (id) => fetchAPI(`/settings/model-options/${id}`, {
    method: 'DELETE',
  }),
};

// Audit Log API
export const auditAPI = {
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return fetchAPI(`/audit-logs${queryParams ? '?' + queryParams : ''}`);
  },
};

// Export/Import API - Fixed export function
export const exportAPI = {
  export: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the JSON data
      const data = await response.json();
      
      // Create a blob from the JSON data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osint-crm-export-${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  },
};

export const importAPI = {
  import: (data) => fetchAPI('/import', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Logo Upload API
export const uploadLogo = async (file) => {
  const formData = new FormData();
  formData.append('appLogo', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload/logo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Logo upload failed');
    }

    const data = await response.json();
    return `${API_BASE_URL.replace('/api', '')}${data.logoUrl}`;
  } catch (error) {
    console.error('Error uploading logo:', error);
    throw error;
  }
};

// Locations API
export const locationsAPI = {
  getAll: (params = {}) => fetchAPI(`/locations${buildQuery(params)}`),
};

// Advanced Search API
export const searchAPI = {
  advanced: (params) => {
    const queryParams = new URLSearchParams();
    
    // Convert complex search params to query string
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(`${key}[]`, v));
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          queryParams.append(`${key}[${subKey}]`, subValue);
        });
      } else if (value !== '' && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    return fetchAPI(`/search/advanced?${queryParams.toString()}`);
  }
};

// Travel History API
export const travelHistoryAPI = {
  getByPerson: (personId) => fetchAPI(`/people/${personId}/travel-history`),
  
  create: (personId, travelData) => fetchAPI(`/people/${personId}/travel-history`, {
    method: 'POST',
    body: JSON.stringify(travelData),
  }),
  
  update: (travelId, travelData) => fetchAPI(`/travel-history/${travelId}`, {
    method: 'PUT',
    body: JSON.stringify(travelData),
  }),
  
  delete: (travelId) => fetchAPI(`/travel-history/${travelId}`, {
    method: 'DELETE',
  }),
  
  analyze: (personId) => fetchAPI(`/people/${personId}/travel-analysis`),
};

// Business API
export const businessAPI = {
  getAll: (params = {}) => fetchAPI(`/businesses${buildQuery(params)}`),
  
  getById: (id) => fetchAPI(`/businesses/${id}`),
  
  create: (businessData) => fetchAPI('/businesses', {
    method: 'POST',
    body: JSON.stringify(businessData),
  }),
  
  update: (id, businessData) => fetchAPI(`/businesses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(businessData),
  }),
  
  delete: (id) => fetchAPI(`/businesses/${id}`, {
    method: 'DELETE',
  }),
};

// System Health API
export const systemAPI = {
  getHealth: () => fetchAPI('/system/health'),
};

// Wireless Networks API (WiGLE Integration)
export const wirelessNetworksAPI = {
  getAll: (params) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.append(key, value);
        }
      });
    }
    return fetchAPI(`/wireless-networks?${queryParams.toString()}`);
  },

  getById: (id) => fetchAPI(`/wireless-networks/${id}`),

  create: (data) => fetchAPI('/wireless-networks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => fetchAPI(`/wireless-networks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => fetchAPI(`/wireless-networks/${id}`, {
    method: 'DELETE',
  }),

  bulkDelete: (ids) => fetchAPI('/wireless-networks/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }),

  importKML: async (file, projectId) => {
    const formData = new FormData();
    formData.append('kmlFile', file);
    if (projectId) formData.append('project_id', projectId);

    const response = await fetch(`${API_BASE_URL}/wireless-networks/import-kml`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Import failed');
    }

    return response.json();
  },

  getStats: (params = {}) => fetchAPI(`/wireless-networks/stats${buildQuery(params)}`),

  getNearby: (latitude, longitude, radius = 0.5) =>
    fetchAPI(`/wireless-networks/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`),

  associate: (id, personId, note, confidence) => fetchAPI(`/wireless-networks/${id}/associate`, {
    method: 'POST',
    body: JSON.stringify({
      person_id: personId,
      association_note: note,
      association_confidence: confidence,
    }),
  }),

  removeAssociation: (id) => fetchAPI(`/wireless-networks/${id}/associate`, {
    method: 'DELETE',
  }),
};

// Helper to build a query string from a params object (skips empty values)
const buildQuery = (params = {}) => {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') qp.append(key, value);
  });
  const s = qp.toString();
  return s ? `?${s}` : '';
};

// Properties API (transaction tracking — issue #43)
export const propertiesAPI = {
  getAll: (params = {}) => fetchAPI(`/properties${buildQuery(params)}`),
  getById: (id) => fetchAPI(`/properties/${id}`),
  create: (data) => fetchAPI('/properties', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => fetchAPI(`/properties/${id}`, { method: 'DELETE' }),
  getTransactions: (id) => fetchAPI(`/properties/${id}/transactions`),
  getLedger: (id, params = {}) => fetchAPI(`/properties/${id}/ledger${buildQuery(params)}`),
};

// Assets API
export const assetsAPI = {
  getAll: (params = {}) => fetchAPI(`/assets${buildQuery(params)}`),
  getById: (id) => fetchAPI(`/assets/${id}`),
  create: (data) => fetchAPI('/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => fetchAPI(`/assets/${id}`, { method: 'DELETE' }),
  getByPerson: (personId) => fetchAPI(`/people/${personId}/assets`),
};

// Transactions API
export const transactionsAPI = {
  getAll: (params = {}) => fetchAPI(`/transactions${buildQuery(params)}`),
  getById: (id) => fetchAPI(`/transactions/${id}`),
  create: (data) => fetchAPI('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => fetchAPI(`/transactions/${id}`, { method: 'DELETE' }),
  getByPerson: (personId) => fetchAPI(`/people/${personId}/transactions`),
  getByBusiness: (businessId) => fetchAPI(`/businesses/${businessId}/transactions`),
  getByProperty: (propertyId) => fetchAPI(`/properties/${propertyId}/transactions`),
};

// Entity ledger + venue analytics API
export const ledgerAPI = {
  get: (entityType, id, params = {}) => fetchAPI(`/${entityType}/${id}/ledger${buildQuery(params)}`),
  venueStats: (businessId) => fetchAPI(`/businesses/${businessId}/venue-stats`),
};

export { API_BASE_URL };