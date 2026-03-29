export function isCommunityEnabled(): boolean {
  // Default to off unless explicitly enabled.
  return String(import.meta.env.VITE_COMMUNITY_ENABLED).toLowerCase() === 'true';
}

