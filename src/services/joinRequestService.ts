import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { sanitizeForFirestore } from '../utils/firestoreHelpers';

export interface JoinRequest {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | Date;
  approvedAt?: Timestamp | Date;
  approvedBy?: string;
  rejectedAt?: Timestamp | Date;
  rejectedBy?: string;
  // Additional profile fields that might be provided during signup
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
}

export interface JoinRequestFormData {
  email: string;
  name?: string;
  displayName?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
}

export class JoinRequestService {
  /**
   * Create a new join request (on signup)
   */
  static async createJoinRequest(
    uid: string,
    formData: JoinRequestFormData
  ): Promise<JoinRequest> {
    try {
      // Log Firebase project info for debugging
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      console.log('🔍 DEBUG: Firebase Project ID:', projectId);
      console.log('🔍 DEBUG: Current user UID (from auth):', (await import('../firebase/config')).auth.currentUser?.uid);
      
      console.log('📝 Creating join request for:', uid);
      console.log('📝 Form data received:', {
        email: formData.email,
        name: formData.name || formData.displayName,
        phone: formData.phone,
        company: formData.company,
        work: formData.work
      });
      
      // Build the join request payload with required fields
      // Only include optional fields if they have defined values
      const joinRequestPayload: any = {
        uid,
        email: formData.email.toLowerCase().trim(),
        name: formData.name || formData.displayName || '',
        displayName: formData.displayName || formData.name || '',
        phone: formData.phone || '',
        company: formData.company || '',
        work: formData.work || '',
        linkedinUsername: formData.linkedinUsername || '',
        position: formData.position || '',
        status: 'pending',
        createdAt: serverTimestamp()
      };

      // Add optional fields only if they are defined (not undefined)
      if (formData.bioTitle !== undefined && formData.bioTitle !== null && formData.bioTitle !== '') {
        joinRequestPayload.bioTitle = formData.bioTitle;
      }
      if (formData.bio !== undefined && formData.bio !== null && formData.bio !== '') {
        joinRequestPayload.bio = formData.bio;
      }
      if (formData.city !== undefined && formData.city !== null && formData.city !== '') {
        joinRequestPayload.city = formData.city;
      }
      if (formData.country !== undefined && formData.country !== null && formData.country !== '') {
        joinRequestPayload.country = formData.country;
      }
      if (formData.timezone !== undefined && formData.timezone !== null && formData.timezone !== '') {
        joinRequestPayload.timezone = formData.timezone;
      }
      if (formData.website !== undefined && formData.website !== null && formData.website !== '') {
        joinRequestPayload.website = formData.website;
      }
      if (formData.twitter !== undefined && formData.twitter !== null && formData.twitter !== '') {
        joinRequestPayload.twitter = formData.twitter;
      }
      if (formData.skills !== undefined && formData.skills !== null && Array.isArray(formData.skills) && formData.skills.length > 0) {
        joinRequestPayload.skills = formData.skills;
      }

      // Sanitize the payload to remove any undefined values (safety check)
      const sanitizedPayload = sanitizeForFirestore(joinRequestPayload);

      const requestRef = doc(db, 'joinRequests', uid);
      
      console.log('📝 Attempting to write join request to Firestore:', {
        collection: 'joinRequests',
        documentId: uid,
        data: {
          email: sanitizedPayload.email,
          name: sanitizedPayload.name,
          status: sanitizedPayload.status,
          hasCreatedAt: !!sanitizedPayload.createdAt,
          includedFields: Object.keys(sanitizedPayload)
        }
      });
      
      try {
        await retryOnNetworkFailure(() => setDoc(requestRef, sanitizedPayload));
        console.log('✅ Join request write succeeded');
      } catch (writeError: any) {
        console.error('❌ Firestore write error:', {
          code: writeError.code,
          message: writeError.message,
          stack: writeError.stack
        });
        
        // Check for permission errors
        if (writeError.code === 'permission-denied') {
          console.error('🚫 PERMISSION DENIED: Check Firestore security rules for joinRequests collection');
          console.error('   Expected rule: allow create on joinRequests/{uid} if request.auth.uid == uid');
        }
        
        // Check for invalid data errors (undefined values)
        if (writeError.code === 'invalid-argument' || writeError.message?.includes('Unsupported field value')) {
          console.error('🚫 INVALID DATA: Firestore does not allow undefined values');
          console.error('   Sanitized payload keys:', Object.keys(sanitizedPayload));
          console.error('   Payload preview (no sensitive data):', {
            uid: sanitizedPayload.uid,
            email: sanitizedPayload.email ? 'present' : 'missing',
            name: sanitizedPayload.name ? 'present' : 'missing',
            status: sanitizedPayload.status,
            fieldCount: Object.keys(sanitizedPayload).length
          });
        }
        
        throw writeError;
      }
      
      console.log('✅ Join request created successfully:', {
        uid,
        email: joinRequest.email,
        name: joinRequest.name,
        status: joinRequest.status
      });
      
      // Verify the document was created
      try {
        const verifyDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
        if (!verifyDoc.exists()) {
          throw new Error('Join request document was not created (verification failed)');
        }
        console.log('✅ Verified join request document exists in Firestore');
        
        const verifiedData = verifyDoc.data();
        console.log('📋 Verified join request data:', {
          uid: verifyDoc.id,
          email: verifiedData.email,
          name: verifiedData.name,
          status: verifiedData.status,
          createdAt: verifiedData.createdAt ? 'present' : 'missing',
          createdAtType: verifiedData.createdAt ? typeof verifiedData.createdAt : 'none'
        });
      } catch (verifyError: any) {
        console.error('❌ Verification error:', {
          code: verifyError.code,
          message: verifyError.message
        });
        if (verifyError.code === 'permission-denied') {
          console.error('🚫 PERMISSION DENIED on read: Check Firestore security rules');
        }
        // Don't throw - write succeeded, verification is just for logging
      }
      
      return {
        uid: verifyDoc.id,
        ...verifiedData
      } as JoinRequest;
    } catch (error) {
      console.error('❌ Error creating join request:', error);
      throw error;
    }
  }

