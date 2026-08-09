const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  validate,
  SettingsCustomFieldCreateSchema,
  SettingsCustomFieldUpdateSchema,
  SettingsGeocodingUpdateSchema,
  SettingsModelOptionCreateSchema,
  SettingsModelOptionUpdateSchema,
} = require('../middleware/schemas');
const { apiLimiter } = require('../middleware/rateLimiters');


router.use(apiLimiter);
// Custom fields
// Reading the definitions is requireAuth, not requireAdmin: every user needs
// them to render custom fields on person profiles, and the frontend fetches
// them at startup — admin-gating locked regular users out (issue #58).
// Creating/editing/deleting definitions stays admin-only.
router.get('/custom-fields', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM custom_person_fields ORDER BY field_label ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching custom fields definitions:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch custom fields definitions' });
  }
});

router.post('/custom-fields', requireAdmin, validate(SettingsCustomFieldCreateSchema), async (req, res) => {
  const { field_name, field_label, field_type, options, is_active } = req.body;

  const query = `INSERT INTO custom_person_fields (field_name, field_label, field_type, options, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
  const values = [field_name, field_label, field_type, JSON.stringify(options || []), is_active !== undefined ? is_active : true];

  try {
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Custom field with name "${field_name}" already exists.` });
    }
    console.error('Error creating custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create custom field definition' });
  }
});

router.put('/custom-fields/:id', requireAdmin, validateIdParam, validate(SettingsCustomFieldUpdateSchema), async (req, res) => {
  const fieldId = req.params.id;
  const { field_label, field_type, options, is_active } = req.body;

  const query = `UPDATE custom_person_fields SET field_label = $1, field_type = $2, options = $3, is_active = $4 WHERE id = $5 RETURNING *;`;
  const values = [field_label, field_type, JSON.stringify(options || []), is_active !== undefined ? is_active : true, fieldId];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Custom field definition not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update custom field definition' });
  }
});

router.delete('/custom-fields/:id', requireAdmin, validateIdParam, async (req, res) => {
  const fieldId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM custom_person_fields WHERE id = $1 RETURNING *;', [fieldId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Custom field definition not found' });
    res.status(200).json({ message: 'Custom field definition deleted successfully', deletedField: result.rows[0] });
  } catch (err) {
    console.error('Error deleting custom field definition:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to delete custom field definition' });
  }
});

// ── Geocoding provider (issue #62) ───────────────────────────────────────────
// Admin-only, and only ever read by the Settings page — never during startup,
// so it can't reproduce the "System Offline" 403 problem from issue #58.
//
// The API key is WRITE-ONLY. The response reports whether one is stored, never
// its value: an operator's paid API key should not be recoverable by anyone who
// can open the settings screen or read a browser network log.
router.get('/geocoding', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('geocoding_provider', 'geocoding_yandex_api_key')`
    );
    const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    res.json({
      provider: map.geocoding_provider === 'yandex' ? 'yandex' : 'nominatim',
      hasYandexApiKey: Boolean(map.geocoding_yandex_api_key),
    });
  } catch (err) {
    console.error('Error fetching geocoding settings:', err);
    res.status(500).json({ error: 'Failed to fetch geocoding settings' });
  }
});

router.put('/geocoding', requireAdmin, validate(SettingsGeocodingUpdateSchema), async (req, res) => {
  const { provider, yandexApiKey } = req.body;

  try {
    const upsert = (key, value) => pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );

    if (provider !== undefined) await upsert('geocoding_provider', provider);

    // undefined = leave the stored key alone (the form doesn't echo it back).
    // '' = explicitly clear it.
    if (yandexApiKey !== undefined) {
      const trimmed = String(yandexApiKey).trim();
      if (trimmed === '') await pool.query(`DELETE FROM app_settings WHERE key = 'geocoding_yandex_api_key'`);
      else await upsert('geocoding_yandex_api_key', trimmed);
    }

    // Apply immediately rather than after the config cache expires.
    req.app.locals.improvedGeocodingService?.invalidateProviderConfig?.();

    const check = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('geocoding_provider', 'geocoding_yandex_api_key')`
    );
    const map = Object.fromEntries(check.rows.map((r) => [r.key, r.value]));
    const activeProvider = map.geocoding_provider === 'yandex' ? 'yandex' : 'nominatim';
    res.json({
      provider: activeProvider,
      hasYandexApiKey: Boolean(map.geocoding_yandex_api_key),
      // Selecting Yandex without a key falls back to Nominatim rather than
      // failing every lookup — surface that so it isn't silent.
      warning: activeProvider === 'yandex' && !map.geocoding_yandex_api_key
        ? 'no_api_key'
        : undefined,
    });
  } catch (err) {
    console.error('Error saving geocoding settings:', err);
    res.status(500).json({ error: 'Failed to save geocoding settings' });
  }
});

// Model options
router.get('/model-options', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM model_options ORDER BY model_type, display_order ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching model options:', err);
    res.status(500).json({ error: 'Failed to fetch model options' });
  }
});

router.post('/model-options', requireAdmin, validate(SettingsModelOptionCreateSchema), async (req, res) => {
  const { model_type, option_value, option_label, display_order } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO model_options (model_type, option_value, option_label, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [model_type, option_value, option_label, display_order || 999]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Option already exists' });
    }
    console.error('Error creating model option:', err);
    res.status(500).json({ error: 'Failed to create model option' });
  }
});

router.put('/model-options/:id', requireAdmin, validateIdParam, validate(SettingsModelOptionUpdateSchema), async (req, res) => {
  const optionId = req.params.id;
  const { option_label, is_active, display_order } = req.body;

  try {
    const result = await pool.query(
      `UPDATE model_options
       SET option_label = COALESCE($1, option_label),
           is_active = COALESCE($2, is_active),
           display_order = COALESCE($3, display_order)
       WHERE id = $4 RETURNING *`,
      [option_label, is_active, display_order, optionId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating model option:', err);
    res.status(500).json({ error: 'Failed to update model option' });
  }
});

router.delete('/model-options/:id', requireAdmin, validateIdParam, async (req, res) => {
  const optionId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM model_options WHERE id = $1 RETURNING *', [optionId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    res.json({ message: 'Option deleted successfully', deletedOption: result.rows[0] });
  } catch (err) {
    console.error('Error deleting model option:', err);
    res.status(500).json({ error: 'Failed to delete model option' });
  }
});

module.exports = router;
