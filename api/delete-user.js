import admin from 'firebase-admin';

let firebaseApp;

function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(key);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return firebaseApp;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIdToDelete, adminId } = req.body;

    if (!userIdToDelete || !adminId) {
      return res.status(400).json({ error: 'Missing userIdToDelete or adminId' });
    }

    if (userIdToDelete === adminId) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    initializeFirebaseAdmin();
    const firestore = admin.firestore();
    const auth = admin.auth();

    // Verify admin permissions
    const adminDoc = await firestore.collection('users').doc(adminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Only admins can delete users' });
    }

    // Check if user exists in Firestore
    const userDoc = await firestore.collection('users').doc(userIdToDelete).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore' });
    }

    console.log(`🗑️ Admin ${adminId} deleting user ${userIdToDelete}`);

    // Delete user document from Firestore
    await firestore.collection('users').doc(userIdToDelete).delete();
    console.log('✅ User deleted from Firestore');

    // Delete registration if exists
    const registrationDoc = await firestore.collection('registrations').doc(userIdToDelete).get();
    if (registrationDoc.exists) {
      await firestore.collection('registrations').doc(userIdToDelete).delete();
      console.log('✅ User registration deleted from Firestore');
    }

    // Delete user from Firebase Auth
    try {
      await auth.deleteUser(userIdToDelete);
      console.log('✅ User deleted from Firebase Auth');
      
      return res.status(200).json({
        success: true,
        message: 'User deleted from Firestore and Auth'
      });
    } catch (authError) {
      console.warn('⚠️ Auth deletion failed:', authError.message);
      
      if (authError.code === 'auth/user-not-found') {
        return res.status(200).json({
          success: true,
          message: 'User deleted from Firestore; not found in Auth',
          partialSuccess: true
        });
      }

      return res.status(500).json({
        success: false,
        error: `Error deleting from Auth: ${authError.message}`,
        partialSuccess: true,
        firestoreDeleted: true
      });
    }

  } catch (error) {
    console.error('❌ Delete user error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}