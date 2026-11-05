// File: backend/routes/tools.js
//
// OSINT tools: links, and integrated tools GHOST can call (issue #96).
// Who sees and manages what is in utils/toolAccess.js; the integration engine
// is services/integrations/. API keys are write-only: nothing here ever
// returns one, only whether one is stored.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  validate, ToolBulkImportSchema, ToolCreateSchema, ToolUpdateSchema, ToolCredentialSchema, ToolRunSchema,
  ToolExportSchema, ToolFileImportSchema,
} = require('../middleware/schemas');
const { apiLimiter, integrationLimiter } = require('../middleware/rateLimiters');
const { requireProjectMember } = require('../utils/projectAccess');
const {
  visibilityCondition, canManageTool, allowedVisibilities, allowUserTools, sessionUser,
} = require('../utils/toolAccess');
const registry = require('../services/integrations/registry');
const { validateManifest, publicSummary, requiresKey } = require('../services/integrations/manifest');
const { runOperation, testConnection, RunError } = require('../services/integrations/runner');
const { encryptAtRest, decryptAtRest, encryptWithPassphrase, decryptWithPassphrase } = require('../utils/secretBox');
const { version: APP_VERSION } = require('../package.json');

router.use(apiLimiter);

// ── helpers ──────────────────────────────────────────────────────────────────

// Spreadsheets and hand-written files hold bare domains far more often than
// full URLs.
const normalizeLink = (raw) => {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return value;
};

const blankToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : v);

const TOOL_SELECT = (uidParam) => `
  SELECT t.*, u.username AS owner_username,
    COALESCE((SELECT array_agg(tp.project_id ORDER BY tp.project_id) FROM tool_projects tp WHERE tp.tool_id = t.id), '{}') AS project_ids,
    EXISTS (SELECT 1 FROM tool_credentials c WHERE c.tool_id = t.id AND c.user_id IS NULL) AS has_shared_key,
    EXISTS (SELECT 1 FROM tool_credentials c WHERE c.tool_id = t.id AND c.user_id = ${uidParam}) AS has_my_key
  FROM tools t LEFT JOIN users u ON u.id = t.owner_user_id`;

async function memberProjectIds(userId) {
  const { rows } = await pool.query('SELECT project_id FROM project_members WHERE user_id = $1', [userId]);
  return new Set(rows.map((r) => r.project_id));
}

async function manifestMap() {
  const list = await registry.listManifests(pool);
  return new Map(list.map((x) => [x.manifest.id, x]));
}

