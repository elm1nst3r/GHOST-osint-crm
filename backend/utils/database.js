// File: backend/utils/database.js
// Optimized database connection with proper pooling and error handling

const { Pool } = require('pg');
const logger = require('./logger');

class Database {
  constructor(config) {
    this.pool = new Pool({
      ...config,
      // Optimized pool settings
      max: 20, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients to keep
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
      maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
    });

    // Pool error handling
    this.pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', (client) => {
      logger.debug('New client connected to database');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Client removed from pool');
    });
  }

  // Execute a query with automatic error handling and timing
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.query(text, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', error, {
        query: text.substring(0, 100),
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  // Execute multiple queries in a transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get a client from the pool for multiple operations
  async getClient() {
    return await this.pool.connect();
  }

  // Check database health
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW()');
      return {
        healthy: true,
        timestamp: result.rows[0].now,
        poolStats: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  // Gracefully close all pool connections
  async close() {
    try {
      await this.pool.end();
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection pool', error);
      throw error;
    }
  }

  // Get pool statistics
  getStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }
}

module.exports = Database;
