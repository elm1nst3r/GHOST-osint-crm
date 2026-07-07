# GHOST OSINT CRM — Quick Start Guide

Get GHOST running locally with Docker in about five minutes.

## 1. Prerequisites

- Docker & Docker Compose
- `openssl` (for generating secrets — preinstalled on macOS/Linux)

## 2. Clone & Configure

```bash
git clone https://github.com/elm1nst3r/GHOST-osint-crm.git
cd GHOST-osint-crm

# Generate .env with secure random credentials
printf "DB_PASSWORD=$(openssl rand -base64 24)\nSESSION_SECRET=$(openssl rand -base64 32)\nDB_USER=postgres\nDB_NAME=osint_crm_db\nDB_HOST=db\nDB_PORT=5432\nNODE_ENV=development\nPORT=3001\nFRONTEND_URL=http://localhost:8080\n" > .env
```

`SESSION_SECRET` and `DB_PASSWORD` are **mandatory** — the backend refuses to
start without them, and weak passwords (`changeme`, `password`, …) are rejected.

## 3. Start the Stack

```bash
docker compose up --build -d
```

This starts three services:

- **Frontend** (Nginx): http://localhost:8080
- **Backend API** (Node.js): http://localhost:3001
- **Database** (PostgreSQL): internal to the Docker network — not exposed to the host

Wait until `docker compose ps` shows all services as `(healthy)`.

## 4. Create Your First Admin User

There are **no default credentials**. Create your admin account:

```bash
docker exec osint-crm-backend node scripts/createAdminSimple.js <username> <password> [email]

# Example:
docker exec osint-crm-backend node scripts/createAdminSimple.js admin MyStr0ngPassw0rd
```

Password rules: at least 12 characters, mixed case, at least one digit.
Common weak passwords are rejected. Email is optional.

## 5. Log In and Explore

Open http://localhost:8080 and log in. A good first tour:

1. **Cases** — create your first investigation case
2. **People** — add subjects with OSINT data, locations, and connections
3. **Relationships** — see the interactive entity network graph
4. **Locations** — geocoded addresses appear on the Global Map
5. **Assets / Properties / Transactions** — track goods, real estate, and the events that move them between parties
6. **Wireless Networks** — add networks manually or import WiGLE KML files
7. **OSINT Tools** — catalogue your tool arsenal
8. **Settings → Data Model** — customise categories, statuses, and taxonomies

## Common Tasks

### Manage users
Settings → User Management (admin only), or via CLI:
```bash
docker exec osint-crm-backend node scripts/createAdminSimple.js <username> <password> [email]
```

### Export / import data
Settings → Data Management (admin only) — full database export/import as JSON.

### View audit logs
Audit Logs section (admin only) — filter by user, action, entity type, date range.

### API access for scripts and integrations
```bash
# Log in and store the session cookie
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<user>","password":"<pass>"}' \
  -c cookies.txt

# Authenticated requests
curl -b cookies.txt http://localhost:3001/api/people
curl -b cookies.txt http://localhost:3001/api/openapi.json   # full OpenAPI 3.1 spec
```

### Use GHOST from Claude (MCP)
GHOST ships an MCP server that exposes the whole API as LLM tools —
see [mcp/README.md](mcp/README.md) for setup with Claude Desktop / Claude Code.

## Container Management

```bash
docker compose ps                # status
docker compose logs backend      # logs (also: frontend, db)
docker compose restart backend   # restart a service
docker compose stop              # stop everything
docker compose up -d             # start again
docker compose down -v           # ⚠️ stop AND DELETE ALL DATA
```

## Troubleshooting

### Can't log in / no session cookie
If `NODE_ENV=production` the session cookie is `Secure` and **only sent over
HTTPS** — over plain HTTP the browser silently drops it. For local HTTP use
`NODE_ENV=development`; in production terminate TLS at a reverse proxy.
See the [README](README.md#-security-considerations) for details.

### Backend unhealthy after changing DB_PASSWORD
The old PostgreSQL volume still has the old password. Reset (deletes all data):
```bash
docker compose down -v && docker compose up --build -d
```

### Forgot your password
Have another admin reset it in Settings → User Management, or create a fresh
admin from the CLI (step 4) and use that account.

### General checks
```bash
docker compose ps                            # all services (healthy)?
curl http://localhost:3001/api/health        # backend + DB status
docker compose logs backend                  # error details
```

Still stuck? [Open an issue](https://github.com/elm1nst3r/GHOST-osint-crm/issues)
with logs, steps to reproduce, Docker version, and OS.

## Further Reading

- [README.md](README.md) — full feature list and documentation
- [CHANGELOG.md](CHANGELOG.md) — version history
- [SECURITY.md](SECURITY.md) — hardening posture and disclosure process
- [USER_MANAGEMENT.md](USER_MANAGEMENT.md) — roles and account administration
- [mcp/README.md](mcp/README.md) — MCP server setup
- [Project Wiki](https://github.com/elm1nst3r/GHOST-osint-crm/wiki) — guided tour with screenshots
