// File: backend/routes/osintRecords.js
//
// Saved records (issue #96): results an integration returned, kept on a
// person exactly as the provider sent them. The table is described in
// migration 20261106000001_osint_records.js.
//
// Access follows the person's project: any member may list, search, save and
// delete records, as with the person's OSINT data.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, OsintRecordsAddSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const { applyProjectScope, requireProjectMember } = require('../utils/projectAccess');
const { recordHash, recordProblem } = require('../utils/osintRecords');
const logAudit = require('../utils/logAudit');

router.use(apiLimiter);

const RECORD_SELECT = `
  SELECT r.id, r.person_id, r.data, r.record_source, r.occurrences, r.tool_id, r.tool_name,
         r.integration_id, r.operation, r.query, r.retrieved_at, r.created_by, r.created_at, r.updated_at,
         p.project_id, p.first_name AS person_first_name, p.patronymic AS person_patronymic,
         p.last_name AS person_last_name
  FROM osint_records r
  JOIN people p ON p.id = r.person_id
`;

// LIKE pattern for text typed by the user: % and _ match themselves.
const likePattern = (text) => `%${String(text).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

async function loadRecord(id) {
  const { rows } = await pool.query(`${RECORD_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

// ── GET / — list or search saved records ─────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'p', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.person_id) {
      params.push(parseInt(req.query.person_id, 10));
      where.push(`r.person_id = $${params.length}`);
    }
    if (req.query.integration_id) {
      params.push(String(req.query.integration_id));
      where.push(`r.integration_id = $${params.length}`);
    }
    if (req.query.q) {
      // Any text anywhere in the record, its source or the search that found it.
      params.push(likePattern(req.query.q));
      const n = params.length;
      where.push(`(r.data::text ILIKE $${n} OR r.record_source ILIKE $${n} OR r.query ILIKE $${n})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataResult = await pool.query(
      `${RECORD_SELECT} ${whereSql}
       ORDER BY r.retrieved_at DESC NULLS LAST, r.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM osint_records r JOIN people p ON p.id = r.person_id ${whereSql}`, params
    );
    const total = countResult.rows[0].count;
    const hasMore = offset + dataResult.rows.length < total;
    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(hasMore));
    res.json({ data: dataResult.rows, meta: { total, limit, offset, hasMore } });
  } catch (err) {
    console.error('Error fetching records:', err.message);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ── GET /:id — one saved record ──────────────────────────────────────────────
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const record = await loadRecord(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const accessErr = await requireProjectMember(req, record.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });
    res.json(record);
  } catch (err) {
    console.error('Error fetching record:', err.message);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// ── POST / — save records on a person ────────────────────────────────────────
// A record the person already has from the same integration (same content,
// whatever the key order) is refreshed: latest search, date and count.
router.post('/', requireAuth, validate(OsintRecordsAddSchema), async (req, res) => {
  const { person_id: personId, records } = req.body;
  const client = await pool.connect();
  try {
    const person = await client.query('SELECT id, project_id FROM people WHERE id = $1', [personId]);
    if (person.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const accessErr = await requireProjectMember(req, person.rows[0].project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const rejected = [];
    const saved = [];
    let added = 0; let updated = 0; let unchanged = 0;
    await client.query('BEGIN');
    for (const [index, rec] of records.entries()) {
      const problem = recordProblem(rec.data);
      if (problem) { rejected.push({ index, error: problem }); continue; }
      const s = rec.source || {};
      const hash = recordHash(rec.data);
      const integrationId = s.integration_id || '';
      const retrievedAt = s.retrieved_at && !Number.isNaN(Date.parse(s.retrieved_at)) ? s.retrieved_at : new Date().toISOString();
      const { rows } = await client.query(
        `INSERT INTO osint_records (person_id, data, data_hash, record_source, occurrences, tool_id, tool_name,
                                    integration_id, operation, query, retrieved_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT ON CONSTRAINT osint_records_unique DO UPDATE SET
           record_source = COALESCE(EXCLUDED.record_source, osint_records.record_source),
           occurrences = EXCLUDED.occurrences,
           tool_id = COALESCE(EXCLUDED.tool_id, osint_records.tool_id),
           tool_name = COALESCE(EXCLUDED.tool_name, osint_records.tool_name),
           operation = COALESCE(EXCLUDED.operation, osint_records.operation),
           query = COALESCE(EXCLUDED.query, osint_records.query),
           retrieved_at = EXCLUDED.retrieved_at
         -- A save with less detail (no tool name, no source) never blanks what
         -- the record already says about where it came from.
         WHERE (osint_records.retrieved_at, osint_records.occurrences,
                osint_records.query, osint_records.record_source, osint_records.tool_name)
               IS DISTINCT FROM (EXCLUDED.retrieved_at, EXCLUDED.occurrences,
                COALESCE(EXCLUDED.query, osint_records.query),
                COALESCE(EXCLUDED.record_source, osint_records.record_source),
                COALESCE(EXCLUDED.tool_name, osint_records.tool_name))
         RETURNING id, (xmax = 0) AS inserted`,
        [personId, JSON.stringify(rec.data), hash, rec.record_source || null, rec.occurrences || 1,
          s.tool_id || null, s.tool_name || null, integrationId, s.operation || null, s.query ?? null,
          retrievedAt, req.session?.userId || null]
      );
      if (rows.length) {
        if (rows[0].inserted) added += 1; else updated += 1;
        saved.push({ index, id: rows[0].id });
      } else {
        unchanged += 1;
        const existing = await client.query(
          'SELECT id FROM osint_records WHERE person_id = $1 AND integration_id = $2 AND data_hash = $3',
          [personId, integrationId, hash]
        );
        saved.push({ index, id: existing.rows[0].id });
      }
    }
    await client.query('COMMIT');

    if (added || updated) {
      const from = records[0].source?.tool_name || 'import';
      await logAudit('person', personId, 'update', {
        osint_records: { oldValue: null, newValue: `+${added} new records, ${updated} refreshed, from ${from}` },
      }, req.session?.userId);
    }
    res.status(added ? 201 : 200).json({ added, updated, unchanged, rejected, saved });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error saving records:', err.message);
    res.status(500).json({ error: 'Failed to save records' });
  } finally {
    client.release();
  }
});

// ── DELETE /:id — remove a saved record ──────────────────────────────────────
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const record = await loadRecord(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const accessErr = await requireProjectMember(req, record.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });
    await pool.query('DELETE FROM osint_records WHERE id = $1', [record.id]);
    await logAudit('person', record.person_id, 'update', {
      osint_records: { oldValue: `record ${record.id} from ${record.tool_name || record.integration_id || 'import'}`, newValue: null },
    }, req.session?.userId);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Error deleting record:', err.message);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
