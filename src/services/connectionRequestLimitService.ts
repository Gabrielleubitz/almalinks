/**
 * Daily limit for manual connection (friend) requests.
 *
 * Limit: 5 requests per calendar day (UTC). Reset: midnight UTC (calendar day, not rolling 24h).
 * Applies only to manual requests from Members page or profile pages.
 * Auto post-event connections (AutoConnectService) do NOT use this and are unlimited.
 */
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';

const COLLECTION = 'connection_request_daily';
const LIMIT = 5;

/** Today's date string in UTC (YYYY-MM-DD). Used for daily reset. */
export function getTodayUTC(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Get how many connection requests the user has sent today (UTC).
 * Does not count auto-event connections.
 */
export async function getDailyRequestCount(userId: string): Promise<number> {
  try {
    const ref = doc(db, COLLECTION, userId);
    const snap = await retryOnNetworkFailure(() => getDoc(ref));
    if (!snap.exists()) return 0;
    const data = snap.data();
    const date = data?.date;
    if (date !== getTodayUTC()) return 0;
    const count = data?.count;
    return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0;
  } catch (e) {
    console.warn('[connectionRequestLimitService] getDailyRequestCount failed', e);
    return 0;
  }
}

/**
 * Increment the daily request count after successfully creating a request.
 * Call this only for manual requests (not for auto-event connections).
 */
export async function incrementDailyRequestCount(userId: string): Promise<void> {
  const today = getTodayUTC();
  const ref = doc(db, COLLECTION, userId);
  await retryOnNetworkFailure(() =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { date: today, count: 1 });
        return;
      }
      const data = snap.data();
      if (data?.date !== today) {
        tx.set(ref, { date: today, count: 1 });
        return;
      }
      const next = (data?.count ?? 0) + 1;
      tx.set(ref, { date: today, count: next });
    })
  );
}

export function isOverDailyLimit(count: number): boolean {
  return count >= LIMIT;
}

export const DAILY_CONNECTION_REQUEST_LIMIT = LIMIT;
export const DAILY_LIMIT_MESSAGE =
  "You've reached today's connection limit. Try again tomorrow.";
