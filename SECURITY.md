# Security Guidelines and Best Practices

## Overview

This document outlines security considerations, best practices, and recommendations for the GHOST OSINT CRM application.

## Recent Security Improvements (2025)

### 1. Environment Variable Protection
- ✅ Added `.env.example` files for both root and backend
- ✅ Created comprehensive `.gitignore` to prevent committing sensitive files
- ✅ Added environment variable validation on startup
- ⚠️ **Action Required**: Copy `.env.example` to `.env` and update with your credentials

### 2. Input Validation & Sanitization
- ✅ Created validation middleware for all user inputs
- ✅ SQL injection detection and prevention
- ✅ XSS protection through input sanitization
- ✅ URL, email, and data format validation
- ✅ Rate limiting to prevent abuse

### 3. Improved Error Handling
- ✅ Centralized logging system with different log levels
- ✅ Request/response logging middleware
- ✅ Proper error handling that doesn't expose internal details in production
- ✅ Database query timing and performance logging

### 4. Database Security
- ✅ Optimized connection pooling with proper limits
- ✅ Automatic client cleanup and connection management
- ✅ Transaction support for atomic operations
- ✅ Database health monitoring

## Known Vulnerabilities

### Frontend Dependencies (npm audit)
The frontend has **15 vulnerabilities** (2 low, 4 moderate, 8 high, 1 critical):
- Most are in dev dependencies (webpack-dev-server, postcss)
- These affect the development server, NOT the production build
- Running `npm audit fix --force` may break the build
- **Recommendation**: Monitor for updates to react-scripts that resolve these issues

### Assessment
- ⚠️ Development-only vulnerabilities (not exposed in production)
- ✅ Production build is served by Nginx and does not include dev dependencies
- 📌 Consider upgrading to newer React/CRA version in future

## Security Checklist for Production Deployment

### Before Going Live:

#### 1. Environment Variables
- [ ] Change default database password from 'changeme'
- [ ] Set strong, unique DB_PASSWORD (16+ characters, mixed case, numbers, symbols)
- [ ] Set NODE_ENV=production
- [ ] Never commit `.env` files to version control
- [ ] Use secrets management (AWS Secrets Manager, Vault, etc.) in cloud deployments

#### 2. Database Security
- [ ] Enable SSL/TLS for database connections
- [ ] Use a dedicated database user with limited privileges
- [ ] Implement regular database backups
- [ ] Enable PostgreSQL audit logging
- [ ] Restrict database access to application servers only

#### 3. Network Security
- [ ] Enable HTTPS/TLS for all connections
- [ ] Configure Nginx with SSL certificates
- [ ] Set up proper CORS policies (restrict origins in production)
- [ ] Use a reverse proxy (Nginx) for additional security layer
- [ ] Implement firewall rules to restrict access

#### 4. Application Security
- [ ] Review and update all default credentials
- [ ] Implement authentication (currently not present!)
- [ ] Add authorization/access control
- [ ] Enable CSRF protection
- [ ] Implement session management
- [ ] Set security headers (Helmet.js)

#### 5. Docker Security
- [ ] Don't run containers as root
- [ ] Scan images for vulnerabilities
- [ ] Use specific image versions (not 'latest')
- [ ] Limit container resources
- [ ] Use Docker secrets for sensitive data

#### 6. Monitoring & Logging
- [ ] Set up centralized logging (ELK, Splunk, CloudWatch)
- [ ] Implement intrusion detection
- [ ] Monitor for unusual access patterns
- [ ] Set up alerts for errors and security events
- [ ] Regular security audits

## Authentication & Authorization

### ⚠️ CRITICAL: No Authentication Currently Implemented!

This application currently has **NO authentication or authorization**. This means:
- Anyone with network access can view/modify ALL data
- Suitable for local/trusted networks only
- **DO NOT expose to public internet without authentication**

### Recommended Implementation:
1. **Add JWT-based authentication**
   - User login/registration system
   - Password hashing with bcrypt
   - JWT tokens for session management

