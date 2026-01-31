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

## Mailchimp Audience (List) Sync

When `MAILCHIMP_AUDIENCE_ID` and a Marketing API key (`MAILCHIMP_MARKETING_API_KEY` or `MAILCHIMP_API_KEY`) are set:

1. **On signup** – `POST /api/notify-user-signup` adds the new signup to your Mailchimp audience after sending the confirmation email.
2. **On approval** – When an admin approves a user in Pending Registrations, that user is added/updated in the audience (via `POST /api/mailchimp-sync-contact`).
3. **When sending bulk email** – Each recipient is added/updated in the audience before the send, so the list stays in sync.
4. **Import users** – On the Admin Email page, "Import users to Mailchimp" syncs all approved AlmaLinks members to the audience (`POST /api/mailchimp-import-users`).

API key: Use a Mailchimp **Marketing API** key (Account → Extras → API keys). You can use the same key as Mandrill if your Mailchimp account has both; otherwise set `MAILCHIMP_MARKETING_API_KEY` for list sync and keep `MAILCHIMP_API_KEY` for transactional (Mandrill) sends.
