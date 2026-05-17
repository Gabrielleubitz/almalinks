/**
 * GET /api/member-profile-reminders
 * Vercel cron job (runs daily). Sends a one-time profile-completion reminder to every
 * member who was approved approximately 48 hours ago and still has an incomplete profile.
 *
 * "Incomplete" = any of these fields is missing or blank:
 *   bioTitle, bio, phone, company, position, AND at least one of linkedin/linkedinUsername.
 *
 * Idempotency: profileReminderSentAt must be absent before sending; set after a
 * successful send so the member never receives this email twice.
 *
 * Cron schedule: 0 10 * * *  (10:00 UTC daily, offset from automation-hub at 09:00)
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { getAppBaseUrl } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { profileReminderEmail } from '../email-templates.js';

const CRON_SECRET = process.env.CRON_SECRET || '';

const WINDOW_MIN_MS = 48 * 60 * 60 * 1000; // 48 h
const WINDOW_MAX_MS = 72 * 60 * 60 * 1000; // 72 h  (24-hour window to avoid double-sends)

const REQUIRED_FIELDS = ['bioTitle', 'bio', 'phone', 'company', 'position'];

function isProfileIncomplete(data) {
  const missingField = REQUIRED_FIELDS.some(f => !data[f] || String(data[f]).trim() === '');
  const hasLinkedin = !!(data.linkedinUsername || data.linkedin || data.linkedinUrl);
  return missingField || !hasLinkedin;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Protect the endpoint: Vercel passes CRON_SECRET via the Authorization header for cron jobs.
  // Also accept a ?secret= query param for manual testing.
  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const querySecret = (req.query && req.query.secret) || '';
    if (authHeader !== CRON_SECRET && querySecret !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  if (!admin.apps.length || !db) {
    return res.status(503).json({ ok: false, error: 'Server not configured' });
  }

  const fromEmail = (process.env.COMMUNICATIONS_FROM_EMAIL || 'communications@almalinks.org').trim();
  const fromName = (process.env.COMMUNICATIONS_FROM_NAME || 'AlmaLinks').trim();
  const profileUrl = `${getAppBaseUrl()}/complete-profile`;

  const now = Date.now();
  const windowStart = now - WINDOW_MAX_MS; // 72 h ago (oldest allowed)
  const windowEnd = now - WINDOW_MIN_MS;   // 48 h ago (most recent allowed)

  const windowStartTs = admin.firestore.Timestamp.fromMillis(windowStart);
  const windowEndTs = admin.firestore.Timestamp.fromMillis(windowEnd);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Query for approved members whose joinedAt falls in the 48–72h window.
    // We use joinedAt (set on approval) as the reference clock.
    const snapshot = await db
      .collection('users')
      .where('status', '==', 'approved')
      .where('joinedAt', '>=', windowStartTs)
      .where('joinedAt', '<=', windowEndTs)
      .get();

    console.log(`[member-profile-reminders] ${snapshot.size} candidate(s) in 48–72h window`);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // Skip if reminder already sent
      if (data.profileReminderSentAt) {
        skipped++;
        continue;
      }

      // Skip if profile is already complete
      if (!isProfileIncomplete(data)) {
        skipped++;
        continue;
      }

      const email = (data.email || '').trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }

      const firstName = (
        data.firstName ||
        (data.displayName || data.name || '').trim().split(/\s+/)[0] ||
        ''
      ).trim();

      try {
        const html = profileReminderEmail(firstName || null, profileUrl);
        const name = firstName || 'there';
        const text = [
          `Hi ${name},`,
          '',
          'Welcome to AlmaLinks! A complete profile helps other members find and connect with you.',
          '',
          'Please take a few minutes to fill in your remaining details:',
          profileUrl,
          '',
          '— The AlmaLinks team',
        ].join('\n');

        const result = await sendTransactionalEmail({
          to: email,
          subject: 'Complete your AlmaLinks profile',
          html,
          text,
          fromEmail,
          fromName,
          replyTo: fromEmail,
        });

        if (result.ok) {
          await db
            .collection('users')
            .doc(docSnap.id)
            .set({ profileReminderSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          console.log('[member-profile-reminders] Sent reminder to', email);
          sent++;
        } else {
          console.warn('[member-profile-reminders] Send failed for', email, result.error);
          errors++;
        }
      } catch (emailErr) {
        console.error('[member-profile-reminders] Error sending to', email, emailErr?.message || emailErr);
        errors++;
      }
    }

    return res.status(200).json({ ok: true, sent, skipped, errors });
  } catch (err) {
    console.error('[member-profile-reminders] Fatal error:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
