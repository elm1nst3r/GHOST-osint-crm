# 👻 GHOST - Global Human Operations & Surveillance Tracking
## OSINT Investigation CRM

> *"Because Excel sheets are for accountants, not investigators"*

A full-stack OSINT investigation management system built for serious intelligence gathering with a modern, professional interface.

## 🎯 Core Features

### 🧑‍💼 People Management
- **Role-based categorization**: Suspects, Witnesses, Persons of Interest, Associates, Victims
- **Comprehensive tracking**: Addresses, phone numbers, emails, social media handles
- **Travel history**: Timeline and analysis of person movements
- **Case associations**: Link people to specific investigations
- **Status tracking**: Active, Inactive, Under Investigation, Cleared
- **Custom fields**: Extend person profiles with custom data fields
- **Advanced search**: Multi-parameter search with filters

### 🔗 Entity Network Visualization
- **Interactive relationship diagrams**: Visual network mapping with ReactFlow
- **Multi-entity support**: People, businesses, locations, phones, emails
- **Connection types**: Family, Business, Criminal, Social, Known Associates
- **Drag-and-drop interface**: Intuitive node manipulation
- **Real-time updates**: Live relationship mapping
- **Network filtering**: Focus on specific entity types and relationships

### 🗺️ Global Intelligence Map
- **Geocoded locations**: Automatically geocode addresses with database caching
- **Clustered markers**: Performance-optimized clustering for large datasets
- **Person-location correlation**: Visual tracking of person movements
- **Interactive popups**: Detailed location information on click
- **Map filters**: Filter by person, date range, or location type

### 📡 Wireless Network Intelligence (WiGLE Integration)
- **Manual network entry**: Add wireless networks manually with comprehensive forms
- **KML import**: Import WiGLE wardriving data
- **Network tracking**: SSID, BSSID, encryption, signal strength, passwords
- **WiFi 7 support**: Full support for WiFi 7 frequency bands (2.4GHz, 5GHz, 6GHz)
- **Multi-entity associations**: Link networks to multiple people and businesses
- **Person association**: Link wireless networks to investigations
- **Map visualization**: Wireless networks appear on global map with WiFi icons
- **Map toggle**: Show/hide wireless networks on map
- **Advanced filtering**: Filter by signal strength, encryption, KML file source
- **Location preview**: Interactive map in detail view
- **Flexible validation**: Only SSID required, BSSID and location optional

### 🛠️ Tools & Resources Arsenal
- **OSINT tool inventory**: Catalog of investigation tools
- **Categories**: Social Media, Background Check, Data Mining, Surveillance
- **URL management**: One-click access to tools
- **Usage notes**: Documentation and tips
- **Search and filtering**: Quick tool discovery

### ✅ Task Management
- **Investigation todos**: Linked to cases and people
- **Priority levels**: Low, Medium, High, Urgent
- **Status tracking**: Pending, In Progress, Completed
- **Case assignment**: Organize tasks by investigation

### 📊 Case Management
- **Multi-case support**: Manage multiple investigations
- **Status tracking**: Custom case statuses and data types
- **Case-person linking**: Associate people with cases
- **Timeline tracking**: Investigation chronology
- **Cross-referencing**: See case interconnections

### 🏢 Business Intelligence
- **Business tracking**: Companies and organizations
- **Employee mapping**: Track personnel
- **Business relationships**: Link to people and other businesses
- **Address and contact management**: Full business profiles

### 🌓 Modern UI/UX
- **Solid backgrounds**: Professional, readable interface with proper contrast
- **Dark mode**: Full dark mode support with optimized text readability
- **Responsive layout**: Works on desktop and tablet
- **Professional colorway**: Business-appropriate aesthetics
- **Smooth animations**: Apple-inspired interactions
- **Enhanced readability**: All text elements have proper contrast in both light and dark modes
- **Centered visualizations**: Relationship graphs center properly on load

## 🚀 Quick Start (Docker)

The easiest way to run GHOST is with Docker:

```bash
# Clone the repository
git clone <repo-url>
cd GHOST-osint-crm

# Generate .env with secure random credentials
printf "DB_PASSWORD=$(openssl rand -base64 24)\nSESSION_SECRET=$(openssl rand -base64 32)\nDB_USER=postgres\nDB_NAME=osint_crm_db\nDB_HOST=db\nDB_PORT=5432\nNODE_ENV=development\nPORT=3001\nFRONTEND_URL=http://localhost:8080\n" > .env

# Start all services
docker compose up --build -d
```

