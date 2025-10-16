// File: backend/middleware/validation.js
// Input validation middleware

const logger = require('../utils/logger');

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

// Validate date format
function isValidDate(dateString) {
  if (!dateString) return true; // Allow empty dates
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// SQL injection detection (basic)
function containsSqlInjection(str) {
  if (typeof str !== 'string') return false;
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi
  ];
  return sqlPatterns.some(pattern => pattern.test(str));
}

// Middleware to validate person data
function validatePersonData(req, res, next) {
  const { firstName, lastName, dateOfBirth, category, status, crmStatus, caseName, notes, profilePictureUrl } = req.body;

  // Required fields
  if (!firstName || typeof firstName !== 'string' || firstName.trim() === '') {
    return res.status(400).json({ error: 'First name is required and must be a non-empty string' });
  }

  // Check for SQL injection attempts
  if (containsSqlInjection(firstName) || containsSqlInjection(lastName) || containsSqlInjection(notes)) {
    logger.warn('Potential SQL injection attempt detected', {
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  // Sanitize string inputs
  req.body.firstName = sanitizeString(firstName);
  if (lastName) req.body.lastName = sanitizeString(lastName);
  if (notes) req.body.notes = sanitizeString(notes);
  if (category) req.body.category = sanitizeString(category);
  if (status) req.body.status = sanitizeString(status);
  if (crmStatus) req.body.crmStatus = sanitizeString(crmStatus);
  if (caseName) req.body.caseName = sanitizeString(caseName);

  // Validate date
  if (dateOfBirth && !isValidDate(dateOfBirth)) {
    return res.status(400).json({ error: 'Invalid date of birth format' });
  }

  // Validate URL if provided
  if (profilePictureUrl && profilePictureUrl.trim() !== '') {
    if (!isValidUrl(profilePictureUrl) && !profilePictureUrl.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid profile picture URL format' });
    }
  }

  // Validate aliases array
  if (req.body.aliases && !Array.isArray(req.body.aliases)) {
    return res.status(400).json({ error: 'Aliases must be an array' });
  }

  next();
}

// Middleware to validate tool data
function validateToolData(req, res, next) {
  const { name, link, description, category } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Tool name is required and must be a non-empty string' });
  }

  // Check for SQL injection
  if (containsSqlInjection(name) || containsSqlInjection(description)) {
    logger.warn('Potential SQL injection attempt detected', {
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  // Sanitize inputs
  req.body.name = sanitizeString(name);
  if (description) req.body.description = sanitizeString(description);
  if (category) req.body.category = sanitizeString(category);

  // Validate URL if provided
  if (link && link.trim() !== '' && !isValidUrl(link)) {
    return res.status(400).json({ error: 'Invalid tool link URL format' });
  }

  next();
}

// Middleware to validate business data
function validateBusinessData(req, res, next) {
  const { name, email, website, phone } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Business name is required and must be a non-empty string' });
  }

  // Check for SQL injection
  if (containsSqlInjection(name)) {
    logger.warn('Potential SQL injection attempt detected', {
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  // Sanitize inputs
  req.body.name = sanitizeString(name);

  // Validate email if provided
  if (email && email.trim() !== '' && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate website URL if provided
  if (website && website.trim() !== '' && !isValidUrl(website)) {
    return res.status(400).json({ error: 'Invalid website URL format' });
  }

  // Validate phone (basic check)
  if (phone && typeof phone === 'string') {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
  }

  next();
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

// Rate limiting helper (simple in-memory implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const userData = requestCounts.get(ip);

  if (now > userData.resetTime) {
    userData.count = 1;
    userData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  userData.count++;

  if (userData.count > MAX_REQUESTS) {
    logger.warn('Rate limit exceeded', { ip, count: userData.count });
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  next();
}

// Clean up old rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

module.exports = {
  validatePersonData,
  validateToolData,
  validateBusinessData,
  validateIdParam,
  rateLimit,
  sanitizeString,
  isValidEmail,
  isValidUrl,
  isValidId
};
