const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiters');
const { applyProjectScope } = require('../utils/projectAccess');
const { connectionsSql, incomingConnectionsSql, isAdmin } = require('../utils/personConnectionsSql');
const { buildSearch, snippet } = require('../utils/searchQuery');
const { visibilityCondition, sessionUser } = require('../utils/toolAccess');


router.use(apiLimiter);
// ── GET / — search everything (search-and-command-palette plan) ─────────────
// Reads search_index (kept current by triggers, see migration
// 20261121000002_search_index.js): every word must be in a record, as the
// start of a word or inside one; phone numbers match however they were
// written. Results come grouped by type, best first, `limit` per type, each
// with the number found and a snippet of where it matched.
//
// `people` and `tools` keep the shape this endpoint had before, for existing
// API and MCP clients.
const SEARCH_TYPES = ['person', 'business', 'crypto_wallet', 'property', 'asset', 'case', 'todo', 'file', 'wireless_network'];

const listParam = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [])
  .map((x) => String(x).trim()).filter(Boolean);

router.get('/', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const search = q.length >= 2 ? buildSearch(q) : null;
  const empty = { query: q, groups: [], people: [], tools: [] };
  if (!search) return res.json(empty);

  const requested = listParam(req.query.types);
  const types = requested.length ? SEARCH_TYPES.filter((t) => requested.includes(t)) : SEARCH_TYPES;
  const wantTools = !requested.length || requested.includes('tool');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);

  try {
    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'si', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });

    const p = (value) => { params.push(value); return `$${params.length}`; };
    where.push(`si.entity_type = ANY(${p(types)}::text[])`);
    const tsq = p(search.tsquery);
    const matches = [`(${tsq}::text IS NOT NULL AND si.tsv @@ to_tsquery('simple', ${tsq}::text))`,
      `si.search_text ILIKE ALL(${p(search.likes)}::text[])`];
    if (search.phone) matches.push(`si.search_text ~ ${p(search.phone)}`);
    where.push(`(${matches.join(' OR ')})`);
    const exact = p(q.toLowerCase());
    const prefix = p(`${q.replace(/[\\%_]/g, '\\$&')}%`);
    const anywhere = p(`%${q.replace(/[\\%_]/g, '\\$&')}%`);

    const { rows } = types.length ? await pool.query(`
      WITH hits AS (
        SELECT si.entity_type, si.entity_id, si.project_id, si.title, si.subtitle, si.body, si.updated_at,
          (CASE WHEN ${tsq}::text IS NULL THEN 0 ELSE ts_rank_cd(si.tsv, to_tsquery('simple', ${tsq}::text)) END)
          + CASE WHEN lower(si.title) = ${exact} THEN 3
                 WHEN si.title ILIKE ${prefix} THEN 2
                 WHEN si.title ILIKE ${anywhere} THEN 1 ELSE 0 END AS rank
        FROM search_index si
        WHERE ${where.join(' AND ')}
      ), ranked AS (
        SELECT h.*,
          row_number() OVER (PARTITION BY h.entity_type ORDER BY h.rank DESC, h.updated_at DESC, h.entity_id DESC) AS n,
          count(*) OVER (PARTITION BY h.entity_type)::int AS total
        FROM hits h
      )
      SELECT r.entity_type, r.entity_id, r.project_id, pr.name AS project_name, r.title, r.subtitle,
             r.body, r.rank, r.total
      FROM ranked r JOIN projects pr ON pr.id = r.project_id
      WHERE r.n <= ${p(limit)}
      ORDER BY r.rank DESC, r.updated_at DESC, r.entity_type, r.entity_id
    `, params) : { rows: [] };

    const groups = [];
    const byType = new Map();
    for (const row of rows) {
      let group = byType.get(row.entity_type);
      if (!group) {
        group = { type: row.entity_type, total: row.total, items: [] };
        byType.set(row.entity_type, group);
        groups.push(group); // in the order of each type's best result
      }
      group.items.push({
        type: row.entity_type,
        id: row.entity_id,
        project_id: row.project_id,
        project_name: row.project_name,
        title: row.title,
        subtitle: row.subtitle,
        snippet: snippet(row.body, search),
        rank: Math.round(Number(row.rank) * 1000) / 1000,
      });
    }

    // The previous response shape.
    const personIds = (byType.get('person')?.items || []).map((i) => i.id);
    const people = personIds.length ? (await pool.query(
      `SELECT id, first_name, last_name, patronymic, category, case_name FROM people WHERE id = ANY($1::int[])`,
      [personIds])).rows.sort((a, b) => personIds.indexOf(a.id) - personIds.indexOf(b.id)) : [];

    // Tools aren't per project; only the ones this user may use (they were
    // all listed before, including other users' private tools).
    let tools = [];
    if (wantTools) {
      const toolParams = [`%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`];
      const visible = visibilityCondition(sessionUser(req), {}, toolParams);
      tools = (await pool.query(`
        SELECT t.id, t.name, t.category, t.description
        FROM tools t
        WHERE ${visible}
          AND (LOWER(t.name) LIKE $1 OR LOWER(t.description) LIKE $1
               OR EXISTS (SELECT 1 FROM unnest(t.tags) AS tag WHERE LOWER(tag) LIKE $1))
        ORDER BY t.name, t.id
        LIMIT ${limit}
      `, toolParams)).rows;
    }

    res.json({ query: q, groups, people, tools });
  } catch (err) {
    console.error('Error in search:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Advanced search
router.get('/advanced', requireAuth, async (req, res) => {
  try {
    let query = 'SELECT * FROM people WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    const scopeWhere = [];
    const scopeErr = await applyProjectScope(req, 'people', scopeWhere, queryParams);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    paramCount = queryParams.length;
    if (scopeWhere.length) query += ` AND ${scopeWhere.join(' AND ')}`;

    if (typeof req.query.searchText === 'string' && req.query.searchText) {
      const searchConditions = [];
      const searchFields = req.query['searchIn[]'] || ['name'];
      const searchTextLower = req.query.searchText.toLowerCase();

      if (searchFields.includes('name')) {
        searchConditions.push(`(LOWER(first_name) LIKE $${++paramCount} OR LOWER(last_name) LIKE $${paramCount} OR LOWER(patronymic) LIKE $${paramCount} OR LOWER(CONCAT_WS(' ', first_name, NULLIF(patronymic, ''), NULLIF(last_name, ''))) LIKE $${paramCount})`);
        queryParams.push(`%${searchTextLower}%`);
      }

      if (searchFields.includes('aliases')) {
        searchConditions.push(`EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE LOWER(a) LIKE $${++paramCount})`);
        queryParams.push(`%${searchTextLower}%`);
      }

      if (searchFields.includes('notes')) {
        searchConditions.push(`LOWER(notes) LIKE $${++paramCount}`);
        queryParams.push(`%${searchTextLower}%`);
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
    // Live connections, not the stale people.connections column (#83), and
    // who links to each person (#112), the same as the people list.
    let viewerParam = null;
    if (!isAdmin(req)) {
      queryParams.push(req.session.userId);
      viewerParam = `$${++paramCount}`;
    }
    query = query.replace('SELECT * FROM people',
      `SELECT people.*, ${connectionsSql('people')}, ${incomingConnectionsSql('people', viewerParam)} FROM people`);
    query += ` ORDER BY ${sortBy} ${sortOrder}, people.id ${sortOrder} LIMIT $${++paramCount}`;
    queryParams.push(limit);

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
