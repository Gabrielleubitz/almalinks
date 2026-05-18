/**
 * Member-facing chats UX is paused while product redesigns structure and flows.
 * Set VITE_CHATS_REDESIGN_PAUSED=false in .env.local to re-enable discover/create CTAs.
 * Existing chat threads remain open when paused.
 */
export const CHATS_REDESIGN_PAUSED =
  import.meta.env.VITE_CHATS_REDESIGN_PAUSED !== 'false';

export const CHATS_REDESIGN_PAUSED_MESSAGE =
  'We’re redesigning Chats to be simpler and easier to use. New groups and discovery are paused for now—you can still open chats you’re already in.';
