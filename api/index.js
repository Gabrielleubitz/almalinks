// Single-entry Vercel function router (Hobby plan friendly)
// All /api/* requests are routed here via vercel.json rewrite.
//
// Important: This file should stay very small; all business logic lives in lib/server/*.

import url from 'url';

// ESM handlers
import userAdminHandler from '../lib/server/api/user-admin.js';
import activityAdminHandler from '../lib/server/api/activity-admin.js';
import emailServiceHandler from '../lib/server/api/email-service.js';
import deleteUserHandler from '../lib/server/api/delete-user.js';
import sendEmailHandler from '../lib/server/api/send-email.js';
import sendBulkEmailHandler from '../lib/server/api/send-bulk-email.js';
import notifySignupHandler from '../lib/server/api/notify-signup.js';
import notifyUserSignupHandler from '../lib/server/api/notify-user-signup.js';
import resolveEmailRecipientsHandler from '../lib/server/api/resolve-email-recipients.js';
import mailchimpSyncContactHandler from '../lib/server/api/mailchimp-sync-contact.js';
import mailchimpImportUsersHandler from '../lib/server/api/mailchimp-import-users.js';
import sendEventAnnouncementHandler from '../lib/server/api/send-event-announcement.js';
import welcomeEmailHandler from '../lib/server/api/welcome-email.js';
import testMandrillHandler from '../lib/server/api/test-mandrill.js';
import syncHubspotContactsHandler from '../lib/server/api/sync-hubspot-contacts.js';
import removeHubspotUsersHandler from '../lib/server/api/remove-hubspot-users.js';
import uploadProfileImageHandler from '../lib/server/api/upload-profile-image.js';
import deleteProfileImageHandler from '../lib/server/api/delete-profile-image.js';

// Legacy connection/request endpoints (kept for compatibility with current frontend paths)
import connectionsAdminCreateHandler from '../lib/server/api/legacy/api/connections/admin-create.js';
import connectionsCreateFromRequestHandler from '../lib/server/api/legacy/api/connections/create-from-request.js';
import connectionRequestCreateHandler from '../lib/server/api/legacy/api/connection-requests/connection-request/create.js';
import connectionRequestRespondHandler from '../lib/server/api/legacy/api/connection-requests/connection-request/respond.js';
import connectionRequestsIncomingHandler from '../lib/server/api/legacy/api/connection-requests/incoming.js';

// CJS handlers (kept as .cjs to avoid changing their runtime semantics)
const lazyCjs = async (relPath) => {
  // Node will treat .cjs as CommonJS even in type=module projects
  const mod = await import(relPath);
  return mod?.default || mod;
};

const routeTable = new Map([
  // Admin/user management
  ['/api/user-admin', userAdminHandler],
  ['/api/activity-admin', activityAdminHandler],
  ['/api/delete-user', deleteUserHandler],

  // Email / notifications
  ['/api/email-service', emailServiceHandler],
  ['/api/send-email', sendEmailHandler],
  ['/api/send-bulk-email', sendBulkEmailHandler],
  ['/api/resolve-email-recipients', resolveEmailRecipientsHandler],
  ['/api/notify-signup', notifySignupHandler],
  ['/api/notify-user-signup', notifyUserSignupHandler],
  ['/api/mailchimp-sync-contact', mailchimpSyncContactHandler],
  ['/api/mailchimp-import-users', mailchimpImportUsersHandler],
  ['/api/send-event-announcement', sendEventAnnouncementHandler],
  ['/api/welcome-email', welcomeEmailHandler],
  ['/api/test-mandrill', testMandrillHandler],
  ['/api/sync-hubspot-contacts', syncHubspotContactsHandler],
  ['/api/remove-hubspot-users', removeHubspotUsersHandler],
  ['/api/upload-profile-image', uploadProfileImageHandler],
  ['/api/delete-profile-image', deleteProfileImageHandler],

  // Connections workflow (current frontend paths)
  ['/api/connections/admin-create', connectionsAdminCreateHandler],
  ['/api/connections/create-from-request', connectionsCreateFromRequestHandler],
  ['/api/connection-request/create', connectionRequestCreateHandler],
  ['/api/connection-request/respond', connectionRequestRespondHandler],
  ['/api/connection-requests/incoming', connectionRequestsIncomingHandler],

  // Back-compat for accidentally nested paths that existed in repo history
  ['/api/api/connections/admin-create', connectionsAdminCreateHandler],
  ['/api/api/connections/create-from-request', connectionsCreateFromRequestHandler],
  ['/api/api/connection-request/create', connectionRequestCreateHandler],
  ['/api/api/connection-request/respond', connectionRequestRespondHandler],
  ['/api/api/connection-requests/incoming', connectionRequestsIncomingHandler],
]);

export default async function handler(req, res) {
  const parsed = url.parse(req.url || '', true);
  const pathname = parsed.pathname || '';

  // Basic CORS / preflight support (individual handlers may also do this)
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // SMS disabled: no network requests to /api/send-sms; return 200 and log only
  if (pathname === '/api/send-sms') {
    console.log('SMS notifications disabled');
    return res.status(200).json({ ok: true, skipped: true, message: 'SMS notifications disabled' });
  }

  // Lazy-load the CJS endpoints only when called (keeps cold start smaller)
  if (pathname === '/api/system-test' || pathname === '/api/admin-tools' || pathname === '/api/automation-hub' || pathname === '/api/chat-api' || pathname === '/api/admin/chats') {
    const cjsHandler =
      pathname === '/api/system-test' ? await lazyCjs('../lib/server/api/system-test.cjs') :
      pathname === '/api/admin-tools' ? await lazyCjs('../lib/server/api/admin-tools.cjs') :
      pathname === '/api/automation-hub' ? await lazyCjs('../lib/server/api/automation-hub.cjs') :
      pathname === '/api/chat-api' ? await lazyCjs('../lib/server/api/chat-api.cjs') :
      pathname === '/api/admin/chats' ? await lazyCjs('../lib/server/api/admin/chats.cjs') :
      null;

    if (!cjsHandler) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    return cjsHandler(req, res);
  }

  const directHandler = routeTable.get(pathname);
  if (directHandler) {
    return directHandler(req, res);
  }

  return res.status(404).json({
    ok: false,
    error: 'Not found',
    path: pathname,
  });
}

