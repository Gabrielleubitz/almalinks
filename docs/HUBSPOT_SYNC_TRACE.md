# HubSpot contact sync – exact code path (debugging trace)

## Two separate HubSpot flows (proof)

There are **two different code paths** that touch HubSpot:

| Flow | Purpose | File(s) | When it runs |
|------|--------|--------|--------------|
| **1. Email engagement log** | Log sent emails to HubSpot (find or create contact by email, then create email engagement) | `lib/server/hubspot-email-log.js` → `logSentEmailToHubSpot`; called from `lib/server/transactional-email.js` after every successful send | **Immediately after** any transactional email is sent (signup, approval, reset, etc.) |
| **2. Contact create/update** | Create or update full CRM contact from website user profile | `lib/server/hubspot-contact-sync.js` → `upsertHubspotContact`; called only from `lib/server/api/update-profile.js` | **Only** when `PATCH /api/profile` is called (ProfileEditPage save or CompleteProfilePage after we added it) |

They are **separate**. The email-log flow does **not** call the contact-sync module. It does its own find-by-email and a **minimal** contact create (email only) if not found. If that minimal create fails (e.g. HubSpot API error), you see `[hubspot-email-log] No contact found or created for <email>`.

### Exact order for e.g. gama@test.com (approval email)

1. Admin approves → `JoinRequestService.approveRequest` creates user doc in Firestore (no HubSpot call).
2. Frontend calls `POST /api/email-service` with `{ type: 'acceptance', email: 'gama@test.com', name: '...' }`.
3. **Before fix:** email-service sends email → `sendTransactionalEmail` → `logSentEmailToHubSpot` runs → find contact by email → null → create minimal contact → **fails** → log "No contact found or created for gama@test.com". Contact sync (`upsertHubspotContact`) has **not** been invoked yet (it runs only on profile save).
4. **After fix:** For `type === 'acceptance'`, email-service first queries Firestore for a user with that email, calls `upsertHubspotContact` so the contact exists, then sends the email so `logSentEmailToHubSpot` finds the contact.

### Why [hubspot-debug] logs may not appear for gama@test.com

- `[hubspot-debug]` logs live in `lib/server/api/update-profile.js` and `lib/server/hubspot-contact-sync.js`, which run **only** when `PATCH /api/profile` is called.
- For a newly approved user, that happens only when they (or someone) later open ProfileEditPage or CompleteProfilePage and save. So until then, contact sync is never invoked and those logs never appear for that user.
- If the deployed backend is the same codebase (and these files are deployed), the logs will appear when `/api/profile` is actually hit in production.

### Why the email-log’s “create” can fail

- In `hubspot-email-log.js`, `createContactWithEmail` does `POST /crm/v3/objects/contacts` with `{ properties: { email } }`. If HubSpot returns non-2xx (e.g. 400, 401, 403), the code returns `null` and you see "No contact found or created".
- **Evidence:** After adding logging, look for `[hubspot-email-log] createContactWithEmail failed` with `status` and `body` to see the real HubSpot error.

---

## A. Frontend submit handler that can trigger HubSpot sync

**Single path only:**

| Item | Value |
|------|--------|
| **File** | `src/pages/ProfileEditPage.tsx` |
| **Handler** | `performSave` (around line 211) |
| **Action** | `apiRequest('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload) })` at **line 251** |
| **Auth** | Uses `auth.currentUser.getIdToken()` from `src/utils/apiClient.ts` – so the request is **always** for the **currently logged-in user**. |

**After the minimal fix:** `CompleteProfilePage` now also calls `apiRequest('/api/profile', { method: 'PATCH', ... })` after a successful Firestore update, so that when a newly approved user completes their profile, HubSpot sync runs for that user (with their own token).

No other frontend code calls `/api/profile`.  
`useAuth.updateProfile` only updates Firestore and does **not** call the profile API.

---

## B. Backend handler

| Item | Value |
|------|--------|
| **File** | `lib/server/api/update-profile.js` |
| **Route** | `PATCH /api/profile` (or POST) – registered in `api/index.js` line 85 |
| **Export** | `export default async function handler(req, res)` |
| **Auth** | `authorizeUser(req)` → `uid = authResult.uid` (Firebase ID token). So **uid is always the logged-in user**. |
| **HubSpot call** | **Line 92:** `const syncResult = await upsertHubspotContact(profileForHubSpot);` |

