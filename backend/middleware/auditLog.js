// Audit logging middleware
const { pool } = require('../config/database');

/**
 * Log an action to the audit_logs table
 * @param {string} entityType - Type of entity (e.g., 'person', 'case', 'tool')
 * @param {number} entityId - ID of the entity
 * @param {string} action - Action performed (e.g., 'create', 'update', 'delete')
 * @param {number} userId - ID of the user performing the action
 * @param {string} fieldName - Optional field name for updates
 * @param {string} oldValue - Optional old value for updates
 * @param {string} newValue - Optional new value for updates
 */
const logAudit = async (entityType, entityId, action, userId, fieldName = null, oldValue = null, newValue = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, field_name, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entityType, entityId, action, userId, fieldName, oldValue, newValue]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
    // Don't throw - we don't want audit logging failures to break the main operation
  }
};

/**
 * Compare two objects and log the differences
 * @param {string} entityType - Type of entity
 * @param {number} entityId - ID of the entity
 * @param {object} oldData - Old data object
 * @param {object} newData - New data object
 * @param {number} userId - ID of the user performing the action
 */
const logFieldChanges = async (entityType, entityId, oldData, newData, userId) => {
  const fieldsToSkip = ['updated_at', 'created_at'];

  for (const field in newData) {
    if (fieldsToSkip.includes(field)) continue;

    const oldValue = oldData[field];
    const newValue = newData[field];

    // Convert to strings for comparison
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      await logAudit(
        entityType,
        entityId,
        'update',
        userId,
        field,
        oldStr,
        newStr
      );
    }
  }
};

/**
 * Middleware to attach audit logging helpers to request
 */
const auditMiddleware = (req, res, next) => {
  req.audit = {
    log: async (entityType, entityId, action, fieldName = null, oldValue = null, newValue = null) => {
      const userId = req.session?.userId || null;
      await logAudit(entityType, entityId, action, userId, fieldName, oldValue, newValue);
    },
    logChanges: async (entityType, entityId, oldData, newData) => {
      const userId = req.session?.userId || null;
      await logFieldChanges(entityType, entityId, oldData, newData, userId);
    }
  };
  next();
};

module.exports = {
  logAudit,
  logFieldChanges,
  auditMiddleware
};
