/**
 * GET /api/admin/email-campaigns
 * Admin-only. Returns bulk/group email campaigns (emailCampaigns collection).
 * Query: limit (default 50), startAfter (document id for cursor).
 */

import url from 'url';
import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { requireAdminOrRespond } from '../admin-auth.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const MODE_LABELS = {
  individuals: 'Selected members',
  group: 'Group',
  event: 'Event registrants',
  chat: 'Chat members',
  location: 'Location',
  all_users: 'All members',
};

function modeLabel(mode) {
  return MODE_LABELS[mode] || mode || 'Bulk send';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const decoded = await requireAdminOrRespond(req, res);
    if (!decoded) return;

    if (!db) {
      return res.status(503).json({ ok: false, error: 'Database not available' });
    }

    const parsed = url.parse(req.url || '', true);
    const limit = Math.min(
      Math.max(1, parseInt(parsed.query?.limit, 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const startAfterId = (parsed.query?.startAfter && String(parsed.query.startAfter).trim()) || null;

    let query = db.collection('emailCampaigns').orderBy('createdAt', 'desc').limit(limit);

    if (startAfterId) {
      const cursorDoc = await db.collection('emailCampaigns').doc(startAfterId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => {
      const d = doc.data() || {};
      const recipients = Array.isArray(d.recipients) ? d.recipients : [];
      return {
        id: doc.id,
        mode: d.mode || '',
        modeLabel: modeLabel(d.mode),
        subject: d.subject || '',
        audienceReason: d.audienceReason || d.reason || null,
        sentAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
        recipientCount: d.recipientCount ?? recipients.length ?? 0,
        successCount: d.successCount ?? 0,
        errorCount: d.errorCount ?? 0,
        status: d.status || 'unknown',
        createdBy: d.createdBy || null,
        createdByEmail: d.createdByEmail || null,
        createdByName: d.createdByName || null,
        recipients: recipients.map((r) => ({
          email: r.email || '',
          name: r.name || null,
          userId: r.userId || null,
        })),
        recipientsTruncated: Boolean(d.recipientsTruncated),
        errors: Array.isArray(d.errors) ? d.errors : [],
      };
    });

    let totalCount = null;
    try {
      if (typeof db.collection('emailCampaigns').count === 'function') {
        const countSnapshot = await db.collection('emailCampaigns').count().get();
        totalCount = countSnapshot.data?.()?.count ?? 0;
      }
    } catch (_) {
      // Count aggregation not available
    }

    return res.status(200).json({
      ok: true,
      items,
      totalCount,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (err) {
    console.error('[admin-email-campaigns]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal server error' });
  }
}
