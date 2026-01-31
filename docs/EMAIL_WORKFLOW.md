# Email Workflow (Production)

This document describes the email flow and environment variables used for transactional and admin emails.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILCHIMP_API_KEY` | Yes* | Mailchimp/Mandrill API key (format: `xxxxx-us5`). Used for all transactional sends. |
| `MAILCHIMP_SERVER` | No | Datacenter (e.g. `us5`). Used for Marketing API base URL. |
| `MAILCHIMP_AUDIENCE_ID` | No** | Audience (list) ID (e.g. `d2650d7ca2`). For Marketing API: add contacts, campaigns. |
| `EMAIL_FROM` | No | From address (default: `Communications@almalinks.org`). |
| `ADMIN_NOTIFICATION_EMAILS` | No*** | Comma-separated admin emails for new-signup notifications. |
| `SIGNUP_TEST_RECIPIENT` | No | Override recipient for signup confirmation (testing). |

\* Or legacy `MANDRILL_API_KEY`.  
\** Set for future list sync / campaigns; not used by current transactional flow.  
\*** Required if you want admin notifications on new signups.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/send-email` | Single email (to, subject, text). |
| `POST /api/send-bulk-email` | Bulk send to audience (admin-only, auth required). |
| `POST /api/notify-signup` | Notify admins when a new user signs up. |
| `POST /api/notify-user-signup` | Send confirmation email to user after signup (join request created). |

## Flow

1. **User signup**  
   Frontend creates a `joinRequests` document, then calls:
   - `POST /api/notify-user-signup` with `{ joinRequestId }` → user gets “Thanks for signing up — pending approval”.
   - `POST /api/notify-signup` with `{ name, email, joinRequestId }` → admins get “New registration pending approval” (if `ADMIN_NOTIFICATION_EMAILS` is set).

2. **Admin / bulk email**  
   Admin uses Email UI → `POST /api/send-email` or `POST /api/send-bulk-email` (auth required for bulk).

## Production Readiness

- **API key**: Use `MAILCHIMP_API_KEY` (or `MANDRILL_API_KEY`) in production env; never commit real keys.
- **Validation**: `send-email` validates `to` (email format), `subject`, and `text`.
- **Errors**: In production, API responses do not expose stack traces or internal error details; only generic messages are returned.
- **Evidence**: `notify-user-signup` writes to Firestore `emailAttempts` for audit.
- **Bulk**: `send-bulk-email` requires admin auth and writes to `emailCampaigns` for audit.

## Mailchimp Audience ID

`MAILCHIMP_AUDIENCE_ID` (e.g. `d2650d7ca2`) is set in env for use with the Mailchimp Marketing API when you add features such as:

- Adding new signups or approved users to an audience.
- Syncing contacts for campaigns.

Current transactional endpoints (Mandrill) do not use the audience ID; it is available as `process.env.MAILCHIMP_AUDIENCE_ID` for future implementation.