**Create your first admin user:**
```bash
# After containers are running
docker exec osint-crm-backend node scripts/createAdminSimple.js <username> <password> [email]

# Example:
docker exec osint-crm-backend node scripts/createAdminSimple.js admin MyStr0ngPass!
```

Password must be at least 12 characters. Common weak passwords are rejected.

**Access the application:**
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/api/health

## 📋 Prerequisites

- **Docker & Docker Compose** (recommended)
- **OR Manual Setup:**
  - Node.js 18+
  - PostgreSQL 15+
  - npm or yarn

## 🔧 Manual Setup

### Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:3000`

### Backend
```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start server
npm start
```
Backend runs on `http://localhost:3001`

### Database
```bash
# Create database
createdb osint_crm_db

# Run migrations (from backend directory)
psql -U postgres -d osint_crm_db < migrations/create_wireless_networks.sql
```

## 📁 Project Structure

```
GHOST-osint-crm/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # API utilities
│   │   └── index.css      # Tailwind styles
│   ├── public/            # Static assets
│   └── nginx.conf         # Nginx configuration
├── backend/               # Node.js/Express API
│   ├── server.js          # Main server file
│   ├── routes/            # Auth, users, audit log routes
│   ├── middleware/        # Auth, audit, rate limiters
│   ├── services/          # Geocoding services
│   ├── utils/             # Password policy, session revocation helpers
│   ├── migrations/        # Database migrations
│   └── public/uploads/    # File uploads
├── docker-compose.yml     # Docker configuration
└── .env.example           # Environment template
```

## 🎮 Usage Guide

### Starting a New Investigation
1. **Create a case** in the Cases section
2. **Add people** with all relevant details
3. **Map connections** in Entity Network view
4. **Track locations** on the Global Map
5. **Import wireless networks** (if using WiGLE data)
6. **Assign tasks** to track investigation progress

### Wireless Network Intelligence
**Manual Entry:**
1. Go to Wireless Networks section
2. Click "Add Network" button
3. Enter network details (SSID required, rest optional)
4. Select associated people/businesses
5. Save and view on map

**KML Import:**
1. Export KML from WiGLE app/website
2. Go to Wireless Networks section
3. Click "Import KML"
4. Upload your KML file (max 5 MB by default; override with `KML_MAX_BYTES` env var)
5. Networks appear on map and table
6. Associate networks with people under investigation

**Map View:**
- Toggle wireless networks on/off in the global map
- Click WiFi icons for network details
- Filter networks by various criteria

### Entity Network Mapping
1. Navigate to "Entity Network" section
2. View interactive relationship diagram
3. Filter by entity types and relationships
4. Click nodes for details
5. Add connections between entities

## ⚡ Performance Notes

**Optimized for:**
- Up to 5,000 people records
- Up to 10,000 wireless networks
- Up to 1,000 locations on map
- Up to 500 relationship nodes

**Features:**
- Database-level geocoding cache
- Map marker clustering
- Paginated people endpoint (`?limit` / `?offset`, `X-Total-Count` header)
- Lazy loading support

## 🔐 Security Considerations

**Required in all environments:**
- ⚠️ **SESSION_SECRET** — mandatory, minimum 32 characters. App exits at startup if missing.
  ```bash
  openssl rand -base64 32
  ```
- ⚠️ **DB_PASSWORD** — no default. Must be set in `.env` before starting.
  ```bash
  openssl rand -base64 24
  ```

**Production hardening:**
- ⚠️ **Use strong DB_PASSWORD** — weak passwords (`changeme`, `password`, etc.) are rejected at startup
- 🔒 **Password policy enforced** — all password-setting routes require ≥12 characters, mixed case, digit, and reject common passwords
- 🔒 **Session fixation protection** — session ID is regenerated on every successful login
- 🔒 **Session revocation** — changing a user's role, deactivating, deleting, or resetting their password immediately invalidates their active sessions
- 🔒 **Rate limiting** — login endpoint limited to 10 attempts/15 min per IP+username; geocoding endpoints limited to 60 req/min per IP. Note: in-process limiter — for multi-instance deployments configure a shared store (Redis/pg) in `backend/middleware/rateLimiters.js`
- 🔒 **Geocoding endpoints require authentication** — `/api/geocode/suggestions`, `/api/geocode/address`, and `/api/geocode/stats` reject unauthenticated requests
- 🔒 **KML upload size-limited** — defaults to 5 MB; override with `KML_MAX_BYTES` env var (in bytes)
- 🔒 **PostgreSQL is not exposed to the host network** by default — only available within the Docker network
- 🔒 **Session cookies use `SameSite=Strict` and `HttpOnly`** — enable `secure: true` by setting `NODE_ENV=production`
- 🔒 **Never commit `.env` files** — contains sensitive credentials
- 🔒 **Use HTTPS in production** — configure a reverse proxy with SSL/TLS
- 🔒 **Keep `backend/public/uploads/` out of version control** — user-generated content
- 🔒 **Follow local laws for data collection** — comply with privacy regulations

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License**.