2. **Implement role-based access control (RBAC)**
   - Admin, investigator, and viewer roles
   - Per-resource permissions
   - Audit trail for all actions

3. **Add security middleware**
   ```javascript
   // Example middleware to add
   - helmet (security headers)
   - express-rate-limit (already partially implemented)
   - express-session (session management)
   - passport.js (authentication strategies)
   ```

## Data Protection

### Sensitive Data Handling
1. **Personal Information**: People records contain PII (names, addresses, etc.)
2. **Investigation Data**: Case information may be sensitive
3. **OSINT Sources**: Tool URLs and access methods

### Recommendations:
- Encrypt data at rest (database-level encryption)
- Encrypt data in transit (HTTPS/TLS)
- Implement data retention policies
- Add data export/deletion capabilities for GDPR compliance
- Consider field-level encryption for highly sensitive data

## API Security

### Current Implementation:
- ✅ Input validation on all endpoints
- ✅ Basic rate limiting (100 requests/minute per IP)
- ✅ SQL injection prevention
- ✅ XSS protection
- ❌ No authentication required
- ❌ No API key system

### Recommendations:
1. Add API authentication (Bearer tokens)
2. Implement request signing
3. Add API versioning
4. Set up API gateway for production
5. Implement stricter rate limiting per user/API key

## File Upload Security

### Current State:
- Logo uploads limited to 5MB
- File type validation (images only)
- Files stored in `/backend/public/uploads/logos/`

### Concerns:
- No virus scanning
- No content validation beyond file extension
- Files publicly accessible

### Recommendations:
1. Implement virus/malware scanning (ClamAV)
2. Validate file contents, not just extension
3. Use object storage (S3) instead of local filesystem
4. Generate random filenames to prevent directory traversal
5. Set proper file permissions
6. Implement file size quotas per user

## Docker Security Best Practices

### Current docker-compose.yml Issues:
```yaml
# ⚠️ Exposes PostgreSQL to host
ports:
  - "5432:5432"  # Should be internal only unless needed for dev

# ⚠️ Default passwords in environment
DB_PASSWORD: ${DB_PASSWORD:-changeme}  # Weak default
```

### Recommendations:
1. Use Docker secrets for passwords
2. Don't expose unnecessary ports to host
3. Run containers as non-root users
4. Use multi-stage builds to minimize image size
5. Scan images with Trivy or Snyk

## Geocoding Service Security

The application uses OpenStreetMap Nominatim for geocoding:
- Includes proper User-Agent header
- Implements rate limiting (1 second between requests)
- Caches results in database to minimize external calls
- **Note**: Consider self-hosting Nominatim or using commercial service for production

## Regular Maintenance

### Weekly:
- Review audit logs for suspicious activity
- Check system health metrics
- Verify backup completion

### Monthly:
- Update dependencies (`npm audit` and `npm update`)
- Review user access and permissions (once implemented)
- Security patch review

### Quarterly:
- Full security audit
- Penetration testing
- Review and update security policies

## Incident Response Plan

### If Security Breach Detected:
1. **Immediate Actions**:
   - Isolate affected systems
   - Preserve logs and evidence
   - Change all credentials

2. **Assessment**:
   - Determine scope of breach
   - Identify compromised data
   - Document timeline

3. **Remediation**:
   - Patch vulnerabilities
   - Restore from clean backups if necessary
   - Implement additional monitoring

4. **Communication**:
   - Notify affected parties
   - Document lessons learned
   - Update security measures

## Resources

### Tools:
- **OWASP ZAP**: Web application security scanner
- **npm audit**: Dependency vulnerability checker
- **Snyk**: Continuous security monitoring
- **SonarQube**: Code quality and security analysis

### References:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

## Contact

For security issues or concerns, create a GitHub issue or contact the maintainer directly.

**Remember**: Security is an ongoing process, not a one-time task!
