import { getIdToken } from 'firebase/auth';
import { auth } from '../firebase/config';

export type EventCompletedThankYouResult = {
  ok: boolean;
  skipped?: boolean;
  sent?: number;
  failed?: number;
  total?: number;
  message?: string;
  error?: string;
};

/**
 * Notify checked-in attendees (server-side) after an event is marked completed. Admin only.
 * Retries are allowed until at least one email is successfully sent (unless forceResend).
 */
export async function triggerEventCompletedThankYouEmail(
  eventId: string,
  options?: { forceResend?: boolean }
): Promise<EventCompletedThankYouResult> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, error: 'Not signed in' };
  }
  try {
    const idToken = await getIdToken(user);
    const res = await fetch('/api/event-completed-thank-you-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        eventId,
        ...(options?.forceResend ? { forceResend: true } : {}),
      }),
      credentials: 'include',
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      skipped?: boolean;
      sent?: number;
      failed?: number;
      total?: number;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: data.ok !== false,
      skipped: Boolean(data.skipped),
      sent: data.sent,
      failed: data.failed,
      total: data.total,
      message: data.message,
      error: data.ok === false ? data.message || data.error : undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, error: msg };
  }
}
