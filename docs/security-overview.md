# Security Overview for Alma Links

## What This Document Is For

This document explains the security measures we've put in place to protect Alma Links and your data. It's written in simple language so that founders, managers, and non-technical team members can understand how we keep the application secure.

We've implemented industry-standard security practices to protect against common threats like unauthorized access, data breaches, and malicious attacks. This document outlines what protections are in place and what you need to know to keep the system secure.

---

## Main Protections We Now Have

### ✅ Secure Connections
- All data is transmitted over encrypted connections (HTTPS only)
- The website enforces secure connections and blocks insecure access
- Your browser will warn you if you try to access the site over an insecure connection

### ✅ Access Control
- Users must log in to access their data
- Each user can only see and modify their own information
- Administrators have special permissions that are verified on every action
- No one can access data they're not authorized to see

### ✅ Data Protection
- Passwords are never stored in plain text (they're encrypted)
- Sensitive information like API keys are kept in secure storage, not in the code
- User data is protected by multiple layers of security rules

### ✅ Input Validation
- All user input is checked and cleaned before being saved
- The system prevents malicious code from being injected through forms or messages
- File uploads are validated to ensure they're safe

### ✅ Restricted Access Points
- Only approved websites can communicate with our API
- We verify the identity of every request to prevent unauthorized access
- Rate limiting prevents abuse and automated attacks

### ✅ Security Monitoring
- Important actions (like admin changes) are logged for review
- We track suspicious activity patterns
- Error messages don't reveal sensitive internal information

---

## How We Protect User Data

### Access Control in the Database
Our database (Firestore) has strict rules about who can read and write data. Every collection is covered; any collection not explicitly allowed is denied by default.

- **Users**: You can read and update your own profile; admins can create (e.g. on approval), read, update, and delete any user.
- **Join requests**: Applicants can create and read their own pending request; only admins can update (approve/reject) or delete.
- **Events & registrations**: All authenticated users can read events; only admins can create/update/delete events. Users can create/update only their own registration per event.
- **Connections**: You can only read and update connections you're part of (uid1/uid2 or fromUid/toUid); admins have full access.
- **Connection requests**: Only requester and target can read; only target can update (accept/reject); admins have full access.
- **Notifications**: You can only read, update, and delete your own notifications; creation is allowed for authenticated users (app creates for others).
- **Activity logs**: Users can only create logs for themselves (userId must match auth uid); only admins can read, update, or delete.
- **Chats, chat_members, chat_messages, chat_requests**: Authenticated users can read/write as allowed (e.g. only own messages, own membership); only admins can create chats and delete chats.
- **HubSpot contacts**: Read-only for admins; no client write (server writes via Admin SDK).
- **Default**: All other paths are denied.

These rules are enforced at the database level, meaning even if someone tries to bypass the website, they still can't access unauthorized data.

### Authentication System
- Users log in with email and password through Firebase Authentication
- Passwords are encrypted and never stored in a way that can be read
- Login sessions are managed securely
- Users are automatically logged out if their session expires or becomes invalid

### Environment Variables and Secrets
- Sensitive information like API keys and database credentials are stored as "environment variables"
- These are never included in the code that's stored in the repository
- Each environment (development, production) has its own set of secure credentials
- Only authorized team members can access these secrets

---

## How We Protect the Website Itself

### Security Headers
The website sends special instructions to browsers to prevent common attacks:

- **Content Security Policy (CSP)**: Prevents malicious scripts from running on the site
- **X-Frame-Options**: Prevents the site from being embedded in malicious frames (clickjacking protection)
- **X-Content-Type-Options**: Prevents browsers from misinterpreting file types
- **Strict Transport Security**: Forces all connections to use encryption
- **Referrer Policy**: Controls what information is shared when you click links

### Input Validation and Sanitization
Every piece of information users enter is checked and cleaned:

- **Email Addresses**: Validated to ensure they're in the correct format
- **Text Input**: Removed of potentially dangerous code
- **File Uploads**: Checked to ensure they're the correct type and size
- **URLs**: Validated to prevent malicious links

This prevents attackers from injecting malicious code through forms or messages.

### Protection Against Common Attacks

**Cross-Site Scripting (XSS)**: 
- All user input is sanitized before being displayed
- The Content Security Policy prevents unauthorized scripts from running

**SQL/NoSQL Injection**: 
- Database queries use parameterized inputs
- User input is validated and sanitized before being used in queries

**Cross-Site Request Forgery (CSRF)**: 
- API requests require authentication tokens
- CORS (Cross-Origin Resource Sharing) is restricted to approved domains only

**Unauthorized Access**: 
- All protected routes require authentication
- Admin actions require additional role verification
- API endpoints verify user identity on every request

---

## What Is NOT Covered Yet

### Legal Compliance Review
While we've implemented security measures that align with data protection principles, we have not yet had a formal legal review for:
- **GDPR Compliance**: We follow GDPR-style data protection practices, but a legal review is recommended
- **CCPA Compliance**: California Consumer Privacy Act compliance should be reviewed by legal counsel
- **Other Regional Regulations**: Depending on where your users are located, additional regulations may apply

**Recommendation**: Consult with a legal expert familiar with data protection regulations in your operating regions.

### Formal Security Testing
- **Penetration Testing**: We recommend periodic professional security audits
- **Vulnerability Scanning**: Automated scanning tools can identify additional issues
- **Code Review**: Regular security-focused code reviews by external experts

### Incident Response Plan
While we have logging and monitoring in place, a formal incident response plan should be developed that includes:
- Defined roles and responsibilities
- Communication procedures
- Recovery procedures
- Post-incident review process

### Advanced Security Features
The following features are recommended for future implementation:
- Two-factor authentication (2FA) for additional account security
- Automated dependency updates to patch security vulnerabilities
- Advanced rate limiting using Redis or similar services
- File upload virus scanning
- IP-based access restrictions for sensitive operations

---

## What to Keep Doing in the Future

### Regular Maintenance Tasks

**Monthly:**
- Review and update software dependencies to get security patches
- Check access logs for any suspicious activity
- Review security advisories for technologies we use

**Quarterly:**
- Review and update database security rules if needed
- Review and update the list of approved domains for API access
- Review security documentation and update as needed

**Annually:**
- Rotate API keys and service account credentials
- Conduct a security audit or penetration test
- Review and update security policies
- Review legal compliance requirements

### Best Practices for the Team

**Never Commit Secrets:**
- Never put passwords, API keys, or other secrets in code that gets committed to the repository
- Always use environment variables for sensitive information
- If you accidentally commit a secret, rotate it immediately

**Keep Dependencies Updated:**
- Regularly update npm packages to get security patches
- Review security advisories for packages we use
- Test updates in development before deploying to production

**Follow Security Guidelines:**
- When adding new features, follow the security checklist
- Validate all user input
- Verify authentication and authorization for new API endpoints
- Update security rules when adding new database collections

**Monitor and Respond:**
- Monitor error logs for unusual patterns
- Respond promptly to security alerts
- Document any security incidents

---

## Understanding Security Terms

**Authentication**: Verifying who you are (logging in with email and password)

**Authorization**: Determining what you're allowed to do (regular user vs. admin)

**Encryption**: Converting data into a secure format that can only be read with the right key

**HTTPS**: Secure version of HTTP that encrypts data in transit

**API**: Application Programming Interface - how different parts of the system communicate

**CORS**: Cross-Origin Resource Sharing - controls which websites can make requests to our API

**XSS**: Cross-Site Scripting - a type of attack where malicious code is injected into a website

**Rate Limiting**: Limiting how many requests can be made in a certain time period to prevent abuse

---

## Questions or Concerns?

If you have questions about security or discover a potential security issue:

1. **Do NOT** create a public issue or post about it publicly
2. Contact the development team directly
3. Provide details about the concern
4. Allow time for the issue to be addressed before public disclosure

---

**Last Updated**: January 2024  
**Version**: 1.0

