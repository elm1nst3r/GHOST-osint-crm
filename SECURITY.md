# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public GitHub issue**.

Contact the maintainer directly or use GitHub's private vulnerability reporting:  
**GitHub:** [Security Advisories](../../security/advisories/new)  
**Email:** hurdles.remand_9g [at] icloud.com

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any proof-of-concept code (if applicable)

We aim to respond within 48 hours and will keep you informed of progress toward a fix.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.8.x   | ✅ Active |
| 2.7.x   | ⚠️ Upgrade immediately — contains a silent data-loss bug fixed in 2.8.0 |
| 2.4.x – 2.6.x | ✅ Security patches only |
| < 2.4   | ❌ No longer supported |

---

## Security Architecture (v2.8.0)

### Authentication & Sessions
- ✅ Session-based authentication via `express-session` with `connect-pg-simple` (sessions stored in PostgreSQL)
- ✅ Session ID regenerated on every successful login — prevents session fixation (OWASP A07)
- ✅ Session revoked immediately on password change, role change, deactivation, or account deletion
- ✅ `requireAdmin` middleware performs a live database lookup on every admin request — stale sessions rejected in real time
- ✅ Session cookies: `HttpOnly`, `SameSite=Strict`; `secure: true` enabled automatically when `NODE_ENV=production`

### Password Policy
- ✅ Minimum 12 characters
- ✅ Must contain at least one uppercase letter, one lowercase letter, and one digit
- ✅ Common/weak passwords rejected via a blocklist (100+ entries)
- ✅ Password must not contain the user's username
- ✅ Maximum 128 characters (bcrypt pre-hash protection)
- ✅ Policy enforced at every password-setting point: login, change, admin create, admin reset

### Rate Limiting
- ✅ Login: 10 attempts per 15 minutes per IP + username combination (tunable via `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_DISABLE`)
- ✅ Password change: 5 attempts per hour
- ✅ Geocoding endpoints: 60 requests per minute per IP
- ✅ General API limiter: 300 requests per minute per IP on all authenticated data routes
- ⚠️ **Multi-instance note**: limiters use in-process memory. For multi-replica deployments configure a shared store (Redis or PostgreSQL) in `backend/middleware/rateLimiters.js`

### Input Validation & Sanitisation
- ✅ All `/:id` route parameters validated as positive integers via `validateIdParam` middleware
- ✅ String inputs stripped of `<script>`, `<iframe>`, and inline event handlers before storage
- ✅ SQL injection prevented — all queries use parameterised statements (no string concatenation)
- ✅ Email, URL, and date formats validated at API boundaries
- ✅ Every POST/PUT request body validated against a Zod schema (`backend/middleware/schemas.js`); unknown fields stripped, structured field-level errors returned
- ✅ Schema↔route consistency enforced by a static test (`schemaRouteConsistency.test.js`) — every body field a route reads must be declared in its schema
- ✅ Raw database error messages suppressed in responses when `NODE_ENV=production`

### Geocoding Endpoints
- ✅ `/api/geocode/suggestions`, `/api/geocode/address`, `/api/geocode/stats` require authentication
- ✅ Nominatim requests rate-limited and cached in the database to minimise external calls
- ✅ 8-second timeout on all outbound geocoding requests

### File Uploads
- ✅ Logo uploads restricted to `image/jpeg`, `image/png`, `image/gif` — SVG rejected
- ✅ Upload size capped at 5 MB by default; override with `KML_MAX_BYTES` environment variable
- ✅ KML imports: oversized uploads return `413 Payload Too Large`
- ⚠️ No virus/malware scanning — consider adding ClamAV for high-security deployments
- ⚠️ Uploaded files are stored on the local filesystem — use object storage (S3/GCS) for production scale

### Docker & Infrastructure
- ✅ Backend container runs as non-root user (`nodejs:1001`)
- ✅ PostgreSQL not exposed to host network by default in `docker-compose.yml`
- ✅ `docker-compose.override.yml` exposes port 5432 for local development only
- ✅ Multi-stage frontend build — dev dependencies not present in the nginx image
- ✅ `nginx.conf`: `index.html` served with `no-store` / `no-cache`; hashed JS/CSS served as `immutable`
- ⚠️ Consider using Docker secrets or a secrets manager (Vault, AWS SSM) for `DB_PASSWORD` and `SESSION_SECRET` in production

---

## Production Deployment Checklist

### Environment
- [ ] `NODE_ENV=production` set
- [ ] `SESSION_SECRET` — minimum 32 characters, generated with `openssl rand -base64 32`
- [ ] `DB_PASSWORD` — strong, unique password — never use a default
- [ ] `.env` file **not** committed to version control
- [ ] `FRONTEND_URL` set to your actual domain (used for CORS)

### Network
- [ ] HTTPS/TLS configured on your reverse proxy
- [ ] PostgreSQL not reachable from the public internet
- [ ] Firewall rules restrict inbound traffic to ports 80/443 only

### Database
- [ ] Dedicated PostgreSQL user with minimum required privileges
- [ ] Regular automated backups with tested restore procedure
- [ ] SSL/TLS enabled for database connections

### Monitoring
- [ ] Centralised log aggregation (e.g. ELK, CloudWatch, Loki)
- [ ] Alerts on repeated login failures and 5xx error spikes
- [ ] Regular review of audit log (`/api/audit`)

---

## Known npm Audit Findings

The frontend uses `react-scripts` (Create React App), which carries several audit findings in its bundled webpack toolchain. **These affect the development server only** — they are not present in the production nginx build.

Running `npm audit fix --force` will likely break the CRA build. The recommendation is to monitor for a CRA upgrade or migration to Vite/Next.js if this becomes a concern.

---

## Data Protection Notes

GHOST stores personally identifiable information (PII). Operators are responsible for:

- Complying with applicable data protection law (GDPR, CCPA, etc.)
- Establishing and enforcing data retention policies
- Restricting access to authorised personnel only
- Encrypting the database volume at rest (filesystem or cloud-volume encryption)
- Using HTTPS in transit at all times

---

## Regular Maintenance

| Cadence | Task |
|---------|------|
| Weekly | Review audit logs; verify backups |
| Monthly | `npm audit` review; rotate credentials if needed |
| Quarterly | Full dependency update pass; review user accounts and permissions |

---

## Incident Response

1. **Contain** — isolate affected containers; rotate `SESSION_SECRET` and `DB_PASSWORD` immediately
2. **Preserve** — copy logs before recycling containers
3. **Assess** — determine what data was accessible and for how long
4. **Remediate** — patch, redeploy, restore from clean backup if necessary
5. **Communicate** — notify affected users; document and publish a post-mortem

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [express-session security](https://github.com/expressjs/session#readme)
