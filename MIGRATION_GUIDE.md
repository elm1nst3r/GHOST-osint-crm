# Migration Guide: Integrating New Security & Utility Features

This guide helps you integrate the new security, logging, and validation utilities into the existing codebase.

## Quick Start

If you want to use the application immediately without changes:

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env and change DB_PASSWORD from 'changeme' to something secure

# 2. Start the application
docker-compose up --build
```

The application will work as before. The new utilities are optional and can be integrated gradually.

## Optional: Integrating New Utilities

### Step 1: Add Environment Validation

Add this to the **top** of `/backend/server.js` (before any other code):

```javascript
// At the very top of server.js, add:
const { validateEnvironment } = require('./utils/validateEnv');

// Validate environment before starting
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}
```

### Step 2: Replace Pool with Database Class (Optional)

Replace the current pool initialization in `/backend/server.js`:

```javascript
// OLD CODE (lines 67-73):
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// NEW CODE:
const Database = require('./utils/database');
const db = new Database({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'osint_crm_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Use db.pool instead of pool throughout the file
const pool = db.pool;

// Add graceful shutdown
process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});
```

### Step 3: Add Request Logging Middleware

Add this near the top of `/backend/server.js`, after `app.use(cors())`:

```javascript
const requestLogger = require('./middleware/requestLogger');

app.use(cors());
app.use(requestLogger); // Add this line
app.use(express.json({ limit: '10mb' }));
```

### Step 4: Add Error Handling Middleware

Add this at the **end** of `/backend/server.js`, just before `app.listen()`:

```javascript
const errorHandler = require('./middleware/errorHandler');

// ... all your route definitions ...

// Add error handler as the last middleware (before app.listen)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
```

### Step 5: Add Validation Middleware to Routes

Add validation to specific routes in `/backend/server.js`:

```javascript
const {
  validatePersonData,
  validateToolData,
  validateBusinessData,
  validateIdParam,
  rateLimit
} = require('./middleware/validation');

// Apply rate limiting globally (add after express.json())
app.use(rateLimit);

// Apply to person routes:
app.post('/api/people', validatePersonData, async (req, res) => {
  // existing code...
});

app.put('/api/people/:id', validateIdParam, validatePersonData, async (req, res) => {
  // existing code...
});

// Apply to tool routes:
app.post('/api/tools', validateToolData, async (req, res) => {
  // existing code...
});

// Apply to business routes:
app.post('/api/businesses', validateBusinessData, async (req, res) => {
  // existing code...
});

// Apply to all routes with :id parameter:
app.put('/api/people/:id', validateIdParam, validatePersonData, async (req, res) => {
  // existing code...
});

app.delete('/api/people/:id', validateIdParam, async (req, res) => {
  // existing code...
});

// ... repeat for other routes with :id
```

### Step 6: Replace console.log with Logger

Replace console.log statements throughout the codebase:

```javascript
const logger = require('./utils/logger');

// OLD:
console.log('Successfully connected to the PostgreSQL database.');
console.error('Error fetching people:', err);

// NEW:
logger.info('Successfully connected to the PostgreSQL database.');
logger.error('Error fetching people', err);
```

## Gradual Migration Strategy

You don't have to do everything at once. Here's a recommended order:

### Phase 1 (5 minutes) - Essential Security:
1. ✅ Copy `.env.example` to `.env` and set secure passwords
2. ✅ Verify `.gitignore` is protecting sensitive files

### Phase 2 (15 minutes) - Basic Improvements:
3. Add environment validation (Step 1)
4. Add request logging (Step 3)
5. Add error handling (Step 4)

### Phase 3 (30 minutes) - Full Integration:
6. Replace console.log with logger (Step 6)
7. Add validation middleware to routes (Step 5)
8. Replace pool with Database class (Step 2)

### Phase 4 (Future) - Advanced Features:
9. Implement authentication system
10. Add Helmet.js for security headers
11. Set up centralized logging (ELK, CloudWatch)

## Testing Your Changes

After each phase, test the application:

```bash
# Restart the backend
docker-compose restart backend

# Check logs
docker-compose logs -f backend

# Test an endpoint
curl http://localhost:3001/api/people

# Test validation (should fail)
curl -X POST http://localhost:3001/api/people \
  -H "Content-Type: application/json" \
  -d '{"firstName": ""}'
```

## Rollback Strategy

If something breaks, you can easily rollback:

1. The new utilities are in separate files
2. They don't modify existing code unless you integrate them
3. Simply remove the require() statements and middleware you added
4. Original functionality remains intact

## Backwards Compatibility

✅ **All new utilities are 100% backwards compatible**:
- Existing code continues to work without changes
- New utilities are opt-in
- No breaking changes to API or database

## Common Issues

### Issue: "Cannot find module './utils/logger'"
**Solution**: Make sure all new files from the review are present:
```bash
ls -la backend/utils/
ls -la backend/middleware/
```

### Issue: Environment validation fails on startup
**Solution**: Check your `.env` file has all required variables:
```bash
cat backend/.env
# Should have: DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT
```

### Issue: "Too many requests" error
**Solution**: Rate limiting is active (100 req/min). This is intentional. Adjust in `/backend/middleware/validation.js` if needed:
```javascript
const MAX_REQUESTS = 100; // Change this value
```

## Verification Checklist

After migration, verify:

- [ ] Application starts without errors
- [ ] Can create/read/update/delete people
- [ ] Can create/read/update/delete tools
- [ ] Can create/read/update/delete businesses
- [ ] Logs show proper formatting (if logger integrated)
- [ ] Invalid inputs are rejected (if validation integrated)
- [ ] Rate limiting works (if integrated)

## Getting Help

If you encounter issues:

1. Check `IMPROVEMENTS.md` for details on what was changed
2. Review `SECURITY.md` for security guidelines
3. Check Docker logs: `docker-compose logs backend`
4. Verify environment variables: `docker-compose exec backend env`

## Next Steps

After successful migration:

1. Review `SECURITY.md` for production deployment checklist
2. Implement authentication (see SECURITY.md for recommendations)
3. Set up monitoring and alerting
4. Plan regular security audits

## Summary

- ✅ New utilities are **optional** and **non-breaking**
- ✅ Can integrate gradually over time
- ✅ Original functionality preserved
- ✅ Clear rollback path if needed
- ✅ Comprehensive testing strategy

The application works fine as-is. The new utilities enhance security and maintainability when you're ready to integrate them.
