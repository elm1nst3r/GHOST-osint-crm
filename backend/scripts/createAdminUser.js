#!/usr/bin/env node

// Script to create the initial admin user
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const readline = require('readline');

// Determine database host based on environment
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost', // Use localhost by default when running outside Docker
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

const pool = new Pool(dbConfig);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdminUser() {
  console.log('\n=== Create Admin User ===\n');
  console.log('Database Configuration:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  User: ${dbConfig.user}\n`);

  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful\n');

    // Check if any users exist
    const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(existingUsers.rows[0].count);

    if (userCount > 0) {
      console.log(`\nNote: ${userCount} user(s) already exist in the database.`);
      const confirm = await question('Continue creating a new admin user? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
      }
      console.log();
    }

    // Collect user information
    const username = await question('Username: ');
    if (!username) {
      console.error('Error: Username is required');
      process.exit(1);
    }

    const email = await question('Email: ');
    if (!email) {
      console.error('Error: Email is required');
      process.exit(1);
    }

    const password = await question('Password: ');
    if (!password) {
      console.error('Error: Password is required');
      process.exit(1);
    }

    const firstName = await question('First Name (optional): ');
    const lastName = await question('Last Name (optional): ');

    // Hash password
    console.log('\nCreating admin user...');
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)
       RETURNING id, username, email, first_name, last_name, role`,
      [username, email, password_hash, firstName || null, lastName || null]
    );

    console.log('\n✓ Admin user created successfully!\n');
    console.log('User details:');
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Username: ${result.rows[0].username}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Name: ${result.rows[0].first_name || ''} ${result.rows[0].last_name || ''}`);
    console.log(`  Role: ${result.rows[0].role}`);
    console.log('\nYou can now log in with these credentials.\n');

  } catch (error) {
    console.error('\n✗ Error creating admin user:');

    if (error.code === 'ENOTFOUND') {
      console.error(`  Cannot connect to database host "${dbConfig.host}"`);
      console.error('\n  If using Docker:');
      console.error('    1. Start containers: docker-compose up -d');
      console.error('    2. Run script in container: docker exec -it osint-crm-backend node scripts/createAdminUser.js');
      console.error('\n  If running locally:');
      console.error('    - Ensure PostgreSQL is running on localhost:5432');
      console.error('    - Or set DB_HOST environment variable');
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`  Connection refused to ${dbConfig.host}:${dbConfig.port}`);
      console.error('  Make sure PostgreSQL is running');
    } else if (error.constraint === 'users_username_key') {
      console.error('  Username already exists');
    } else if (error.constraint === 'users_email_key') {
      console.error('  Email already exists');
    } else if (error.code === '42P01') {
      console.error('  Table "users" does not exist');
      console.error('  Start the backend server first to initialize the database');
    } else {
      console.error('  ', error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdminUser();
