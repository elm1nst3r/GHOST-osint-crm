// File: backend/utils/logger.js
// Centralized logging utility with different log levels

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      ...meta,
      error: error.message,
      stack: this.isDevelopment ? error.stack : undefined
    } : meta;

    console.error(this.formatMessage(LOG_LEVELS.ERROR, message, errorMeta));
  }

  warn(message, meta = {}) {
    console.warn(this.formatMessage(LOG_LEVELS.WARN, message, meta));
  }

  info(message, meta = {}) {
    console.log(this.formatMessage(LOG_LEVELS.INFO, message, meta));
  }

  debug(message, meta = {}) {
    if (this.isDevelopment) {
      console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }

  // Database query logging
  query(query, duration) {
    if (this.isDevelopment) {
      this.debug('Database Query', { query: query.substring(0, 100), duration: `${duration}ms` });
    }
  }

  // API request logging
  request(method, path, statusCode, duration) {
    const level = statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO;
    const message = `${method} ${path} - ${statusCode}`;

    if (level === LOG_LEVELS.WARN) {
      this.warn(message, { duration: `${duration}ms` });
    } else {
      this.info(message, { duration: `${duration}ms` });
    }
  }
}

module.exports = new Logger();
