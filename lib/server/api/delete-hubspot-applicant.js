/**
 * POST /api/delete-hubspot-applicant
 * Removes a HubSpot contact by applicant email (e.g. when rejecting an application).
 * Body: { email: string }
 */
import '../firebase-init.js';
import { deleteHubspotContactByEmail } from '../hubspot-contact-sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }

    const result = await deleteHubspotContactByEmail(email);
    if (!result.ok && !result.skipped) {
      console.warn('[delete-hubspot-applicant] failed:', email, result.error);
      return res.status(500).json({ ok: false, error: result.error || 'HubSpot delete failed' });
    }

    return res.status(200).json({
      ok: true,
      deleted: !!result.deleted,
      skipped: !!result.skipped,
      reason: result.reason || null,
      hubspotContactId: result.hubspotContactId || null,
    });
  } catch (err) {
    console.error('[delete-hubspot-applicant]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
