import { getIdToken } from 'firebase/auth';
import { auth } from '../firebase/config';

export type HubSpotEventSyncResult = {
  ok: boolean;
  synced: boolean;
  hubspotDealId?: string;
  path?: 'CREATE' | 'UPDATE';
  error?: string;
  hint?: string;
  message?: string;
};

export type HubSpotIntegrationConfig = {
  hubspot: boolean;
  hubspotDealPipeline?: string;
  hubspotDealStage?: string;
};

/** Admin-only: env flags for HubSpot (no secrets). */
export async function fetchHubSpotIntegrationConfig(): Promise<HubSpotIntegrationConfig | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const token = await getIdToken(user);
    const res = await fetch('/api/admin/test/email-config', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      hubspot: Boolean(data.hubspot),
      hubspotDealPipeline: data.hubspotDealPipeline,
      hubspotDealStage: data.hubspotDealStage,
    };
  } catch {
    return null;
  }
}

/** Sync one Alma event to HubSpot Deals (create or update). */
export async function syncEventToHubSpot(eventId: string): Promise<HubSpotEventSyncResult> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, synced: false, error: 'You must be signed in as an admin.' };
  }

  try {
    const idToken = await getIdToken(user);
    const res = await fetch('/api/sync-event-to-hubspot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ eventId }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 503) {
      return {
        ok: false,
        synced: false,
        error: data.error || 'HubSpot is not configured on the server.',
        hint: data.hint || 'Add HUBSPOT_ACCESS_TOKEN in Vercel → Environment Variables, then redeploy.',
      };
    }

    if (res.ok && data.synced) {
      return {
        ok: true,
        synced: true,
        hubspotDealId: data.hubspotDealId,
        path: data.path,
        message: data.path === 'CREATE' ? 'Deal created in HubSpot.' : 'Deal updated in HubSpot.',
      };
    }

    return {
      ok: false,
      synced: false,
      error: data.error || `Sync failed (HTTP ${res.status})`,
      hint: data.hint,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    const isFetch =
      msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError');
    return {
      ok: false,
      synced: false,
      error: isFetch ? 'Could not reach the API.' : msg,
      hint: isFetch
        ? 'Locally: run npm run dev:all. Production: confirm the site is deployed with API routes.'
        : undefined,
    };
  }
}