**You are free to:**
- ✅ Use for personal investigations
- ✅ Use for educational purposes
- ✅ Use for research
- ✅ Modify and improve
- ✅ Share with others

**Under these conditions:**
- 📝 **Attribution** - Give appropriate credit
- 🚫 **NonCommercial** - No commercial use without permission
- 🔄 **ShareAlike** - Share modifications under same license

**Commercial use requires explicit permission from the author.**

For commercial licensing, contact: hurdles.remand_9g [at] icloud.com

## 🙈 Legal Disclaimer

This tool is intended for **legitimate OSINT investigation purposes only**. Users are responsible for:
- Complying with all applicable laws and regulations
- Respecting privacy rights and data protection laws
- Using the tool ethically and responsibly
- Obtaining proper authorization for investigations

The authors are not responsible for misuse of this software.

## 🆘 Support & Troubleshooting

**Common Issues:**

### Issue: "Table 'users' does not exist"
This has been fixed in v2.1.0. The users table is now created automatically.
```bash
# Rebuild containers to apply fix
docker compose down -v
docker compose up --build
```

### Issue: Application won't start in production
Check that you've set required environment variables:
```bash
# Verify .env file contains:
DB_PASSWORD=<strong-password-not-changeme>
SESSION_SECRET=<32+-character-secret>
FRONTEND_URL=http://localhost:8080
```

### Issue: Permission denied errors in Docker
The backend now runs as non-root user (nodejs:1001). Ensure upload directories have correct permissions:
```bash
chmod -R 777 backend/public/uploads/
```

### General Troubleshooting Steps:

1. **Check service health:**
   ```bash
   docker compose ps
   # All services should show (healthy)
   ```

2. **View logs:**
   ```bash
   docker compose logs backend
   docker compose logs frontend
   docker compose logs db
   ```

3. **Check health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Verify database connection:**
   ```bash
   docker exec osint-crm-db psql -U postgres -d osint_crm_db -c "SELECT COUNT(*) FROM users;"
   ```

5. **Clean restart:**
   ```bash
   docker compose down -v  # WARNING: Deletes all data
   docker compose up --build
   ```

6. **Check browser console** for frontend errors

7. **Open an issue on GitHub** with:
   - Error messages from logs
   - Steps to reproduce
   - Docker version
   - Operating system

## 💬 Feedback

Feedback, inputs, and suggestions are highly welcome! Please open an issue or reach out directly.

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Tailwind CSS
- Leaflet (maps)
- ReactFlow (diagrams)
- Lucide Icons

**Backend:**
- Node.js / Express
- PostgreSQL 15
- xml2js (KML parsing)
- papaparse (CSV parsing)
- express-rate-limit (login & geocoding throttling)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)

---

## 📋 Recent Changes