---

## C. HubSpot service

| Item | Value |
|------|--------|
| **File** | `lib/server/hubspot-contact-sync.js` |
| **Function** | `export async function upsertHubspotContact(profile)` at **line 208** |
| **Used by** | Only `lib/server/api/update-profile.js` (no other callers). |

---

## D. Where create vs update is decided

**File:** `lib/server/hubspot-contact-sync.js`  
**Function:** `upsertHubspotContact`

Decision order:

1. **Lines 219–225:** `lookupEmail` = `profile._lookupEmail` only (trimmed, lowercased); if missing → `null`.
2. **Lines 221–226:** `contactId` = `profile.hubspotContactId` from profile (from DB).
3. **Lines 224–230:** If `contactId` and `lookupEmail` are both set, **verify**: GET contact by `contactId`, compare contact’s email to `lookupEmail`. If different → set `contactId = null`.
4. **Lines 232–238:** If `contactId` is set → **UPDATE** (PATCH that contact).
5. **Lines 240–251:** Else, if `lookupEmail` is set → **search** by `lookupEmail`; if found → **UPDATE** that contact.
6. **Lines 253–258:** Else → **CREATE** (POST new contact).

So:

- **Update** happens when: (a) we have a stored `hubspotContactId` that passes verification, or (b) we have `_lookupEmail` and search finds a contact.
- **Create** happens when: we have no (or invalid) `contactId` and either no `_lookupEmail` or search finds no contact.

---

## E. Identifier used for matching/updating

| Identifier | Source | Used for |
|------------|--------|----------|
| **uid** | Firebase ID token in request | Which Firestore user doc to load (`users/{uid}`). |
| **_lookupEmail** | Set in update-profile.js as `canonicalEmail` = `(current.email || '').toString().trim().toLowerCase() \|\| null` from **current** user doc (line 82). | Only identifier used for HubSpot search. Never from request body. |
| **hubspotContactId** | From `current.hubspotContactId` (user doc in Firestore). | If set and verified (contact’s email === _lookupEmail), we PATCH that contact. |

So the **only** HubSpot matching key is **email**: either via stored `hubspotContactId` (after email verification) or via search by `_lookupEmail`.

---

## F. What payload is sent to HubSpot

Built by `buildHubSpotProperties(profile)` in `lib/server/hubspot-contact-sync.js` (lines 56–95).

`profile` here is `profileForHubSpot` from update-profile.js:

- `profileForHubSpot` = `{ ...merged, email: merged.email || current.email, hubspotContactId: current.hubspotContactId, _lookupEmail: canonicalEmail }`.
- `merged` = `{ ...current, ...updates }` (current user doc + request body).

So the payload is built from **merged** (current user + body). Only keys that exist in the map and have non-empty values are sent. Map:

- firstname, lastname, email, jobtitle, company, phone, linkedin_profile, chapter, job_description, bio_one_liner, bio_paragraph.

Profile fields read in `buildHubSpotProperties`: `fullName`/`displayName`/`name`/`firstName`/`lastName`, `email`, `title`/`position`/`jobTitle`, `organization`/`company`, `phone`, `linkedinUrl`/`linkedin`/`linkedinUsername`, `chapter`, `work`/`jobDescription`, `bioShort`/`bioTitle`, `bioLong`/`bio`.

---

## G. Why a new contact might not be created

1. **HubSpot sync is never run for the new user**  
   Creating a new website user (signup + approval) does **not** call `/api/profile` or HubSpot:
   - Signup: `SignupPage` → `JoinRequestService.createJoinRequest` (Firestore only).
   - Approval: `PendingRegistrations` → `JoinRequestService.approveRequest` (Firestore only, creates `users/{uid}`). No HTTP call to `/api/profile` or HubSpot.
   So **no new HubSpot contact is created at user creation time**.

2. **When sync does run, it’s for whoever is logged in**  
   HubSpot sync only runs when **PATCH /api/profile** is called, and that is only from **ProfileEditPage** with the **current user’s** token. So:
   - If the **new** user never opens ProfileEditPage and saves, their profile is never synced to HubSpot.
   - If an **admin** (or another user) is the one who has ProfileEditPage open and saves, sync runs for **that** user (admin’s uid and email), so the **same** HubSpot contact (admin’s) gets updated again.

