// Authentication API utilities
// Match the base URL pattern from api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const authAPI = {
  // Login
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  },

  // Logout
  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Logout failed');
    }

    return response.json();
  },

  // Get current session
  getSession: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to get session');
    }

    return response.json();
  },

  // Get current user details
  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user details');
    }

    return response.json();
  },

  // Update current user profile
  updateProfile: async (data) => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    return response.json();
  }
};

export const usersAPI = {
  // Get all users (admin only)
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }

    return response.json();
  },

  // Get user by ID (admin only)
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user');
    }

    return response.json();
  },

  // Create new user (admin only)
  create: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    return response.json();
  },

  // Update user (admin only)
  update: async (id, userData) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }

    return response.json();
  },

  // Delete user (admin only)
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  }
};

export const auditLogsAPI = {
  // Get audit logs with filtering (admin only)
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const response = await fetch(`${API_BASE_URL}/audit-logs?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch audit logs');
    }

    return response.json();
  },

  // Get audit logs for specific entity (admin only)
  getForEntity: async (entityType, entityId, filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const response = await fetch(
      `${API_BASE_URL}/audit-logs/entity/${entityType}/${entityId}?${params}`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch audit logs');
    }

    return response.json();
  },

  // Get audit log statistics (admin only)
  getStats: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const response = await fetch(`${API_BASE_URL}/audit-logs/stats?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch audit log statistics');
    }

    return response.json();
  }
};
