// File: backend/middleware/audit.js
const { pool } = require('../config/database');

// Audit logging middleware
const logAudit = async (entityType, entityId, action, changes = {}) => {
  try {
    const client = await pool.connect();
    
    for (const [fieldName, { oldValue, newValue }] of Object.entries(changes)) {
      await client.query(`
        INSERT INTO audit_logs (entity_type, entity_id, field_name, old_value, new_value, action)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entityType, entityId, fieldName, oldValue?.toString() || null, newValue?.toString() || null, action]);
    }
    
    client.release();
  } catch (err) {
    console.error('Error logging audit:', err);
  }
};

module.exports = {
  logAudit
};