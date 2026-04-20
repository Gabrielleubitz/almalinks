import { getIdToken } from 'firebase/auth';
import { auth } from '../firebase/config';

/**
 * Notify checked-in attendees (server-side) after an event is marked completed. Admin only; idempotent per event.
 */
export async function triggerEventCompletedThankYouEmail(
  eventId: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, error: 'Not signed in' };
  }
  try {
    const idToken = await getIdToken(user);
    const res = await fetch('/api/event-completed-thank-you-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ eventId }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return { ok: true, skipped: Boolean((data as { skipped?: boolean }).skipped) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, error: msg };
  }
}
