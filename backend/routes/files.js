// File: backend/routes/files.js
//
// Uploaded files for people and projects (issue #97). Storage and the orphan
// sweep are in services/fileStorage.js; the table is described in migration
// 20261101000001_files.js.
//
// Access follows project membership, like every other project-scoped entity:
// any member may list, upload, download and edit a file's description or
// person. Deleting is narrower than for other entities, because these are
// evidence: only the uploader, the project's owners and managers, or an admin.
//
// Bytes are only ever served by GET /:id/content, always as a download
// (application/octet-stream, Content-Disposition: attachment, nosniff, a
// sandbox CSP). The frontend's preview fetches the same endpoint and renders
// the bytes itself, so an uploaded HTML or SVG file never runs as part of
// GHOST's own origin.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const { validate, FileUploadSchema, FileUpdateSchema } = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');
const {
  applyProjectScope, requireProjectMember, getUserProjectRole, PROJECT_ROLE_RANK,
} = require('../utils/projectAccess');
const storage = require('../services/fileStorage');
const { fixMultipartFilename, sanitizeFilename } = require('../utils/fileNames');

router.use(apiLimiter);

// stored_name is internal and never leaves the server.
const FILE_SELECT = `
  SELECT f.id, f.project_id, f.person_id, f.original_name, f.mime_type, f.size_bytes,
         f.sha256, f.description, f.uploaded_by, f.created_at, f.updated_at,
         u.username AS uploaded_by_username,
         p.first_name AS person_first_name, p.patronymic AS person_patronymic,
         p.last_name AS person_last_name
  FROM files f
  LEFT JOIN users u ON u.id = f.uploaded_by
  LEFT JOIN people p ON p.id = f.person_id
`;

// BIGINT comes back from pg as a string.
const toApi = (row) => row && { ...row, size_bytes: Number(row.size_bytes) };

async function loadFile(id) {
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
  return rows[0] || null;
}

async function loadFileForApi(id) {
  const { rows } = await pool.query(`${FILE_SELECT} WHERE f.id = $1`, [id]);
  return toApi(rows[0]);
}

// Deleting is limited to the uploader, project owners/managers and admins.
async function canDelete(req, file) {
  if (req.session.userRole === 'admin') return true;
  if (file.uploaded_by != null && Number(file.uploaded_by) === Number(req.session.userId)) return true;
  const role = await getUserProjectRole(req.session.userId, file.project_id);
  return (PROJECT_ROLE_RANK[role] || 0) >= PROJECT_ROLE_RANK.manager;
}

// ── GET / — list files ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    const scopeErr = await applyProjectScope(req, 'f', where, params);
    if (scopeErr) return res.status(403).json({ error: scopeErr });
    if (req.query.person_id) {
      params.push(parseInt(req.query.person_id, 10));
      where.push(`f.person_id = $${params.length}`);
    }
    if (req.query.uploaded_by) {
      params.push(parseInt(req.query.uploaded_by, 10));
      where.push(`f.uploaded_by = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(f.original_name ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataResult = await pool.query(
      `${FILE_SELECT} ${whereSql}
       ORDER BY f.created_at DESC, f.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM files f ${whereSql}`, params);
    const total = countResult.rows[0].count;
    const hasMore = offset + dataResult.rows.length < total;

    res.set('X-Total-Count', String(total));
    res.set('X-Has-More', String(hasMore));
    res.json({ data: dataResult.rows.map(toApi), meta: { total, limit, offset, hasMore } });
  } catch (err) {
    console.error('Error fetching files:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ── POST / — upload one file ─────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, storage.TMP_DIR),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.part`),
  }),
  limits: { fileSize: storage.MAX_BYTES, files: 1, fields: 10 },
});

const receiveUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the size limit', limit_bytes: storage.MAX_BYTES });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// validate() would reject a bad body but leave multer's temp file behind.
const discardTmpOnError = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400 && req.file) storage.removeTmp(req.file.path);
  });
  next();
};

