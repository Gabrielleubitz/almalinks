/**
 * Derive trustee / mentor flags from flattened HubSpot contact properties on the user doc.
 * Internal property names vary by portal; we match keys containing "trustee" / "mentor"
 * (with a few exclusions) and treat common HubSpot truthy values as active.
 */
function hubspotPropertyIsTruthy(raw: string | number | boolean | null | undefined): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw === null || raw === undefined) return false;
  const s = String(raw).trim().toLowerCase();
  if (!s) return false;
  return ['true', 'yes', 'y', '1', 'on', 'checked'].includes(s);
}

function propertyKeyLooksLikeTrustee(key: string): boolean {
  const k = key.toLowerCase();
  if (!k.includes('trustee')) return false;
  if (/(non|not)[_-]?trustee|no[_-]?trustee|trustee[_-]?(no|n\/a)|former[_-]?trustee/.test(k)) return false;
  return true;
}

function propertyKeyLooksLikeMentor(key: string): boolean {
  const k = key.toLowerCase();
  if (!k.includes('mentor')) return false;
  if (k.includes('mentee')) return false;
  if (/(non|not)[_-]?mentor|no[_-]?mentor|mentor[_-]?(no|n\/a)/.test(k)) return false;
  return true;
}

export function getTrusteeMentorFromHubspot(user: {
  hubspotContactProperties?: Record<string, string | number | boolean | null> | null;
}): { isTrustee: boolean; isMentor: boolean } {
  let isTrustee = false;
  let isMentor = false;
  const props = user.hubspotContactProperties;
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
