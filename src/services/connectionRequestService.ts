import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { nanoid } from 'nanoid';
import { ConnectionRequest, ConnectionRequestStatus } from '../types/connection';
import { PrivacyService } from './privacyService';
import { ConnectionService, ConnectionReason } from './connectionService';

export class ConnectionRequestService {
  /**
   * Send a connection request to another user
   */
  static async sendConnectionRequest(
    fromUid: string,
    toUid: string,
    options: {
      eventId?: string;
      message?: string;
    } = {}
  ): Promise<string> {
    try {
      // Check rate limit
      const rateLimitCheck = await PrivacyService.checkAndIncrementRateLimit(fromUid);
      if (!rateLimitCheck.allowed) {
        throw new Error('Daily connection request limit reached (50/day). Please try again tomorrow.');
      }

      // Check if users are the same
      if (fromUid === toUid) {
        throw new Error('Cannot send connection request to yourself');
      }

      // Check if connection already exists
      const existingConnection = await ConnectionService.checkExistingConnection(
        fromUid, toUid, options.eventId || ''
      );
      if (existingConnection) {
        throw new Error('You are already connected with this user');
      }

      // Check if request already exists
      const existingRequest = await this.checkExistingRequest(fromUid, toUid, options.eventId);
      if (existingRequest) {
        throw new Error('Connection request already sent to this user');
      }

      // Get sender's user data for enrichment
      const senderDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', fromUid)));
      if (!senderDoc.exists()) {
        throw new Error('Sender user not found');
      }
      const senderData = senderDoc.data();

      // Verify receiver exists and can be discovered
      const receiverDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', toUid)));
      if (!receiverDoc.exists()) {
        throw new Error('Target user not found');
      }

      // Check privacy settings
      const sharedEventIds = options.eventId ? [options.eventId] : [];
      const canDiscover = await PrivacyService.canUserBeDiscovered(toUid, fromUid, sharedEventIds);
      if (!canDiscover) {
        throw new Error('This user cannot be contacted based on their privacy settings');
      }

      // Create connection request
      const requestId = nanoid(12);
      const request: ConnectionRequest = {
        id: requestId,
        fromUid,
        toUid,
        eventId: options.eventId,
        message: options.message,
        status: 'pending',
        createdAt: new Date(),
        
        // Enriched sender data
        fromName: senderData.displayName || senderData.name || 'Unknown User',
        fromWork: senderData.work || 'Not specified',
        fromPosition: senderData.position || '',
        fromProfileImage: senderData.profileImage || null
      };

      // Convert to Firestore format
      const firestoreRequest = {
        ...request,
        createdAt: serverTimestamp()
      };

      await retryOnNetworkFailure(() => 
        setDoc(doc(db, 'connection_requests', requestId), firestoreRequest)
      );

      console.log('✅ Connection request sent:', requestId);
      return requestId;

    } catch (error) {
      console.error('❌ Error sending connection request:', error);
      throw error;
    }
  }

  /**
   * Respond to a connection request
   */
  static async respondToRequest(
    requestId: string,
    response: 'accepted' | 'rejected',
    respondingUserId: string
  ): Promise<void> {
    try {
      const requestDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connection_requests', requestId))
      );

      if (!requestDoc.exists()) {
        throw new Error('Connection request not found');
      }

      const requestData = requestDoc.data() as ConnectionRequest & { createdAt: any };
      
      // Verify this user can respond to this request
      if (requestData.toUid !== respondingUserId) {
        throw new Error('You are not authorized to respond to this request');
      }

      // Check if already responded
      if (requestData.status !== 'pending') {
        throw new Error('This request has already been responded to');
      }

      // Update request status
      await retryOnNetworkFailure(() => updateDoc(doc(db, 'connection_requests', requestId), {
        status: response,
        respondedAt: serverTimestamp()
      }));

      // If accepted, create the connection
      if (response === 'accepted') {
        const reason: Omit<ConnectionReason, 'timestamp'> = {
          type: 'user',
          requestId,
          context: 'user-requested connection accepted',
          ...(requestData.eventId && { eventId: requestData.eventId })
        };

        await ConnectionService.createOrUpdateConnection(
          requestData.fromUid, 
          requestData.toUid, 
          reason
        );
        console.log('✅ Connection created from accepted request:', requestId);
      }

      console.log('✅ Connection request responded to:', requestId, response);

    } catch (error) {
      console.error('❌ Error responding to connection request:', error);
      throw error;
    }
  }

  /**
   * Get pending connection requests for a user
   */
  static async getPendingRequests(userId: string): Promise<ConnectionRequest[]> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      const q = query(
        requestsRef,
        where('toUid', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(0),
        respondedAt: doc.data().respondedAt?.toDate()
      })) as ConnectionRequest[];

      return requests;

    } catch (error) {
      console.error('❌ Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Get sent connection requests for a user
   */
  static async getSentRequests(userId: string): Promise<ConnectionRequest[]> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      const q = query(
        requestsRef,
        where('fromUid', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(0),
        respondedAt: doc.data().respondedAt?.toDate()
      })) as ConnectionRequest[];

      return requests;

    } catch (error) {
      console.error('❌ Error getting sent requests:', error);
      return [];
    }
  }

  /**
   * Cancel a sent connection request
   */
  static async cancelRequest(requestId: string, userId: string): Promise<void> {
    try {
      const requestDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connection_requests', requestId))
      );

      if (!requestDoc.exists()) {
        throw new Error('Connection request not found');
      }

      const requestData = requestDoc.data();
      
      // Verify this user can cancel this request
      if (requestData.fromUid !== userId) {
        throw new Error('You are not authorized to cancel this request');
      }

      // Can only cancel pending requests
      if (requestData.status !== 'pending') {
        throw new Error('Can only cancel pending requests');
      }

      // Delete the request
      await retryOnNetworkFailure(() => 
        deleteDoc(doc(db, 'connection_requests', requestId))
      );

      console.log('✅ Connection request cancelled:', requestId);

    } catch (error) {
      console.error('❌ Error cancelling connection request:', error);
      throw error;
    }
  }

  /**
   * Check if connection request already exists
   */
  private static async checkExistingRequest(
    fromUid: string, 
    toUid: string, 
    eventId?: string
  ): Promise<ConnectionRequest | null> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      
      let q = query(
        requestsRef,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      );

      // Add event filter if specified
      if (eventId) {
        q = query(q, where('eventId', '==', eventId));
      }

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(0),
          respondedAt: doc.data().respondedAt?.toDate()
        } as ConnectionRequest;
      }

      return null;

    } catch (error) {
      console.error('❌ Error checking existing request:', error);
      return null;
    }
  }

  /**
   * Get request statistics for admin/debugging
   */
  static async getRequestStats(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  }> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      const snapshot = await retryOnNetworkFailure(() => getDocs(requestsRef));
      
      let total = 0;
      let pending = 0;
      let accepted = 0;
      let rejected = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        total++;
        
        switch (data.status) {
          case 'pending':
            pending++;
            break;
          case 'accepted':
            accepted++;
            break;
          case 'rejected':
            rejected++;
            break;
        }
      });

      return { total, pending, accepted, rejected };

    } catch (error) {
      console.error('❌ Error getting request stats:', error);
      return { total: 0, pending: 0, accepted: 0, rejected: 0 };
    }
  }
}