router.post('/', requireAuth, receiveUpload, discardTmpOnError, validate(FileUploadSchema), async (req, res) => {
  const { project_id, person_id, description } = req.body;
  if (!req.file) return res.status(400).json({ error: 'A file is required (form field "file")' });

  let stored = null;
  try {
    let projectId = project_id || null;
    if (person_id) {
      const person = await pool.query('SELECT project_id FROM people WHERE id = $1', [person_id]);
      if (person.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
      const personProject = person.rows[0].project_id;
      if (projectId && projectId !== personProject) {
        return res.status(400).json({ error: 'person_id belongs to a different project' });
      }
      projectId = personProject;
    }
    if (!projectId) return res.status(400).json({ error: 'project_id or person_id is required' });

    const accessErr = await requireProjectMember(req, projectId);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const project = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const originalName = sanitizeFilename(fixMultipartFilename(req.file.originalname));
    const mimeType = (req.file.mimetype || 'application/octet-stream').slice(0, 255);

    stored = await storage.storeUpload(req.file.path);
    const { rows } = await pool.query(
      `INSERT INTO files (project_id, person_id, original_name, stored_name, mime_type, size_bytes, sha256, description, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [projectId, person_id || null, originalName, stored.storedName, mimeType, stored.size,
       stored.sha256, description || null, req.session.userId || null]
    );
    const id = rows[0].id;

    await req.audit.log('file', id, 'create', 'file', null,
      JSON.stringify({ name: originalName, size: stored.size, sha256: stored.sha256, project_id: projectId, person_id: person_id || null }));

    res.status(201).json(await loadFileForApi(id));
  } catch (err) {
    if (stored) await storage.removeStored(stored.storedName);
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// ── GET /:id — metadata ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const file = await loadFileForApi(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const accessErr = await requireProjectMember(req, file.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });
    res.json(file);
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// ── GET /:id/content — the bytes ─────────────────────────────────────────────
// ?preview=1 only changes how the access is recorded in the audit log
// ('view' instead of 'download'); the response is identical.
router.get('/:id/content', requireAuth, validateIdParam, async (req, res) => {
  try {
    const file = await loadFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const accessErr = await requireProjectMember(req, file.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    const filePath = storage.storedPath(file.stored_name);
    const action = req.query.preview === '1' ? 'view' : 'download';
    await req.audit.log('file', file.id, action, null, null, file.original_name);

    // res.attachment() also sets Content-Type from the extension, so set the
    // real one after it.
    res.attachment(file.original_name);
    res.type('application/octet-stream');
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    });
    res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
      if (!err || res.headersSent) return;
      if (err.code === 'ENOENT') {
        console.error(`[files] file ${file.id} is missing on disk (${path.basename(filePath)})`);
        return res.status(410).json({ error: 'The stored file is missing' });
      }
      console.error('Error sending file:', err);
      res.status(500).json({ error: 'Failed to read file' });
    });
  } catch (err) {
    console.error('Error reading file:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to read file' });
  }
});

// ── PUT /:id — description / person ──────────────────────────────────────────
// Only the fields sent are changed.
router.put('/:id', requireAuth, validateIdParam, validate(FileUpdateSchema), async (req, res) => {
  const { description, person_id } = req.body;
  try {
    const file = await loadFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const accessErr = await requireProjectMember(req, file.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });

    if (person_id) {
      const person = await pool.query('SELECT project_id FROM people WHERE id = $1', [person_id]);
      if (person.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
      if (person.rows[0].project_id !== file.project_id) {
        return res.status(400).json({ error: 'person_id belongs to a different project' });
      }
    }

    const sets = [];
    const params = [];
    if (description !== undefined) { params.push(description || null); sets.push(`description = $${params.length}`); }
    if (person_id !== undefined) { params.push(person_id || null); sets.push(`person_id = $${params.length}`); }
    if (sets.length > 0) {
      params.push(file.id);
      await pool.query(`UPDATE files SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      if (description !== undefined && (description || null) !== file.description) {
        await req.audit.log('file', file.id, 'update', 'description', file.description, description || null);
      }
      if (person_id !== undefined && (person_id || null) !== file.person_id) {
        await req.audit.log('file', file.id, 'update', 'person_id',
          file.person_id == null ? null : String(file.person_id), person_id ? String(person_id) : null);
      }
    }
    res.json(await loadFileForApi(file.id));
  } catch (err) {
    console.error('Error updating file:', err);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, validateIdParam, async (req, res) => {
  try {
    const file = await loadFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const accessErr = await requireProjectMember(req, file.project_id);
    if (accessErr) return res.status(403).json({ error: accessErr });
    if (!(await canDelete(req, file))) {
      return res.status(403).json({ error: 'Only the uploader, a project owner or manager, or an admin can delete this file' });
    }

    await pool.query('DELETE FROM files WHERE id = $1', [file.id]);
    await storage.removeStored(file.stored_name);
    await req.audit.log('file', file.id, 'delete', 'file',
      JSON.stringify({ name: file.original_name, size: Number(file.size_bytes), sha256: file.sha256 }), null);

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
