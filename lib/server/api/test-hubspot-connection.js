/**
 * GET /api/test-hubspot-connection
 * Admin-only: test whether the HubSpot access token is valid by making a
 * lightweight API call. Returns diagnostic info so admins can quickly tell
 * if the token is expired / missing.
 */

import { authorizeUser, getHubspotToken } from './hubspot-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorizeUser(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return res.status(200).json({
      ok: false,
      connected: false,
      error: tokenResult.error,
      hint: 'Set HUBSPOT_ACCESS_TOKEN in your Vercel environment variables and redeploy.',
    });
  }

  try {
    // Lightweight check: just fetch the first page of contacts with limit=1
    const testUrl = 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=email';
    const hsRes = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${tokenResult.token}`, 'Content-Type': 'application/json' },
    });

    if (hsRes.status === 401) {
      return res.status(200).json({
        ok: false,
        connected: false,
        httpStatus: 401,
        error: 'HubSpot returned 401 Unauthorized — the access token is expired or invalid.',
        hint: 'Generate a new private app token in HubSpot → Settings → Integrations → Private Apps, then update HUBSPOT_ACCESS_TOKEN in Vercel.',
      });
    }

    if (!hsRes.ok) {
      const text = await hsRes.text();
      return res.status(200).json({
        ok: false,
        connected: false,
        httpStatus: hsRes.status,
        error: `HubSpot API returned HTTP ${hsRes.status}: ${text.slice(0, 200)}`,
      });
    }

    const data = await hsRes.json();
    const contactCount = data?.total ?? '?';
    return res.status(200).json({
      ok: true,
      connected: true,
      contactCount,
      message: `HubSpot connection is working. Portal has ${contactCount} contact(s).`,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      connected: false,
      error: `Network error reaching HubSpot: ${err.message}`,
    });
  }
}
