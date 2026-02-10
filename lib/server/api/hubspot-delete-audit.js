/**
 * Audit logging for HubSpot admin delete actions.
 * Logs: action type, admin user id, number of records deleted, timestamp.
 */

/**
 * @param {string} action - e.g. 'remove-hubspot-users', 'delete-hubspot-contact', 'clear-hubspot-deals'
 * @param {string} [adminUid] - caller uid when using Bearer auth
 * @param {{ users?: number, contacts?: number, deals?: number, events?: number, [key: string]: number | undefined }} counts
 */
export function logHubspotDeleteAudit(action, adminUid, counts) {
  const payload = {
    action,
    adminUid: adminUid || null,
    ...counts,
    timestamp: new Date().toISOString(),
  };
  console.log('[hubspot-delete-audit]', JSON.stringify(payload));
}
