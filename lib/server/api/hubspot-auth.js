/**
 * Single source of truth for HubSpot API auth and token.
 * - HUBSPOT_ACCESS_TOKEN: server env only, never exposed to frontend.
 * - SYNC_SECRET: optional header-based auth for sync/delete endpoints.
 */

import admin from '../firebase-init.js';
import { resolveIsAdmin } from './admin-auth.js';

const ENV_TOKEN = 'HUBSPOT_ACCESS_TOKEN';

/**
 * Get HubSpot access token from server env. Never expose to client.
 * @returns {{ ok: true, token: string }} or {{ ok: false, status: number, error: string }}
 */
export function getHubspotToken() {
  const token = process.env[ENV_TOKEN];
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      ok: false,
      status: 503,
      error: `${ENV_TOKEN} is not set. Add it in your server environment (e.g. Vercel) and redeploy.`,
    };
  }
  return { ok: true, token: token.trim() };
}

/**
 * Authorize request: Firebase Admin (Bearer) or SYNC_SECRET header.
 * @returns {{ ok: true, uid?: string }} or {{ ok: false, status: number, error: string }}
 */
export async function authorize(req) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && syncSecret.trim()) {
    const headerSecret = req.headers['x-sync-secret'];
    if (headerSecret === syncSecret) return { ok: true };
    return { ok: false, status: 401, error: 'Invalid or missing x-sync-secret' };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return { ok: false, status: 401, error: 'Missing token' };

  if (!admin?.apps?.length) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const isAdmin = await resolveIsAdmin(decoded);
    if (!isAdmin) return { ok: false, status: 403, error: 'Admin required' };
    return { ok: true, uid: decoded.uid || decoded.sub || undefined };
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
}

/**
 * Authorize any authenticated user (for profile update API). Verifies Firebase ID token and returns uid.
 * @returns {{ ok: true, uid: string }} or {{ ok: false, status: number, error: string }}
 */
export async function authorizeUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return { ok: false, status: 401, error: 'Missing token' };

  if (!admin?.apps?.length) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
}
