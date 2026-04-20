/**
 * Normalize event audience fields: legacy singular (eventId, chatId, location)
 * vs plural arrays (eventIds, chatIds, locations).
 */

export type EventAudienceLike = {
  mode?: string;
  eventId?: string;
  eventIds?: string[];
  chatId?: string;
  chatIds?: string[];
  location?: string;
  locations?: string[];
};

export function effectiveEventAudienceIds(audience: EventAudienceLike | null | undefined): string[] {
  if (!audience) return [];
  const fromArr = (audience.eventIds || []).filter(Boolean);
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience.eventId) return [audience.eventId];
  return [];
}

export function effectiveChatAudienceIds(audience: EventAudienceLike | null | undefined): string[] {
  if (!audience) return [];
  const fromArr = (audience.chatIds || []).filter(Boolean);
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience.chatId) return [audience.chatId];
  return [];
}

/** City/country labels as stored on user profiles (match Firestore values). */
export function effectiveLocationAudienceLabels(audience: EventAudienceLike | null | undefined): string[] {
  if (!audience) return [];
  const fromArr = (audience.locations || []).map((s) => String(s || '').trim()).filter(Boolean);
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience.location?.trim()) return [audience.location.trim()];
  return [];
}

export function hasAudiencePickForMode(
  mode: string,
  audience: EventAudienceLike | null | undefined,
  individualUidCount: number
): boolean {
  if (mode === 'all_users') return true;
  if (mode === 'individuals') return individualUidCount > 0;
  if (mode === 'event') return effectiveEventAudienceIds(audience).length > 0;
  if (mode === 'chat') return effectiveChatAudienceIds(audience).length > 0;
  if (mode === 'location') return effectiveLocationAudienceLabels(audience).length > 0;
  if (mode === 'group') return !!(audience as { groupId?: string })?.groupId;
  return false;
}
