# User Management & Authentication

This document covers the authentication system, user roles, and admin operations for GHOST OSINT CRM.

## Roles and Hierarchy

GHOST has two kinds of role:

- an **account role** (`admin` or `user`), set on the user account by an
  administrator, which decides whether someone can run the instance;
- a **project role** (`owner`, `manager` or `investigator`), held on each
  project membership, which decides what a non-admin can do *inside that
  project*.

```
Administrator          account role — every project, every setting
  │
  └─ User              account role — only projects they are a member of
       │                (one project role per membership)
       ├─ Owner        manages the project's managers and investigators
       ├─ Manager      edits project settings, manages investigators
       └─ Investigator works with the project's data
```

The project role belongs to the membership, not the account. The same user
can be an owner on one project, a manager on another and an investigator on
a third, and not a member of a fourth at all — in which case that project
does not exist as far as they can tell. Administrators are never listed as
members; they reach every project regardless.

### Administrator

- Everything in every project, without being a member
- Create and delete projects
- Make someone a project **owner**, and change or remove owners
- User management (create, edit, deactivate, delete)
- Audit logs, data export / import, system health
- System settings: branding, geocoding, update checks, archived-project
  retention, Settings → Data Model, custom fields
- Batch geocoding and bulk deletes

### User

A user sees and can reach only the projects they have been added to. What
they can do there depends on their project role.

| | Owner | Manager | Investigator |
|---|:---:|:---:|:---:|
| Read and write the project's records | ✅ | ✅ | ✅ |
| See the project's member list | ✅ | ✅ | ✅ |
| Edit project settings (name, description, icon, status, cross-project linking) | ✅ | ✅ | — |
| Add and remove investigators | ✅ | ✅ | — |
| Add, promote, demote and remove managers | ✅ | — | — |
| Make someone an owner, or change / remove an owner | — | — | — |
| Change their own membership | — | — | — |
| Create or delete projects | — | — | — |

The membership rule behind the table: **a non-admin can only act on members
ranked below themselves (owner > manager > investigator), can only grant
roles below their own, and can never change their own membership.** Only an
administrator can appoint, change or remove an owner, so there is always
someone above every project role who can fix a mistake.

Two project settings deserve care when you hand out the manager role:

- **Closing a project** (status *Closed*) starts the archived-project
  retention clock if an administrator has enabled a retention period —
  when it runs out, the project and all its data are deleted.
- **Cross-project linking** allows relationships in this project to point
  at records that belong to other projects. It is off by default.

### Typical setup

1. An administrator creates the user accounts (Settings → User Management),
   all with the `user` role.
2. The administrator creates a project and, from the project's member list,
   adds one or more **owners**.
3. Owners add **managers**; owners or managers add **investigators**.
4. Day-to-day membership changes no longer need the administrator, except
   for anything involving an owner.

All of this is enforced by the API on every project-scoped route, not just
hidden in the interface; the member list only shows each person the
controls they are allowed to use.

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
4. If you've turned on two-step verification, enter the code from your authenticator app, use your passkey, or enter a recovery code

### Two-Step Verification
Under **Settings → Security** every user can add a second step to their sign-in, so a stolen password alone isn't enough:

- **Authenticator app**: any app that shows 6-digit codes (Google Authenticator, Microsoft Authenticator, Authy, 1Password, …). Scan the QR code, or type the key shown under it, then enter a code to confirm.
- **Passkeys**: confirm sign-in with your fingerprint, face, device PIN or a security key. Passkeys are tied to the server's address: they only work when GHOST is opened at the address in `FRONTEND_URL` (or `PASSKEY_ORIGINS`), and only over **HTTPS with a domain name, or on localhost**. Plain HTTP on a network name, or an IP address like `https://192.168.1.10`, can't use them. If the address changes, existing passkeys stop working; sign in with the app or a recovery code and add them again.
- **Recovery codes**: ten one-time codes, shown once when you add your first method. Keep them in a password manager. **Get new codes** replaces them.

Removing a method or getting new recovery codes asks for your password. Each code from the app works once, five wrong codes in a row end the attempt, and the second step is limited to 10 tries per account per 15 minutes.

