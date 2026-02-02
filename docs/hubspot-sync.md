# HubSpot → Firestore Sync

## Overview

**POST /api/sync-hubspot-contacts** imports all HubSpot CRM contacts and creates sign-in–ready accounts:

1. **hubspotContacts** – one doc per contact (doc ID = HubSpot contact ID).
2. **Firebase Auth** – one account per contact with email: `email` + default password (e.g. `123456789`), so contacts can sign in and complete onboarding.
3. **users** – one doc per contact (doc ID = Firebase Auth UID), `status: 'approved'`, `registrationComplete: false`, so they do not appear on the Members page until they complete onboarding.

Each contact is upserted; Auth users are created (or looked up by email if already existing).

- Pages through HubSpot API (limit=100, `after` cursor) until all contacts are fetched.
- Requests properties: `email`, `firstname`, `lastname`, `phone`.
- For each contact with email: creates Firebase Auth user (or gets existing by email), then writes hubspotContacts + users.
- Returns `{ ok: true, totalUpserted: number }`.

**POST /api/remove-hubspot-users** removes all HubSpot-synced users from Firestore and deletes their Firebase Auth accounts. Optionally clears `hubspotContacts` (body: `{ removeContacts: true }`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| **HUBSPOT_ACCESS_TOKEN** | Yes | HubSpot Private App or OAuth access token. Used **server-side only**; never expose in frontend. |
| **SYNC_SECRET** | No | If set, requests must include header `x-sync-secret: <value>`. If unset, endpoint requires Firebase Auth ID token with admin role. |
| **HUBSPOT_IMPORT_DEFAULT_PASSWORD** | No | Default password for imported contacts. They sign in with email + this password, then complete onboarding. Default: `123456789`. |

Add in Vercel: Project → Settings → Environment Variables. Locally: add to `.env` (do not commit).

**Do not hardcode the token or expose it in the frontend.**

## Auth (Safety)

- **Option A (default):** Firebase Auth ID token in `Authorization: Bearer <idToken>`. Server verifies token and requires `role === 'admin'` or `admin === true`.
- **Option B:** Set `SYNC_SECRET` in env. Then call with header `x-sync-secret: <SYNC_SECRET>`. No Firebase token needed.

Only one is used: if `SYNC_SECRET` is set, the secret header is required; otherwise admin token is required.

## Frontend

- Admin: **System Test Panel** → **HubSpot → Firebase** → **Sync HubSpot → Firebase**.
- Button POSTs to `/api/sync-hubspot-contacts` with the current user’s Firebase ID token (via `apiRequest`). The HubSpot token is never sent from the frontend.

## Firestore

### hubspotContacts

- **Document ID:** HubSpot contact ID (string)
- **Data:** `hubspotId`, `email`, `properties`, `syncedAt` (server timestamp)

### users (HubSpot-synced, sign-in ready)

- **Document ID:** Firebase Auth UID (same as the Auth user created for that contact).
- **Data (merged):** `email`, `name` / `displayName` (firstname + lastname), `phone`, `status: 'approved'`, `role: 'member'`, `source: 'hubspot'`, `hubspotId`, `registrationComplete: false`, `avatarUrl`, `profileImage`, `createdAt`, `updatedAt` (server timestamps).
- **When created:** Only contacts with a non-empty **email** get an Auth account and user doc; contacts without email are still written to `hubspotContacts` only.

Contacts can sign in with **email + default password** (e.g. `123456789` or `HUBSPOT_IMPORT_DEFAULT_PASSWORD`), then complete onboarding. They do not appear on the Members page until `registrationComplete` is true (set when they complete profile). If an email already exists in Firebase Auth, the sync reuses that UID and updates the user doc (merge).

**Remove HubSpot users:** **POST /api/remove-hubspot-users** deletes Firestore user docs where `source === 'hubspot'` or doc id starts with `hubspot_`, and deletes the corresponding Firebase Auth users so they can no longer sign in.

**Rules:** `hubspotContacts` and `users` are configured in `firestore.rules`. Backend writes via Admin SDK bypass rules.

## Deploy

1. Set `HUBSPOT_ACCESS_TOKEN` (and optionally `SYNC_SECRET`) in Vercel.
2. Deploy. After deploy, run the sync from the admin System Test Panel or with:

   ```bash
   curl -X POST https://your-domain.com/api/sync-hubspot-contacts \
     -H "Authorization: Bearer <firebase-id-token>"
   # Or with secret:
   curl -X POST https://your-domain.com/api/sync-hubspot-contacts \
     -H "x-sync-secret: <SYNC_SECRET>"
   ```
