/**
 * GET /api/admin/email-log
 * Admin-only. Returns recent sent emails (emailLog collection) and total count.
 * Query: limit (default 50), startAfter (document id for cursor).
 *
 * DELETE /api/admin/email-log?id=<documentId>
 * Admin-only. Removes one email log entry from Firestore (does not unsend email).
 */

import url from 'url';
import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { requireAdminOrRespond } from '../admin-auth.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CSV_MAX_LIMIT = 10000;

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function requireAdmin(req, res) {
  return requireAdminOrRespond(req, res);
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    try {
      const decoded = await requireAdmin(req, res);
      if (!decoded) return;

      if (!db) {
        return res.status(503).json({ ok: false, error: 'Database not available' });
      }

      const parsed = url.parse(req.url || '', true);
      const id = (parsed.query?.id && String(parsed.query.id).trim()) || '';
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing id query parameter' });
      }

      await db.collection('emailLog').doc(id).delete();
      return res.status(200).json({ ok: true, deletedId: id });
    } catch (err) {
      console.error('[admin-email-log] DELETE', err?.message || err);
      return res.status(500).json({ ok: false, error: err?.message || 'Internal server error' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded) return;

    if (!db) {
      return res.status(503).json({ ok: false, error: 'Database not available' });
    }

    const format = (req.query?.format && String(req.query.format).trim().toLowerCase()) || 'json';
    const isCsv = format === 'csv';
    const limit = Math.min(
      Math.max(1, parseInt(req.query?.limit, 10) || (isCsv ? CSV_MAX_LIMIT : DEFAULT_LIMIT)),
      isCsv ? CSV_MAX_LIMIT : MAX_LIMIT
    );
    const startAfterId = (req.query?.startAfter && String(req.query.startAfter).trim()) || null;

    let query = db
      .collection('emailLog')
      .orderBy('sentAt', 'desc')
      .limit(limit);

    if (startAfterId) {
      const cursorDoc = await db.collection('emailLog').doc(startAfterId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        to: d.to || '',
        subject: d.subject || '',
        sentAt: d.sentAt?.toDate?.()?.toISOString?.() || null,
        provider: d.provider || '',
        messageId: d.messageId || null,
        template: d.template || null,
        category: d.category || null,
      };
    });

    let totalCount = null;
    try {
      if (typeof db.collection('emailLog').count === 'function') {
        const countSnapshot = await db.collection('emailLog').count().get();
        totalCount = countSnapshot.data?.()?.count ?? 0;
      }
    } catch (_) {
      // Count aggregation not available in this SDK version
    }

    if (isCsv) {
      const header = ['To', 'Subject', 'Sent At', 'Provider', 'Template', 'Category', 'Message ID'];
      const lines = [header.map(csvEscape).join(',')];
      for (const row of items) {
        lines.push([
          row.to,
          row.subject,
          row.sentAt || '',
          row.provider,
          row.template || '',
          row.category || '',
          row.messageId || '',
        ].map(csvEscape).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alma-sent-emails.csv"');
      return res.status(200).send(lines.join('\n'));
    }

    return res.status(200).json({
      ok: true,
      items,
      totalCount,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (err) {
    console.error('[admin-email-log]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal server error' });
  }
}