**Lost your phone?** Sign in with a recovery code. If you have none left, ask an administrator to reset your two-step verification (**Settings → Users**, the shield button). If you're the only administrator:
```bash
docker exec -it osint-crm-backend node scripts/resetTwoFactor.js <username>
```

**Requiring it for everyone (admin):** **Settings → Security → Server policy**. Users without two-step verification are asked to set it up at their next sign-in, before they can use GHOST. You need it on your own account first.

### API Tokens
For the MCP server and scripts. Create one under **Settings → Security → API tokens** (asks for your password) and send it as `Authorization: Bearer ghost_…`. A token:
- acts as you, with your role and project access, and skips two-step verification, so treat it like a password;
- is shown once; GHOST stores only a hash;
- can expire after 30, 90 or 365 days, or never, and can be revoked at any time;
- stops working when your account is deactivated;
- can't change your password or your security settings, or create more tokens.

Accounts with two-step verification need a token for the MCP server; see [mcp/README.md](mcp/README.md).

### Single sign-on (OpenID Connect)
GHOST can sign people in through an identity provider that speaks OpenID Connect: Keycloak, Authentik, Authelia, Zitadel, Entra ID, Google and others. Users then sign in with their existing account, and two-step verification, password rules and offboarding happen at the provider. The sign-in page shows a **Sign in with …** button next to (or instead of) the password form.

**How accounts are matched.** GHOST links an identity by the provider's issuer and its permanent user id (`sub`), never by email or username alone.
- A sign-in that matches no linked account is refused, and appears under **Settings → User Management → Single sign-on** for an admin to **link** to an existing user or **create** a new user for (that user gets no GHOST password).
- With `OIDC_AUTO_PROVISION=true`, a new identity becomes a new GHOST user on first sign-in, unless a local user already has the same email: then it waits for an admin, so nobody ends up with two accounts.
- New users start with no project access and see the "no project" screen until someone adds them to a project.
- With `OIDC_ADMIN_GROUP` set, the provider decides who is an administrator: members of that group get the Administrator role at each sign-in, everyone else User. Project roles (Owner/Manager/Investigator) stay in GHOST.
- Deactivating a user in GHOST blocks their single sign-on too. Unlinking an identity (edit the user) signs them out.
- GHOST's own "require two-step verification" setting doesn't apply to single sign-on: the provider does that.
- Accounts without a GHOST password create API tokens (for the MCP server) right after signing in; after 15 minutes GHOST asks them to sign in again first.

**Settings** (environment variables, see `.env.example`):

| Variable | Meaning |
|---|---|
| `OIDC_ENABLED` | `true` to turn it on |
| `OIDC_ISSUER_URL` | the provider's issuer, e.g. `https://keycloak.example.com/realms/ghost` (must be https) |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | the client registered for GHOST (leave the secret empty for a public client; PKCE is always used) |
| `OIDC_REDIRECT_URI` | `https://<your GHOST address>/api/auth/oidc/callback` |
| `OIDC_SCOPES` | default `openid profile email` |
| `OIDC_DISPLAY_NAME` | the button text: "Sign in with *Keycloak*" |
| `OIDC_AUTO_PROVISION` | `true`: create users on first sign-in (default `false`: an admin links them) |
| `OIDC_ADMIN_GROUP`, `OIDC_GROUPS_CLAIM` | group that makes someone an admin, and the claim that lists groups (default `groups`; nested claims like `realm_access.roles` work) |
| `OIDC_LOGOUT` | default `true`: signing out of GHOST also signs out at the provider |
| `LOCAL_LOGIN_ENABLED` | default `true`. Set `false` to allow single sign-on only; set it back to `true` and restart if the provider is ever unreachable |

**Keycloak example.**
1. In your realm, create a client: *Client ID* `ghost`, *Client authentication* on, *Standard flow* on (nothing else).
2. *Valid redirect URIs*: `https://ghost.example.com/api/auth/oidc/callback`; *Valid post logout redirect URIs*: `https://ghost.example.com/*`.
3. Optional, for `OIDC_ADMIN_GROUP`: *Client scopes → ghost-dedicated → Add mapper → Group Membership*, token claim name `groups`, *Full group path* off.
4. Copy the client secret from the *Credentials* tab, then in GHOST's `.env`:
   ```
   OIDC_ENABLED=true
   OIDC_ISSUER_URL=https://keycloak.example.com/realms/<realm>
   OIDC_CLIENT_ID=ghost
   OIDC_CLIENT_SECRET=<secret>
   OIDC_REDIRECT_URI=https://ghost.example.com/api/auth/oidc/callback
   OIDC_DISPLAY_NAME=Keycloak
   OIDC_ADMIN_GROUP=ghost-admins
   ```
