/**
 * POST /api/upload-image
 * Uploads an image to Cloudinary in a given folder (chat-groups or events).
 * Body: { folder: 'chat-groups' | 'events', image } (image = base64 data URL).
 * Auth: Firebase ID token. Caller must be admin.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */
import '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_FOLDERS = ['chat-groups', 'events'];

function getBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : {};
  } catch {
    return {};
  }
}

async function authorize(req) {
  const result = await verifyAdminRequest(req);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, uid: result.uid };
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
  const folder = body.folder;
  const image = body.image;
  if (!folder || typeof image !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing folder or image' });
  }
  if (!ALLOWED_FOLDERS.includes(folder)) {
    return res.status(400).json({ ok: false, error: 'folder must be chat-groups or events' });
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const publicId = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  try {
    const result = await cloudinary.uploader.upload(image, {
      public_id: publicId,
      overwrite: false,
    });
    return res.status(200).json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error('[upload-image] Cloudinary error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Upload failed',
    });
  }
}