3. **Resulting behavior**  
   - New website users do not get a new HubSpot contact unless they themselves call PATCH /api/profile (e.g. by saving on ProfileEditPage).
   - If in practice only one person (e.g. admin or one test user) ever saves on ProfileEditPage, that one HubSpot contact will keep being updated and can show multiple emails/names over time if the payload or merged data ever reflects someone else’s data.

---

## Summary

| Question | Answer |
|----------|--------|
| Frontend submit handler | `src/pages/ProfileEditPage.tsx` – `performSave` → `apiRequest('/api/profile', ...)` at line 251 |
| Backend handler | `lib/server/api/update-profile.js` – default handler, line 92 calls `upsertHubspotContact(profileForHubSpot)` |
| HubSpot service | `lib/server/hubspot-contact-sync.js` – `upsertHubspotContact` at line 208 |
| Create vs update | Decided in `upsertHubspotContact`: by `hubspotContactId` (if verified) or by search on `_lookupEmail`; else create |
| Identifier used | `_lookupEmail` (from current user doc’s email) and optionally stored `hubspotContactId` (after email check) |
| Payload | Built from merged user doc + body; only mapped, non-empty fields (firstname, lastname, email, jobtitle, company, phone, linkedin_profile, chapter, job_description, bio_one_liner, bio_paragraph) |
| Why no new contact | New user creation (signup/approval) never calls the profile API or HubSpot; sync runs only when someone saves ProfileEditPage, and that someone is the logged-in user |

---

## Temporary debug logs (what to watch)

Logs are prefixed with `[hubspot-debug]`.

### 1. In `lib/server/api/update-profile.js` (once per PATCH /api/profile)

- **`[hubspot-debug] update-profile ENTRY`**
  - `websiteUserId` – Firebase uid of the user being synced (from token).
  - `storedEmailFromDoc` – email on the user doc before this request.
  - `canonicalLookupEmail` – value used as `_lookupEmail` for HubSpot (should equal stored email).
  - `bodyEmail` – email from request body (if any).
  - `storedHubspotContactId` – HubSpot contact id stored on the user doc (if any).

### 2. In `lib/server/hubspot-contact-sync.js`

- **`[hubspot-debug] upsertHubspotContact INPUT`**
  - `hasLookupEmail`, `lookupEmail`, `profileEmail`, `storedHubspotContactId`, `payloadKeys`.

- **`[hubspot-debug] upsertHubspotContact RESULT`**
  - `path` – one of `UPDATE_BY_STORED_ID` | `UPDATE_BY_EMAIL_SEARCH` | `CREATE`.
  - `selectedHubspotContactId` – HubSpot contact id updated or created.
  - `lookupEmail` – email used for search (if any).
  - `payloadKeys` – keys sent to HubSpot.
  - `payload` – full property object sent to HubSpot.

### What you should see when creating two different users

1. **If each user logs in and saves ProfileEditPage once**
   - First user: one `update-profile ENTRY` with that user’s `websiteUserId` and `canonicalLookupEmail`; one `RESULT` with `path: 'CREATE'` and a new `selectedHubspotContactId`.
   - Second user: one `update-profile ENTRY` with the **other** `websiteUserId` and **other** `canonicalLookupEmail`; one `RESULT` with `path: 'CREATE'` and a **different** `selectedHubspotContactId`.

2. **If the same user saves twice**
   - First save: `path: 'CREATE'` and a new `selectedHubspotContactId`.
   - Second save: same `websiteUserId` and `canonicalLookupEmail`; `path: 'UPDATE_BY_EMAIL_SEARCH'` or `UPDATE_BY_STORED_ID`; same `selectedHubspotContactId`.

3. **If you never see `[hubspot-debug] update-profile ENTRY` when “creating” a new user**
   - Then that flow is not calling PATCH /api/profile (e.g. you only approved the user and they didn’t save ProfileEditPage). So no HubSpot sync runs for the new user.

4. **Payload check**
   - In `RESULT`, inspect `payload`. It should include at least: `firstname`, `lastname`, `email`, and any of `jobtitle`, `company`, `phone`, `linkedin_profile`, `chapter`, `job_description`, `bio_one_liner`, `bio_paragraph` that you sent.
