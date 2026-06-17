/** Client-side Alma app admin check (matches Firestore rules + server admin-auth). */
export function isAppAdminDoc(
  data: { role?: string; admin?: boolean } | null | undefined
): boolean {
  if (!data) return false;
  return data.role === 'admin' || data.admin === true;
}

export function isAppAdminUser(
  user: { role?: string; admin?: boolean } | null | undefined
): boolean {
  return isAppAdminDoc(user);
}
