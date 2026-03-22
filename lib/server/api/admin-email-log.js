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
import { auth, db } from '../firebase-init.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return null;
  }
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (e) {
    res.status(401).json({ ok: false, error: 'Invalid token' });
    return null;
  }
  const isAdmin = decoded.role === 'admin' || decoded.admin === true;
  if (!isAdmin) {
    res.status(403).json({ ok: false, error: 'Forbidden: Admin required' });
    return null;
  }
  return decoded;
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

    const limit = Math.min(
      Math.max(1, parseInt(req.query?.limit, 10) || DEFAULT_LIMIT),
      MAX_LIMIT
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
