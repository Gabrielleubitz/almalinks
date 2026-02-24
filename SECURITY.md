# Security Documentation

This document outlines all security measures implemented in the Alma Links application to protect against threats and attacks.

## Quick Reference: Security Changes Made

### Files Modified/Created

**Configuration Files:**
- `.gitignore` - Updated to exclude all service account keys and sensitive files
- `cors.json` - Restricted CORS to specific allowed origins (no wildcard)
- `_headers` - Added comprehensive security headers (CSP, HSTS, XSS protection, etc.)
- `storage.rules` - Tightened storage rules (default deny, authenticated read, owner-only write)
- `firestore.rules` - Require authentication for event reads (was public)
- `vite.config.ts` - Security configurations for Vite build

**Source Code:**
- `src/firebase/config.ts` - Removed hardcoded API keys, added environment variable validation, removed debug code in production
- `src/hooks/useAdmin.ts` - Removed hardcoded admin emails, uses Firestore role field
- `src/utils/security.ts` - **NEW** - Comprehensive security utilities (input sanitization, rate limiting, validation)
- `src/utils/validation.ts` - Existing validation utilities (already secure)

**API Routes:**
- `api/chat.js` - Added input sanitization and validation
- `api/chat-api.js` - Added CORS origin validation and security headers
- `api/user-admin.js` - Already had validation, enhanced with security comments
- `api/delete-user.js` - Already had admin verification
- `api/activity-admin.js` - Already had token verification
- `api/firebase-init.js` - Removed hardcoded service account key fallback
- `dev-server.js` - Added CORS origin validation and security headers

**Documentation:**
- `SECURITY.md` - This file (comprehensive technical documentation)
- `docs/security-overview.md` - **NEW** - Non-technical security overview for founders/managers
- `SECURITY_CHECKLIST.md` - Implementation checklist
- `SECURITY_SUMMARY.md` - Executive summary

### Key Security Decisions

1. **CSP Configuration**: Allows Firebase and Google APIs (required for Firebase SDK), blocks all other external scripts except Hotjar (analytics)
2. **Auth Enforcement**: All protected routes verify Firebase ID tokens; admin routes additionally verify role in Firestore
3. **Firestore Access**: Users can only access their own documents; admins have verified override; events require authentication
4. **Input Sanitization**: All user input is sanitized using utilities in `src/utils/security.ts` before processing
5. **CORS Policy**: Restricted to production domains + localhost for development only

### Security Checklist for Future Changes

