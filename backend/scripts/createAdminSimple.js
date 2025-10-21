#!/usr/bin/env node

// Simple script to create admin user with command line arguments
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

const pool = new Pool(dbConfig);

async function createAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const email = process.argv[4] || 'admin@example.com';
  const firstName = process.argv[5] || 'Admin';
  const lastName = process.argv[6] || 'User';

  console.log('\nCreating admin user...');
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Name: ${firstName} ${lastName}\n`);

  try {
    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)
       RETURNING id, username, email, first_name, last_name, role`,
      [username, email, password_hash, firstName, lastName]
    );

    console.log('✓ Admin user created successfully!\n');
    console.log('User details:');
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Username: ${result.rows[0].username}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Name: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
    console.log(`  Role: ${result.rows[0].role}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
