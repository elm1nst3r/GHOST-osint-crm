# User Management & Authentication

This document covers the authentication system, user roles, and admin operations for GHOST OSINT CRM.

## User Roles

### Admin
- Full access to all data and features
- User management (create, edit, deactivate, delete)
- Audit log access
- Data export / import
- System settings

### User
- Read and write access to investigation data (people, cases, tools, etc.)
- Cannot manage other users
- Cannot view audit logs
- Cannot export data

---

## Initial Setup — Creating the First Admin

After the containers are running, create your first admin account:

```bash
docker exec osint-crm-backend node scripts/createAdminSimple.js <username> <password> [email]

# Example
docker exec osint-crm-backend node scripts/createAdminSimple.js admin MyStr0ngPass!
```

Email is optional. Password requirements:
- Minimum 12 characters
- At least one uppercase letter, one lowercase letter, one digit
- Cannot be a common/weak password (blocklist of 100+ entries)
- Cannot contain your username

---

## Using the Application

### Logging In
1. Navigate to http://localhost:8080
2. Enter your username and password
3. Click **Sign in**

### Managing Users (Admin only)
1. Log in as admin
2. Go to **User Management** in the sidebar
3. Available actions:
   - **Add User** — create a new account
   - **Edit** — update name, email, role, or reset password
   - **Activate / Deactivate** — toggle login access without deleting the account
   - **Delete** — permanent removal (cannot delete your own account)

### User Fields
| Field | Required | Notes |
|-------|----------|-------|
| Username | ✅ | Unique, used for login |
| Password | ✅ (new users) | Must meet password policy above |
| Email | ❌ | Optional |
| First / Last Name | ❌ | Optional |
| Role | ✅ | `admin` or `user` |
| Active | ✅ | Inactive users cannot log in |

### Viewing Audit Logs (Admin only)
1. Click **Audit Logs** in the sidebar
2. Filter by entity type, action, date range, or user

Audit logs record: what changed, who changed it, when, and the before/after values.

---

## Security Features

### Sessions
- Stored in PostgreSQL via `connect-pg-simple`
- Session ID **regenerated on every login** — prevents session fixation
- Sessions **immediately revoked** when a user's password is changed, role is changed, account is deactivated, or account is deleted
- Cookies: `HttpOnly`, `SameSite=Strict`; `Secure` flag set automatically in production

### Password Policy
Enforced at every password-setting point (login, change, admin create, admin reset):
- Minimum 12 characters, maximum 128
- Must contain uppercase, lowercase, and a digit
- Common/weak passwords rejected (blocklist)
- Cannot contain the user's own username
- Hashed with bcryptjs before storage — never stored in plain text

### Rate Limiting
- Login: **10 attempts per 15 minutes** per IP + username
- Password change: **5 attempts per hour**

### Access Control
- All API endpoints require authentication
- Admin endpoints perform a **live database lookup** on every request — stale or revoked sessions are rejected immediately
- Users cannot escalate their own privileges
- Admins cannot delete or demote themselves

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Session status |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me` | Update profile |

### User Management (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Audit Logs (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs` | List with filters |
| GET | `/api/audit-logs/entity/:type/:id` | Logs for an entity |
| GET | `/api/audit-logs/stats` | Summary statistics |

---

## Environment Variables

```env
SESSION_SECRET=<generate with: openssl rand -base64 32>
FRONTEND_URL=http://localhost:8080

DB_USER=postgres
DB_HOST=db
DB_NAME=osint_crm_db
DB_PASSWORD=<generate with: openssl rand -base64 24>
DB_PORT=5432
```

⚠️ Never commit `.env` to version control. Never use placeholder values in production.

---

## Troubleshooting

### Cannot log in
- Verify the username and password are correct
- Check the account is active (admin can toggle this)
- Check backend logs: `docker compose logs backend`

### Forgot admin password
Reset via a new admin account, or connect directly to the database:

```bash
# Generate a new hash (run from the backend directory)
node -e "const b = require('bcryptjs'); b.hash('NewPassword123', 12, (e,h) => console.log(h));"

# Apply it
docker exec -it osint-crm-db psql -U postgres -d osint_crm_db \
  -c "UPDATE users SET password_hash = '<hash>' WHERE username = 'yourusername';"
```

The new password must still meet the policy the next time it is changed through the UI.

### Session expires unexpectedly
- Default session lifetime is 30 days of inactivity
- `cookie.maxAge` is configured in `backend/server.js`
- Sessions are also revoked server-side on password/role changes — this is intentional

---

## Best Practices

- Grant admin role only to trusted personnel
- Deactivate rather than delete users to preserve audit trail integrity
- Review audit logs periodically for unusual activity
- Back up the `users` and `audit_logs` tables regularly
- Rotate `SESSION_SECRET` if you suspect it has been compromised (all active sessions will be invalidated)
