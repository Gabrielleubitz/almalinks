/**
 * Trustee / mentor flags from HubSpot contact properties on the user doc.
 *
 * Alma portal (2026): Membership Type dropdown → internal name `membership_type`.
 * Trustees are contacts whose membership type option includes "Trustee".
 */

const MEMBERSHIP_TYPE_PROP = 'membership_type';

function hubspotPropertyIsTruthy(raw: string | number | boolean | null | undefined): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw === null || raw === undefined) return false;
  const s = String(raw).trim().toLowerCase();
  if (!s) return false;
  return ['true', 'yes', 'y', '1', 'on', 'checked'].includes(s);
}

/** HubSpot dropdown / multi-select values (semicolon- or comma-separated). */
function membershipTypeTokens(raw: string | number | boolean | null | undefined): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  return s
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function tokenIndicatesTrustee(token: string): boolean {
  if (token === 'trustee' || token === 'trustees') return true;
  if (/\btrustee\b/.test(token) && !/non[- ]?trustee|not[- ]?trustee|former/.test(token)) return true;
  return false;
}

function tokenIndicatesMentor(token: string): boolean {
  if (token === 'mentor' || token === 'mentors') return true;
  if (token.includes('mentee')) return false;
  if (/\bmentor\b/.test(token) && !/non[- ]?mentor|not[- ]?mentor|former/.test(token)) return true;
  return false;
}

function membershipTypeValueIndicates(
  raw: string | number | boolean | null | undefined,
  kind: 'trustee' | 'mentor'
): boolean {
  const tokens = membershipTypeTokens(raw);
  if (tokens.length === 0) return false;
  const check = kind === 'trustee' ? tokenIndicatesTrustee : tokenIndicatesMentor;
  return tokens.some(check);
}

function propertyKeyLooksLikeTrustee(key: string): boolean {
  const k = key.toLowerCase();
  if (k === MEMBERSHIP_TYPE_PROP) return false;
  if (!k.includes('trustee')) return false;
  if (/(non|not)[_-]?trustee|no[_-]?trustee|trustee[_-]?(no|n\/a)|former[_-]?trustee/.test(k)) return false;
  return true;
}

function propertyKeyLooksLikeMentor(key: string): boolean {
  const k = key.toLowerCase();
  if (k === MEMBERSHIP_TYPE_PROP) return false;
  if (!k.includes('mentor')) return false;
  if (k.includes('mentee')) return false;
  if (/(non|not)[_-]?mentor|no[_-]?mentor|mentor[_-]?(no|n\/a)/.test(k)) return false;
  return true;
}

function readMembershipType(
  props: Record<string, string | number | boolean | null>
): string | number | boolean | null | undefined {
  return props[MEMBERSHIP_TYPE_PROP] ?? props.membership_type ?? null;
}

export function getTrusteeMentorFromHubspot(user: {
  hubspotContactProperties?: Record<string, string | number | boolean | null> | null;
  isTrustee?: boolean;
  isMentor?: boolean;
}): { isTrustee: boolean; isMentor: boolean } {
  let isTrustee = user.isTrustee === true;
  let isMentor = user.isMentor === true;
  const props = user.hubspotContactProperties;
  if (props && typeof props === 'object') {
    const membershipType = readMembershipType(props);
    if (membershipTypeValueIndicates(membershipType, 'trustee')) isTrustee = true;
    if (membershipTypeValueIndicates(membershipType, 'mentor')) isMentor = true;
  }

  if (!props || typeof props !== 'object') {
    return { isTrustee, isMentor };
  }

  for (const [key, raw] of Object.entries(props)) {
    if (propertyKeyLooksLikeTrustee(key) && hubspotPropertyIsTruthy(raw)) {
      isTrustee = true;
    }
    if (propertyKeyLooksLikeMentor(key) && hubspotPropertyIsTruthy(raw)) {
      isMentor = true;
    }
  }

  return { isTrustee, isMentor };
}
