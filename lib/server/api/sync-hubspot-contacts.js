/**
 * POST /api/sync-hubspot-contacts
 * Imports ALL HubSpot CRM contacts into Firestore:
 * 1) hubspotContacts collection (by HubSpot id)
 * 2) users collection as pending users (doc id = hubspot_<hubspotId>)
 * UPSERT using set(..., { merge: true }). Pages through HubSpot API (limit=100, after).
 *
 * Auth: Firebase Auth ID token (admin) OR header x-sync-secret: SYNC_SECRET.
 * Env: HUBSPOT_ACCESS_TOKEN (required), SYNC_SECRET (optional).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const LIMIT = 100;
const PROPERTIES = ['email', 'firstname', 'lastname', 'phone'];
const FIRESTORE_BATCH_SIZE = 500; // Firestore batch limit; we do ≤2 writes per contact (hubspotContacts + users), LIMIT=100 → max 200 ops
const USERS_PREFIX = 'hubspot_';

async function authorize(req) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && syncSecret.trim()) {
    const headerSecret = req.headers['x-sync-secret'];
    if (headerSecret === syncSecret) return { ok: true };
    return { ok: false, status: 401, error: 'Invalid or missing x-sync-secret' };
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return { ok: false, status: 401, error: 'Missing token' };
  if (!admin.apps.length || !auth) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
  const isAdmin = decoded.role === 'admin' || decoded.admin === true;
  if (!isAdmin) return { ok: false, status: 403, error: 'Admin required' };
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token || !token.trim()) {
    return res.status(503).json({
      ok: false,
      error: 'HUBSPOT_ACCESS_TOKEN is not set. Add it in Vercel (or .env) and redeploy.',
    });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
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

        batch.set(
          hubspotCol.doc(docId),
          {
            hubspotId: docId,
            email: email,
            properties: props,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Create/update user doc only when contact has email (avoid invalid user records; hubspotContacts still gets all)
        if (email) {
          const userDocId = USERS_PREFIX + docId;
          batch.set(
            usersCol.doc(userDocId),
            {
              email: email,
              name: name,
              displayName: name,
              phone: phone || null,
              status: 'approved',
              role: 'member',
              source: 'hubspot',
              hubspotId: docId,
              registrationComplete: false,
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
      // Small delay between pages to reduce HubSpot rate-limit risk
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
