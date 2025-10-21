# User Management & Authentication System

This document describes the user management and authentication system implemented in the GHOST OSINT CRM.

## Overview

The system provides:
- User authentication with username/password
- Role-based access control (Admin and User roles)
- Session management
- Activity audit logging
- User account management

## User Roles

### Admin Role
Admins have full access to the system, including:
- All regular user features
- User management (create, edit, delete users)
- Access to audit logs
- Export/import data
- System administration

### User Role
Regular users can:
- Access and modify data (people, cases, tools, etc.)
- Cannot export data
- Cannot manage other users
- Cannot view audit logs

## Initial Setup

### Creating the First Admin User

After deploying the application, you need to create the first admin user:

```bash
cd backend
node scripts/createAdminUser.js
```

Follow the prompts to create your admin account with:
- Username
- Email
- Password
- First Name (optional)
- Last Name (optional)

## Using the System

### Logging In

1. Navigate to the application URL
2. You'll be presented with a login screen
3. Enter your username and password
4. Click "Sign in"

### Managing Users (Admin Only)

1. Log in as an admin
2. Click on "User Management" in the sidebar
3. You can:
   - **Add User**: Click the "Add User" button
   - **Edit User**: Click the edit icon next to a user
   - **Delete User**: Click the delete icon (cannot delete yourself)
   - **Activate/Deactivate**: Toggle user active status

### User Fields

When creating or editing a user:
- **Username** (required): Unique username for login
- **Email** (required): User's email address
- **Password** (required for new users): User's password
- **First Name**: Optional
- **Last Name**: Optional
- **Role**: Either "admin" or "user"
- **Active Status**: Whether the user can log in

### Viewing Audit Logs (Admin Only)

1. Log in as an admin
2. Click on "Audit Logs" in the sidebar
3. Filter logs by:
   - Entity type (person, tool, case, user)
   - Action (create, update, delete)
   - Date range
   - User

The audit logs track:
- What action was performed
- Who performed it
- When it was performed
- What changed (for updates)

## Security Features

### Password Security
- Passwords are hashed using bcryptjs with salt rounds
- Passwords are never stored in plain text
- Sessions are stored securely in the database

### Session Management
- Sessions expire after 30 days of inactivity
- Sessions are stored in PostgreSQL
- Secure cookies (HTTP-only, secure in production)

### Access Control
- All API endpoints are protected with authentication middleware
- Admin-only endpoints have additional role checks
- Users cannot escalate their own privileges
- Admins cannot delete or demote themselves

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/session` - Get current session status
- `GET /api/auth/me` - Get current user details
- `PUT /api/auth/me` - Update current user profile

### User Management (Admin Only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Audit Logs (Admin Only)
- `GET /api/audit-logs` - Get audit logs with filters
- `GET /api/audit-logs/entity/:type/:id` - Get logs for specific entity
- `GET /api/audit-logs/stats` - Get audit log statistics

## Environment Variables

Configure these in your `.env` file:

```env
# Session secret (change this in production!)
SESSION_SECRET=your-secret-key-change-this-in-production

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Database connection
DB_USER=postgres
DB_HOST=db
DB_NAME=osint_crm_db
DB_PASSWORD=changeme
DB_PORT=5432
```

## Database Schema

### Users Table
- `id`: Serial primary key
- `username`: Unique username
- `email`: Unique email
- `password_hash`: Bcrypt hashed password
- `first_name`: Optional first name
- `last_name`: Optional last name
- `role`: 'admin' or 'user'
- `is_active`: Boolean, whether user can log in
- `last_login`: Timestamp of last login
- `created_at`: Timestamp of user creation
- `updated_at`: Timestamp of last update

### Audit Logs Table
- `id`: Serial primary key
- `entity_type`: Type of entity (person, tool, case, user)
- `entity_id`: ID of the affected entity
- `field_name`: Name of the field that changed
- `old_value`: Previous value
- `new_value`: New value
- `action`: Type of action (create, update, delete)
- `user_id`: ID of user who performed action
- `created_at`: Timestamp of action

### User Sessions Table
(Automatically created by connect-pg-simple)
- Stores session data
- Expires sessions automatically

## Troubleshooting

### Cannot Log In
- Verify username and password are correct
- Check that user account is active
- Check browser console for errors
- Verify backend server is running

### Session Expires Too Quickly
- Check `cookie.maxAge` in `server.js`
- Default is 30 days (30 * 24 * 60 * 60 * 1000)

### Forgot Admin Password
1. Connect to your PostgreSQL database
2. Run the create admin script to create a new admin user
3. Or manually reset password:
```sql
UPDATE users
SET password_hash = '$2a$10$[hash]'
WHERE username = 'your_username';
```

### Database Migration
The users table and audit_logs table are created automatically when the server starts via `initDatabase.js`.

## Best Practices

1. **Change Default Session Secret**: Update `SESSION_SECRET` in production
2. **Use Strong Passwords**: Enforce password complexity on user creation
3. **Regular Backups**: Backup the users and audit_logs tables regularly
4. **Review Audit Logs**: Periodically review audit logs for suspicious activity
5. **Deactivate vs Delete**: Consider deactivating users instead of deleting them
6. **Limited Admin Access**: Only grant admin role to trusted users

## Future Enhancements

Potential improvements:
- Password reset via email
- Two-factor authentication
- Password complexity requirements
- Account lockout after failed login attempts
- More granular permissions
- User activity dashboard
- Export audit logs to CSV/PDF
