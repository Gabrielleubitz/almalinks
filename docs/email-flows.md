# Email flows: production behavior and shared config

All email steps use the same config for **links** (APP_URL) and **from** address. In **production**, emails always go to **real recipients**; test overrides do not apply.

## Production behavior

1. **Admin notifications** → sent to **ADMIN_NOTIFICATION_EMAILS** (one or more real admin emails).
2. **User signup confirmation** → sent to the **actual user’s email** (from join request).
3. **Acceptance / registration** → sent to the **actual user email** (no rerouting).
4. **APP_URL** is used **only to build links** (login, events, admin pending page). It does **not** control who receives emails.
5. **Test overrides** (TEST_EMAIL*, SIGNUP_TEST_RECIPIENT) apply **only when NODE_ENV !== 'production'**. In production they are ignored.

## Shared config (`lib/server/email-config.js`)

- **Base URL for links:** `APP_URL` or `VERCEL_URL` or `https://almalinks.org`. Used only for link URLs in emails.
- **Links:** Admin pending registrations, login, events — all built from this base URL.
- **From:** `EMAIL_FROM` or `MAILCHIMP_REPLY_TO`, `MAILCHIMP_FROM_NAME` — same across transactional emails.
- **Test overrides:** Only when not in production; see above.

## Steps

| Step | Recipient (production) | Endpoint / trigger | Links in email |
|------|-------------------------|--------------------|----------------|
| **Upon sign-up** | User | `POST /api/notify-user-signup` | Login, Events |
| **Upon sign-up** | User | `POST /api/welcome-email` (Mailchimp Marketing) | (in template) |
| **Upon sign-up** | Admin(s) | `POST /api/notify-signup` | Pending registrations |
| **Upon approval** | User | `POST /api/email-service` type `acceptance` | `loginUrl`, `eventsUrl` (Mailjet) |
| **Event registration** | User | `POST /api/email-service` type `registration` | `loginUrl`, `eventsUrl` |
| **Post-event** | (future) | — | Same base URL + links |

## Logging (server-side only)

- **Admin notifications:** Resolved recipient count and masked emails (e.g. `a***@x.com`) plus links base (APP_URL).
- **User signup confirmation:** Recipient masked, links base (APP_URL).
- **Acceptance / registration:** Links base (APP_URL) when sending.

No recipient lists or secrets are sent to the client.

## Required env vars for production (Vercel)

- **APP_URL** — base URL for links (e.g. `https://almalinks.org`).
- **ADMIN_NOTIFICATION_EMAILS** — comma-separated admin emails for sign-up notifications.
- Provider keys: **MAILCHIMP_API_KEY** (transactional), **MAILJET_*** (if using email-service), etc.
- **EMAIL_FROM** or **MAILCHIMP_REPLY_TO**, **MAILCHIMP_FROM_NAME** for from/reply-to.

## Development-only (optional)

- **TEST_EMAIL**, **TEST_EMAIL_SIGNUP_USER**, **TEST_EMAIL_SIGNUP_ADMIN**, **SIGNUP_TEST_RECIPIENT** — only used when `NODE_ENV !== 'production'` to redirect emails to a test address. Never applied in production.
