/**
 * Log sent emails to Firestore for admin tracking (who received what, when).
 * Collection: emailLog. Fields: to, subject, sentAt, provider, messageId?, template?, category?
 */

import admin from './firebase-init.js';
import { db } from './firebase-init.js';

const COLLECTION = 'emailLog';

/**
 * Append a single send to the log. No-op if db is not available.
 * @param {{ to: string, subject: string, provider: string, messageId?: string, template?: string, category?: string }} entry
 */
export async function logEmailSend(entry) {
  if (!db) return;
  const { to, subject, provider, messageId, template, category } = entry;
  if (!to || !subject) return;
  try {
    await db.collection(COLLECTION).add({
      to: String(to).trim().toLowerCase(),
      subject: String(subject).trim(),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      provider: provider || 'unknown',
      ...(messageId != null && { messageId: String(messageId) }),
      ...(template != null && template !== '' && { template: String(template) }),
      ...(category != null && category !== '' && { category: String(category) }),
    });
  } catch (e) {
    console.warn('[email-log] Failed to log send:', e?.message || e);
  }
}

const BATCH_SIZE = 500;

/**
 * Log multiple recipients (e.g. bulk send). One document per recipient. Chunks to respect Firestore batch limit.
 */
export async function logEmailSendBulk(recipients, subject, provider, meta = {}) {
  if (!db || !Array.isArray(recipients) || recipients.length === 0) return;
  const emails = recipients
    .map((to) => (typeof to === 'string' ? to : to?.email || '').trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;
  const now = admin.firestore.FieldValue.serverTimestamp();
  try {
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const email of chunk) {
        const ref = db.collection(COLLECTION).doc();
        batch.set(ref, {
          to: email,
          subject: String(subject || '').trim(),
          sentAt: now,
          provider: provider || 'unknown',
          ...(meta.messageId != null && { messageId: String(meta.messageId) }),
          ...(meta.template != null && meta.template !== '' && { template: String(meta.template) }),
          ...(meta.category != null && meta.category !== '' && { category: String(meta.category) }),
        });
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('[email-log] Failed to log bulk send:', e?.message || e);
  }
}
