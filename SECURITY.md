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
| 2.18.x (latest release) | ✅ Active |
| 2.8 – 2.17 | ❌ Fixes ship in the latest release only — upgrade |
| 2.7.x   | ⚠️ Upgrade immediately — contains a silent data-loss bug fixed in 2.8.0 |
| < 2.7   | ❌ No longer supported |

Database migrations run automatically at startup, so upgrading is a matter of
replacing the images.

---

## Security Architecture (v2.18)

### Authentication & Sessions
- ✅ Session-based authentication via `express-session` with `connect-pg-simple` (sessions stored in PostgreSQL)
- ✅ Session ID regenerated on every successful login — prevents session fixation (OWASP A07)
- ✅ Session revoked immediately on password change, role change, deactivation, or account deletion
- ✅ `requireAdmin` middleware performs a live database lookup on every admin request — stale sessions rejected in real time
- ✅ Session cookies: `HttpOnly`, `SameSite=Strict`; `secure: true` enabled automatically when `NODE_ENV=production`
- ✅ Optional two-step verification (v2.26): authenticator app (TOTP, RFC 6238) and passkeys (WebAuthn), with one-time recovery codes. After the password the session holds only a pending marker, not a user, until the second step passes. App secrets are encrypted at rest (AES-256-GCM, key from `SECRETS_KEY`/`SESSION_SECRET`); each code is accepted once; recovery codes and API tokens are stored as SHA-256 hashes
- ✅ Admins can require two-step verification for everyone; users without it can reach only the setup screen
- ✅ Personal API tokens (`Authorization: Bearer ghost_…`) act as their owner with the owner's current role, are refused for deactivated accounts, and cannot change passwords, security settings or create tokens

### Authorisation
- ✅ Two global roles (`admin`, `user`) plus a per-project role (`owner`, `manager`, `investigator`) held on the membership
- ✅ Membership changes are rank-checked server-side: a non-admin can only act on members ranked below them, only grant roles below their own, and never change their own membership; only admins appoint or remove owners
- ✅ Projects are an isolation boundary: non-admins can read and write only the projects they are members of, enforced on every project-scoped API route — list endpoints are constrained to the caller's memberships even when no project is requested
- ✅ Project membership is checked with a live query on every request, so removing a member takes effect immediately
- ✅ Linking records across projects is off unless enabled per project

### Password Policy
- ✅ Minimum 12 characters
- ✅ Must contain at least one uppercase letter, one lowercase letter, and one digit
- ✅ Common/weak passwords rejected via a blocklist (100+ entries)
- ✅ Password must not contain the user's username
- ✅ Maximum 128 characters (bcrypt pre-hash protection)
- ✅ Policy enforced at every password-setting point: login, change, admin create, admin reset

### Rate Limiting
- ✅ Login: 10 attempts per 15 minutes per IP + username combination (tunable via `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_DISABLE`)
- ✅ Second sign-in step: 10 attempts per 15 minutes per account; five wrong codes in a row require the password again
- ✅ Integrated OSINT tool searches: 30 per minute per client
- ✅ Geocoding endpoints: 60 requests per minute per IP
- ✅ General API limiter: 300 requests per minute per IP on all authenticated data routes (this also covers password changes, which need the current password)
- ✅ IPv6 clients are counted per /56 block, so rotating through an ISP-assigned range doesn't buy more attempts (v2.27)
- ✅ Login, second-step and tool-search counts are stored in PostgreSQL (v2.27): a restart doesn't reset them, and several backend instances share them. The general API and geocoding limiters stay in memory, per instance
- ✅ The client address comes from `X-Forwarded-For`, trusting one proxy hop (nginx). The backend's own port (3001) is published on localhost only (v2.27), since a client reaching it directly could set that header itself. `BACKEND_BIND=0.0.0.0` publishes it anyway; then put it behind your proxy too

### Input Validation & Sanitisation
- ✅ All `/:id` route parameters validated as positive integers via `validateIdParam` middleware
- ✅ Stored text is rendered through React, which escapes it on output — input is not rewritten or stripped on the way in
- ✅ SQL injection prevented — all queries use parameterised statements (no string concatenation)
- ✅ Field formats (URLs, emails, ids, enums, lengths) validated by the Zod schemas where a field has one
- ✅ Every POST/PUT request body validated against a Zod schema (`backend/middleware/schemas.js`); unknown fields stripped, structured field-level errors returned
- ✅ Schema↔route consistency enforced by a static test (`schemaRouteConsistency.test.js`) — every body field a route reads must be declared in its schema
- ✅ The backend test suite runs in CI on every push and pull request
- ✅ Raw database error messages suppressed in responses when `NODE_ENV=production`

