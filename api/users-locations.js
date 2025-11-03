// Thin wrapper for Member Map locations endpoint
// This delegates to the user-admin.js handler to keep the function consolidated
// while providing the expected /api/users-locations endpoint for Vercel

import userAdminHandler from './user-admin.js';

export default async function handler(req, res) {
  // Mark the request URL so user-admin knows to route to getUserLocations
  req.url = '/api/users-locations';

  // Delegate to the consolidated handler
  return userAdminHandler(req, res);
}
