const { pool } = require('../config/database');

// userId identifies who performed the action; pass req.session?.userId from
// the route. Without it the audit_logs row has a NULL user_id and the admin
// audit view renders every entry as "System" (issue #84).
const logAudit = async (entityType, entityId, action, changes = {}, userId = null) => {
  let client;
  try {
    client = await pool.connect();

    for (const [fieldName, { oldValue, newValue }] of Object.entries(changes)) {
      await client.query(`
        INSERT INTO audit_logs (entity_type, entity_id, field_name, old_value, new_value, action, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [entityType, entityId, fieldName, oldValue?.toString() || null, newValue?.toString() || null, action, userId || null]);
    }
  } catch (err) {
    console.error('Error logging audit:', err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = logAudit;