When adding new features, ensure:
- [ ] Validate inputs in all new API routes using `src/utils/security.ts`
- [ ] Update CSP in `_headers` if adding new external script providers
- [ ] Update Firestore rules in `firestore.rules` when adding new collections
- [ ] Update CORS origins in `cors.json` and `src/utils/security.ts` if adding new domains
- [ ] Verify authentication/authorization for all new protected routes
- [ ] Add rate limiting for new public-facing endpoints
- [ ] Never commit secrets - use environment variables only
- [ ] Update `.env.example` with any new required environment variables

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Data Protection](#data-protection)
3. [API Security](#api-security)
4. [Input Validation & Sanitization](#input-validation--sanitization)
5. [Network Security](#network-security)
6. [Storage Security](#storage-security)
7. [Firebase Security Rules](#firebase-security-rules)
8. [Environment Variables & Secrets](#environment-variables--secrets)
9. [Security Headers](#security-headers)
10. [Rate Limiting](#rate-limiting)
11. [Security Best Practices](#security-best-practices)
12. [Incident Response](#incident-response)

---

## Authentication & Authorization

### Firebase Authentication
- **Implementation**: All user authentication is handled through Firebase Authentication
- **Methods Supported**: Email/Password authentication
- **Session Management**: Browser local persistence (stays logged in until explicit logout)
- **Token Verification**: All API endpoints verify Firebase ID tokens before processing requests

### Role-Based Access Control (RBAC)
- **Admin Role**: Determined by `role: 'admin'` field in Firestore user document
- **Custom Claims**: Firebase Custom Claims are set server-side when roles are updated
- **Verification**: Admin status is verified in two ways:
  1. Client-side: Checks `user.role` from Firestore (via `useAuth` hook)
  2. Server-side: Verifies role in Firestore document for all admin operations
- **No Hardcoded Admin Lists**: Admin status is never determined by hardcoded email lists

### Protected Routes
- All admin routes require authentication and admin role verification
- User-specific routes verify ownership before allowing access
- Unauthorized access attempts are logged for security monitoring

---

## Data Protection

### Sensitive Data Handling
- **Firebase Admin SDK Keys**: Never stored in repository, must be provided via environment variables
- **API Keys**: All Firebase configuration uses environment variables, no hardcoded values
- **Password Storage**: Handled by Firebase Authentication (passwords are hashed and never stored in plain text)
- **User Data**: Stored in Firestore with proper access controls via security rules

### Data Encryption
- **In Transit**: All communications use HTTPS/TLS
- **At Rest**: Firebase handles encryption of data at rest
- **Storage**: Firebase Storage files are encrypted at rest

---

## API Security

### CORS Configuration
- **Restricted Origins**: Only specific allowed origins can make API requests
- **Allowed Origins**:
  - `https://almalinks.com`
  - `https://www.almalinks.com`
  - `https://alma-links-test.web.app`
  - `https://alma-links-test.firebaseapp.com`
  - Development: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:3001`
- **Credentials**: CORS credentials are enabled for authenticated requests
- **No Wildcard Origins**: The `*` wildcard is never used in production

### API Authentication
- **Token-Based**: All protected API endpoints require Firebase ID token in `Authorization: Bearer <token>` header
- **Token Verification**: Tokens are verified server-side using Firebase Admin SDK
- **Expiration**: Tokens expire automatically (handled by Firebase)
- **Invalid Token Handling**: Invalid or expired tokens result in 401 Unauthorized responses

### API Endpoint Security
- **Admin Endpoints**: Require both authentication and admin role verification
- **User Endpoints**: Verify user ownership or admin role before allowing access
- **Public Endpoints**: Limited public endpoints (e.g., member locations) with no sensitive data
- **Error Messages**: Generic error messages in production (detailed errors only in development)

---

## Input Validation & Sanitization

### Client-Side Validation
- **Form Validation**: All forms use validation utilities (`src/utils/validation.ts`)
- **Email Validation**: RFC-compliant email format validation
- **URL Validation**: Proper URL format validation for LinkedIn, website, Twitter fields
- **Phone Validation**: E.164 format or local format validation
- **Length Limits**: Maximum length restrictions on all text fields

### Server-Side Sanitization
- **XSS Prevention**: All user input is sanitized to prevent cross-site scripting attacks
- **HTML Sanitization**: HTML content is sanitized to remove script tags and event handlers
- **NoSQL Injection Prevention**: Firestore queries use parameterized queries and input sanitization
- **Path Traversal Prevention**: File names and document IDs are sanitized to prevent path traversal
- **Input Sanitization Utilities**: Located in `src/utils/security.ts`

### Sanitization Functions
- `sanitizeString()`: Removes HTML tags and escapes special characters
- `sanitizeHTML()`: Allows safe HTML but removes scripts and event handlers
- `sanitizeEmail()`: Validates and normalizes email addresses
- `sanitizeURL()`: Validates and normalizes URLs
- `sanitizeDocumentId()`: Prevents path traversal in Firebase document IDs
- `sanitizeFirestoreQuery()`: Prevents NoSQL injection attacks

---

## Network Security

### HTTPS Enforcement
- **Production**: All production deployments use HTTPS only
- **HSTS**: HTTP Strict Transport Security header enforces HTTPS
- **Mixed Content**: Blocked by Content Security Policy

### Security Headers
All responses include the following security headers:

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains` - Enforces HTTPS
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: Restricts access to geolocation, microphone, camera
- **Content-Security-Policy**: Restricts resource loading to prevent XSS and data injection

### CORS Headers
- **Access-Control-Allow-Origin**: Restricted to allowed origins only
- **Access-Control-Allow-Credentials**: Enabled for authenticated requests
- **Access-Control-Allow-Methods**: Limited to necessary HTTP methods
- **Access-Control-Allow-Headers**: Limited to necessary headers

---

## Storage Security

### Firebase Storage Rules
- **Default Deny**: All paths default to deny access
- **Authenticated Access**: Most files require authentication to read
- **Owner-Only Write**: Users can only write to their own files
- **Admin Override**: Admins have full access to all files
- **Path Restrictions**: Files are organized by user ID to prevent unauthorized access

### File Upload Security
- **File Type Validation**: Only allowed MIME types are accepted
- **File Name Sanitization**: File names are sanitized to prevent path traversal
- **Size Limits**: File size limits enforced (configured per use case)
- **Virus Scanning**: Recommended for production (not currently implemented)

---

## Firebase Security Rules

### Firestore Rules
- **Authentication Required**: Most collections require authentication
- **Role-Based Access**: Admin role checked via Firestore document lookup
- **Owner Verification**: Users can only access their own documents
- **Read/Write Separation**: Different rules for read and write operations
- **Subcollection Protection**: Subcollections inherit parent security rules

### Key Security Rules:
- **Users Collection**: Users can read/write their own profile; admins can access all
- **Events Collection**: Authenticated users can read; only admins can write
- **Connections Collection**: Users can only access connections they're part of
- **Connection Requests**: Users can only access requests involving them
- **Announcements**: Authenticated users can read; only admins can write

### Storage Rules
- **Profile Pictures**: Authenticated users can read; only owner can write
- **Speaker Files**: Authenticated users can read; only owner can write
- **Public Assets**: Read-only public access (if any)
- **Admin Override**: Admins have full access

---

## Environment Variables & Secrets

### Required Environment Variables

#### Client-Side (VITE_ prefix)
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Firebase analytics measurement ID

#### Server-Side
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK service account key (JSON or base64-encoded JSON)
- `FIREBASE_PROJECT_ID`: Firebase project ID (fallback)
- `FIREBASE_CLIENT_EMAIL`: Firebase client email (fallback)
- `FIREBASE_PRIVATE_KEY`: Firebase private key (fallback)

#### Optional
- `VITE_ADMIN_EMAIL`: Admin notification email
- `MJ_APIKEY_PUBLIC`: Mailjet public API key
- `MJ_APIKEY_PRIVATE`: Mailjet private API key
- `TWILIO_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token

### Secret Management
- **Never Commit Secrets**: All secrets must be in environment variables
- **Gitignore**: `.gitignore` includes patterns for service account keys
- **Production**: Use hosting platform's environment variable management (Vercel, Netlify, etc.)
- **Development**: Use `.env.local` file (not committed to repository)

### ⚠️ CRITICAL: Remove Service Account Key File
**The file `alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json` must be removed from the repository immediately.**

1. Delete the file from the repository
2. Add it to `.gitignore` (already done)
3. Remove it from git history: `git rm --cached alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json`
4. Rotate the service account key in Firebase Console
5. Use environment variables for the new key

---

## Rate Limiting

### Implementation
- **In-Memory Rate Limiting**: Basic rate limiting implemented in `src/utils/security.ts`
- **Rate Limits**:
  - General API: 100 requests per minute
  - Authentication: 5 requests per minute (login/register)
  - Admin Actions: 200 requests per minute

### Production Recommendations
- **Redis-Based**: Use Redis for distributed rate limiting in production
- **IP-Based**: Implement IP-based rate limiting
- **User-Based**: Implement user-based rate limiting for authenticated requests
- **DDoS Protection**: Use a service like Cloudflare for DDoS protection

---

## Security Best Practices

### Code Security
1. **No Hardcoded Secrets**: All secrets must be in environment variables
2. **Input Validation**: Always validate and sanitize user input
3. **Output Encoding**: Encode output to prevent XSS
4. **Error Handling**: Generic error messages in production
5. **Logging**: Log security events without exposing sensitive data

### Development Security
1. **Debug Code**: Debug code (e.g., `window.__app`) only in development
2. **Console Logs**: Minimize console logs in production
3. **Source Maps**: Disable source maps in production builds
4. **Environment Checks**: Always check environment before exposing debug features

### Deployment Security
1. **HTTPS Only**: Enforce HTTPS in production
2. **Security Headers**: All security headers are configured
3. **CORS**: Restricted to allowed origins only
4. **Firebase Rules**: Security rules are deployed and active
5. **Monitoring**: Set up monitoring for security events

---

## Incident Response

### Security Incident Procedure
1. **Identify**: Identify the security incident
2. **Contain**: Contain the incident (disable affected features, revoke access)
3. **Assess**: Assess the impact and scope
4. **Remediate**: Fix the vulnerability
5. **Notify**: Notify affected users if necessary
6. **Document**: Document the incident and response
7. **Review**: Review and improve security measures

### Security Monitoring
- **Audit Logs**: All admin actions are logged in `audit_logs` collection
- **Activity Tracking**: User activities are tracked in `activities` collection
- **Error Monitoring**: Monitor for unusual error patterns
- **Access Logs**: Monitor API access logs for suspicious activity

### Reporting Security Issues
If you discover a security vulnerability, please:
1. **Do NOT** create a public GitHub issue
2. Email security concerns to: [security contact email]
3. Include details about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

---

## Security Checklist

### Pre-Deployment Checklist
- [ ] All environment variables are set in production
- [ ] Service account key file is removed from repository
- [ ] Firebase security rules are deployed
- [ ] Storage security rules are deployed
- [ ] CORS origins are configured correctly
- [ ] Security headers are configured
- [ ] HTTPS is enforced
- [ ] All hardcoded secrets are removed
- [ ] Debug code is disabled in production
- [ ] Input validation is implemented
- [ ] Error messages are generic in production
- [ ] Rate limiting is configured
- [ ] Monitoring is set up

### Regular Security Maintenance
- [ ] Review and update dependencies monthly
- [ ] Review Firebase security rules quarterly
- [ ] Review access logs monthly
- [ ] Rotate service account keys annually
- [ ] Review and update security documentation
- [ ] Conduct security audits annually
- [ ] Review and update CORS origins as needed
- [ ] Monitor for security advisories

---

## Additional Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CORS Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

## Security Contact

For security concerns or to report vulnerabilities, please contact the development team.

**Last Updated**: 2024-01-XX
**Version**: 1.0