  /**
   * Get join request by UID
   */
  static async getJoinRequest(uid: string): Promise<JoinRequest | null> {
    try {
      const requestRef = doc(db, 'joinRequests', uid);
      const requestDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
      
      if (!requestDoc.exists()) {
        return null;
      }
      
      return {
        uid: requestDoc.id,
        ...requestDoc.data()
      } as JoinRequest;
    } catch (error) {
      console.error('❌ Error getting join request:', error);
      return null;
    }
  }

  /**
   * Get join request by email (for finding existing requests when email is already in use)
   */
  static async getJoinRequestByEmail(email: string): Promise<JoinRequest | null> {
    try {
      const requestsRef = collection(db, 'joinRequests');
      const q = query(
        requestsRef,
        where('email', '==', email.toLowerCase().trim())
      );
      
      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      
      if (snapshot.empty) {
        return null;
      }
      
      // Return the most recent request (should only be one per email, but handle multiple)
      const docs = snapshot.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime; // Most recent first
      });
      
      return {
        uid: docs[0].id,
        ...docs[0].data()
      } as JoinRequest;
    } catch (error) {
      console.error('❌ Error getting join request by email:', error);
      return null;
    }
  }

  /**
   * Create or update join request for existing Auth user (fallback for rejected users)
   * This allows users with existing Auth accounts to re-submit a join request
   */
  static async createOrUpdateJoinRequestForExistingUser(
    uid: string,
    formData: JoinRequestFormData
  ): Promise<JoinRequest> {
    try {
      console.log('📝 Creating/updating join request for existing Auth user:', uid);
      
      // Check if join request already exists
      const existingRequest = await this.getJoinRequest(uid);
      
      // Build the join request payload
      const joinRequestPayload: any = {
        uid,
        email: formData.email.toLowerCase().trim(),
        name: formData.name || formData.displayName || '',
        displayName: formData.displayName || formData.name || '',
        phone: formData.phone || '',
        company: formData.company || '',
        work: formData.work || '',
        linkedinUsername: formData.linkedinUsername || '',
        position: formData.position || '',
        status: 'pending',
        createdAt: existingRequest?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add optional fields only if they are defined
      if (formData.bioTitle !== undefined && formData.bioTitle !== null && formData.bioTitle !== '') {
        joinRequestPayload.bioTitle = formData.bioTitle;
      }
      if (formData.bio !== undefined && formData.bio !== null && formData.bio !== '') {
        joinRequestPayload.bio = formData.bio;
      }
      if (formData.city !== undefined && formData.city !== null && formData.city !== '') {
        joinRequestPayload.city = formData.city;
      }
      if (formData.country !== undefined && formData.country !== null && formData.country !== '') {
        joinRequestPayload.country = formData.country;
      }
      if (formData.timezone !== undefined && formData.timezone !== null && formData.timezone !== '') {
        joinRequestPayload.timezone = formData.timezone;
      }
      if (formData.website !== undefined && formData.website !== null && formData.website !== '') {
        joinRequestPayload.website = formData.website;
      }
      if (formData.twitter !== undefined && formData.twitter !== null && formData.twitter !== '') {
        joinRequestPayload.twitter = formData.twitter;
      }
      if (formData.skills !== undefined && formData.skills !== null && Array.isArray(formData.skills) && formData.skills.length > 0) {
        joinRequestPayload.skills = formData.skills;
      }

      // If existing request was rejected, add metadata
      if (existingRequest?.status === 'rejected') {
        joinRequestPayload.previouslyRejected = true;
        joinRequestPayload.rejectedAt = existingRequest.rejectedAt;
        joinRequestPayload.rejectedBy = existingRequest.rejectedBy;
      }

      // Sanitize the payload
      const sanitizedPayload = sanitizeForFirestore(joinRequestPayload);

      const requestRef = doc(db, 'joinRequests', uid);
      await retryOnNetworkFailure(() => setDoc(requestRef, sanitizedPayload, { merge: true }));
      
      console.log('✅ Join request created/updated for existing Auth user');
      
      // Verify the document
      const verifyDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
      if (!verifyDoc.exists()) {
        throw new Error('Join request document was not created');
      }
      
      return {
        uid: verifyDoc.id,
        ...verifyDoc.data()
      } as JoinRequest;
    } catch (error) {
      console.error('❌ Error creating/updating join request for existing user:', error);
      throw error;
    }
  }

  /**
   * Get all pending join requests
   * Tries with orderBy first, falls back to without orderBy if index is missing
   */
  static async getPendingRequests(): Promise<JoinRequest[]> {
    try {
      const requestsRef = collection(db, 'joinRequests');
      
      // Try with orderBy first (requires index)
      try {
        const q = query(
          requestsRef,
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await retryOnNetworkFailure(() => getDocs(q));
        const requests = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as JoinRequest[];
        
        console.log(`✅ Loaded ${requests.length} pending requests (with orderBy)`);
        return requests;
      } catch (orderByError: any) {
        // If orderBy fails (likely missing index), try without it
        if (orderByError.code === 'failed-precondition' || orderByError.message?.includes('index')) {
          console.warn('⚠️ Index missing, loading without orderBy...');
          const q = query(
            requestsRef,
            where('status', '==', 'pending')
          );
          
          const snapshot = await retryOnNetworkFailure(() => getDocs(q));
          const requests = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          })) as JoinRequest[];
          
          // Sort client-side
          requests.sort((a, b) => {
            const aTime = a.createdAt instanceof Date ? a.getTime() : (a.createdAt as any)?.toDate?.()?.getTime() || 0;
            const bTime = b.createdAt instanceof Date ? b.getTime() : (b.createdAt as any)?.toDate?.()?.getTime() || 0;
            return bTime - aTime; // Descending
          });
          
          console.log(`✅ Loaded ${requests.length} pending requests (without orderBy, sorted client-side)`);
          return requests;
        }
        throw orderByError;
      }
    } catch (error) {
      console.error('❌ Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Approve a join request and create user document
   */
  static async approveRequest(
    uid: string,
    approvedBy: string
  ): Promise<void> {
    try {
      console.log('✅ Approving join request for:', uid);
      
      // Get the join request
      const request = await this.getJoinRequest(uid);
      if (!request) {
        throw new Error('Join request not found');
      }
      
      if (request.status !== 'pending') {
        throw new Error(`Request is not pending (status: ${request.status})`);
      }

      // Update join request status
      const requestRef = doc(db, 'joinRequests', uid);
      await retryOnNetworkFailure(() => updateDoc(requestRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy
      }));

      // Create user document from join request data
      // Build payload with required fields first
      const userProfilePayload: any = {
        uid,
        email: request.email,
        name: request.name || request.displayName || '',
        displayName: request.displayName || request.name || '',
        phone: request.phone || '',
        company: request.company || '',
        work: request.work || '',
        linkedinUsername: request.linkedinUsername || '',
        position: request.position || '',
        role: 'member',
        status: 'approved',
        profileImage: null,
        avatarUrl: null,
        profileVisibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        joinedAt: serverTimestamp(),
        profileCompletionPercentage: 0,
        lastProfileUpdate: serverTimestamp()
      };

      // Add optional fields only if they exist in the join request
      if (request.bioTitle) {
        userProfilePayload.bioTitle = request.bioTitle;
      }
      if (request.bio) {
        userProfilePayload.bio = request.bio;
      }
      if (request.city) {
        userProfilePayload.city = request.city;
      }
      if (request.country) {
        userProfilePayload.country = request.country;
      }
      if (request.timezone) {
        userProfilePayload.timezone = request.timezone;
      }
      if (request.website) {
        userProfilePayload.website = request.website;
      }
      if (request.twitter) {
        userProfilePayload.twitter = request.twitter;
      }
      if (request.skills && Array.isArray(request.skills) && request.skills.length > 0) {
        userProfilePayload.skills = request.skills;
      }

      // Sanitize the payload to remove any undefined values
      const sanitizedUserProfile = sanitizeForFirestore(userProfilePayload);

      // Create the user document
      const userRef = doc(db, 'users', uid);
      await retryOnNetworkFailure(() => setDoc(userRef, sanitizedUserProfile));

      console.log('✅ User document created from approved join request');
    } catch (error) {
      console.error('❌ Error approving join request:', error);
      throw error;
    }
  }

  /**
   * Reject a join request
   * NOTE: This method is deprecated. Use rejectAndDeleteUser via API endpoint instead.
   * The API endpoint properly deletes the Firebase Auth user, allowing re-signup.
   * 
   * @deprecated Use the server-side rejectAndDeleteUser endpoint instead
   */
  static async rejectRequest(
    uid: string,
    rejectedBy: string
  ): Promise<void> {
    try {
      console.log('❌ Rejecting join request for:', uid);
      console.warn('⚠️ Using deprecated rejectRequest method. Consider using server-side rejectAndDeleteUser endpoint.');
      
      // Get the join request
      const request = await this.getJoinRequest(uid);
      if (!request) {
        throw new Error('Join request not found');
      }

      // Update join request status
      const requestRef = doc(db, 'joinRequests', uid);
      await retryOnNetworkFailure(() => updateDoc(requestRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy
      }));

      // Ensure no user document exists (delete if it does - legacy cleanup)
      const userRef = doc(db, 'users', uid);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (userDoc.exists()) {
        console.log('⚠️ Found legacy user document for rejected user, deleting...');
        await retryOnNetworkFailure(() => deleteDoc(userRef));
        console.log('✅ Legacy user document deleted');
      }

      console.log('✅ Join request rejected and user document ensured not to exist');
      console.warn('⚠️ NOTE: Firebase Auth user was NOT deleted. User cannot re-signup with same email.');
    } catch (error) {
      console.error('❌ Error rejecting join request:', error);
      throw error;
    }
  }

  /**
   * Reject and delete user completely (calls server endpoint)
   * 
   * IMPORTANT: This MUST be done server-side using Firebase Admin SDK because:
   * 1. Client-side code cannot delete Firebase Auth users (security restriction)
   * 2. Only Admin SDK has the permissions to delete Auth accounts
   * 3. This is the ONLY way to free the email for re-signup
   * 
   * This deletes the user from:
   * - Firebase Authentication (critical - frees email)
   * - Firestore joinRequests/{uid}
   * - Firestore users/{uid} (if exists)
   * - Firestore registrations/{uid} (if exists)
   * - All event registrations (if any)
   * 
   * @param uid - User UID to reject and delete
   * @param adminId - Admin user ID performing the action
   * @returns Promise resolving with deletion results when complete
   */
  static async rejectAndDeleteUser(uid: string, adminId: string): Promise<{
    success: boolean;
    message: string;
    details: any;
    email?: string;
    deletedFrom?: string[];
  }> {
    // Validate required parameters
    if (!uid || typeof uid !== 'string' || uid.trim() === '') {
      throw new Error('User UID is required and must be a non-empty string');
    }
    if (!adminId || typeof adminId !== 'string' || adminId.trim() === '') {
      throw new Error('Admin ID is required and must be a non-empty string');
    }

    try {
      const endpointUrl = '/api/user-admin';
      const requestPayload = {
        action: 'reject-and-delete-user',
        uid: uid.trim(),
        adminId: adminId.trim()
      };

      console.log('🗑️ Rejecting and purging user:', uid);
      console.log('🔍 Calling server endpoint:', endpointUrl);
      console.log('🔍 Action:', requestPayload.action);
      console.log('🔍 Request payload:', requestPayload);
      
      if (import.meta.env.DEV) {
        console.log('🔍 Full endpoint URL:', `${window.location.origin}${endpointUrl}`);
        console.log('🔍 Request will be sent to:', endpointUrl);
      }
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('📥 Server response status:', response.status, response.statusText);
      console.log('📥 Server response headers:', Object.fromEntries(response.headers.entries()));

      let data;
      try {
        data = await response.json();
        console.log('📥 Server response data:', data);
      } catch (jsonError) {
        const text = await response.text();
        console.error('❌ Failed to parse JSON response:', text);
        throw new Error(`Server returned invalid JSON: ${text.substring(0, 200)}`);
      }

      if (!response.ok || !data.success) {
        // Log detailed error information
        console.error('❌ Reject and delete failed:', {
          status: response.status,
          error: data.error,
          details: data.details,
          partialSuccess: data.partialSuccess,
          permissionError: data.permissionError,
          serviceAccount: data.serviceAccount,
          projectId: data.projectId
        });
        
        // Check if this is an "Unknown action" error (backend doesn't support the action)
        if (data.error && (data.error.includes('Unknown action') || data.error.includes('reject-and-delete-user'))) {
          const availableActions = data.availableActions || 
                                  (data.error.match(/Available actions: (.+)/)?.[1]) || 
                                  'unknown';
          
          const unknownActionError = new Error(
            `Backend not updated/deployed: reject-and-delete-user action missing. ` +
            `The backend code needs to be redeployed. ` +
            `Available actions on server: ${availableActions}`
          );
          (unknownActionError as any).unknownAction = true;
          (unknownActionError as any).availableActions = availableActions;
          (unknownActionError as any).receivedAction = data.receivedAction || 'reject-and-delete-user';
          throw unknownActionError;
        }
        
        // Check if this is a permission error
        if (data.permissionError) {
          const permissionError = new Error(
            `Backend lacks permission to delete Firebase Auth users. ` +
            `Service account: ${data.serviceAccount || 'Unknown'}. ` +
            `Required role: ${data.requiredRole || 'Firebase Authentication Admin'}. ` +
            `Project: ${data.projectId || 'Unknown'}. ` +
            `See FIREBASE_AUTH_DELETION_PERMISSIONS.md for setup instructions.`
          );
          (permissionError as any).permissionError = true;
          (permissionError as any).serviceAccount = data.serviceAccount;
          (permissionError as any).projectId = data.projectId;
          (permissionError as any).requiredRole = data.requiredRole;
          throw permissionError;
        }
        
        // Check if Auth deletion failed (critical)
        if (data.details && !data.details.authUserDeleted) {
          throw new Error(
            `Failed to delete Firebase Auth user: ${data.error || 'Unknown error'}. ` +
            `The user may not be able to re-signup with the same email. ` +
            `Please check server logs for details.`
          );
        }
        
        throw new Error(data.error || 'Failed to reject and delete user');
      }

      // Verify deletion results
      if (data.details) {
        console.log('✅ Deletion results:', {
          joinRequestDeleted: data.details.joinRequestDeleted,
          userDocDeleted: data.details.userDocDeleted,
          authUserDeleted: data.details.authUserDeleted
        });
        
        if (!data.details.authUserDeleted) {
          console.error('⚠️ WARNING: Firebase Auth user was NOT deleted!');
          throw new Error('Firebase Auth user deletion failed. User cannot re-signup with the same email.');
        }
      }

      console.log('✅ User rejected and deleted successfully:', data.message);
      
      // Log warnings if any
      if (data.warnings && data.warnings.length > 0) {
        console.warn('⚠️ Warnings during deletion:', data.warnings);
      }
      
      // Return the data so the UI can use it
      return {
        success: data.success,
        message: data.message,
        details: data.details,
        email: data.email,
        deletedFrom: data.deletedFrom
      };
    } catch (error: any) {
      console.error('❌ Error rejecting and deleting user:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if a user has an approved join request
   */
  static async isApproved(uid: string): Promise<boolean> {
    try {
      const request = await this.getJoinRequest(uid);
      if (!request) return false;
      return request.status === 'approved';
    } catch (error) {
      console.error('❌ Error checking approval status:', error);
      return false;
    }
  }

  /**
   * Get approval status for a user
   */
  static async getApprovalStatus(uid: string): Promise<'pending' | 'approved' | 'rejected' | 'none'> {
    try {
      const request = await this.getJoinRequest(uid);
      if (!request) return 'none';
      return request.status;
    } catch (error) {
      console.error('❌ Error getting approval status:', error);
      return 'none';
    }
  }
}
