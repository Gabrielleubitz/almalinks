# Email Workflow (Production)

This document describes the email flow and environment variables used for transactional and admin emails. All emails use the shared **AlmaLinks theme** (header, footer, brand colors) for consistency between Mailchimp campaigns and transactional (Mailjet or Mandrill) emails.

## Environment Variables

### Transactional email (Mailjet or Mandrill)

- **Mailjet** (preferred for transactional): set `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` (or `MJ_APIKEY_PUBLIC` and `MJ_APIKEY_PRIVATE`). If both are set, transactional emails are sent via Mailjet.
- **Mandrill** (fallback): set `MAILCHIMP_API_KEY` (Mandrill key, e.g. `md-xxx`). Used when Mailjet is not configured.
- From/reply: `TRANSACTIONAL_FROM_EMAIL` (or `EMAIL_FROM`), `TRANSACTIONAL_FROM_NAME`, `TRANSACTIONAL_REPLY_TO`.

### Mailchimp Marketing (campaigns)

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILCHIMP_API_KEY` | Yes* | Mailchimp API key (format: `xxxxx-us5`). Used for Marketing API and (if no Mailjet) transactional. |
| `MAILCHIMP_SERVER` | No | Datacenter (e.g. `us5`). Used for Marketing API base URL. |
| `MAILCHIMP_AUDIENCE_ID` | No** | Audience (list) ID. For Marketing API: add contacts, campaigns. |
| `EMAIL_FROM` | No | From address (default: `Communications@almalinks.org`). |
| `ADMIN_NOTIFICATION_EMAILS` | No*** | Comma-separated admin emails for new-signup notifications. |
| `SIGNUP_TEST_RECIPIENT` | No | Override recipient for signup confirmation (testing). |

\* Required for Mailchimp campaigns and for transactional if Mailjet is not configured.  
\** Required for list sync (Import users, signup/approval → audience).  
\*** Required if you want admin notifications on new signups.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/send-email` | Single email (to, subject, text or html). Sent via Mailjet or Mandrill with Alma theme. |
| `POST /api/send-bulk-email` | Bulk send to audience (admin-only, auth required). Same theme and sender. |
| `POST /api/notify-signup` | Notify admins when a new user signs up. |
| `POST /api/notify-user-signup` | Send confirmation email to user after signup (join request created). |
| `POST /api/email-service` | Typed transactional emails (acceptance, registration, reset, etc.). Alma theme applied. |
| `POST /api/welcome-email` | Welcome / signup-received email. Alma theme applied. |

## Flow

1. **User signup**  
   Frontend creates a `joinRequests` document, then calls:
   - `POST /api/notify-user-signup` with `{ joinRequestId }` → user gets “Thanks for signing up — pending approval”.
   - `POST /api/notify-signup` with `{ name, email, joinRequestId }` → admins get “New registration pending approval” (if `ADMIN_NOTIFICATION_EMAILS` is set).

2. **Admin / bulk email**  
   Admin uses Email UI → `POST /api/send-email` or `POST /api/send-bulk-email` (auth required for bulk).

## AlmaLinks theme

- **Transactional** (Mailjet or Mandrill): All emails from `lib/server/transactional-email.js` are wrapped in the shared Alma theme (header with “AlmaLinks” in brand colors, footer, max-width layout). Implemented in `lib/server/alma-email-theme.js`.
- **Mailchimp campaigns**: Event announcements and welcome campaigns built in `lib/server/mailchimp-campaign.js` use the same theme wrapper so Mailchimp and Mailjet emails look consistent.

## Production Readiness

- **API keys**: Use Mailjet keys and/or `MAILCHIMP_API_KEY` in production env; never commit real keys.
- **Validation**: `send-email` validates `to` (email format), `subject`, and body (text or html).
- **Errors**: In production, API responses do not expose stack traces or internal error details; only generic messages are returned.
- **Evidence**: `notify-user-signup` writes to Firestore `emailAttempts` for audit.
- **Bulk**: `send-bulk-email` requires admin auth and writes to `emailCampaigns` for audit.

## Mailchimp Audience (List) Sync

When `MAILCHIMP_AUDIENCE_ID` and a Marketing API key (`MAILCHIMP_MARKETING_API_KEY` or `MAILCHIMP_API_KEY`) are set:

1. **On signup** – `POST /api/notify-user-signup` adds the new signup to your Mailchimp audience after sending the confirmation email.
2. **On approval** – When an admin approves a user in Pending Registrations, that user is added/updated in the audience (via `POST /api/mailchimp-sync-contact`).
3. **When sending bulk email** – Each recipient is added/updated in the audience before the send, so the list stays in sync.
4. **Import users** – On the Admin Email page, "Import users to Mailchimp" syncs all approved AlmaLinks members to the audience (`POST /api/mailchimp-import-users`).

API key: Use a Mailchimp API key (Account → Extras → API keys). For list sync we use `MAILCHIMP_MARKETING_API_KEY` if set, otherwise `MAILCHIMP_API_KEY` with `MAILCHIMP_SERVER`.
