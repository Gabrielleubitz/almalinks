/**
 * GET /api/admin/test/email-config
 * Admin-only. Returns which integrations are configured (env only, no secrets, no side effects).
 * Response: { mailjet, mailchimp, cloudinary, hubspot } (each boolean).
 */
import '../firebase-init.js';
import { requireAdminOrRespond } from '../admin-auth.js';

function mailjetConfigured() {
  const key = (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || '').trim();
  const secret = (process.env.MAILJET_SECRET_KEY || process.env.MJ_APIKEY_PRIVATE || '').trim();
  return Boolean(key && secret);
}

function mailchimpConfigured() {
  return Boolean((process.env.MAILCHIMP_API_KEY || '').trim());
}

function cloudinaryConfigured() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  return Boolean(cloudName && apiKey && apiSecret);
}

function hubspotConfigured() {
  return Boolean((process.env.HUBSPOT_ACCESS_TOKEN || '').trim());
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const decoded = await requireAdminOrRespond(req, res);
    if (!decoded) return;

    const hubspot = hubspotConfigured();
    return res.status(200).json({
      ok: true,
      mailjet: mailjetConfigured(),
      mailchimp: mailchimpConfigured(),
      cloudinary: cloudinaryConfigured(),
      hubspot,
      ...(hubspot
        ? {
            hubspotDealPipeline:
              (process.env.HUBSPOT_DEAL_PIPELINE || 'default').trim() || 'default',
            hubspotDealStage:
              (process.env.HUBSPOT_DEAL_STAGE || 'appointmentscheduled').trim() ||
              'appointmentscheduled',
          }
        : {}),
    });
  } catch (err) {
    console.error('[admin-email-config]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
