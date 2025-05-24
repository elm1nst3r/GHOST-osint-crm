// File: frontend/src/utils/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Generic fetch wrapper with error handling
const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// People API
export const peopleAPI = {
  getAll: () => fetchAPI('/people'),
  
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

// Tools API
export const toolsAPI = {
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
  getAll: () => fetchAPI('/todos'),
  
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
  getAll: () => fetchAPI('/cases'),
  
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

// Export/Import API
export const exportAPI = {
  export: () => fetchAPI('/export'),
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

export { API_BASE_URL };