const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Universal search
router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ people: [], tools: [] });
  }

  try {
    const searchTerm = `%${q.toLowerCase()}%`;

    const peopleQuery = `
      SELECT id, first_name, last_name, category, case_name
      FROM people
      WHERE LOWER(first_name) LIKE $1
         OR LOWER(last_name) LIKE $1
         OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(aliases) AS alias WHERE LOWER(alias) LIKE $1)
         OR LOWER(case_name) LIKE $1
      LIMIT 10
    `;

    const toolsQuery = `
      SELECT id, name, category, description
      FROM tools
      WHERE LOWER(name) LIKE $1
         OR LOWER(description) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE LOWER(tag) LIKE $1)
      LIMIT 10
    `;

    const [peopleResult, toolsResult] = await Promise.all([
      pool.query(peopleQuery, [searchTerm]),
      pool.query(toolsQuery, [searchTerm])
    ]);

    res.json({
      people: peopleResult.rows,
      tools: toolsResult.rows
    });
  } catch (err) {
    console.error('Error in universal search:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Advanced search
router.get('/advanced', requireAuth, async (req, res) => {
  try {
    let query = 'SELECT * FROM people WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    if (req.query.searchText) {
      const searchConditions = [];
      const searchFields = req.query['searchIn[]'] || ['name'];

      if (searchFields.includes('name')) {
        searchConditions.push(`(LOWER(first_name) LIKE $${++paramCount} OR LOWER(last_name) LIKE $${paramCount} OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $${paramCount})`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }

      if (searchFields.includes('aliases')) {
        searchConditions.push(`EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE LOWER(a) LIKE $${++paramCount})`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }

      if (searchFields.includes('notes')) {
        searchConditions.push(`LOWER(notes) LIKE $${++paramCount}`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }

      if (searchConditions.length > 0) {
        query += ` AND (${searchConditions.join(' OR ')})`;
      }
    }

    if (req.query['categories[]']) {
      const categories = Array.isArray(req.query['categories[]'])
        ? req.query['categories[]']
        : [req.query['categories[]']];

      const placeholders = categories.map(() => `$${++paramCount}`).join(',');
      query += ` AND category IN (${placeholders})`;
      queryParams.push(...categories);
    }

    if (req.query['statuses[]']) {
      const statuses = Array.isArray(req.query['statuses[]'])
        ? req.query['statuses[]']
        : [req.query['statuses[]']];

      const placeholders = statuses.map(() => `$${++paramCount}`).join(',');
      query += ` AND status IN (${placeholders})`;
      queryParams.push(...statuses);
    }

    if (req.query.dateFrom && req.query.dateFilter !== 'all') {
      const dateField = req.query.dateFilter === 'created' ? 'created_at' : 'updated_at';
      query += ` AND ${dateField} >= $${++paramCount}`;
      queryParams.push(req.query.dateFrom);
    }

    if (req.query.dateTo && req.query.dateFilter !== 'all') {
      const dateField = req.query.dateFilter === 'created' ? 'created_at' : 'updated_at';
      query += ` AND ${dateField} <= $${++paramCount}`;
      queryParams.push(req.query.dateTo);
    }

    const allowedSortColumns = ['updated_at', 'created_at', 'first_name', 'last_name', 'status', 'category'];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'updated_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${++paramCount}`;
    queryParams.push(limit);

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
