# HubSpot → Firestore Sync

## Overview

**POST /api/sync-hubspot-contacts** imports all HubSpot CRM contacts into Firestore in two places:

1. **hubspotContacts** – one doc per contact (doc ID = HubSpot contact ID).
2. **users** – one doc per contact as a *pending user* (doc ID = `hubspot_<hubspotId>`), so they appear in your users list (e.g. in Admin) and can be approved or invited.

Each contact is upserted using `set(..., { merge: true })`.

- Pages through HubSpot API (limit=100, `after` cursor) until all contacts are fetched.
- Requests properties: `email`, `firstname`, `lastname`, `phone`.
- Uses Firestore batch writes per page (hubspotContacts + users, under 500 ops per batch).
- Returns `{ ok: true, totalUpserted: number }`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| **HUBSPOT_ACCESS_TOKEN** | Yes | HubSpot Private App or OAuth access token. Used **server-side only**; never expose in frontend. |
| **SYNC_SECRET** | No | If set, requests must include header `x-sync-secret: <value>`. If unset, endpoint requires Firebase Auth ID token with admin role. |

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

### users (HubSpot-synced as pending users)

- **Document ID:** `hubspot_<hubspotId>` (e.g. `hubspot_12345`)
- **Data (merged):** `email`, `name` / `displayName` (firstname + lastname), `phone`, `status: 'pending'`, `role: 'member'`, `source: 'hubspot'`, `hubspotId`, `createdAt`, `updatedAt` (server timestamps)
- **When created:** Only contacts with a non-empty **email** get a user doc; contacts without email are still written to `hubspotContacts` only (avoids invalid user records).

These docs appear in your users collection so you can see HubSpot contacts in Admin (e.g. User Management, Pending). They have **no Firebase Auth account** until the person signs up; when they do, you may want to match by email and merge or de-dupe. Re-running the sync updates existing `hubspot_*` users (email, name, phone, updatedAt).

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
