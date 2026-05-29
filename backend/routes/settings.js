const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// Custom fields
router.get('/custom-fields', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM custom_person_fields ORDER BY field_label ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching custom fields definitions:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch custom fields definitions' });
  }
});

router.post('/custom-fields', requireAdmin, async (req, res) => {
  const { field_name, field_label, field_type, options, is_active } = req.body;
  if (!field_name || !field_label || !field_type) {
    return res.status(400).json({ error: 'field_name, field_label, and field_type are required' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(field_name)) {
    return res.status(400).json({ error: 'field_name can only contain alphanumeric characters and underscores.' });
  }

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

router.put('/custom-fields/:id', requireAdmin, validateIdParam, async (req, res) => {
  const fieldId = req.params.id;
  const { field_label, field_type, options, is_active } = req.body;
  if (!field_label || !field_type) {
    return res.status(400).json({ error: 'field_label and field_type are required for update' });
  }

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

router.post('/model-options', requireAdmin, async (req, res) => {
  const { model_type, option_value, option_label, display_order } = req.body;

  if (!model_type || !option_value || !option_label) {
    return res.status(400).json({ error: 'model_type, option_value, and option_label are required' });
  }

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

router.put('/model-options/:id', requireAdmin, validateIdParam, async (req, res) => {
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
