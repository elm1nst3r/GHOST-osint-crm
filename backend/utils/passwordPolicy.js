// Centralised password strength policy — applied at every password-setting site.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '12345678', '123456789', '1234567890', 'qwertyui', 'qwertyuiop',
  'letmein12', 'letmein123', 'welcome12', 'welcome123', 'admin12345',
  'passw0rd', 'p@ssw0rd', 'iloveyou1', 'iloveyou12', 'qwerty123',
  'football1', 'monkey123', 'dragon123', 'master123', 'sunshine1',
  'princess1', 'superman1', 'batman123', 'trustno1!', 'abc123456',
]);

function validatePasswordStrength(password, { username } = {}) {
  const errors = [];
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, errors: ['Password is required.'] };
  }
  if (password.length < 12) errors.push('Must be at least 12 characters.');
  if (password.length > 128) errors.push('Must be at most 128 characters.');
  if (!/[a-z]/.test(password)) errors.push('Must contain at least one lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Must contain at least one digit.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) errors.push('Password is too common.');
  if (username && password.toLowerCase().includes(String(username).toLowerCase())) {
    errors.push('Password must not contain your username.');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validatePasswordStrength };
