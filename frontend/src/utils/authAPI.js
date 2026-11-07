// Authentication API utilities
// Match the base URL pattern from api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// JSON request that throws an Error carrying the server's `code` and the
// HTTP status, so callers can show a translated message for known cases.
async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export const authAPI = {
  // Login. With two-factor on, the answer is { mfa_required, methods } and
  // one of the mfa* calls below finishes the sign-in (issue #90).
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  // How this instance signs in: { local, sso: { name, url } | null } (issue #105).
  methods: () => request('/auth/methods'),
  mfaVerifyCode: (code) => request('/auth/mfa/verify', { method: 'POST', body: { code } }),
  mfaVerifyRecoveryCode: (recoveryCode) => request('/auth/mfa/verify', { method: 'POST', body: { recovery_code: recoveryCode } }),
  mfaPasskeyOptions: () => request('/auth/mfa/passkey/options', { method: 'POST' }),
  mfaPasskeyVerify: (response) => request('/auth/mfa/passkey/verify', { method: 'POST', body: { response } }),

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
      // Not "signed out": the server couldn't say (rate limit, restart…).
      const error = new Error('Failed to get session');
      error.status = response.status;
      const retryAfter = Number(response.headers.get('Retry-After'));
      if (Number.isFinite(retryAfter) && response.headers.has('Retry-After')) error.retryAfter = retryAfter;
      throw error;
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

// The signed-in user's own sign-in security (issue #90).
export const accountAPI = {
  getSecurity: () => request('/account/security'),
  startTotpSetup: () => request('/account/totp/setup', { method: 'POST' }),
  enableTotp: (code) => request('/account/totp', { method: 'POST', body: { code } }),
  disableTotp: (password) => request('/account/totp', { method: 'DELETE', body: { password } }),
  replaceRecoveryCodes: (password) => request('/account/recovery-codes', { method: 'POST', body: { password } }),
  passkeyOptions: () => request('/account/passkeys/options', { method: 'POST' }),
  addPasskey: (response, name) => request('/account/passkeys', { method: 'POST', body: { response, name } }),
  removePasskey: (id, password) => request(`/account/passkeys/${id}`, { method: 'DELETE', body: { password } }),
  getTokens: () => request('/account/tokens'),
  createToken: ({ name, expiresInDays, password }) =>
    request('/account/tokens', { method: 'POST', body: { name, expires_in_days: expiresInDays, password } }),
  revokeToken: (id) => request(`/account/tokens/${id}`, { method: 'DELETE' }),
};

// Admin: "require two-factor for everyone".
export const securitySettingsAPI = {
  get: () => request('/settings/security'),
  update: (mfaRequired) => request('/settings/security', { method: 'PUT', body: { mfa_required: mfaRequired } }),
};

export const usersAPI = {
  // Admin: remove a user's authenticator app, passkeys and recovery codes.
  resetTwoFactor: (id) => request(`/users/${id}/two-factor`, { method: 'DELETE' }),

  // Single sign-on (issue #105, admin): status, waiting sign-ins, linking.
  ssoStatus: () => request('/users/sso'),
  linkSso: (pendingId, userId) => request(`/users/sso/pending/${pendingId}/link`, { method: 'POST', body: { user_id: userId } }),
  createFromSso: (pendingId, role) => request(`/users/sso/pending/${pendingId}/create`, { method: 'POST', body: { role } }),
  dismissSso: (pendingId) => request(`/users/sso/pending/${pendingId}`, { method: 'DELETE' }),
  ssoIdentities: (userId) => request(`/users/${userId}/sso`),
  unlinkSso: (userId, identityId) => request(`/users/${userId}/sso/${identityId}`, { method: 'DELETE' }),

  // Lightweight directory (any authenticated user) — id/username/email only,
  // for a Project Manager's "add member" picker (issue #84). Not admin-only,
  // unlike everything else here.
  getDirectory: async () => {
    const response = await fetch(`${API_BASE_URL}/users/directory`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user directory');
    }

    return response.json();
  },

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