### Version 2.5.0 (May 2026)
- 🔒 **Session fixation fixed** — session ID is now regenerated on every successful login (OWASP A07)
- 🔒 **Password policy enforced end-to-end** — min 12 chars, mixed case, digit, common-password blocklist applied at login/change, admin create, and admin reset
- 🔒 **Session revocation** — role changes, deactivations, deletions, and password resets immediately invalidate the target user's active sessions
- 🔒 **Live admin re-validation** — `requireAdmin` middleware re-checks user existence and role in the database on every admin request; stale or revoked sessions are rejected in real time
- 🔒 **Rate limiting** — `POST /api/auth/login` limited to 10 attempts/15 min per IP+username; geocoding endpoints limited to 60 req/min per IP via `express-rate-limit`
- 🔒 **Geocoding endpoints locked down** — `/api/geocode/suggestions`, `/api/geocode/address`, and `/api/geocode/stats` now require authentication
- 🔒 **KML upload size limit** — uploads capped at 5 MB by default; configurable with `KML_MAX_BYTES` environment variable; oversized uploads return 413
- 🐛 **Location data loss fixed** — creating or updating a person with mixed geocoded/ungeocoded locations no longer discards already-geocoded entries
- 🐛 **Batch geocode fallback fixed** — city/country fallback in batch geocoding now correctly triggers when the full-address lookup returns a failure object
- 🐛 **Autocomplete timeout added** — address suggestion requests now have the same 8s abort timeout as single-address geocoding
- 🐛 **Audit log JSON fields fixed** — changes to `locations`, `connections`, and `osint_data` now store the actual before/after JSON values instead of a useless `{changed: true}` marker
- 🐛 **Import partial-success signal** — imports that skip records due to errors now return `207 Multi-Status` with `partial: true`; add `?strict=1` for full rollback on any failure
- ✨ **People endpoint paginated** — `GET /api/people` honours `?limit` (default 100, max 1000) and `?offset`; `X-Total-Count` and `X-Has-More` response headers added
- ✨ **Wireless association model canonical** — `associated_person_ids` / `associated_business_ids` arrays are now the authoritative association store; filters, stats, and `/associate` helpers all use them consistently

### Version 2.4.0 (May 2026)
- 🔒 **Security hardening** — 15 vulnerabilities addressed: unauthenticated routes locked down, SQL injection in sort parameter fixed, Docker control endpoints removed, session cookie hardened with `SameSite=Strict`
- 🔒 **Secrets management** — `SESSION_SECRET` and `DB_PASSWORD` are now mandatory with no fallback defaults; app exits at startup if missing
- 🔒 **Docker hardening** — production `NODE_ENV` in compose, PostgreSQL no longer exposed to host network by default
- 🔒 **SVG upload blocked** — logo upload restricted to jpeg/png/gif only
- 🔒 **Wireless network passwords masked** — passwords excluded from API responses and masked in map popups
- 🐛 **Fixed wireless network route collision** — `/stats` endpoint no longer captured by `/:id` handler
- 🐛 **Fixed alias search** — variable shadowing bug in SQL query corrected
- 🐛 **Fixed locations pagination** — `hasMore` now correctly reflects active filters
- 🐛 **Fixed KML re-import** — empty BSSID stored as NULL instead of empty string
- 🐛 **Fixed business owner links after import** — `owner_person_id` now remapped correctly
- 🐛 **Fixed CSV import** — replaced naive `split(',')` with papaparse; quoted fields and embedded commas now handled
- 🐛 **Import resilience** — one bad record no longer rolls back the entire import
- 🐛 **Travel history date validation** — invalid dates return 400 instead of a DB error
- 🐛 **Geocoding timeout** — Nominatim requests now have an 8s timeout
- ✨ **Audit log improved** — changes to locations, connections, and OSINT data fields now recorded
- ✨ **Advanced search capped** — results limited to 500 rows to prevent memory issues

### Version 2.2.0 (January 2026)
- 🛜 **Manual wireless network entry** - Add networks manually with comprehensive forms
- 🗺️ **Wireless networks on map** - Networks appear on global map with WiFi icons
- 📡 **WiFi 7 support** - Full support for WiFi 7 frequency bands
- 🔗 **Multi-entity associations** - Associate networks with multiple people and businesses
- 🎨 **Dark mode improvements** - Fixed text readability across all components
- 📊 **Relationship graph enhancements** - Better centering and header readability
- ✨ **UI refinements** - Solid backgrounds for improved readability
- 🔧 **Flexible validation** - Only SSID required for network entry

### Version 2.1.0 (January 2026)
- 🔒 **Critical security improvements** - Production environment validation
- 🐛 **Fixed users table creation** - No more manual migrations needed
- ⚡ **Performance optimizations** - Database indexes added
- 🎯 **Optional email field** - Admin users don't require email
- 🛡️ **Docker security** - Non-root user implementation
- 🏥 **Health checks** - All services monitored for reliability
- 📝 **Graceful shutdown** - Proper cleanup on container stop

See [CHANGELOG.md](CHANGELOG.md) for complete details.

---

Built with ❤️ for the OSINT community.

**Version:** 2.5.0
**Last Updated:** May 28, 2026
