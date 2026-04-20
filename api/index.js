// Single-entry Vercel function router (Hobby plan friendly)
// All /api/* requests are routed here via vercel.json rewrite.
//
// Important: This file should stay very small; all business logic lives in lib/server/*.

// Initialize Firebase Admin before any route (including lazy-loaded CJS handlers).
import '../lib/server/firebase-init.js';

import url from 'url';
import adminChatsHandler from '../lib/server/api/admin/chats.js';

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
import eventRegistrationApprovedEmailHandler from '../lib/server/api/event-registration-approved-email.js';
import eventCompletedThankYouEmailHandler from '../lib/server/api/event-completed-thank-you-email.js';
import welcomeEmailHandler from '../lib/server/api/welcome-email.js';
import applicationFollowUpEmailHandler from '../lib/server/api/application-follow-up-email.js';
import testMandrillHandler from '../lib/server/api/test-mandrill.js';
import adminTestMailjetHandler from '../lib/server/api/admin-test-mailjet.js';
import adminTestMailchimpHandler from '../lib/server/api/admin-test-mailchimp.js';
import adminEmailConfigHandler from '../lib/server/api/admin-email-config.js';
import adminSendTemplateEmailHandler from '../lib/server/api/admin-send-template-email.js';
import adminEmailLogHandler from '../lib/server/api/admin-email-log.js';
import syncHubspotContactsHandler from '../lib/server/api/sync-hubspot-contacts.js';
import removeHubspotUsersHandler from '../lib/server/api/remove-hubspot-users.js';
import syncHubspotEventsHandler from '../lib/server/api/sync-hubspot-events.js';
import syncHubspotDealsHandler from '../lib/server/api/sync-hubspot-deals.js';
import createEventsFromDealsHandler from '../lib/server/api/create-events-from-deals.js';
import clearHubspotDealsHandler from '../lib/server/api/clear-hubspot-deals.js';
import removeEventsFromDealsHandler from '../lib/server/api/remove-events-from-deals.js';
import listHubspotContactsHandler from '../lib/server/api/list-hubspot-contacts.js';
import listHubspotDealsHandler from '../lib/server/api/list-hubspot-deals.js';
import deleteHubspotContactHandler from '../lib/server/api/delete-hubspot-contact.js';
import deleteHubspotDealHandler from '../lib/server/api/delete-hubspot-deal.js';
import syncEventToHubspotHandler from '../lib/server/api/sync-event-to-hubspot.js';
import syncAllEventsToHubspotHandler from '../lib/server/api/sync-all-events-to-hubspot.js';
import deleteEventFromHubspotHandler from '../lib/server/api/delete-event-from-hubspot.js';
import updateEventPrivateDetailsHandler from '../lib/server/api/update-event-private-details.js';
import updateProfileHandler from '../lib/server/api/update-profile.js';
import uploadProfileImageHandler from '../lib/server/api/upload-profile-image.js';
import deleteProfileImageHandler from '../lib/server/api/delete-profile-image.js';
import uploadImageHandler from '../lib/server/api/upload-image.js';

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
  ['/api/event-registration-approved-email', eventRegistrationApprovedEmailHandler],
  ['/api/event-completed-thank-you-email', eventCompletedThankYouEmailHandler],
  ['/api/welcome-email', welcomeEmailHandler],
  ['/api/application-follow-up-email', applicationFollowUpEmailHandler],
  ['/api/test-mandrill', testMandrillHandler],
  ['/api/sync-hubspot-contacts', syncHubspotContactsHandler],
  ['/api/remove-hubspot-users', removeHubspotUsersHandler],
  ['/api/sync-hubspot-events', syncHubspotEventsHandler],
  ['/api/sync-hubspot-deals', syncHubspotDealsHandler],
  ['/api/create-events-from-deals', createEventsFromDealsHandler],
  ['/api/clear-hubspot-deals', clearHubspotDealsHandler],
  ['/api/remove-events-from-deals', removeEventsFromDealsHandler],
  ['/api/sync-event-to-hubspot', syncEventToHubspotHandler],
  ['/api/sync-all-events-to-hubspot', syncAllEventsToHubspotHandler],
  ['/api/delete-event-from-hubspot', deleteEventFromHubspotHandler],
  ['/api/update-event-private-details', updateEventPrivateDetailsHandler],
  ['/api/profile', updateProfileHandler],
  ['/api/upload-profile-image', uploadProfileImageHandler],
  ['/api/delete-profile-image', deleteProfileImageHandler],
  ['/api/upload-image', uploadImageHandler],

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

  // Admin chat creation (ESM, static import so Vercel bundles it — dynamic import of ../lib failed on serverless)
  if (pathname === '/api/admin/chats') {
    return adminChatsHandler(req, res);
  }

  // Lazy-load remaining CJS endpoints only when called (keeps cold start smaller)
  if (pathname === '/api/system-test' || pathname === '/api/admin-tools' || pathname === '/api/automation-hub' || pathname === '/api/chat-api') {
    const cjsHandler =
      pathname === '/api/system-test' ? await lazyCjs('../lib/server/api/system-test.cjs') :
      pathname === '/api/admin-tools' ? await lazyCjs('../lib/server/api/admin-tools.cjs') :
      pathname === '/api/automation-hub' ? await lazyCjs('../lib/server/api/automation-hub.cjs') :
      pathname === '/api/chat-api' ? await lazyCjs('../lib/server/api/chat-api.cjs') :
      null;

    if (!cjsHandler) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    return cjsHandler(req, res);
  }

  // HubSpot list + delete (dynamic paths)
  if (pathname === '/api/hubspot-contacts') {
    if (req.method === 'GET') return listHubspotContactsHandler(req, res);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (pathname.startsWith('/api/hubspot-contacts/') && pathname.length > '/api/hubspot-contacts/'.length) {
    if (req.method === 'DELETE') {
      const id = pathname.slice('/api/hubspot-contacts/'.length);
      return deleteHubspotContactHandler(req, res, id);
    }
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (pathname === '/api/hubspot-deals') {
    if (req.method === 'GET') return listHubspotDealsHandler(req, res);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (pathname.startsWith('/api/hubspot-deals/') && pathname.length > '/api/hubspot-deals/'.length) {
    if (req.method === 'DELETE') {
      const id = pathname.slice('/api/hubspot-deals/'.length);
      return deleteHubspotDealHandler(req, res, id);
    }
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Admin test email (Mailjet / Mailchimp)
  if (pathname === '/api/admin/test/mailjet') {
    return adminTestMailjetHandler(req, res);
  }
  if (pathname === '/api/admin/test/mailchimp') {
    return adminTestMailchimpHandler(req, res);
  }
  if (pathname === '/api/admin/test/email-config') {
    return adminEmailConfigHandler(req, res);
  }
  if (pathname === '/api/admin/test/send-template-email') {
    return adminSendTemplateEmailHandler(req, res);
  }
  if (pathname === '/api/admin/email-log') {
    return adminEmailLogHandler(req, res);
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

