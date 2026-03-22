# HubSpot → Firestore Sync

## Overview

**POST /api/sync-hubspot-contacts** imports all HubSpot CRM contacts and creates sign-in–ready accounts:

1. **hubspotContacts** – one doc per contact (doc ID = HubSpot contact ID).
2. **Firebase Auth** – one account per contact with email: `email` + default password (e.g. `123456789`), so contacts can sign in and complete onboarding.
3. **users** – one doc per contact (doc ID = Firebase Auth UID), `status: 'approved'`, `registrationComplete: false`, so they do not appear on the Members page until they complete onboarding.

Each contact is upserted; Auth users are created (or looked up by email if already existing).

- Pages through HubSpot API (limit=100, `after` cursor) until all contacts are fetched.
- Requests contact properties from HubSpot: by default the server **fetches the portal’s full contact property list** (via CRM Properties API), merges it with a built-in list (email, name, phone, job title, company, city, state, country, timezone, website, LinkedIn, chapter, short/long bios, interests, industry, year joined, profile picture URLs, Mailchimp/Portal/WhatsApp/Spotlight, etc.), **dedupes**, and caps how many names are sent per list request (`HUBSPOT_SYNC_MAX_PROPERTIES`, default 150, max 200). Set `HUBSPOT_SYNC_FETCH_ALL_PROPERTIES=false` to skip the portal-wide fetch and use only the built-in list + extras. Override the fetch list entirely with `HUBSPOT_SYNC_CONTACT_PROPERTIES` (full list) or append with `HUBSPOT_SYNC_CONTACT_PROPERTIES_EXTRA`. **Chapter** internal name: `HUBSPOT_CHAPTER_PROPERTY_NAME` (default `chapter`). **Picture** property name(s): `HUBSPOT_CONTACT_PROPERTY_PICTURE` (comma-separated, tried first).
- For each contact with email: creates Firebase Auth user (or gets existing by email), then writes hubspotContacts (full `properties` blob) + **users** with mapped profile fields (`title`, `company`, `linkedin`, `twitter`, `bioTitle`, `bio`, `skills` from interests, `avatarUrl`/`profileImage` from picture URL, `hubspotImportExtras` for Mailchimp/Portal/WhatsApp groups/Spotlight, etc.). **`hubspotContactProperties`** on `users/{uid}` stores a **flattened snapshot** of all requested HubSpot fields (so custom/unmapped properties are still available in Firestore).
- **Existing users (same email):** Profile fields that are **already filled** in Firestore are **not overwritten**; empty fields are filled from HubSpot. HubSpot sync metadata and `hubspotContactProperties` are refreshed each run. Admins and non–HubSpot-sourced accounts are protected from having `role`/`status` or identity overwritten (see `mergeHubspotUserPatch` in `sync-hubspot-contacts.js`).
- Returns `{ ok: true, totalUpserted: number }`.

**POST /api/sync-hubspot-deals** imports all HubSpot deals into Firestore `hubspotDeals` (doc ID = deal id). Schema: `hubspotDealId`, `properties`, `syncedAt`. Paginates with `paging.next.after`.

**GET /api/hubspot-contacts** (admin or SYNC_SECRET) returns all docs from `hubspotContacts` for the Import UI. **GET /api/hubspot-deals** returns all from `hubspotDeals`.

**DELETE /api/hubspot-contacts/:id** and **DELETE /api/hubspot-deals/:id** delete one document from Firestore only (do not delete from HubSpot unless you add that separately).

