// File: backend/routes/integrations.js
//
// Installed integration manifests (issue #96). Anyone signed in can list them
// (the tool form needs the choices); only admins install or remove them.
// Built-ins come with GHOST and can't be removed; imported ones are the
// community manifests an admin chose to add.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, IntegrationImportSchema, IntegrationDraftTestSchema, IntegrationDraftMapSchema } = require('../middleware/schemas');
const { apiLimiter, integrationLimiter } = require('../middleware/rateLimiters');
const { testDraft, previewMapping } = require('../services/integrations/draft');
const registry = require('../services/integrations/registry');
const { validateManifest, publicSummary } = require('../services/integrations/manifest');

router.use(apiLimiter);

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT integration_id, COUNT(*)::int AS n FROM tools WHERE integration_id IS NOT NULL GROUP BY integration_id');
    const usage = new Map(rows.map((r) => [r.integration_id, r.n]));
    const list = (await registry.summaries(pool)).map((s) => ({ ...s, tool_count: usage.get(s.id) || 0 }));
    res.json(list);
  } catch (err) {
    console.error('Error listing integrations:', err.message);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

// ── Integration builder ──────────────────────────────────────────────────────
// Admin-only: a test call reaches any public HTTPS host the draft names, so
// it's limited to the people who can install integrations anyway. The test
// key is used for this one request and never stored.
router.post('/draft/test', requireAdmin, integrationLimiter, validate(IntegrationDraftTestSchema), async (req, res) => {
  const { manifest, operation_id, input, secret } = req.body;
  try {
    const result = await testDraft({ draft: manifest, operationId: operation_id, input, secret });
    if (result.invalid) return res.status(400).json({ error: 'The integration is not complete yet', details: result.errors });
    await req.audit.log('integration', 0, 'test', 'draft', null, JSON.stringify({
      host: (() => { try { return new URL(manifest.baseUrl).host; } catch { return null; } })(),
      status: result.status ?? null,
    }));
    res.json(result);
  } catch (err) {
    console.error('Error testing draft integration:', err.message);
    res.status(500).json({ error: 'The test call failed' });
  }
});

router.post('/draft/map', requireAdmin, validate(IntegrationDraftMapSchema), async (req, res) => {
  const { results, json } = req.body;
  const mapped = previewMapping(results, json);
  if (mapped.errors) return res.status(400).json({ error: 'The result fields are not complete yet', details: mapped.errors });
  res.json(mapped);
});

// The full manifest, so anyone can see exactly what a tool sends where.
router.get('/:integrationId', requireAuth, async (req, res) => {
  try {
    const entry = await registry.getManifest(pool, req.params.integrationId);
    if (!entry) return res.status(404).json({ error: 'Integration not found' });
    res.json({ summary: publicSummary(entry.manifest, entry.source), manifest: entry.manifest });
  } catch (err) {
    console.error('Error fetching integration:', err.message);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

router.post('/', requireAdmin, validate(IntegrationImportSchema), async (req, res) => {
  const { manifest: raw, replace } = req.body;
  try {
    const { manifest, errors } = validateManifest(raw);
    if (errors) return res.status(400).json({ error: 'The integration file is not valid', details: errors });
    if (registry.builtinIds().has(manifest.id)) {
      return res.status(409).json({ error: `"${manifest.id}" is a built-in integration and can't be replaced` });
    }
    const existing = await registry.getManifest(pool, manifest.id);
    if (existing && !replace) {
      return res.status(409).json({ error: `An integration with id "${manifest.id}" is already installed`, exists: true });
    }
    await pool.query(
      `INSERT INTO integration_manifests (id, manifest, source, installed_by) VALUES ($1, $2, 'imported', $3)
       ON CONFLICT (id) DO UPDATE SET manifest = EXCLUDED.manifest, installed_by = EXCLUDED.installed_by, updated_at = CURRENT_TIMESTAMP
       WHERE integration_manifests.source = 'imported'`,
      [manifest.id, JSON.stringify(manifest), req.session.userId]
    );
    await req.audit.log('integration', 0, existing ? 'update' : 'create', 'manifest', null,
      JSON.stringify({ id: manifest.id, host: new URL(manifest.baseUrl).host }));
    res.status(existing ? 200 : 201).json(publicSummary(manifest, 'imported'));
  } catch (err) {
    console.error('Error installing integration:', err.message);
    res.status(500).json({ error: 'Failed to install the integration' });
  }
});

router.delete('/:integrationId', requireAdmin, async (req, res) => {
  try {
    const entry = await registry.getManifest(pool, req.params.integrationId);
    if (!entry) return res.status(404).json({ error: 'Integration not found' });
    if (entry.source === 'builtin') return res.status(409).json({ error: 'Built-in integrations can\'t be removed; disable their tools instead' });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM tools WHERE integration_id = $1', [entry.manifest.id]);
    if (rows[0].n > 0) {
      return res.status(409).json({ error: `${rows[0].n} tool(s) still use this integration. Delete or change them first.`, tool_count: rows[0].n });
    }
    await pool.query('DELETE FROM integration_manifests WHERE id = $1', [entry.manifest.id]);
    await req.audit.log('integration', 0, 'delete', 'manifest', JSON.stringify({ id: entry.manifest.id }), null);
    res.json({ message: 'Integration removed' });
  } catch (err) {
    console.error('Error removing integration:', err.message);
    res.status(500).json({ error: 'Failed to remove the integration' });
  }
});

module.exports = router;