// What the browser gets for one tool.
function decorate(row, user, manifests, myProjects) {
  const canManage = canManageTool(user, row);
  const entry = row.integration_id ? manifests.get(row.integration_id) : null;
  const integration = entry ? publicSummary(entry.manifest, entry.source) : null;

  let status = 'link';
  if (row.kind === 'integration') {
    if (!integration) status = 'missing_integration';
    else if (!row.enabled) status = 'disabled';
    else if (!requiresKey(entry.manifest)) status = 'connected';
    else status = (row.credential_mode === 'per_user' ? row.has_my_key : row.has_shared_key) ? 'connected' : 'needs_key';
  } else if (!row.enabled) {
    status = 'disabled';
  }

  const projectIds = (row.project_ids || []).map(Number);
  return {
    id: row.id,
    name: row.name,
    link: row.link,
    description: row.description,
    category: row.category,
    status: row.status,
    tags: row.tags || [],
    notes: row.notes,
    kind: row.kind,
    integration_id: row.integration_id,
    integration,
    owner_user_id: row.owner_user_id,
    owner_username: row.owner_username || null,
    visibility: row.visibility,
    // Ordinary viewers only learn about projects they belong to.
    project_ids: canManage || user.isAdmin ? projectIds : projectIds.filter((id) => myProjects.has(id)),
    enabled: row.enabled,
    credential_mode: row.credential_mode,
    has_shared_key: row.has_shared_key,
    has_my_key: row.has_my_key,
    connection_status: status,
    can_manage: canManage,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// The tool if the caller may use it (optionally within a project), else null.
async function loadVisibleTool(req, id, projectId = null) {
  const user = sessionUser(req);
  const params = [user.userId];
  const cond = visibilityCondition(user, { projectId }, params);
  params.push(id);
  const { rows } = await pool.query(`${TOOL_SELECT('$1')} WHERE ${cond} AND t.id = $${params.length}`, params);
  return rows[0] || null;
}

async function loadToolRow(id) {
  const { rows } = await pool.query(`${TOOL_SELECT('NULL')} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

// Checks visibility/projects a caller asks for on a tool they manage.
// Returns { visibility, projectIds } or { error }.
async function resolveSharing(user, ownerUserId, requested, current = null) {
  const target = { owner_user_id: ownerUserId };
  const visibility = requested.visibility ?? current?.visibility ?? (ownerUserId == null ? 'all' : 'private');
  if (!allowedVisibilities(target).includes(visibility)) {
    return { error: ownerUserId == null
      ? 'Central tools are shared with everyone or with selected projects'
      : 'Your own tools are private or shared with selected projects' };
  }
  let projectIds = requested.project_ids ?? current?.project_ids?.map(Number) ?? [];
  if (visibility !== 'projects') projectIds = [];
  projectIds = [...new Set(projectIds)];
  if (visibility === 'projects') {
    if (projectIds.length === 0) return { error: 'Choose at least one project to share the tool with' };
    if (user.isAdmin) {
      const { rows } = await pool.query('SELECT id FROM projects WHERE id = ANY($1)', [projectIds]);
      if (rows.length !== projectIds.length) return { error: 'One of the selected projects does not exist' };
    } else {
      const mine = await memberProjectIds(user.userId);
      if (projectIds.some((id) => !mine.has(id))) return { error: 'You can only share a tool with projects you are a member of' };
    }
  }
  return { visibility, projectIds };
}

async function setToolProjects(db, toolId, projectIds) {
  await db.query('DELETE FROM tool_projects WHERE tool_id = $1', [toolId]);
  if (projectIds.length) {
    await db.query(
      'INSERT INTO tool_projects (tool_id, project_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING',
      [toolId, projectIds]
    );
  }
}

async function storeSecret(db, toolId, userId, secret, actorId) {
  const sealed = encryptAtRest(secret);
  if (userId == null) {
    await db.query(
      `INSERT INTO tool_credentials (tool_id, user_id, secret, updated_by) VALUES ($1, NULL, $2, $3)
       ON CONFLICT (tool_id) WHERE user_id IS NULL DO UPDATE SET secret = EXCLUDED.secret, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [toolId, sealed, actorId]
    );
  } else {
    await db.query(
      `INSERT INTO tool_credentials (tool_id, user_id, secret, updated_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tool_id, user_id) WHERE user_id IS NOT NULL DO UPDATE SET secret = EXCLUDED.secret, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [toolId, userId, sealed, actorId]
    );
  }
}

const isAllowedToCreate = async (user) => user.isAdmin || allowUserTools(pool);
const NOT_ALLOWED = 'Adding your own tools has been turned off by an administrator';

// ── GET / — tools the caller may use ─────────────────────────────────────────
// ?project_id narrows project-shared tools to that project; ?all=true gives
// admins every tool, including users' private ones.
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = sessionUser(req);
    const projectId = req.query.project_id ? parseInt(req.query.project_id, 10) : null;
    if (projectId != null) {
      const accessErr = await requireProjectMember(req, projectId);
      if (accessErr) return res.status(403).json({ error: accessErr });
    }
    const all = req.query.all === 'true' && user.isAdmin;
    const params = [user.userId];
    const cond = visibilityCondition(user, { projectId, all }, params);
    const { rows } = await pool.query(`${TOOL_SELECT('$1')} WHERE ${cond} ORDER BY t.name ASC, t.id ASC`, params);
    const [manifests, myProjects] = await Promise.all([manifestMap(), memberProjectIds(user.userId)]);
    res.json(rows.map((r) => decorate(r, user, manifests, myProjects)));
  } catch (err) {
    console.error('Error fetching tools:', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// ── POST / — add a tool ──────────────────────────────────────────────────────
// Admins add central tools; other users (when allowed) add their own.
router.post('/', requireAuth, validate(ToolCreateSchema), async (req, res) => {
  const {
    name, link, description, category, status, tags, notes,
    kind, integration_id, visibility, project_ids, enabled, credential_mode,
  } = req.body;
  const user = sessionUser(req);
  try {
    if (!(await isAllowedToCreate(user))) return res.status(403).json({ error: NOT_ALLOWED });

    const toolKind = kind || 'link';
    let integrationId = null;
    let defaultLink = null;
    if (toolKind === 'integration') {
      const entry = await registry.getManifest(pool, integration_id);
      if (!entry) return res.status(400).json({ error: 'Choose an installed integration' });
      integrationId = entry.manifest.id;
      defaultLink = entry.manifest.homepage || null;
    }

    const ownerUserId = user.isAdmin ? null : user.userId;
    const sharing = await resolveSharing(user, ownerUserId, { visibility, project_ids });
    if (sharing.error) return res.status(400).json({ error: sharing.error });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO tools (name, link, description, category, status, tags, notes, kind, integration_id,
                            owner_user_id, visibility, enabled, credential_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [name, link || defaultLink, description || null, category || null, status || null, tags || [], notes || null,
         toolKind, integrationId, ownerUserId, sharing.visibility, enabled ?? true, credential_mode || 'shared']
      );
      await setToolProjects(client, rows[0].id, sharing.projectIds);
      await client.query('COMMIT');
      const created = await loadToolRow(rows[0].id);
      res.status(201).json(decorate(created, user, await manifestMap(), await memberProjectIds(user.userId)));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating tool:', err.message);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// ── POST /bulk-import — many link tools from a spreadsheet ───────────────────
//
// One request rather than one per row: a few hundred tools would otherwise
// trip the rate limiter and take minutes. Rows are handled individually so one
// bad row can't lose the rest, and the response reports what happened to each.
//
// Duplicates are matched on name, case-insensitively, among the tools the
// caller manages: central tools for an admin, their own for anyone else.
router.post('/bulk-import', requireAuth, validate(ToolBulkImportSchema), async (req, res) => {
  const { tools, mode } = req.body;
  const user = sessionUser(req);
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    if (!(await isAllowedToCreate(user))) return res.status(403).json({ error: NOT_ALLOWED });
    const ownerUserId = user.isAdmin ? null : user.userId;
    const visibility = user.isAdmin ? 'all' : 'private';

    const existing = await pool.query(
      'SELECT id, name FROM tools WHERE owner_user_id IS NOT DISTINCT FROM $1', [ownerUserId]
    );
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
            `INSERT INTO tools (name, link, description, category, status, tags, notes, owner_user_id, visibility)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [...values, ownerUserId, visibility]
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

// ── POST /export — the tool list as a file ───────────────────────────────────
// Exports the tools the caller can see (admins: central tools and their own).
// include_config adds sharing settings for tools the caller manages; with a
// passphrase it also adds their shared API keys, encrypted with it.
router.post('/export', requireAuth, validate(ToolExportSchema), async (req, res) => {
  const { include_config, passphrase, tool_ids } = req.body;
  const user = sessionUser(req);
  try {
    const params = [user.userId];
    const cond = user.isAdmin
      ? '(t.owner_user_id IS NULL OR t.owner_user_id = $1)'
      : visibilityCondition(user, {}, params);
    let sql = `${TOOL_SELECT('$1')} WHERE ${cond}`;
    if (tool_ids && tool_ids.length) {
      params.push(tool_ids);
      sql += ` AND t.id = ANY($${params.length})`;
    }
    const { rows } = await pool.query(`${sql} ORDER BY t.name ASC, t.id ASC`, params);

    const projectNames = new Map((await pool.query('SELECT id, name FROM projects')).rows.map((p) => [p.id, p.name]));
    const manifests = await manifestMap();
    const integrationIds = new Set();
    const secrets = {};
    let keysOmitted = 0;

    const tools = [];
    for (const row of rows) {
      const entry = {
        name: row.name, link: row.link, description: row.description, category: row.category,
        status: row.status, tags: row.tags || [], notes: row.notes, kind: row.kind, integration_id: row.integration_id,
      };
      if (row.integration_id) integrationIds.add(row.integration_id);
      if (include_config && canManageTool(user, row)) {
        entry.config = {
          visibility: row.visibility,
          enabled: row.enabled,
          credential_mode: row.credential_mode,
          projects: (row.project_ids || []).map((id) => projectNames.get(Number(id))).filter(Boolean),
        };
        if (row.has_shared_key) {
          if (passphrase) {
            const { rows: cred } = await pool.query(
              'SELECT secret FROM tool_credentials WHERE tool_id = $1 AND user_id IS NULL', [row.id]
            );
            const plain = decryptAtRest(cred[0]?.secret);
            if (plain) secrets[tools.length] = plain; else keysOmitted++;
          } else {
            keysOmitted++;
          }
        }
      }
      tools.push(entry);
    }

    const file = {
      format: 'ghost-tools',
      version: 1,
      exported_at: new Date().toISOString(),
      app_version: APP_VERSION,
      includes_config: Boolean(include_config),
      tools,
      integrations: [...integrationIds].map((id) => manifests.get(id)).filter(Boolean)
        .map(({ manifest, source }) => ({ source, manifest })),
    };
    if (Object.keys(secrets).length) {
      try {
        file.secrets = encryptWithPassphrase(passphrase, JSON.stringify(secrets));
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    await req.audit.log('tool', 0, 'export', 'tools', null,
      JSON.stringify({ count: tools.length, include_config: Boolean(include_config), keys: Object.keys(secrets).length }));
    res.json({ file, keys_included: Object.keys(secrets).length, keys_omitted: keysOmitted });
  } catch (err) {
    console.error('Error exporting tools:', err.message);
    res.status(500).json({ error: 'Failed to export tools' });
  }
});

// ── POST /import — a file from /export ───────────────────────────────────────
// Admins import central tools, everyone else (when allowed) their own.
// Without include_config, tools get default sharing and no keys. project_id
// assigns every imported tool to that project instead.
router.post('/import', requireAuth, validate(ToolFileImportSchema), async (req, res) => {
  const { data, include_config, passphrase, mode, project_id } = req.body;
  const user = sessionUser(req);
  const report = { created: 0, updated: 0, skipped: 0, keys_imported: 0, integrations_installed: [], errors: [], warnings: [] };

  try {
    if (!(await isAllowedToCreate(user))) return res.status(403).json({ error: NOT_ALLOWED });
    if (data.format !== 'ghost-tools' || data.version !== 1 || !Array.isArray(data.tools)) {
      return res.status(400).json({ error: 'This is not a GHOST tools export file' });
    }
    if (data.tools.length > 2000) return res.status(400).json({ error: 'The file has more than 2000 tools' });

    if (project_id) {
      const accessErr = await requireProjectMember(req, project_id);
      if (accessErr) return res.status(403).json({ error: accessErr });
    }

    let secrets = {};
    if (include_config && data.secrets) {
      if (passphrase) {
        try {
          secrets = JSON.parse(decryptWithPassphrase(passphrase, data.secrets));
        } catch (err) {
          return res.status(400).json({ error: err.message === 'Wrong passphrase' ? 'Wrong passphrase' : 'The API keys in the file could not be read' });
        }
      } else {
        report.warnings.push('API keys in the file were skipped (no passphrase given)');
      }
    }

    // Integrations the file needs. Admins can install missing ones; an
    // installed integration is never replaced by an import.
    const installed = await manifestMap();
    for (const item of Array.isArray(data.integrations) ? data.integrations : []) {
      const id = item?.manifest?.id;
      if (!id || installed.has(id)) continue;
      if (!user.isAdmin) continue;
      const { manifest, errors } = validateManifest(item.manifest);
      if (errors) { report.warnings.push(`Integration "${id}" is invalid and was not installed: ${errors[0]}`); continue; }
      await pool.query(
        `INSERT INTO integration_manifests (id, manifest, source, installed_by) VALUES ($1, $2, 'imported', $3)
         ON CONFLICT (id) DO NOTHING`,
        [manifest.id, JSON.stringify(manifest), user.userId]
      );
      installed.set(manifest.id, { manifest, source: 'imported' });
      report.integrations_installed.push(manifest.id);
    }

    const ownerUserId = user.isAdmin ? null : user.userId;
    const projectsByName = new Map();
    {
      const { rows } = user.isAdmin
        ? await pool.query('SELECT id, name FROM projects')
        : await pool.query('SELECT p.id, p.name FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = $1', [user.userId]);
      rows.forEach((p) => projectsByName.set(p.name.trim().toLowerCase(), p.id));
    }
    const existing = await pool.query(
      'SELECT id, name, kind FROM tools WHERE owner_user_id IS NOT DISTINCT FROM $1', [ownerUserId]
    );
    const byKey = new Map(existing.rows.map((r) => [`${r.kind}:${r.name.trim().toLowerCase()}`, r.id]));
    const seen = new Set();

    for (let i = 0; i < data.tools.length; i++) {
      const row = data.tools[i] || {};
      const name = String(row.name || '').trim().slice(0, 255);
      try {
        if (!name) throw new Error('Missing name');
        const kind = row.kind === 'integration' ? 'integration' : 'link';
        const key = `${kind}:${name.toLowerCase()}`;
        if (seen.has(key)) { report.skipped++; report.errors.push({ index: i, name, message: 'Duplicate within the file' }); continue; }
        seen.add(key);

        let integrationId = null;
        if (kind === 'integration') {
          if (!installed.has(row.integration_id)) {
            throw new Error(`Integration "${row.integration_id}" is not installed${user.isAdmin ? '' : ' (ask an admin to install it)'}`);
          }
          integrationId = row.integration_id;
        }

        // Sharing: from the file's config, the project override, or defaults.
        let visibility = ownerUserId == null ? 'all' : 'private';
        let projectIds = [];
        let enabled = true;
        let credentialMode = 'shared';
        const config = include_config && row.config && typeof row.config === 'object' ? row.config : null;
        if (config) {
          if (allowedVisibilities({ owner_user_id: ownerUserId }).includes(config.visibility)) visibility = config.visibility;
          if (typeof config.enabled === 'boolean') enabled = config.enabled;
          if (['shared', 'per_user'].includes(config.credential_mode)) credentialMode = config.credential_mode;
          if (visibility === 'projects') {
            for (const pname of Array.isArray(config.projects) ? config.projects : []) {
              const pid = projectsByName.get(String(pname).trim().toLowerCase());
              if (pid) projectIds.push(pid);
              else report.warnings.push(`"${name}": project "${pname}" not found here`);
            }
          }
        }
        if (project_id) { visibility = 'projects'; projectIds = [project_id]; }
        if (visibility === 'projects' && projectIds.length === 0) {
          visibility = ownerUserId == null ? 'projects' : 'private';
          report.warnings.push(ownerUserId == null
            ? `"${name}" is not assigned to any project yet; assign it in Tools`
            : `"${name}" was imported as private (none of its projects exist here)`);
        }

        const values = [
          name, normalizeLink(row.link), blankToNull(row.description)?.toString().slice(0, 1000) ?? null,
          blankToNull(row.category)?.toString().slice(0, 1000) ?? null, blankToNull(row.status)?.toString().slice(0, 255) ?? null,
          Array.isArray(row.tags) ? row.tags.map(String).slice(0, 100) : [], blankToNull(row.notes)?.toString().slice(0, 1000) ?? null,
        ];

        let toolId = byKey.get(key);
        if (toolId) {
          if (mode !== 'update') { report.skipped++; continue; }
          // Only what the file supplies overwrites, as in bulk-import.
          await pool.query(
            `UPDATE tools SET name = $1, link = COALESCE($2, link), description = COALESCE($3, description),
               category = COALESCE($4, category), status = COALESCE($5, status),
               tags = CASE WHEN cardinality($6::text[]) = 0 THEN tags ELSE $6::text[] END,
               notes = COALESCE($7, notes), updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [...values, toolId]
          );
          if (config || project_id) {
            await pool.query('UPDATE tools SET visibility = $1, enabled = $2, credential_mode = $3 WHERE id = $4',
              [visibility, enabled, credentialMode, toolId]);
            await setToolProjects(pool, toolId, visibility === 'projects' ? projectIds : []);
          }
          report.updated++;
        } else {
          const { rows } = await pool.query(
            `INSERT INTO tools (name, link, description, category, status, tags, notes, kind, integration_id,
                                owner_user_id, visibility, enabled, credential_mode)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            [...values, kind, integrationId, ownerUserId, visibility, enabled, credentialMode]
          );
          toolId = rows[0].id;
          byKey.set(key, toolId);
          await setToolProjects(pool, toolId, visibility === 'projects' ? projectIds : []);
          report.created++;
        }

        const secret = secrets[String(i)];
        if (secret && kind === 'integration') {
          await storeSecret(pool, toolId, null, String(secret), user.userId);
          report.keys_imported++;
        }
      } catch (err) {
        report.errors.push({ index: i, name, message: err.message });
      }
    }

    await req.audit.log('tool', 0, 'import', 'tools', null, JSON.stringify({
      created: report.created, updated: report.updated, keys: report.keys_imported, include_config: Boolean(include_config),
    }));
    res.json(report);
  } catch (err) {
    console.error('Error importing tools:', err.message);
    res.status(500).json({ error: 'Failed to import tools' });
  }
});

// ── PUT /:id — edit ──────────────────────────────────────────────────────────
// Fields not sent keep their value.
router.put('/:id', requireAuth, validateIdParam, validate(ToolUpdateSchema), async (req, res) => {
  const {
    name, link, description, category, status, tags, notes,
    kind, integration_id, visibility, project_ids, enabled, credential_mode,
  } = req.body;
  const user = sessionUser(req);
  try {
    const current = await loadToolRow(req.params.id);
    if (!current) return res.status(404).json({ error: 'Tool not found' });
    if (!canManageTool(user, current)) {
      return res.status(403).json({ error: current.owner_user_id == null ? 'Only an admin can change shared tools' : 'Only the owner can change this tool' });
    }

    const newKind = kind || current.kind;
    let integrationId = newKind === 'integration' ? (integration_id ?? current.integration_id) : null;
    if (newKind === 'integration') {
      const entry = await registry.getManifest(pool, integrationId);
      if (!entry) return res.status(400).json({ error: 'Choose an installed integration' });
      integrationId = entry.manifest.id;
    }

    const sharing = await resolveSharing(user, current.owner_user_id, { visibility, project_ids }, current);
    if (sharing.error) return res.status(400).json({ error: sharing.error });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE tools SET name = $1, link = $2, description = $3, category = $4, status = $5, tags = $6, notes = $7,
           kind = $8, integration_id = $9, visibility = $10, enabled = $11, credential_mode = $12, updated_at = CURRENT_TIMESTAMP
         WHERE id = $13`,
        [name, link || null, description || null, category || null, status || null, tags || [], notes || null,
         newKind, integrationId, sharing.visibility, enabled ?? current.enabled, credential_mode || current.credential_mode,
         current.id]
      );
      await setToolProjects(client, current.id, sharing.projectIds);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const updated = await loadVisibleTool(req, current.id) || await loadToolRow(current.id);
    res.json(decorate(updated, user, await manifestMap(), await memberProjectIds(user.userId)));
  } catch (err) {
    console.error('Error updating tool:', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  const user = sessionUser(req);
  try {
    const current = await loadToolRow(req.params.id);
    if (!current) return res.status(404).json({ error: 'Tool not found' });
    if (!canManageTool(user, current)) {
      return res.status(403).json({ error: current.owner_user_id == null ? 'Only an admin can delete shared tools' : 'Only the owner can delete this tool' });
    }
    const result = await pool.query('DELETE FROM tools WHERE id = $1 RETURNING id, name', [current.id]);
    res.status(200).json({ message: 'Tool deleted successfully', deletedTool: result.rows[0] });
  } catch (err) {
    console.error('Error deleting tool:', err.message);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// ── API keys ─────────────────────────────────────────────────────────────────
// Write-only. scope 'shared' is the tool's key for everyone and needs the
// right to manage the tool; scope 'mine' is the caller's own key for a tool
// set to per-user keys.
router.put('/:id/credentials', requireAuth, validateIdParam, validate(ToolCredentialSchema), async (req, res) => {
  const { scope, secret } = req.body;
  const user = sessionUser(req);
  try {
    const tool = await loadVisibleTool(req, req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    if (tool.kind !== 'integration') return res.status(400).json({ error: 'Only integrated tools take an API key' });
    if (scope === 'shared' && !canManageTool(user, tool)) return res.status(403).json({ error: 'Only someone who manages this tool can set its shared key' });
    if (scope === 'mine' && tool.credential_mode !== 'per_user') return res.status(400).json({ error: 'This tool uses a shared key' });

    await storeSecret(pool, tool.id, scope === 'shared' ? null : user.userId, secret.trim(), user.userId);
    await req.audit.log('tool', tool.id, 'update', scope === 'shared' ? 'shared_api_key' : 'own_api_key', null, 'set');
    res.json({ message: 'API key saved' });
  } catch (err) {
    console.error('Error saving tool key:', err.message);
    res.status(500).json({ error: 'Failed to save the API key' });
  }
});

router.delete('/:id/credentials', requireAuth, validateIdParam, async (req, res) => {
  const user = sessionUser(req);
  const scope = req.query.scope === 'mine' ? 'mine' : 'shared';
  try {
    const tool = await loadVisibleTool(req, req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    if (scope === 'shared' && !canManageTool(user, tool)) return res.status(403).json({ error: 'Only someone who manages this tool can remove its shared key' });
    if (scope === 'shared') await pool.query('DELETE FROM tool_credentials WHERE tool_id = $1 AND user_id IS NULL', [tool.id]);
    else await pool.query('DELETE FROM tool_credentials WHERE tool_id = $1 AND user_id = $2', [tool.id, user.userId]);
    await req.audit.log('tool', tool.id, 'update', scope === 'shared' ? 'shared_api_key' : 'own_api_key', 'set', null);
    res.json({ message: 'API key removed' });
  } catch (err) {
    console.error('Error removing tool key:', err.message);
    res.status(500).json({ error: 'Failed to remove the API key' });
  }
});

// ── POST /:id/run — search with an integrated tool ───────────────────────────
// With person_id the tool must be available in that person's project, and the
// caller a member of it.
router.post('/:id/run', requireAuth, integrationLimiter, validateIdParam, validate(ToolRunSchema), async (req, res) => {
  const { operation, input, person_id } = req.body;
  const user = sessionUser(req);
  try {
    let projectId = null;
    if (person_id) {
      const { rows } = await pool.query('SELECT project_id FROM people WHERE id = $1', [person_id]);
      if (!rows.length) return res.status(404).json({ error: 'Person not found' });
      projectId = rows[0].project_id;
      const accessErr = await requireProjectMember(req, projectId);
      if (accessErr) return res.status(403).json({ error: accessErr });
    }
    const tool = await loadVisibleTool(req, req.params.id, projectId);
    if (!tool) return res.status(404).json({ error: person_id ? 'This tool is not available in the person\'s project' : 'Tool not found' });
    if (tool.kind !== 'integration') return res.status(400).json({ error: 'This tool is a link, not an integration' });
    if (!tool.enabled) return res.status(409).json({ error: 'This tool is disabled' });
    const entry = await registry.getManifest(pool, tool.integration_id);
    if (!entry) return res.status(409).json({ error: 'The integration behind this tool is not installed' });

    const result = await runOperation(pool, {
      tool, manifest: entry.manifest, operationId: operation, rawInput: input, userId: user.userId,
    });
    const { redactedUrl, ...payload } = result;
    await req.audit.log('tool', tool.id, 'run', operation, null, JSON.stringify({
      query: result.query, person_id: person_id || null, results: result.total, not_found: result.not_found,
    }));
    res.json(payload);
  } catch (err) {
    if (err instanceof RunError) return res.status(err.status).json({ error: err.message });
    console.error('Error running tool:', err.message);
    res.status(500).json({ error: 'The search failed' });
  }
});

// ── POST /:id/test — check the key works ─────────────────────────────────────
router.post('/:id/test', requireAuth, integrationLimiter, validateIdParam, async (req, res) => {
  const user = sessionUser(req);
  try {
    const tool = await loadVisibleTool(req, req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    if (tool.kind !== 'integration') return res.status(400).json({ error: 'This tool is a link, not an integration' });
    const entry = await registry.getManifest(pool, tool.integration_id);
    if (!entry) return res.status(409).json({ error: 'The integration behind this tool is not installed' });
    res.json(await testConnection(pool, { tool, manifest: entry.manifest, userId: user.userId }));
  } catch (err) {
    console.error('Error testing tool:', err.message);
    res.status(500).json({ error: 'The connection test failed' });
  }
});

module.exports = router;
