/**
 * Server-side password reset tokens (valid until used — no time expiry).
 * Stored in Firestore password_resets/{token}.
 */
import crypto from 'crypto';
import admin from './firebase-init.js';
import { auth, db } from './firebase-init.js';
import { getAppBaseUrl } from './email-config.js';

const COLLECTION = 'password_resets';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function buildPasswordResetUrl(token) {
  const base = getAppBaseUrl().replace(/\/$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function findAuthUserByEmail(email) {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  try {
    return await auth.getUserByEmail(norm);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return null;
    throw err;
  }
}

/**
 * Create a single-use password reset token for an email address.
 * @returns {Promise<{ ok: boolean, token?: string, resetUrl?: string, error?: string }>}
 */
export async function createPasswordResetTokenForEmail(email) {
  if (!db) {
    return { ok: false, error: 'Database not available' };
  }

  const norm = normalizeEmail(email);
  if (!norm) {
    return { ok: false, error: 'Email is required' };
  }

  const authUser = await findAuthUserByEmail(norm);
  if (!authUser) {
    // Do not reveal whether the account exists
    return { ok: true, skipped: true };
  }

  const token = crypto.randomBytes(32).toString('hex');
  await db.collection(COLLECTION).doc(token).set({
    userId: authUser.uid,
    email: norm,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    used: false,
  });

  return { ok: true, token, resetUrl: buildPasswordResetUrl(token) };
}

/**
 * Verify token and return associated email (does not consume).
 */
export async function verifyPasswordResetToken(token) {
  if (!db) return { valid: false };
  const clean = String(token || '').trim();
  if (!clean) return { valid: false };

  const snap = await db.collection(COLLECTION).doc(clean).get();
  if (!snap.exists) return { valid: false };

  const data = snap.data() || {};
  if (data.used) return { valid: false };

  return {
    valid: true,
    userId: data.userId,
    email: data.email,
  };
}

/**
 * Set a new password and mark token used.
 */
export async function resetPasswordWithToken(token, newPassword) {
  if (!db) {
    return { ok: false, error: 'Database not available' };
  }

  const clean = String(token || '').trim();
  const password = String(newPassword || '');
  if (!clean) {
    return { ok: false, error: 'Invalid reset link' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }

  const ref = db.collection(COLLECTION).doc(clean);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: 'This password reset link is invalid or has already been used.' };
  }

  const data = snap.data() || {};
  if (data.used) {
    return { ok: false, error: 'This password reset link has already been used.' };
  }

  const userId = data.userId;
  if (!userId) {
    return { ok: false, error: 'Invalid reset link' };
  }

  await auth.updateUser(userId, { password });
  await ref.set(
    {
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, email: data.email };
}
