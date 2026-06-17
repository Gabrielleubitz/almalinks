/**
 * Re-exports from lib/server/admin-auth.js (legacy import path for API routes).
 */
export {
  isAdminFromClaims,
  isAdminFromUserDoc,
  isAdminUser,
  resolveIsAdmin,
  resolveAdminAccess,
  verifyAdminRequest,
  requireAdminOrRespond,
} from '../admin-auth.js';
