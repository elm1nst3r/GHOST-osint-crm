// Audit logs routes (admin only)
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// Get audit logs with filtering and pagination
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      entity_type,
      entity_id,
      user_id,
      action,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        al.*,
        u.username,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const values = [];
    let valueIndex = 1;

    if (entity_type) {
      query += ` AND al.entity_type = $${valueIndex++}`;
      values.push(entity_type);
    }

    if (entity_id) {
      query += ` AND al.entity_id = $${valueIndex++}`;
      values.push(entity_id);
    }

    if (user_id) {
      query += ` AND al.user_id = $${valueIndex++}`;
      values.push(user_id);
    }

    if (action) {
      query += ` AND al.action = $${valueIndex++}`;
      values.push(action);
    }

    if (start_date) {
      query += ` AND al.created_at >= $${valueIndex++}`;
      values.push(start_date);
    }

    if (end_date) {
      query += ` AND al.created_at <= $${valueIndex++}`;
      values.push(end_date);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${valueIndex++} OFFSET $${valueIndex++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM audit_logs al WHERE 1=1`;
    const countValues = [];
    let countIndex = 1;

    if (entity_type) {
      countQuery += ` AND al.entity_type = $${countIndex++}`;
      countValues.push(entity_type);
    }

    if (entity_id) {
      countQuery += ` AND al.entity_id = $${countIndex++}`;
      countValues.push(entity_id);
    }

    if (user_id) {
      countQuery += ` AND al.user_id = $${countIndex++}`;
      countValues.push(user_id);
    }

    if (action) {
      countQuery += ` AND al.action = $${countIndex++}`;
      countValues.push(action);
    }

    if (start_date) {
      countQuery += ` AND al.created_at >= $${countIndex++}`;
      countValues.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND al.created_at <= $${countIndex++}`;
      countValues.push(end_date);
    }

    const countResult = await pool.query(countQuery, countValues);

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit logs for a specific entity
router.get('/entity/:entity_type/:entity_id', requireAdmin, async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT
        al.*,
        u.username,
        u.first_name,
        u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = $1 AND al.entity_id = $2
       ORDER BY al.created_at DESC
       LIMIT $3 OFFSET $4`,
      [entity_type, entity_id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM audit_logs WHERE entity_type = $1 AND entity_id = $2',
      [entity_type, entity_id]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching entity audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit log statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const values = [];
    let valueIndex = 1;

    if (start_date) {
      dateFilter += ` AND created_at >= $${valueIndex++}`;
      values.push(start_date);
    }

    if (end_date) {
      dateFilter += ` AND created_at <= $${valueIndex++}`;
      values.push(end_date);
    }

    // Get stats by action
    const actionStats = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE 1=1 ${dateFilter}
       GROUP BY action
       ORDER BY count DESC`,
      values
    );

    // Get stats by entity type
    const entityStats = await pool.query(
      `SELECT entity_type, COUNT(*) as count
       FROM audit_logs
       WHERE 1=1 ${dateFilter}
       GROUP BY entity_type
       ORDER BY count DESC`,
      values
    );

    // Get stats by user
    const userStats = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        COUNT(*) as count
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE 1=1 ${dateFilter}
       GROUP BY u.id, u.username, u.first_name, u.last_name
       ORDER BY count DESC
       LIMIT 10`,
      values
    );

    // Get recent activity
    const recentActivity = await pool.query(
      `SELECT
        al.*,
        u.username,
        u.first_name,
        u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE 1=1 ${dateFilter}
       ORDER BY al.created_at DESC
       LIMIT 20`,
      values
    );

    res.json({
      byAction: actionStats.rows,
      byEntityType: entityStats.rows,
      byUser: userStats.rows,
      recentActivity: recentActivity.rows
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
