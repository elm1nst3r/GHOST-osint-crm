// File: backend/middleware/requestLogger.js
// HTTP request logging middleware

const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req.method, req.path, res.statusCode, duration);
  });

  next();
}

module.exports = requestLogger;