**POST /api/remove-hubspot-users** removes all HubSpot-synced users from Firestore and deletes their Firebase Auth accounts. Optionally clears `hubspotContacts`, `hubspotDeals`, `hubspotEvents` (body: `{ removeContacts: true }`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| **HUBSPOT_ACCESS_TOKEN** | Yes | HubSpot Private App or OAuth access token with **READ + WRITE** scopes for Contacts and Deals. Single source of truth: read from server env only. Validation error (503) if missing. **Never expose in frontend.** |
| **SYNC_SECRET** | No | If set, sync/list/delete requests must include header `x-sync-secret: <value>`. If unset, endpoints require Firebase Auth ID token with admin role. |
| **HUBSPOT_IMPORT_DEFAULT_PASSWORD** | No | Default password for imported contacts. Default: `123456789`. |
| **HUBSPOT_CHAPTER_PROPERTY_NAME** | No | HubSpot Contact property internal name for Chapter. Default: `chapter`. |
| **HUBSPOT_CONTACT_PROPERTY_PICTURE** | No | Comma-separated internal names for profile image URL (tried first, then `picture`, `profile_picture`, …). |
| **HUBSPOT_SYNC_CONTACT_PROPERTIES_EXTRA** | No | Comma-separated property internal names to **add** to the merged fetch list. |
| **HUBSPOT_SYNC_CONTACT_PROPERTIES** | No | If set, **only** these comma-separated internal names are requested (full override; skips portal-wide property discovery unless you include those names here). |
| **HUBSPOT_SYNC_FETCH_ALL_PROPERTIES** | No | If not `false`, fetch all contact property internal names from HubSpot and merge with the built-in list (default: enabled). |
| **HUBSPOT_SYNC_MAX_PROPERTIES** | No | Max number of property names to request per contacts list API call (default `150`, max `200`). |

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
- **Data:** `hubspotId`, `email`, `chapter` (string | null, for querying/filtering), `properties` (all requested HubSpot properties including chapter), `syncedAt` (server timestamp)

**Chapter:** The sync requests the HubSpot Contact property whose label in the UI is "Chapter" (assigns members to one of 9 global chapters). The internal property name is set in `lib/server/api/sync-hubspot-contacts.js` as `CHAPTER_PROPERTY_NAME`. Default is `"chapter"`. If your portal uses a different internal name (e.g. `hs_chapter` or a custom name), change it there. To find the internal name: HubSpot → Settings → Properties → Contact → find "Chapter" → use the **Internal name**.

### users (HubSpot-synced, sign-in ready)

- **Document ID:** Firebase Auth UID (same as the Auth user created for that contact).
- **Data (merged):** `email`, `name` / `displayName`, `firstName`, `lastName`, `phone`, `title` / `position`, `company` / `organization`, `chapter`, `city`, `country`, `website`, `linkedin` / `linkedinUrl`, `twitter`, `bioTitle`, `bio`, `skills` (from comma-separated **interests**), `industry`, `yearJoined`, `avatarUrl` / `profileImage` (from **Picture** URL properties), `hubspotImportExtras` (Mailchimp, Portal, PHL/NY/WhatsApp groups, Spotlight, duplicate bio old), `hubspotContactProperties` (flattened snapshot of requested HubSpot fields), `status: 'approved'`, `role: 'member'`, `source: 'hubspot'`, `hubspotContactId` / `hubspotId`, `registrationComplete`, `profileVisibility`, timestamps. Full raw HubSpot values remain on `hubspotContacts/{id}.properties`.
- **When created:** Only contacts with a non-empty **email** get an Auth account and user doc; contacts without email are still written to `hubspotContacts` only.

Contacts can sign in with **email + default password** (e.g. `123456789` or `HUBSPOT_IMPORT_DEFAULT_PASSWORD`), then complete onboarding. They do not appear on the Members page until `registrationComplete` is true (set when they complete profile). If an email already exists in Firebase Auth, the sync reuses that UID and updates the user doc (merge).

**Remove HubSpot users:** **POST /api/remove-hubspot-users** deletes **only** users that were created by the HubSpot contact sync: doc id starts with `hubspot_` **or** (`source === 'hubspot'` **and** `hubspotId` is set). The requesting admin and any user with `role === 'admin'` are never deleted. It does not touch `joinRequests`.

**Rules:** `hubspotContacts` and `users` are configured in `firestore.rules`. Backend writes via Admin SDK bypass rules.

## Profile → HubSpot real-time sync

When a member updates their profile in the app, changes are pushed to HubSpot automatically (no manual button).

- **PATCH /api/profile** (or POST): Authenticated user sends profile fields (fullName, title, organization, chapter, linkedinUrl, email, phone, bioShort, bioLong, etc.). Server writes Firestore `users/{uid}` (merge) then calls HubSpot upsert (create or update contact by email). Server never exposes `HUBSPOT_ACCESS_TOKEN`; all HubSpot API calls are server-side.
- **Flow:** Profile Edit page saves via PATCH /api/profile → backend updates Firestore → backend calls `upsertHubspotContact(profile)` → HubSpot search by email or PATCH/POST contact → backend writes `hubspotContactId`, `hubspotLastSyncedAt`, `hubspotSyncStatus`, `hubspotSyncError` on `users/{uid}`.
- **Data model (users doc):** `fullName`/`name`/`displayName`, `title`/`position`, `organization`/`company`, `bioShort`/`bioTitle`, `bioLong`/`bio`, `chapter`, `linkedinUrl`/`linkedin`, `email`, `phone`, and `hubspotContactId`, `hubspotLastSyncedAt`, `hubspotSyncStatus`, `hubspotSyncError`.
- **Field mapping:** See `lib/server/hubspot-contact-sync.js` (`HUBSPOT_PROPERTY_MAP`). Standard: email, firstname, lastname, jobtitle, company, phone, linkedinbio. Custom (confirm in HubSpot): chapter, bio_short, bio_long.
- **Debounce:** Frontend only sends update on Save (or blur), not on every keystroke.
- **Required HubSpot scopes:** Contacts **read** and **write** (e.g. `crm.objects.contacts.read`, `crm.objects.contacts.write`). Same token as sync: `HUBSPOT_ACCESS_TOKEN`.

## Recovery after accidental removal

If an admin or other user was removed by "Remove HubSpot users" (e.g. before safeguards were in place):

1. **Restore admin access** (so you can log in and approve others):
   ```bash
   ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword node scripts/restore-admin.js
   ```
   Use `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string in env) or a service account file. If the Auth user exists, only claims and `users` doc are updated. If not, a new Auth user is created with that email/password and a new `users` doc with `role: 'admin'`.

2. **Regular users (non-admin)** must sign up again: go to the app’s **Sign up** page, register with the same (or new) email. That creates a new Firebase Auth user and a new **join request** in the `joinRequests` collection (doc id = new Auth UID, `status: 'pending'`). An admin can then approve them from **Admin → Pending Registrations**.

3. **Where to see pending signups:** In Firebase Console → Firestore → `joinRequests` collection. Pending requests have `status: 'pending'`. The admin UI at **Pending Registrations** lists those; ensure the composite index exists for `joinRequests` (status, createdAt) if the page fails to load.

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
