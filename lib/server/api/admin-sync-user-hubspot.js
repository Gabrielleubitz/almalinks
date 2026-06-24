/**
 * POST /api/admin-sync-user-hubspot
 * Admin-only: force-sync a single user's Firestore profile to HubSpot.
 *
 * Body: { adminId: string, targetUserId: string }
 * Auth: Bearer Firebase ID token of an admin user.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorizeUser } from './hubspot-auth.js';
import { upsertHubspotContact, shouldSyncStatusToHubspot } from '../hubspot-contact-sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorizeUser(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const { adminId, targetUserId } = req.body || {};
  if (!targetUserId) {
    return res.status(400).json({ ok: false, error: 'targetUserId is required' });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    // Verify caller is admin
    const callerUid = authResult.uid;
    const callerRef = db.collection('users').doc(callerUid);
    const callerSnap = await callerRef.get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const targetRef = db.collection('users').doc(targetUserId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const profile = targetSnap.data();

    // Push real members; only withhold un-approved applicants (pending/rejected)
    if (!shouldSyncStatusToHubspot(profile.status)) {
      return res.status(400).json({
        ok: false,
        error: `User is a ${profile.status} applicant. Only approved members sync to HubSpot.`,
      });
    }

    const canonicalEmail = (profile.email || '').toString().trim().toLowerCase() || null;
    const profileForHubSpot = {
      ...profile,
      email: profile.email,
      hubspotContactId: profile.hubspotContactId || null,
      _lookupEmail: canonicalEmail,
    };

    console.log('[admin-sync-user-hubspot] Syncing', targetUserId, canonicalEmail);
    const syncResult = await upsertHubspotContact(profileForHubSpot);

    const hubspotUpdate = {
      hubspotLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      hubspotSyncStatus: syncResult.ok ? 'ok' : 'error',
      ...(syncResult.hubspotContactId && { hubspotContactId: syncResult.hubspotContactId }),
      ...(syncResult.ok ? {} : { hubspotSyncError: syncResult.error || 'Sync failed' }),
    };
    await targetRef.set(hubspotUpdate, { merge: true });

    if (!syncResult.ok) {
      return res.status(200).json({
        ok: false,
        hubspotSync: false,
        hubspotError: syncResult.error,
      });
    }

    return res.status(200).json({
      ok: true,
      hubspotSync: true,
      hubspotContactId: syncResult.hubspotContactId,
    });
  } catch (err) {
    console.error('[admin-sync-user-hubspot] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Sync failed' });
  }
}
