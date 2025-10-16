// File: backend/utils/validateEnv.js
// Environment variable validation

const logger = require('./logger');

const REQUIRED_ENV_VARS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_HOST',
  'DB_PORT'
];

const OPTIONAL_ENV_VARS = {
  PORT: '3001',
  NODE_ENV: 'development'
};

function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Set defaults for optional variables
  Object.entries(OPTIONAL_ENV_VARS).forEach(([varName, defaultValue]) => {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      warnings.push(`${varName} not set, using default: ${defaultValue}`);
    }
  });

  // Log warnings
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning));
  }

  // Check for insecure defaults in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DB_PASSWORD === 'changeme' || process.env.DB_PASSWORD === 'password') {
      logger.warn('SECURITY WARNING: Using default/weak database password in production!');
    }
  }

  // Fail if required vars are missing
  if (missing.length > 0) {
    logger.error('Missing required environment variables', null, { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info('Environment validation passed');
  return true;
}

module.exports = { validateEnvironment };
