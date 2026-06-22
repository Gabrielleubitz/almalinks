/**
 * PATCH /api/profile (or POST)
 * Updates the authenticated user's profile in Firestore and syncs to HubSpot.
 * Only profile fields are accepted; hubspot* fields are set server-side after sync.
 *
 * Body: fullName?, firstName?, lastName?, displayName?, email?, title?, organization?, company?,
 *       phone?, linkedinUrl?, linkedin?, chapter?, bioShort?, bioTitle?, bioLong?, bio?, ...
 * (organization and company both map to company; bioShort/bioTitle and bioLong/bio are aliased.)
 *
 * Auth: Bearer Firebase ID token (any authenticated user). User can only update their own profile.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorizeUser } from './hubspot-auth.js';
import { upsertHubspotContact } from '../hubspot-contact-sync.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { getAppBaseUrl } from '../email-config.js';

const ALLOWED_TOP_LEVEL = new Set([
  'fullName', 'firstName', 'lastName', 'displayName', 'name', 'email',
  'title', 'position', 'jobTitle', 'organization', 'company', 'phone',
  'linkedinUrl', 'linkedin', 'linkedinUsername', 'chapter',
  'work', 'jobDescription',
  'bioShort', 'bioTitle', 'bioLong', 'bio',
  'city', 'country', 'timezone', 'website', 'twitter', 'skills',
  'showPhone', 'profileVisibility',
  'address', 'specialty', 'expertiseAreas', 'industry',
  'lookingToGain', 'offerToMembers', 'heardAboutAlma',
]);

function pickAllowed(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (ALLOWED_TOP_LEVEL.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorizeUser(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }
  const uid = authResult.uid;

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const updates = pickAllowed(body);

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'User profile not found' });
    }

    const current = snap.data();
    const merged = {
      ...current,
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastProfileUpdate: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Normalize for Firestore: use name/displayName, company, bio, linkedin as canonical where we have aliases
    if (merged.fullName !== undefined) {
      merged.name = merged.fullName;
      merged.displayName = merged.fullName;
    }
    // Keep company/organization aligned; never let a stale organization overwrite an explicit company PATCH.
    if (updates.company !== undefined) {
      merged.organization = merged.company;
    } else if (updates.organization !== undefined) {
      merged.company = merged.organization;
    }
    if (merged.bioShort !== undefined) merged.bioTitle = merged.bioShort;
    if (merged.bioLong !== undefined) merged.bio = merged.bioLong;
    if (merged.linkedinUrl !== undefined) merged.linkedin = merged.linkedinUrl;

    // Identity for HubSpot: always use this user's stored email so one user never overwrites another's contact.
    const canonicalEmail = (current.email || '').toString().trim().toLowerCase() || null;
    const profileForHubSpot = {
      ...merged,
      email: merged.email || current.email,
      hubspotContactId: current.hubspotContactId || null,
      _lookupEmail: canonicalEmail,
    };

    // [DEBUG] HubSpot sync entry – who is being synced
    console.log('[hubspot-debug] update-profile ENTRY', {
      websiteUserId: uid,
      storedEmailFromDoc: current.email,
      canonicalLookupEmail: canonicalEmail,
      bodyEmail: updates.email,
      storedHubspotContactId: current.hubspotContactId || null,
    });

    await userRef.set(merged, { merge: true });

    // Profile completion notification — fire once, non-blocking
    // Required fields mirror checkProfileComplete() in useAuth.ts
    if (!current.profileCompletedNotifiedAt) {
      const isComplete = !!(
        (merged.displayName || merged.name) &&
        merged.phone && String(merged.phone).trim() &&
        (merged.company || merged.organization) && String(merged.company || merged.organization || '').trim() &&
        (merged.bioTitle || merged.work || merged.bioShort) && String(merged.bioTitle || merged.work || merged.bioShort || '').trim() &&
        (merged.linkedinUsername || merged.linkedin || merged.linkedinUrl) &&
        (merged.position || merged.title || merged.jobTitle)
      );
      if (isComplete) {
        const notifyEmail = (process.env.COMMUNICATIONS_FROM_EMAIL || 'communications@almalinks.org').trim();
        const memberName = (merged.displayName || merged.name || merged.email || uid).toString().trim();
        const memberEmail = (merged.email || current.email || '').toString().trim();
        const profileLink = `${getAppBaseUrl()}/admin/users/${uid}/edit`;
        const subject = `Member profile completed: ${memberName}`;
        const bodyHtml = `<p style="margin:0 0 16px 0;font-size:16px;color:#1C1C1C;"><strong>${memberName}</strong> (${memberEmail}) has completed their AlmaLinks profile.</p><p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;"><a href="${profileLink}" style="color:#2E7FEF;">View profile in admin</a></p>`;
        const bodyText = `${memberName} (${memberEmail}) has completed their AlmaLinks profile.\n\nView in admin: ${profileLink}`;
        // Mark first so a concurrent call doesn't double-send
        await userRef.set({ profileCompletedNotifiedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        sendTransactionalEmail({ to: notifyEmail, subject, html: bodyHtml, text: bodyText }).catch(e =>
          console.warn('[update-profile] Profile completion notification failed (non-blocking):', e?.message || e)
        );
        console.log('[update-profile] Profile completion notification queued for', memberEmail);
      }
    }

    const syncResult = await upsertHubspotContact(profileForHubSpot);

    const hubspotUpdate = {
      hubspotLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      hubspotSyncStatus: syncResult.ok ? 'ok' : 'error',
      ...(syncResult.hubspotContactId && { hubspotContactId: syncResult.hubspotContactId }),
      ...(syncResult.ok ? {} : { hubspotSyncError: syncResult.error || 'Sync failed' }),
    };
    await userRef.set(hubspotUpdate, { merge: true });

    if (!syncResult.ok) {
      console.warn('[update-profile] HubSpot sync failed for', uid, syncResult.error);
      return res.status(200).json({
        ok: true,
        profileSaved: true,
        hubspotSync: false,
        hubspotError: syncResult.error,
      });
    }

    return res.status(200).json({
      ok: true,
      profileSaved: true,
      hubspotSync: true,
      hubspotContactId: syncResult.hubspotContactId,
    });
  } catch (err) {
    console.error('[update-profile] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Failed to update profile',
    });
  }
}
