// File: backend/middleware/validation.js
// Input validation utilities

// Sanitize string input to prevent XSS
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate URL format
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validate integer ID
function isValidId(id) {
  const numId = parseInt(id, 10);
  return !isNaN(numId) && numId > 0 && Number.isInteger(numId);
}

// Middleware to validate ID parameter
function validateIdParam(req, res, next) {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid ID parameter' });
  }

  req.params.id = parseInt(id, 10);
  next();
}

module.exports = {
  validateIdParam,
  sanitizeString,
  isValidEmail,
  isValidUrl,
  isValidId
};
