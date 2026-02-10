/**
 * POST /api/sync-hubspot-contacts
 * Imports ALL HubSpot CRM contacts into Firestore and creates Firebase Auth accounts:
 * 1) hubspotContacts collection (by HubSpot id) - upsert with hubspotId, email, properties, syncedAt
 * 2) Firebase Auth user (email + default password) so contacts can sign in
 * 3) users collection with source: 'hubspot', status: 'approved'
 * UPSERT using set(..., { merge: true }). Pages through HubSpot API (limit=100, paging.next.after).
 *
 * Auth: Firebase Admin (Bearer) OR x-sync-secret. Token: HUBSPOT_ACCESS_TOKEN (server env only).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { authorize, getHubspotToken } from './hubspot-auth.js';

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const LIMIT = 100;
// HubSpot Contact property for Chapter (label "Chapter" in UI). TODO: Replace with actual internal name if different in your HubSpot portal (Settings → Properties → Contact → Chapter → internal name).
const CHAPTER_PROPERTY_NAME = 'chapter';
const PROPERTIES = ['email', 'firstname', 'lastname', 'phone', CHAPTER_PROPERTY_NAME];
const DEFAULT_PASSWORD = process.env.HUBSPOT_IMPORT_DEFAULT_PASSWORD || '123456789';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return res.status(tokenResult.status).json({ ok: false, error: tokenResult.error });
  }
  const token = tokenResult.token;

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }
  if (!auth) {
    return res.status(503).json({ ok: false, error: 'Firebase Auth not available' });
  }

  const hubspotCol = db.collection('hubspotContacts');
  const usersCol = db.collection('users');
  let totalUpserted = 0;
  let after = undefined;

  try {
    do {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      PROPERTIES.forEach((p) => params.append('properties', p));
      if (after) params.set('after', after);

      const url = `${HUBSPOT_CONTACTS_URL}?${params.toString()}`;
      const hubRes = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!hubRes.ok) {
        const errText = await hubRes.text();
        console.error('[sync-hubspot-contacts] HubSpot error:', hubRes.status, errText);
        return res.status(502).json({
          ok: false,
          error: `HubSpot API error: ${hubRes.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await hubRes.json();
      const results = data.results || [];
      const next = data.paging?.next?.after;

      if (results.length === 0 && !next) break;

      const batch = db.batch();
      for (const contact of results) {
        const docId = String(contact.id);
        const props = contact.properties || {};
        const email = (props.email?.value ?? props.email ?? '').toString().trim().toLowerCase();
        const first = (props.firstname?.value ?? props.firstname ?? '').toString().trim();
        const last = (props.lastname?.value ?? props.lastname ?? '').toString().trim();
        const name = [first, last].filter(Boolean).join(' ') || email || 'HubSpot Contact';
        const phone = (props.phone?.value ?? props.phone ?? '').toString().trim();
        const chapterRaw = props[CHAPTER_PROPERTY_NAME]?.value ?? props[CHAPTER_PROPERTY_NAME];
        const chapter = chapterRaw != null && chapterRaw !== '' ? String(chapterRaw).trim() : null;

        batch.set(
          hubspotCol.doc(docId),
          {
            hubspotId: docId,
            email: email || (props?.email?.value ?? props?.email ?? null),
            chapter,
            properties: props,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (email) {
          let uid;
          try {
            const userRecord = await auth.createUser({
              email,
              password: DEFAULT_PASSWORD,
              displayName: name || undefined,
              emailVerified: false,
            });
            uid = userRecord.uid;
          } catch (e) {
            if (e.code === 'auth/email-already-exists') {
              const existing = await auth.getUserByEmail(email);
              uid = existing.uid;
            } else {
              console.warn('[sync-hubspot-contacts] Auth createUser failed for', email, e.code, e.message);
              totalUpserted += 1;
              continue;
            }
          }
          batch.set(
            usersCol.doc(uid),
            {
              email,
              name,
              displayName: name,
              phone: phone || null,
              status: 'approved',
              role: 'member',
              source: 'hubspot',
              hubspotId: docId,
              registrationComplete: false,
              avatarUrl: null,
              profileImage: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        totalUpserted += 1;
      }

      if (results.length > 0) {
        await batch.commit();
      }

      after = next || null;
      if (after) {
        await new Promise((r) => setTimeout(r, 150));
      }
    } while (after);

    return res.status(200).json({ ok: true, totalUpserted });
  } catch (err) {
    console.error('[sync-hubspot-contacts] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sync failed',
    });
  }
}
