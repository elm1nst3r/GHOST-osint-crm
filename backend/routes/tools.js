const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, ToolBulkImportSchema, ToolCreateSchema, ToolUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');


router.use(apiLimiter);
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tools ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tools:', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

router.post('/', requireAuth, validate(ToolCreateSchema), async (req, res) => {
  const { name, link, description, category, status, tags, notes } = req.body;

  const query = `INSERT INTO tools (name, link, description, category, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null];

  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating tool:', err.message);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// POST /bulk-import — create many tools in one request.
//
// One request rather than one per row: a few hundred tools would otherwise
// trip the rate limiter and take minutes. Rows are handled individually so one
// bad row can't lose the rest, and the response reports what happened to each.
//
// Duplicates are matched on name, case-insensitively — `tools` has no unique
// constraint on name, so this is the only sensible key.
router.post('/bulk-import', requireAuth, validate(ToolBulkImportSchema), async (req, res) => {
  const { tools, mode } = req.body;

  // Spreadsheets hold bare domains far more often than full URLs.
  const normalizeLink = (raw) => {
    const value = (raw || '').trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
    return value;
  };

  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const existing = await pool.query('SELECT id, name FROM tools');
    const byName = new Map(existing.rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
    // Names appearing twice within the file itself: the first wins, the rest
    // are reported rather than silently creating duplicates.
    const seenInFile = new Set();

    for (let i = 0; i < tools.length; i++) {
      const row = tools[i];
      const name = row.name.trim();
      const key = name.toLowerCase();

      try {
        if (seenInFile.has(key)) {
          result.skipped++;
          result.errors.push({ index: i, name, message: 'Duplicate name within the imported file' });
          continue;
        }
        seenInFile.add(key);

        // '' and undefined both mean "not supplied" here, so they become null
        // and COALESCE preserves whatever is already stored.
        const blankToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : v);
        const values = [
          name,
          normalizeLink(row.link),
          blankToNull(row.description),
          blankToNull(row.category),
          blankToNull(row.status),
          row.tags || [],
          blankToNull(row.notes),
        ];

        const existingId = byName.get(key);
        if (existingId) {
          if (mode !== 'update') { result.skipped++; continue; }
          // Only overwrite what the row actually supplies. A partial file —
          // say name and description only — must not blank out the links and
          // categories of every tool it touches.
          await pool.query(
            `UPDATE tools SET name = $1,
                              link = COALESCE($2, link),
                              description = COALESCE($3, description),
                              category = COALESCE($4, category),
                              status = COALESCE($5, status),
                              tags = CASE WHEN $6::text[] IS NULL OR cardinality($6::text[]) = 0
                                          THEN tags ELSE $6::text[] END,
                              notes = COALESCE($7, notes),
                              updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [...values, existingId]
          );
          result.updated++;
        } else {
          const inserted = await pool.query(
            `INSERT INTO tools (name, link, description, category, status, tags, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            values
          );
          byName.set(key, inserted.rows[0].id);
          result.created++;
        }
      } catch (err) {
        result.errors.push({ index: i, name, message: err.message });
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Error bulk importing tools:', err.message);
    res.status(500).json({ error: 'Failed to import tools' });
  }
});

router.put('/:id', requireAuth, validateIdParam, validate(ToolUpdateSchema), async (req, res) => {
  const toolId = req.params.id;
  const { name, link, description, category, status, tags, notes } = req.body;

  const query = `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7 WHERE id = $8 RETURNING *;`;
  const values = [name, link || null, description || null, category || null, status || null, tags || [], notes || null, toolId];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating tool:', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const toolId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING *;', [toolId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] });
  } catch (err) {
    console.error('Error deleting tool:', err.message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

module.exports = router;
