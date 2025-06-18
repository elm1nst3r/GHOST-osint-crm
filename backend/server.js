// File: backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
// Add this with the other requires at the top
let geocodingService;
try {
  geocodingService = require('./services/geocodingService');
  console.log('Geocoding service loaded successfully');
} catch (err) {
  console.error('Failed to load geocoding service:', err);
  // Create dummy functions if service fails to load
  geocodingService = {
    geocodeAddress: async () => null,
    batchGeocode: async (locations) => locations
  };
}
const { geocodeAddress, batchGeocode } = geocodingService;
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Multer Configuration for Logo Uploads ---
const LOGO_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(LOGO_UPLOAD_DIR)) {
  fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});

// Attack Surface API Endpoints

// Get all asset types
app.get('/api/attack-surface/asset-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM asset_types ORDER BY type_category, type_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching asset types:', err);
    res.status(500).json({ error: 'Failed to fetch asset types' });
  }
});

// Get assets for a person or all assets
app.get('/api/attack-surface/assets', async (req, res) => {
  const { person_id, case_name, risk_level, asset_type } = req.query;
  
  try {
    let query = `
      SELECT 
        asa.*,
        at.type_name,
        at.type_category,
        at.icon_name,
        at.scan_available,
        p.first_name,
        p.last_name,
        p.case_name,
        (SELECT COUNT(*) FROM asset_cves WHERE asset_id = asa.id AND status = 'unpatched') as unpatched_cves,
        (SELECT MAX(assessment_date) FROM asset_risk_assessments WHERE asset_id = asa.id) as last_assessment
      FROM attack_surface_assets asa
      JOIN asset_types at ON asa.asset_type_id = at.id
      JOIN people p ON asa.person_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (person_id) {
      query += ` AND asa.person_id = ${++paramCount}`;
      params.push(person_id);
    }
    
    if (case_name) {
      query += ` AND p.case_name = ${++paramCount}`;
      params.push(case_name);
    }
    
    if (risk_level) {
      switch(risk_level) {
        case 'high':
          query += ` AND asa.risk_score >= 70`;
          break;
        case 'medium':
          query += ` AND asa.risk_score >= 40 AND asa.risk_score < 70`;
          break;
        case 'low':
          query += ` AND asa.risk_score < 40`;
          break;
      }
    }
    
    if (asset_type) {
      query += ` AND at.type_category = ${++paramCount}`;
      params.push(asset_type);
    }
    
    query += ' ORDER BY asa.risk_score DESC, asa.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Create new asset
app.post('/api/attack-surface/assets', async (req, res) => {
  const {
    person_id,
    asset_type_id,
    asset_name,
    asset_identifier,
    asset_details,
    location,
    status,
    notes
  } = req.body;
  
  if (!person_id || !asset_type_id || !asset_name) {
    return res.status(400).json({ error: 'person_id, asset_type_id, and asset_name are required' });
  }
  
  try {
    // Get default risk weight for the asset type
    const typeResult = await pool.query('SELECT default_risk_weight FROM asset_types WHERE id = $1', [asset_type_id]);
    const defaultRiskWeight = typeResult.rows[0]?.default_risk_weight || 0.5;
    const initialRiskScore = Math.round(defaultRiskWeight * 50); // Start at 50% of max risk
    
    const result = await pool.query(`
      INSERT INTO attack_surface_assets 
      (person_id, asset_type_id, asset_name, asset_identifier, asset_details, location, status, risk_score, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [person_id, asset_type_id, asset_name, asset_identifier, JSON.stringify(asset_details || {}), 
        location, status || 'active', initialRiskScore, notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating asset:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// Update asset
app.put('/api/attack-surface/assets/:id', async (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const updates = req.body;
  
  if (isNaN(assetId)) return res.status(400).json({ error: 'Invalid asset ID' });
  
  try {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = ${index + 2}`)
      .join(', ');
    
    const values = [assetId, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE attack_surface_assets SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating asset:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset
app.delete('/api/attack-surface/assets/:id', async (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  if (isNaN(assetId)) return res.status(400).json({ error: 'Invalid asset ID' });
  
  try {
    const result = await pool.query('DELETE FROM attack_surface_assets WHERE id = $1 RETURNING *', [assetId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Perform basic scan on asset (simplified example)
app.post('/api/attack-surface/assets/:id/scan', async (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const { scan_type } = req.body;
  
  if (isNaN(assetId)) return res.status(400).json({ error: 'Invalid asset ID' });
  
  try {
    // Get asset details
    const assetResult = await pool.query(`
      SELECT asa.*, at.type_name, at.scan_available 
      FROM attack_surface_assets asa
      JOIN asset_types at ON asa.asset_type_id = at.id
      WHERE asa.id = $1
    `, [assetId]);
    
    if (assetResult.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    
    const asset = assetResult.rows[0];
    
    if (!asset.scan_available) {
      return res.status(400).json({ error: 'Scanning not available for this asset type' });
    }
    
    // Create scan record
    const scanResult = await pool.query(`
      INSERT INTO asset_scans (asset_id, scan_type, scan_status)
      VALUES ($1, $2, 'running')
      RETURNING id
    `, [assetId, scan_type || 'basic']);
    
    const scanId = scanResult.rows[0].id;
    
    // Simulate scan (in production, this would be actual scanning logic)
    setTimeout(async () => {
      try {
        let scanResults = {};
        let riskFactors = [];
        let newRiskScore = asset.risk_score;
        
        // Simulate different scan types
        switch (scan_type) {
          case 'port_scan':
            scanResults = {
              open_ports: [22, 80, 443, 3389].filter(() => Math.random() > 0.5),
              scan_time: new Date().toISOString()
            };
            if (scanResults.open_ports.includes(22)) {
              riskFactors.push({ factor: 'SSH port open', severity: 'medium', score_impact: 10 });
            }
            if (scanResults.open_ports.includes(3389)) {
              riskFactors.push({ factor: 'RDP port open', severity: 'high', score_impact: 20 });
            }
            break;
            
          case 'ssl_check':
            scanResults = {
              ssl_valid: Math.random() > 0.3,
              expiry_date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
              protocol_version: 'TLS 1.2',
              vulnerabilities: Math.random() > 0.7 ? ['POODLE', 'Heartbleed'] : []
            };
            if (!scanResults.ssl_valid) {
              riskFactors.push({ factor: 'Invalid SSL certificate', severity: 'high', score_impact: 25 });
            }
            if (scanResults.vulnerabilities.length > 0) {
              riskFactors.push({ factor: 'SSL vulnerabilities detected', severity: 'critical', score_impact: 30 });
            }
            break;
            
          default:
            scanResults = {
              status: 'completed',
              timestamp: new Date().toISOString()
            };
        }
        
        // Calculate new risk score
        const totalImpact = riskFactors.reduce((sum, factor) => sum + factor.score_impact, 0);
        newRiskScore = Math.min(100, asset.risk_score + totalImpact);
        
        // Update scan record
        await pool.query(`
          UPDATE asset_scans 
          SET scan_status = 'completed', 
              scan_results = $1, 
              completed_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [JSON.stringify(scanResults), scanId]);
        
        // Update asset with scan results and new risk score
        await pool.query(`
          UPDATE attack_surface_assets
          SET last_scan_date = CURRENT_TIMESTAMP,
              scan_results = $1,
              risk_score = $2
          WHERE id = $3
        `, [JSON.stringify(scanResults), newRiskScore, assetId]);
        
        // Create risk assessment if risk factors found
        if (riskFactors.length > 0) {
          await pool.query(`
            INSERT INTO asset_risk_assessments 
            (asset_id, risk_score, risk_factors, assessed_by)
            VALUES ($1, $2, $3, 'Automated Scan')
          `, [assetId, newRiskScore, JSON.stringify(riskFactors)]);
        }
        
      } catch (err) {
        console.error('Error completing scan:', err);
        await pool.query(`
          UPDATE asset_scans 
          SET scan_status = 'failed', 
              error_message = $1,
              completed_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [err.message, scanId]);
      }
    }, 5000); // Simulate 5 second scan
    
    res.json({ 
      message: 'Scan started', 
      scan_id: scanId,
      estimated_time: '5 seconds'
    });
  } catch (err) {
    console.error('Error starting scan:', err);
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

// Get risk assessment history for an asset
app.get('/api/attack-surface/assets/:id/risk-assessments', async (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  if (isNaN(assetId)) return res.status(400).json({ error: 'Invalid asset ID' });
  
  try {
    const result = await pool.query(`
      SELECT * FROM asset_risk_assessments 
      WHERE asset_id = $1 
      ORDER BY assessment_date DESC
    `, [assetId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching risk assessments:', err);
    res.status(500).json({ error: 'Failed to fetch risk assessments' });
  }
});

// CVE Management
app.get('/api/attack-surface/cves', async (req, res) => {
  const { severity, search } = req.query;
  
  try {
    let query = 'SELECT * FROM cve_database WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (severity) {
      query += ` AND severity = ${++paramCount}`;
      params.push(severity);
    }
    
    if (search) {
      query += ` AND (cve_id ILIKE ${++paramCount} OR description ILIKE ${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY published_date DESC LIMIT 100';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching CVEs:', err);
    res.status(500).json({ error: 'Failed to fetch CVEs' });
  }
});

// Add CVE to database
app.post('/api/attack-surface/cves', async (req, res) => {
  const { cve_id, description, severity, cvss_score, affected_products, published_date, reference_links } = req.body; // Changed 'references' to 'reference_links'
  
  if (!cve_id) return res.status(400).json({ error: 'CVE ID is required' });
  
  try {
    const result = await pool.query(`
      INSERT INTO cve_database 
      (cve_id, description, severity, cvss_score, affected_products, published_date, reference_links)  // Changed column name
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cve_id) DO UPDATE
      SET description = EXCLUDED.description,
          severity = EXCLUDED.severity,
          cvss_score = EXCLUDED.cvss_score,
          affected_products = EXCLUDED.affected_products,
          published_date = EXCLUDED.published_date,
          reference_links = EXCLUDED.reference_links,  // Changed column name
          last_modified = CURRENT_DATE
      RETURNING *
    `, [cve_id, description, severity, cvss_score, JSON.stringify(affected_products || []), 
        published_date, JSON.stringify(reference_links || [])]);  // Changed parameter name
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding CVE:', err);
    res.status(500).json({ error: 'Failed to add CVE' });
  }
});

// Link CVE to asset
app.post('/api/attack-surface/assets/:id/cves', async (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const { cve_id, status, notes } = req.body;
  
  if (isNaN(assetId)) return res.status(400).json({ error: 'Invalid asset ID' });
  if (!cve_id) return res.status(400).json({ error: 'CVE ID is required' });
  
  try {
    // First check if CVE exists in database
    const cveResult = await pool.query('SELECT id FROM cve_database WHERE cve_id = $1', [cve_id]);
    if (cveResult.rows.length === 0) {
      return res.status(404).json({ error: 'CVE not found in database' });
    }
    
    const cveDbId = cveResult.rows[0].id;
    
    const result = await pool.query(`
      INSERT INTO asset_cves (asset_id, cve_id, status, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [assetId, cveDbId, status || 'unpatched', notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error linking CVE to asset:', err);
    res.status(500).json({ error: 'Failed to link CVE to asset' });
  }
});

// Get overall attack surface risk for a person
app.get('/api/attack-surface/people/:id/risk-summary', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
  try {
    // Get all assets for the person
    const assetsResult = await pool.query(`
      SELECT 
        asa.risk_score,
        at.default_risk_weight,
        at.type_category
      FROM attack_surface_assets asa
      JOIN asset_types at ON asa.asset_type_id = at.id
      WHERE asa.person_id = $1 AND asa.status = 'active'
    `, [personId]);
    
    if (assetsResult.rows.length === 0) {
      return res.json({
        overall_risk_score: 0,
        asset_count: 0,
        high_risk_assets: 0,
        critical_vulnerabilities: 0,
        risk_level: 'low'
      });
    }
    
    // Calculate weighted risk score
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let highRiskCount = 0;
    
    assetsResult.rows.forEach(asset => {
      totalWeightedScore += asset.risk_score * asset.default_risk_weight;
      totalWeight += asset.default_risk_weight;
      if (asset.risk_score >= 70) highRiskCount++;
    });
    
    const overallRiskScore = Math.round(totalWeightedScore / totalWeight);
    
    // Get critical vulnerabilities count
    const vulnResult = await pool.query(`
      SELECT COUNT(*) as critical_count
      FROM asset_cves ac
      JOIN cve_database cd ON ac.cve_id = cd.id
      JOIN attack_surface_assets asa ON ac.asset_id = asa.id
      WHERE asa.person_id = $1 
      AND ac.status = 'unpatched'
      AND cd.severity = 'CRITICAL'
    `, [personId]);
    
    const criticalVulns = parseInt(vulnResult.rows[0].critical_count);
    
    // Determine risk level
    let riskLevel = 'low';
    if (overallRiskScore >= 70 || criticalVulns > 0) {
      riskLevel = 'high';
    } else if (overallRiskScore >= 40) {
      riskLevel = 'medium';
    }
    
    res.json({
      overall_risk_score: overallRiskScore,
      asset_count: assetsResult.rows.length,
      high_risk_assets: highRiskCount,
      critical_vulnerabilities: criticalVulns,
      risk_level: riskLevel
    });
  } catch (err) {
    console.error('Error calculating risk summary:', err);
    res.status(500).json({ error: 'Failed to calculate risk summary' });
  }
});
  console.log(`Created logo upload directory: ${LOGO_UPLOAD_DIR}`);
}

const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGO_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'app-logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, /jpeg|jpg|png|gif|svg/, cb);
  }
});

function checkFileType(file, filetypes, cb) {
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only (jpeg, jpg, png, gif, svg)!');
  }
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const createUpdatedAtTriggerFunction = `
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

const applyUpdatedAtTrigger = async (client, tableName) => {
  await client.query(`
    DROP TRIGGER IF EXISTS set_timestamp ON ${tableName};
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  `);
  console.log(`Applied "updated_at" trigger to "${tableName}" table.`);
};

const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to the PostgreSQL database.');
    await client.query(createUpdatedAtTriggerFunction);
    console.log('Ensured "trigger_set_timestamp" function exists.');

    // Check if we need to migrate name to first_name and last_name
    const nameColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'people' AND column_name = 'name'
    `);

    if (nameColumnExists.rows.length > 0) {
      console.log('Migrating name column to first_name and last_name...');
      
      // Add new columns if they don't exist
      await client.query(`
        ALTER TABLE people 
        ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)
      `);
      
      // Migrate existing data
      await client.query(`
        UPDATE people 
        SET 
          first_name = SPLIT_PART(name, ' ', 1),
          last_name = CASE 
            WHEN ARRAY_LENGTH(STRING_TO_ARRAY(name, ' '), 1) > 1 
            THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
            ELSE ''
          END
        WHERE first_name IS NULL OR last_name IS NULL
      `);
      
      // Drop the old name column
      await client.query(`ALTER TABLE people DROP COLUMN IF EXISTS name`);
      console.log('Migration completed successfully.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255),
        aliases TEXT[],
        date_of_birth DATE,
        category VARCHAR(100),
        status VARCHAR(100),
        crm_status VARCHAR(100),
        case_name VARCHAR(255),
        profile_picture_url TEXT,
        notes TEXT,
        osint_data JSONB DEFAULT '[]'::jsonb,
        attachments JSONB DEFAULT '[]'::jsonb,
        connections JSONB DEFAULT '[]'::jsonb,
        locations JSONB DEFAULT '[]'::jsonb,
        custom_fields JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "people" table.');
    await applyUpdatedAtTrigger(client, 'people');

    // Business Entity Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100), -- corporation, llc, nonprofit, etc.
        industry VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        owner_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        registration_number VARCHAR(100),
        registration_date DATE,
        status VARCHAR(50) DEFAULT 'active', -- active, inactive, dissolved
        employees JSONB DEFAULT '[]'::jsonb, -- Simple employee list with names and roles
        financial_info JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "businesses" table.');
    await applyUpdatedAtTrigger(client, 'businesses');

    // Entity Relationships Table (for all entity connections)
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_relationships (
        id SERIAL PRIMARY KEY,
        source_type VARCHAR(50) NOT NULL, -- person, business, location, etc.
        source_id INTEGER NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id INTEGER NOT NULL,
        relationship_type VARCHAR(100) NOT NULL, -- employs, owns, lives_at, etc.
        relationship_subtype VARCHAR(100),
        confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        attributes JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_type, source_id, target_type, target_id, relationship_type)
      );
    `);
    console.log('Checked/created "entity_relationships" table.');
    await applyUpdatedAtTrigger(client, 'entity_relationships');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_source 
        ON entity_relationships(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_target 
        ON entity_relationships(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_type 
        ON entity_relationships(relationship_type);
      CREATE INDEX IF NOT EXISTS idx_businesses_owner 
        ON businesses(owner_person_id);
    `);

    // Relationship types configuration
    await client.query(`
      CREATE TABLE IF NOT EXISTS relationship_types (
        id SERIAL PRIMARY KEY,
        source_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        relationship_type VARCHAR(100) NOT NULL,
        reverse_type VARCHAR(100), -- e.g., employs <-> employed_by
        display_name VARCHAR(255) NOT NULL,
        icon_name VARCHAR(50),
        color VARCHAR(7),
        style VARCHAR(50) DEFAULT 'solid', -- solid, dashed, dotted
        is_directional BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_type, target_type, relationship_type)
      );
    `);
    console.log('Checked/created "relationship_types" table.');

    // Insert default relationship types
    const defaultRelationshipTypes = [
      // Person to Person (existing)
      { source: 'person', target: 'person', type: 'family', reverse: 'family', name: 'Family', color: '#10b981', style: 'solid' },
      { source: 'person', target: 'person', type: 'friend', reverse: 'friend', name: 'Friend', color: '#3b82f6', style: 'solid' },
      { source: 'person', target: 'person', type: 'associate', reverse: 'associate', name: 'Associate', color: '#6b7280', style: 'solid' },
      
      // Person to Business
      { source: 'person', target: 'business', type: 'owns', reverse: 'owned_by', name: 'Owns', color: '#10b981', style: 'solid' },
      { source: 'person', target: 'business', type: 'works_at', reverse: 'employs', name: 'Works At', color: '#f59e0b', style: 'solid' },
      { source: 'person', target: 'business', type: 'director_of', reverse: 'has_director', name: 'Director Of', color: '#8b5cf6', style: 'solid' },
      { source: 'person', target: 'business', type: 'customer_of', reverse: 'has_customer', name: 'Customer Of', color: '#6366f1', style: 'dashed' },
      
      // Person to Location (from existing locations)
      { source: 'person', target: 'location', type: 'lives_at', reverse: 'residence_of', name: 'Lives At', color: '#8b5cf6', style: 'solid' },
      { source: 'person', target: 'location', type: 'works_at', reverse: 'workplace_of', name: 'Works At', color: '#f59e0b', style: 'dashed' },
      { source: 'person', target: 'location', type: 'owns_property', reverse: 'owned_by', name: 'Owns Property', color: '#10b981', style: 'solid' },
      { source: 'person', target: 'location', type: 'frequents', reverse: 'frequented_by', name: 'Frequents', color: '#64748b', style: 'dotted' },
      
      // Business to Business
      { source: 'business', target: 'business', type: 'subsidiary_of', reverse: 'parent_of', name: 'Subsidiary Of', color: '#8b5cf6', style: 'solid' },
      { source: 'business', target: 'business', type: 'partner_with', reverse: 'partner_with', name: 'Partner With', color: '#3b82f6', style: 'solid' },
      { source: 'business', target: 'business', type: 'supplies', reverse: 'supplied_by', name: 'Supplies', color: '#f59e0b', style: 'dashed' },
      
      // Business to Location
      { source: 'business', target: 'location', type: 'located_at', reverse: 'location_of', name: 'Located At', color: '#6366f1', style: 'solid' },
      { source: 'business', target: 'location', type: 'has_branch', reverse: 'branch_of', name: 'Has Branch', color: '#f59e0b', style: 'dashed' }
    ];

    for (const relType of defaultRelationshipTypes) {
      await client.query(`
        INSERT INTO relationship_types 
        (source_type, target_type, relationship_type, reverse_type, display_name, color, style, is_directional)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source_type, target_type, relationship_type) DO UPDATE
        SET reverse_type = EXCLUDED.reverse_type,
            display_name = EXCLUDED.display_name,
            color = EXCLUDED.color,
            style = EXCLUDED.style
      `, [relType.source, relType.target, relType.type, relType.reverse, relType.name, relType.color, relType.style, true]);
    }
    console.log('Ensured default relationship types exist.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        link TEXT,
        description TEXT,
        category VARCHAR(100),
        status VARCHAR(50),
        tags TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "tools" table.');
    await applyUpdatedAtTrigger(client, 'tools');

    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        last_update_comment TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "todos" table.');
    await applyUpdatedAtTrigger(client, 'todos');

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_person_fields (
        id SERIAL PRIMARY KEY,
        field_name VARCHAR(100) NOT NULL UNIQUE,
        field_label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        options JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "custom_person_fields" table.');
    await applyUpdatedAtTrigger(client, 'custom_person_fields');

    await client.query(`
      CREATE TABLE IF NOT EXISTS model_options (
        id SERIAL PRIMARY KEY,
        model_type VARCHAR(50) NOT NULL,
        option_value VARCHAR(255) NOT NULL,
        option_label VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(model_type, option_value)
      );
    `);
    console.log('Checked/created "model_options" table.');
    await applyUpdatedAtTrigger(client, 'model_options');

    // Insert default model options if they don't exist
    const defaultOptions = [
      // Categories
      { model_type: 'person_category', option_value: 'Person of Interest', option_label: 'Person of Interest', display_order: 1 },
      { model_type: 'person_category', option_value: 'Client', option_label: 'Client', display_order: 2 },
      { model_type: 'person_category', option_value: 'Witness', option_label: 'Witness', display_order: 3 },
      { model_type: 'person_category', option_value: 'Victim', option_label: 'Victim', display_order: 4 },
      { model_type: 'person_category', option_value: 'Suspect', option_label: 'Suspect', display_order: 5 },
      { model_type: 'person_category', option_value: 'Related to Person of Interest', option_label: 'Related to Person of Interest', display_order: 6 },
      { model_type: 'person_category', option_value: 'Other', option_label: 'Other', display_order: 7 },
      
      // Statuses
      { model_type: 'person_status', option_value: 'Open', option_label: 'Open', display_order: 1 },
      { model_type: 'person_status', option_value: 'Being Investigated', option_label: 'Being Investigated', display_order: 2 },
      { model_type: 'person_status', option_value: 'Closed', option_label: 'Closed', display_order: 3 },
      { model_type: 'person_status', option_value: 'On Hold', option_label: 'On Hold', display_order: 4 },
      
      // CRM Statuses
      { model_type: 'crm_status', option_value: 'new_lead', option_label: 'New Lead', display_order: 1 },
      { model_type: 'crm_status', option_value: 'attempted_engage', option_label: 'Attempted to Engage', display_order: 2 },
      { model_type: 'crm_status', option_value: 'engaged', option_label: 'Engaged', display_order: 3 },
      { model_type: 'crm_status', option_value: 'qualified', option_label: 'Qualified', display_order: 4 },
      { model_type: 'crm_status', option_value: 'follow_up', option_label: 'Follow Up', display_order: 5 },
      { model_type: 'crm_status', option_value: 'archived', option_label: 'Archived', display_order: 6 },
      { model_type: 'crm_status', option_value: 'active', option_label: 'Active', display_order: 7 },
      { model_type: 'crm_status', option_value: 'awaiting_response', option_label: 'Awaiting Response', display_order: 8 },
      
      // Task Statuses
      { model_type: 'task_status', option_value: 'open', option_label: 'Open', display_order: 1 },
      { model_type: 'task_status', option_value: 'in_progress', option_label: 'In Progress', display_order: 2 },
      { model_type: 'task_status', option_value: 'on_hold', option_label: 'On Hold', display_order: 3 },
      { model_type: 'task_status', option_value: 'attention', option_label: 'Attention / Issue', display_order: 4 },
      { model_type: 'task_status', option_value: 'done', option_label: 'Done', display_order: 5 },
      { model_type: 'task_status', option_value: 'cancelled', option_label: 'Cancelled', display_order: 6 },
      
      // Connection Types
      { model_type: 'connection_type', option_value: 'family', option_label: 'Family', display_order: 1 },
      { model_type: 'connection_type', option_value: 'friend', option_label: 'Friend', display_order: 2 },
      { model_type: 'connection_type', option_value: 'enemy', option_label: 'Enemy', display_order: 3 },
      { model_type: 'connection_type', option_value: 'associate', option_label: 'Associate', display_order: 4 },
      { model_type: 'connection_type', option_value: 'employer', option_label: 'Employer/Employee', display_order: 5 },
      { model_type: 'connection_type', option_value: 'suspect', option_label: 'Suspect Connection', display_order: 6 },
      { model_type: 'connection_type', option_value: 'witness', option_label: 'Witness', display_order: 7 },
      { model_type: 'connection_type', option_value: 'victim', option_label: 'Victim', display_order: 8 },
      { model_type: 'connection_type', option_value: 'other', option_label: 'Other', display_order: 9 },
      
      // Location Types
      { model_type: 'location_type', option_value: 'primary_residence', option_label: 'Primary Residence', display_order: 1 },
      { model_type: 'location_type', option_value: 'holiday_home', option_label: 'Holiday Home', display_order: 2 },
      { model_type: 'location_type', option_value: 'work', option_label: 'Work', display_order: 3 },
      { model_type: 'location_type', option_value: 'favorite_hotel', option_label: 'Favorite Hotel', display_order: 4 },
      { model_type: 'location_type', option_value: 'yacht_location', option_label: 'Yacht Location', display_order: 5 },
      { model_type: 'location_type', option_value: 'other', option_label: 'Other', display_order: 6 },
      
      // Business Types
      { model_type: 'business_type', option_value: 'corporation', option_label: 'Corporation', display_order: 1 },
      { model_type: 'business_type', option_value: 'llc', option_label: 'LLC', display_order: 2 },
      { model_type: 'business_type', option_value: 'partnership', option_label: 'Partnership', display_order: 3 },
      { model_type: 'business_type', option_value: 'sole_proprietorship', option_label: 'Sole Proprietorship', display_order: 4 },
      { model_type: 'business_type', option_value: 'nonprofit', option_label: 'Non-Profit', display_order: 5 },
      { model_type: 'business_type', option_value: 'government', option_label: 'Government Entity', display_order: 6 },
      { model_type: 'business_type', option_value: 'other', option_label: 'Other', display_order: 7 },
      
      // Business Status
      { model_type: 'business_status', option_value: 'active', option_label: 'Active', display_order: 1 },
      { model_type: 'business_status', option_value: 'inactive', option_label: 'Inactive', display_order: 2 },
      { model_type: 'business_status', option_value: 'dissolved', option_label: 'Dissolved', display_order: 3 },
      { model_type: 'business_status', option_value: 'suspended', option_label: 'Suspended', display_order: 4 },
      { model_type: 'business_status', option_value: 'bankruptcy', option_label: 'Bankruptcy', display_order: 5 }
    ];

    for (const option of defaultOptions) {
      await client.query(`
        INSERT INTO model_options (model_type, option_value, option_label, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (model_type, option_value) DO NOTHING
      `, [option.model_type, option.option_value, option.option_label, option.display_order]);
    }
    console.log('Ensured default model options exist.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        action VARCHAR(50) NOT NULL,
        user_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "audit_logs" table.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        case_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "cases" table.');
    await applyUpdatedAtTrigger(client, 'cases');

    // Create travel_history table for detailed travel tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS travel_history (
        id SERIAL PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        location_type VARCHAR(50),
        location_name VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        arrival_date TIMESTAMPTZ,
        departure_date TIMESTAMPTZ,
        purpose VARCHAR(100),
        transportation_mode VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Checked/created "travel_history" table.');
    await applyUpdatedAtTrigger(client, 'travel_history');

    // Add indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_travel_history_person_id ON travel_history(person_id);
      CREATE INDEX IF NOT EXISTS idx_travel_history_dates ON travel_history(arrival_date, departure_date);
      CREATE INDEX IF NOT EXISTS idx_travel_history_location ON travel_history(country, city);
    `);



  } catch (err) {
    console.error('Error during database initialization:', err.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
};

initializeDatabase();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Audit logging middleware
const logAudit = async (entityType, entityId, action, changes = {}) => {
  try {
    const client = await pool.connect();
    
    for (const [fieldName, { oldValue, newValue }] of Object.entries(changes)) {
      await client.query(`
        INSERT INTO audit_logs (entity_type, entity_id, field_name, old_value, new_value, action)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entityType, entityId, fieldName, oldValue?.toString() || null, newValue?.toString() || null, action]);
    }
    
    client.release();
  } catch (err) {
    console.error('Error logging audit:', err);
  }
};

app.get('/api', (req, res) => {
  res.json({ message: "Hello from the OSINT CRM Backend!" });
});

app.post('/api/upload/logo', logoUpload.single('appLogo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type incorrect.' });
  }
  const logoUrl = `/public/uploads/logos/${req.file.filename}`;
  res.json({ message: 'Logo uploaded successfully!', logoUrl: logoUrl });
});

// Universal search endpoint
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ people: [], tools: [], businesses: [] });
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
    
    const businessesQuery = `
      SELECT id, name, type, industry, city, country 
      FROM businesses 
      WHERE LOWER(name) LIKE $1 
         OR LOWER(industry) LIKE $1
         OR LOWER(city) LIKE $1
         OR LOWER(registration_number) LIKE $1
      LIMIT 10
    `;
    
    const [peopleResult, toolsResult, businessesResult] = await Promise.all([
      pool.query(peopleQuery, [searchTerm]),
      pool.query(toolsQuery, [searchTerm]),
      pool.query(businessesQuery, [searchTerm])
    ]);
    
    res.json({
      people: peopleResult.rows,
      tools: toolsResult.rows,
      businesses: businessesResult.rows
    });
  } catch (err) {
    console.error('Error in universal search:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Advanced search endpoint
app.get('/api/search/advanced', async (req, res) => {
  try {
    let query = 'SELECT * FROM people WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    // Text search
    if (req.query.searchText) {
      const searchConditions = [];
      const searchFields = req.query['searchIn[]'] || ['name'];
      
      if (searchFields.includes('name')) {
        searchConditions.push(`(LOWER(first_name) LIKE $${++paramCount} OR LOWER(last_name) LIKE $${paramCount} OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $${paramCount})`);
        queryParams.push(`%${req.query.searchText.toLowerCase()}%`);
      }
      
      if (searchFields.includes('aliases')) {
        searchConditions.push(`EXISTS (SELECT 1 FROM unnest(aliases) AS alias WHERE LOWER(alias) LIKE $${++paramCount})`);
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

    // Category filter
    if (req.query['categories[]']) {
      const categories = Array.isArray(req.query['categories[]']) 
        ? req.query['categories[]'] 
        : [req.query['categories[]']];
      
      const placeholders = categories.map(() => `$${++paramCount}`).join(',');
      query += ` AND category IN (${placeholders})`;
      queryParams.push(...categories);
    }

    // Status filter
    if (req.query['statuses[]']) {
      const statuses = Array.isArray(req.query['statuses[]']) 
        ? req.query['statuses[]'] 
        : [req.query['statuses[]']];
      
      const placeholders = statuses.map(() => `$${++paramCount}`).join(',');
      query += ` AND status IN (${placeholders})`;
      queryParams.push(...statuses);
    }

    // Date filters
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

    // Sorting
    const sortBy = req.query.sortBy || 'updated_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Cases endpoints
app.get('/api/cases', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cases ORDER BY case_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

app.post('/api/cases', async (req, res) => {
  const { case_name, description } = req.body;
  if (!case_name) return res.status(400).json({ error: 'Case name is required' });
  
  try {
    const result = await pool.query(
      'INSERT INTO cases (case_name, description) VALUES ($1, $2) RETURNING *',
      [case_name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Case name already exists' });
    }
    console.error('Error creating case:', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// Update case endpoint
app.put('/api/cases/:id', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const { case_name, description, status } = req.body;
  
  if (isNaN(caseId)) return res.status(400).json({ error: 'Invalid case ID' });
  
  try {
    const result = await pool.query(
      'UPDATE cases SET case_name = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
      [case_name, description, status, caseId]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// Delete case endpoint
app.delete('/api/cases/:id', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  if (isNaN(caseId)) return res.status(400).json({ error: 'Invalid case ID' });
  
  try {
    const result = await pool.query('DELETE FROM cases WHERE id = $1 RETURNING *', [caseId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case deleted successfully', deletedCase: result.rows[0] });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// People endpoints with audit logging
app.get('/api/people', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name
      FROM people 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching people:', err.message);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

app.post('/api/people', async (req, res) => {
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  if (!firstName) return res.status(400).json({ error: 'First name is required' });
  
  // Geocode locations before saving
  let geocodedLocations = locations || [];
  if (geocodedLocations.length > 0) {
    const locationsToGeocode = geocodedLocations.filter(
      loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
    );
    
    if (locationsToGeocode.length > 0) {
      console.log(`Geocoding ${locationsToGeocode.length} locations for new person`);
      const geocoded = await batchGeocode(locationsToGeocode);
      
      geocodedLocations = geocodedLocations.map(loc => {
        if (!loc.latitude || !loc.longitude) {
          const geocodedLoc = geocoded.find(g => 
            g.address === loc.address && 
            g.city === loc.city && 
            g.country === loc.country
          );
          if (geocodedLoc) {
            return {
              ...loc,
              latitude: geocodedLoc.latitude,
              longitude: geocodedLoc.longitude
            };
          }
        }
        return loc;
      });
    }
  }
  
  const query = `
    INSERT INTO people (first_name, last_name, aliases, date_of_birth, category, status, crm_status, case_name, profile_picture_url, notes, osint_data, attachments, connections, locations, custom_fields) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
    RETURNING *, CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name;
  `;
  
  const values = [
    firstName, 
    lastName || null, 
    aliases || [], 
    dateOfBirth || null, 
    category || null, 
    status || null, 
    crmStatus || null, 
    caseName || null, 
    profilePictureUrl || null, 
    notes || null, 
    JSON.stringify(osintData || []), 
    JSON.stringify(attachments || []), 
    JSON.stringify(connections || []), 
    JSON.stringify(geocodedLocations), // Use geocoded locations
    JSON.stringify(custom_fields || {})
  ];
  
  try {
    const result = await pool.query(query, values);
    const newPerson = result.rows[0];
    
    // Log audit
    await logAudit('person', newPerson.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newPerson) }
    });
    
    res.status(201).json(newPerson);
  } catch (err) {
    console.error('Error creating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

app.put('/api/people/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  const { firstName, lastName, aliases, dateOfBirth, category, status, crmStatus, caseName, profilePictureUrl, notes, osintData, attachments, connections, locations, custom_fields } = req.body;
  
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  if (!firstName) return res.status(400).json({ error: 'First name is required for update' });
  
  try {
    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    const oldPerson = oldResult.rows[0];
    
    // Geocode any locations that don't have coordinates
    let geocodedLocations = locations || [];
    if (geocodedLocations.length > 0) {
      const locationsToGeocode = geocodedLocations.filter(
        loc => (!loc.latitude || !loc.longitude) && (loc.address || loc.city || loc.country)
      );
      
      if (locationsToGeocode.length > 0) {
        console.log(`Geocoding ${locationsToGeocode.length} locations for person ${personId}`);
        const geocoded = await batchGeocode(locationsToGeocode);
        
        // Merge geocoded results back
        geocodedLocations = geocodedLocations.map(loc => {
          if (!loc.latitude || !loc.longitude) {
            const geocodedLoc = geocoded.find(g => 
              g.address === loc.address && 
              g.city === loc.city && 
              g.country === loc.country
            );
            if (geocodedLoc) {
              return {
                ...loc,
                latitude: geocodedLoc.latitude,
                longitude: geocodedLoc.longitude
              };
            }
          }
          return loc;
        });
      }
    }
    
    const query = `
      UPDATE people 
      SET first_name = $1, last_name = $2, aliases = $3, date_of_birth = $4, category = $5, 
          status = $6, crm_status = $7, case_name = $8, profile_picture_url = $9, notes = $10, 
          osint_data = $11, attachments = $12, connections = $13, locations = $14, custom_fields = $15 
      WHERE id = $16 
      RETURNING *, CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name;
    `;
    
    const values = [
      firstName, 
      lastName || null, 
      aliases || [], 
      dateOfBirth || null, 
      category || null, 
      status || null, 
      crmStatus || null, 
      caseName || null, 
      profilePictureUrl || null, 
      notes || null, 
      JSON.stringify(osintData || []), 
      JSON.stringify(attachments || []), 
      JSON.stringify(connections || []), 
      JSON.stringify(geocodedLocations), // Use geocoded locations
      JSON.stringify(custom_fields || {}), 
      personId
    ];
    
    const result = await pool.query(query, values);
    const newPerson = result.rows[0];
    
    // Log audit changes
    const changes = {};
    if (oldPerson.first_name !== firstName) changes.first_name = { oldValue: oldPerson.first_name, newValue: firstName };
    if (oldPerson.last_name !== lastName) changes.last_name = { oldValue: oldPerson.last_name, newValue: lastName };
    if (oldPerson.category !== category) changes.category = { oldValue: oldPerson.category, newValue: category };
    if (oldPerson.status !== status) changes.status = { oldValue: oldPerson.status, newValue: status };
    if (oldPerson.case_name !== caseName) changes.case_name = { oldValue: oldPerson.case_name, newValue: caseName };
    
    if (Object.keys(changes).length > 0) {
      await logAudit('person', personId, 'update', changes);
    }
    
    res.json(newPerson);
  } catch (err) {
    console.error('Error updating person:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

app.delete('/api/people/:id', async (req, res) => {
  const personId = parseInt(req.params.id, 10);
  if (isNaN(personId)) return res.status(400).json({ error: 'Invalid person ID' });
  
  try {
    const result = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *;', [personId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
    
    await logAudit('person', personId, 'delete', {
      record: { oldValue: JSON.stringify(result.rows[0]), newValue: null }
    });
    
    res.status(200).json({ message: 'Person deleted successfully', deletedPerson: result.rows[0] });
  } catch (err) {
    console.error('Error deleting person:', err.message);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// Business endpoints
app.get('/api/businesses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, 
        p.first_name as owner_first_name, 
        p.last_name as owner_last_name
      FROM businesses b
      LEFT JOIN people p ON b.owner_person_id = p.id
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

app.post('/api/businesses', async (req, res) => {
  const {
    name, type, industry, address, city, state, country, postal_code,
    latitude, longitude, phone, email, website, owner_person_id,
    registration_number, registration_date, status, employees, financial_info, notes
  } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Business name is required' });
  
  try {
    // Geocode if coordinates not provided
    let lat = latitude;
    let lng = longitude;
    if ((!lat || !lng) && (address || city || country)) {
      const geocoded = await geocodeAddress({ address, city, state, country, postal_code });
      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
      }
    }
    
    const result = await pool.query(`
      INSERT INTO businesses 
      (name, type, industry, address, city, state, country, postal_code,
       latitude, longitude, phone, email, website, owner_person_id,
       registration_number, registration_date, status, employees, financial_info, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [name, type, industry, address, city, state, country, postal_code,
        lat, lng, phone, email, website, owner_person_id,
        registration_number, registration_date, status || 'active', 
        JSON.stringify(employees || []), JSON.stringify(financial_info || {}), notes]);
    
    const newBusiness = result.rows[0];
    
    // Log audit
    await logAudit('business', newBusiness.id, 'create', {
      record: { oldValue: null, newValue: JSON.stringify(newBusiness) }
    });
    
    res.status(201).json(newBusiness);
  } catch (err) {
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

app.put('/api/businesses/:id', async (req, res) => {
  const businessId = parseInt(req.params.id, 10);
  if (isNaN(businessId)) return res.status(400).json({ error: 'Invalid business ID' });
  
  const {
    name, type, industry, address, city, state, country, postal_code,
    latitude, longitude, phone, email, website, owner_person_id,
    registration_number, registration_date, status, employees, financial_info, notes
  } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Business name is required' });
  
  try {
    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    const oldBusiness = oldResult.rows[0];
    
    // Geocode if coordinates not provided
    let lat = latitude;
    let lng = longitude;
    if ((!lat || !lng) && (address || city || country)) {
      const geocoded = await geocodeAddress({ address, city, state, country, postal_code });
      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
      }
    }
    
    const result = await pool.query(`
      UPDATE businesses 
      SET name = $1, type = $2, industry = $3, address = $4, city = $5, 
          state = $6, country = $7, postal_code = $8, latitude = $9, longitude = $10,
          phone = $11, email = $12, website = $13, owner_person_id = $14,
          registration_number = $15, registration_date = $16, status = $17,
          employees = $18, financial_info = $19, notes = $20
      WHERE id = $21
      RETURNING *
    `, [name, type, industry, address, city, state, country, postal_code,
        lat, lng, phone, email, website, owner_person_id,
        registration_number, registration_date, status,
        JSON.stringify(employees || []), JSON.stringify(financial_info || {}), notes, businessId]);
    
    const newBusiness = result.rows[0];
    
    // Log audit changes
    const changes = {};
    if (oldBusiness.name !== name) changes.name = { oldValue: oldBusiness.name, newValue: name };
    if (oldBusiness.type !== type) changes.type = { oldValue: oldBusiness.type, newValue: type };
    if (oldBusiness.status !== status) changes.status = { oldValue: oldBusiness.status, newValue: status };
    if (oldBusiness.owner_person_id !== owner_person_id) changes.owner_person_id = { oldValue: oldBusiness.owner_person_id, newValue: owner_person_id };
    
    if (Object.keys(changes).length > 0) {
      await logAudit('business', businessId, 'update', changes);
    }
    
    res.json(newBusiness);
  } catch (err) {
    console.error('Error updating business:', err);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

app.delete('/api/businesses/:id', async (req, res) => {
  const businessId = parseInt(req.params.id, 10);
  if (isNaN(businessId)) return res.status(400).json({ error: 'Invalid business ID' });
  
  try {
    const result = await pool.query('DELETE FROM businesses WHERE id = $1 RETURNING *', [businessId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    
    await logAudit('business', businessId, 'delete', {
      record: { oldValue: JSON.stringify(result.rows[0]), newValue: null }
    });
    
    res.json({ message: 'Business deleted successfully', deletedBusiness: result.rows[0] });
  } catch (err) {
    console.error('Error deleting business:', err);
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

// Entity Relationships endpoints
app.get('/api/entity-relationships', async (req, res) => {
  const { source_type, source_id, target_type, target_id } = req.query;
  
  try {
    let query = 'SELECT * FROM entity_relationships WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (source_type) {
      query += ` AND source_type = ${++paramCount}`;
      params.push(source_type);
    }
    
    if (source_id) {
      query += ` AND source_id = ${++paramCount}`;
      params.push(parseInt(source_id));
    }
    
    if (target_type) {
      query += ` AND target_type = ${++paramCount}`;
      params.push(target_type);
    }
    
    if (target_id) {
      query += ` AND target_id = ${++paramCount}`;
      params.push(parseInt(target_id));
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching entity relationships:', err);
    res.status(500).json({ error: 'Failed to fetch entity relationships' });
  }
});

app.post('/api/entity-relationships', async (req, res) => {
  const {
    source_type, source_id, target_type, target_id, relationship_type,
    relationship_subtype, confidence_score, start_date, end_date, attributes, notes
  } = req.body;
  
  if (!source_type || !source_id || !target_type || !target_id || !relationship_type) {
    return res.status(400).json({ 
      error: 'source_type, source_id, target_type, target_id, and relationship_type are required' 
    });
  }
  
  try {
    const result = await pool.query(`
      INSERT INTO entity_relationships 
      (source_type, source_id, target_type, target_id, relationship_type,
       relationship_subtype, confidence_score, start_date, end_date, attributes, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [source_type, source_id, target_type, target_id, relationship_type,
        relationship_subtype, confidence_score || 50, start_date, end_date,
        JSON.stringify(attributes || {}), notes]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This relationship already exists' });
    }
    console.error('Error creating entity relationship:', err);
    res.status(500).json({ error: 'Failed to create entity relationship' });
  }
});

app.put('/api/entity-relationships/:id', async (req, res) => {
  const relationshipId = parseInt(req.params.id, 10);
  if (isNaN(relationshipId)) return res.status(400).json({ error: 'Invalid relationship ID' });
  
  const {
    relationship_subtype, confidence_score, start_date, end_date, attributes, notes
  } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE entity_relationships 
      SET relationship_subtype = $1, confidence_score = $2, start_date = $3,
          end_date = $4, attributes = $5, notes = $6
      WHERE id = $7
      RETURNING *
    `, [relationship_subtype, confidence_score, start_date, end_date,
        JSON.stringify(attributes || {}), notes, relationshipId]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating entity relationship:', err);
    res.status(500).json({ error: 'Failed to update entity relationship' });
  }
});

app.delete('/api/entity-relationships/:id', async (req, res) => {
  const relationshipId = parseInt(req.params.id, 10);
  if (isNaN(relationshipId)) return res.status(400).json({ error: 'Invalid relationship ID' });
  
  try {
    const result = await pool.query('DELETE FROM entity_relationships WHERE id = $1 RETURNING *', [relationshipId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ message: 'Relationship deleted successfully' });
  } catch (err) {
    console.error('Error deleting entity relationship:', err);
    res.status(500).json({ error: 'Failed to delete entity relationship' });
  }
});

// Get relationship types
app.get('/api/relationship-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM relationship_types WHERE is_active = true ORDER BY source_type, target_type, display_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationship types:', err);
    res.status(500).json({ error: 'Failed to fetch relationship types' });
  }
});

// Get entities with their relationships (for visualization)
app.get('/api/entities-graph', async (req, res) => {
  const { entity_type, entity_id, depth = 1 } = req.query;
  
  try {
    // This is a simplified version - you might want to implement recursive queries
    // to fetch relationships up to a certain depth
    let entities = { people: [], businesses: [], locations: [] };
    let relationships = [];
    
    if (entity_type && entity_id) {
      // Get the primary entity
      if (entity_type === 'person') {
        const personResult = await pool.query('SELECT id, first_name, last_name, category FROM people WHERE id = $1', [entity_id]);
        entities.people = personResult.rows;
      } else if (entity_type === 'business') {
        const businessResult = await pool.query('SELECT id, name, type, industry FROM businesses WHERE id = $1', [entity_id]);
        entities.businesses = businessResult.rows;
      }
      
      // Get relationships
      const relResult = await pool.query(`
        SELECT * FROM entity_relationships 
        WHERE (source_type = $1 AND source_id = $2) 
           OR (target_type = $1 AND target_id = $2)
      `, [entity_type, entity_id]);
      
      relationships = relResult.rows;
      
      // Get connected entities
      for (const rel of relationships) {
        if (rel.source_type === entity_type && rel.source_id == entity_id) {
          // Fetch target entity
          if (rel.target_type === 'person') {
            const result = await pool.query('SELECT id, first_name, last_name, category FROM people WHERE id = $1', [rel.target_id]);
            entities.people.push(...result.rows.filter(p => !entities.people.find(ep => ep.id === p.id)));
          } else if (rel.target_type === 'business') {
            const result = await pool.query('SELECT id, name, type, industry FROM businesses WHERE id = $1', [rel.target_id]);
            entities.businesses.push(...result.rows.filter(b => !entities.businesses.find(eb => eb.id === b.id)));
          }
        } else {
          // Fetch source entity
          if (rel.source_type === 'person') {
            const result = await pool.query('SELECT id, first_name, last_name, category FROM people WHERE id = $1', [rel.source_id]);
            entities.people.push(...result.rows.filter(p => !entities.people.find(ep => ep.id === p.id)));
          } else if (rel.source_type === 'business') {
            const result = await pool.query('SELECT id, name, type, industry FROM businesses WHERE id = $1', [rel.source_id]);
            entities.businesses.push(...result.rows.filter(b => !entities.businesses.find(eb => eb.id === b.id)));
          }
        }
      }
    }
    
    res.json({ entities, relationships });
  } catch (err) {
    console.error('Error fetching entities graph:', err);
    res.status(500).json({ error: 'Failed to fetch entities graph' });
  }
});