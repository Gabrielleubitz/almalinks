const admin = require('firebase-admin');

let firebaseApp;

function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!rawKey) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
    }

    let serviceAccount;
    try {
      // Try parsing as JSON first
      serviceAccount = JSON.parse(rawKey);
    } catch (jsonError) {
      // If JSON parse fails, try decoding from base64
      try {
        console.log('🔍 Attempting to decode base64-encoded credentials...');
        const decodedKey = Buffer.from(rawKey, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decodedKey);
        console.log('✅ Successfully decoded base64 credentials');
      } catch (base64Error) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is neither valid JSON nor valid base64-encoded JSON');
      }
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return firebaseApp;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { userIdToDelete, adminId } = body;

    if (!userIdToDelete || !adminId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userIdToDelete or adminId' })
      };
    }

    if (userIdToDelete === adminId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You cannot delete your own account' })
      };
    }

    initializeFirebaseAdmin();
    const firestore = admin.firestore();
    const auth = admin.auth();

    const adminDoc = await firestore.collection('users').doc(adminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Only admins can delete users' })
      };
    }

    const userDoc = await firestore.collection('users').doc(userIdToDelete).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found in Firestore' })
      };
    }

    await firestore.collection('users').doc(userIdToDelete).delete();

    const registrationDoc = await firestore.collection('registrations').doc(userIdToDelete).get();
    if (registrationDoc.exists) {
      await firestore.collection('registrations').doc(userIdToDelete).delete();
    }

    try {
      await auth.deleteUser(userIdToDelete);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: 'User deleted from Firestore; not found in Auth',
            partialSuccess: true
          })
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: `Error deleting from Auth: ${authError.message}`,
          partialSuccess: true,
          firestoreDeleted: true
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'User deleted from Firestore and Auth',
        success: true
      })
    };

  } catch (error) {
    console.error('Delete error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
