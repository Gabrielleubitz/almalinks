/**
 * POST /api/delete-profile-image
 * Deletes a profile image from Cloudinary. Body: { userId, publicId }.
 * Auth: Firebase ID token. User can delete their own, or admin can delete for any user.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */
import '../firebase-init.js';
import { auth, db } from '../firebase-init.js';
import { v2 as cloudinary } from 'cloudinary';

const FOLDER = 'profile-pictures';

function getBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : {};
  } catch {
    return {};
  }
}

async function authorize(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken || !auth) {
    return { ok: false, status: 401, error: 'Missing or invalid token' };
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ ok: false, error: 'Cloudinary not configured' });
  }

  const body = getBody(req);
  const userId = body.userId;
  const publicId = body.publicId;
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'Missing userId' });
  }
  if (authResult.uid !== userId) {
    if (!db) {
      return res.status(503).json({ ok: false, error: 'Database not available' });
    }
    const callerDoc = await db.collection('users').doc(authResult.uid).get();
    const isAdmin = callerDoc.exists && callerDoc.data()?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Can only delete your own profile image' });
    }
  }

  const expectedPublicId = `${FOLDER}/${userId}`;
  if (!publicId || publicId !== expectedPublicId) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing publicId for this user' });
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  try {
    await cloudinary.uploader.destroy(publicId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[delete-profile-image] Cloudinary error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Delete failed',
    });
  }
}