### Geocoding Endpoints
- ✅ All `/api/geocode/*` endpoints require authentication; batch geocoding is admin-only
- ✅ Requests to the configured provider (Nominatim by default; Yandex or LocationIQ optionally) are rate-limited and cached in the database to minimise external calls
- ✅ Provider API keys are write-only: the settings API reports whether a key is stored, never its value
- ✅ 8-second timeout on all outbound geocoding requests

### API Reference & Outbound Connections
- ✅ `/api/docs` (Swagger UI) and `/api/openapi.json` are available to signed-in users only; requests sent from the page use the caller's own session, role and project memberships. `API_DOCS_ENABLED=false` removes the page
- ✅ Swagger UI is served from the backend image — no CDN is contacted
- ✅ The update check is the only connection GHOST makes on its own besides geocoding; it can be disabled in Settings → General, after which no request is made
- ⚠️ The MCP server (`mcp/`) logs in with a username and password you give it and acts with that account's permissions — use a dedicated account, not your admin login

### File Uploads
- ✅ Logo uploads restricted to `image/jpeg`, `image/png`, `image/gif` — SVG rejected
- ✅ Upload size capped at 5 MB by default; override with `KML_MAX_BYTES` environment variable
- ✅ KML imports: oversized uploads return `413 Payload Too Large`
- ⚠️ No virus/malware scanning — consider adding ClamAV for high-security deployments
- ⚠️ Uploaded files are stored on the local filesystem — use object storage (S3/GCS) for production scale

### Security Headers (v2.27)
- ✅ Pages (nginx): `frame-ancestors 'none'` and `X-Frame-Options: DENY` (no clickjacking), `object-src`/`base-uri`/`form-action` locked down, `nosniff`, `Cross-Origin-Opener-Policy: same-origin`, a Permissions-Policy that allows only passkeys
- ✅ `Referrer-Policy: no-referrer`: following a link out of GHOST doesn't tell the destination where GHOST runs. Map tiles alone send the origin, as OpenStreetMap's tile policy asks
- ✅ HSTS is sent only when a proxy in front reports HTTPS (`X-Forwarded-Proto: https`), without `includeSubDomains`
- ✅ API (helmet): `default-src 'none'` for JSON and files; the API docs page allows only its own scripts, pinned by hash
- ✅ nginx doesn't reveal its version
- ✅ Pages: a strict Content-Security-Policy (v3.0). Only the app's own bundled scripts run (`script-src 'self'`, no inline script), and the page can only talk to its own server (`connect-src 'self'`), so injected markup can neither run code nor send data elsewhere. Images may come from `https:` (map tiles, linked profile pictures)
- ✅ Leaflet's marker images ship with the app instead of loading from a CDN (v3.0)

### Docker & Infrastructure
- ✅ Supported base images: Node.js 26 LTS (security fixes until April 2029) and nginx 1.30 stable (v2.27)
- ✅ Backend container runs as non-root user (`nodejs:1001`)
- ✅ PostgreSQL not exposed to host network by default in `docker-compose.yml`
- ✅ Exposing port 5432 to the host takes a deliberate local `docker-compose.override.yml`, which is git-ignored and not shipped
- ✅ Images are built and published by GitHub Actions; the repository is scanned with CodeQL
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
- [ ] Regular automated backups with tested restore procedure — use `pg_dump`; the in-app JSON export does not cover every table
- [ ] SSL/TLS enabled for database connections

### Monitoring
- [ ] Centralised log aggregation (e.g. ELK, CloudWatch, Loki)
- [ ] Alerts on repeated login failures and 5xx error spikes
- [ ] Regular review of the audit log (Settings → Audit Logs, or `/api/audit-logs`)

---

## Known npm Audit Findings

Since v3.0 the frontend builds with Vite instead of Create React App, which removed the webpack toolchain and its audit findings. `npm audit --omit=dev` lists what ships to the browser; findings in development tools (ESLint, Vitest) don't reach the production build.

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
