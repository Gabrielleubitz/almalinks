/**
 * POST /api/upload-profile-image
 * Uploads a profile image to Cloudinary. Body: { userId, image } (image = base64 data URL).
 * Auth: Firebase ID token. User can upload for themselves (uid === userId), or admin can upload for any user.
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
  const image = body.image;
  const imageType = body.imageType === 'cover' ? 'cover' : 'avatar';
  if (!userId || typeof image !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing userId or image' });
  }
  if (authResult.uid !== userId) {
    if (!db) {
      return res.status(503).json({ ok: false, error: 'Database not available' });
    }
    const callerDoc = await db.collection('users').doc(authResult.uid).get();
    const isAdmin = callerDoc.exists && callerDoc.data()?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Can only upload your own profile image' });
    }
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const folder = imageType === 'cover' ? 'cover-photos' : FOLDER;
  const publicId = `${folder}/${userId}`;

  try {
    const result = await cloudinary.uploader.upload(image, {
      public_id: publicId,
      overwrite: true,
    });
    return res.status(200).json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error('[upload-profile-image] Cloudinary error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Upload failed',
    });
  }
}
