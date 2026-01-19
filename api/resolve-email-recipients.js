// POST /api/resolve-email-recipients
// Resolve email recipients based on audience selection (group, event, chat, location, or individuals)
// Requires authentication (admin)
import '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import admin from '../firebase-init.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let currentUserId;
    let isAdmin = false;
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      currentUserId = decodedToken.uid;
      isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    } catch (authError) {
      console.error('[resolve-email-recipients] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Require admin for bulk recipient resolution
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required' });
    }

    // Parse request body
    const { mode, ids, groupId, eventId, chatId, location } = req.body;

    // Validate input
    if (!mode || !['individuals', 'group', 'event', 'chat', 'location'].includes(mode)) {
      return res.status(400).json({ ok: false, error: 'mode must be one of: individuals, group, event, chat, location' });
    }

    let recipients = [];

    try {
      switch (mode) {
        case 'individuals':
          if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ ok: false, error: 'ids array is required for individuals mode' });
          }
          recipients = await resolveIndividualRecipients(ids);
          break;

        case 'group':
          if (!groupId) {
            return res.status(400).json({ ok: false, error: 'groupId is required for group mode' });
          }
          recipients = await resolveGroupRecipients(groupId);
          break;

        case 'event':
          if (!eventId) {
            return res.status(400).json({ ok: false, error: 'eventId is required for event mode' });
          }
          recipients = await resolveEventRecipients(eventId);
          break;

        case 'chat':
          if (!chatId) {
            return res.status(400).json({ ok: false, error: 'chatId is required for chat mode' });
          }
          recipients = await resolveChatRecipients(chatId);
          break;

        case 'location':
          if (!location) {
            return res.status(400).json({ ok: false, error: 'location is required for location mode' });
          }
          recipients = await resolveLocationRecipients(location);
          break;
      }

      // Deduplicate by email and userId
      const uniqueRecipients = deduplicateRecipients(recipients);

      // Filter out invalid emails
      const validRecipients = uniqueRecipients.filter(r => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return r.email && emailRegex.test(r.email);
      });

      console.log(`[resolve-email-recipients] Resolved ${validRecipients.length} recipients for mode: ${mode}`);

      return res.status(200).json({
        ok: true,
        recipients: validRecipients,
        count: validRecipients.length
      });

    } catch (resolveError) {
      console.error('[resolve-email-recipients] Error resolving recipients:', resolveError);
      return res.status(500).json({
        ok: false,
        error: resolveError.message || 'Failed to resolve recipients'
      });
    }

  } catch (error) {
    console.error('[resolve-email-recipients] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Resolve recipients from individual user IDs
 */
async function resolveIndividualRecipients(userIds) {
  const recipients = [];
  
  // Batch fetch users (Firestore 'in' query supports up to 10)
  const BATCH_SIZE = 10;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const userDocs = await Promise.all(
      batch.map(uid => db.collection('users').doc(uid).get())
    );
    
    userDocs.forEach((userDoc, index) => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        recipients.push({
          userId: batch[index],
          email: userData.email,
          name: userData.displayName || userData.name || undefined
        });
      }
    });
  }
  
  return recipients;
}

/**
 * Resolve recipients from a group
 * TODO: Implement when groups collection is available
 * For now, return empty array with a note
 */
async function resolveGroupRecipients(groupId) {
  // TODO: Implement group member resolution
  // Example structure (when groups collection exists):
  // const groupDoc = await db.collection('groups').doc(groupId).get();
  // if (!groupDoc.exists) throw new Error('Group not found');
  // const memberIds = groupDoc.data().memberIds || [];
  // return resolveIndividualRecipients(memberIds);
  
  console.warn('[resolve-email-recipients] Groups not yet implemented');
  return [];
}

/**
 * Resolve recipients from an event (all registered users)
 */
async function resolveEventRecipients(eventId) {
  const recipients = [];
  
  // Get all registrations for the event
  const registrationsSnapshot = await db.collection('events').doc(eventId)
    .collection('registrations').get();
  
  if (registrationsSnapshot.empty) {
    return [];
  }
  
  // Get user IDs from registrations (registration doc ID is userId)
  const userIds = registrationsSnapshot.docs.map(doc => doc.id);
  
  // Resolve user emails
  return resolveIndividualRecipients(userIds);
}

/**
 * Resolve recipients from a chat (all chat members)
 */
async function resolveChatRecipients(chatId) {
  const recipients = [];
  
  // Get all chat members
  const membersSnapshot = await db.collection('chat_members')
    .where('chatId', '==', chatId)
    .get();
  
  if (membersSnapshot.empty) {
    return [];
  }
  
  // Get user IDs from chat members
  const userIds = membersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);
  
  // Resolve user emails
  return resolveIndividualRecipients(userIds);
}

/**
 * Resolve recipients by location (city or country)
 */
async function resolveLocationRecipients(location) {
  const recipients = [];
  
  // Search users by city or country
  // Note: Firestore doesn't support OR queries, so we'll search both and deduplicate
  const cityQuery = db.collection('users')
    .where('city', '==', location)
    .where('status', '==', 'approved');
  
  const countryQuery = db.collection('users')
    .where('country', '==', location)
    .where('status', '==', 'approved');
  
  const [citySnapshot, countrySnapshot] = await Promise.all([
    cityQuery.get(),
    countryQuery.get()
  ]);
  
  // Combine results
  const allUserDocs = [
    ...citySnapshot.docs,
    ...countrySnapshot.docs
  ];
  
  // Deduplicate by doc ID
  const uniqueUserDocs = Array.from(
    new Map(allUserDocs.map(doc => [doc.id, doc])).values()
  );
  
  uniqueUserDocs.forEach(doc => {
    const userData = doc.data();
    if (userData.email) {
      recipients.push({
        userId: doc.id,
        email: userData.email,
        name: userData.displayName || userData.name || undefined
      });
    }
  });
  
  return recipients;
}

/**
 * Deduplicate recipients by email and userId
 */
function deduplicateRecipients(recipients) {
  const seen = new Map();
  
  recipients.forEach(recipient => {
    const key = recipient.email?.toLowerCase() || recipient.userId;
    if (key && !seen.has(key)) {
      seen.set(key, recipient);
    }
  });
  
  return Array.from(seen.values());
}