5. `docker compose up -d`. The status shows under Settings → User Management → Single sign-on.

Other providers work the same way: register a "web" client with the redirect URI above and use the issuer URL from their documentation.

### Managing Users (Admin only)
1. Log in as admin
2. Go to **Settings → User Management**
3. Available actions:
   - **Add User** — create a new account
   - **Edit** — update name, email, role, or reset password
   - **Activate / Deactivate** — toggle login access without deleting the account
   - **Delete** — permanent removal (cannot delete your own account)
   - **Reset two-step verification** (shield button, shown for users who have it) — removes their authenticator app, passkeys and recovery codes and signs them out, for someone who lost their phone
   - **Single sign-on** — link waiting sign-ins to users or create users for them; unlink an identity in the user's edit dialog

### User Fields
| Field | Required | Notes |
|-------|----------|-------|
| Username | ✅ | Unique, used for login |
| Password | ✅ (new users) | Must meet password policy above |
| Email | ❌ | Optional |
| First / Last Name | ❌ | Optional |
| Role | ✅ | `admin` or `user` — the account role. Project roles are set per project, from that project's member list |
| Active | ✅ | Inactive users cannot log in |

### Viewing Audit Logs (Admin only)
1. Go to **Settings → Audit Logs**
2. Filter by entity type, action, date range, or user

Audit logs record: what changed, who changed it, when, and the before/after values.

---

## Security Features

### Sessions
- Stored in PostgreSQL via `connect-pg-simple`
- Session ID **regenerated on every login** — prevents session fixation
- Sessions **immediately revoked** when a user's password is changed, role is changed, account is deactivated, or account is deleted
- Turning on two-step verification signs out the user's other sessions; an admin reset signs out all of them
- Cookies: `HttpOnly`, `SameSite=Strict`; `Secure` flag set automatically in production

### Password Policy
Enforced at every password-setting point (login, change, admin create, admin reset):
- Minimum 12 characters, maximum 128
- Must contain uppercase, lowercase, and a digit
- Common/weak passwords rejected (blocklist)
- Cannot contain the user's own username
- Hashed with bcryptjs before storage — never stored in plain text

### Rate Limiting
- Login: **10 attempts per 15 minutes** per IP + username — tunable via `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS`, or disabled for automated clients with `LOGIN_RATE_LIMIT_DISABLE=true`
- Integrated OSINT tool searches: **30 per minute**
- Login, second-step and tool-search counts are kept in the database, so restarting the backend doesn't reset them
- Second sign-in step: **10 attempts per 15 minutes** per account, and five wrong codes in a row end the attempt

### Access Control
- API endpoints require authentication, apart from login, the session check, the health probe and the branding shown on the login screen
- Project-scoped data requires membership of that project (admins excepted)
- Membership changes are rank-checked: owners and managers can only act on members below them, and nobody but an admin can change their own membership
- Admin endpoints perform a **live database lookup** on every request — stale or revoked sessions are rejected immediately
- Users cannot escalate their own privileges
- Admins cannot delete or demote themselves

---

## API Reference

The tables below cover accounts and auditing. The complete, browsable
reference is at `/api/docs` on your instance (signed-in users), and for the
latest release at https://elm1nst3r.github.io/GHOST-osint-crm/.

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
| GET | `/api/users/directory` | Active users (id, username, email) for member pickers — any signed-in user |
| GET | `/api/users/:id` | Get user |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Project membership
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/members` | List members — any member of the project |
| POST | `/api/projects/:id/members` | Add a user — owner, manager or admin (within their rank) |
| PUT | `/api/projects/:id/members/:userId` | Change a member's role — owner, manager or admin (within their rank) |
| DELETE | `/api/projects/:id/members/:userId` | Remove a member — owner, manager or admin (within their rank) |

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
