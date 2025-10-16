// File: backend/middleware/errorHandler.js
// Centralized error handling middleware

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send error response
  res.status(statusCode).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

module.exports = errorHandler;
