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
import { db, retryOnNetworkFailure, auth } from '../firebase/config';
import { nanoid } from 'nanoid';
import { ConnectionRequest, ConnectionRequestStatus } from '../types/connection';
import { PrivacyService } from './privacyService';
import { ConnectionService, ConnectionReason } from './connectionService';

export class ConnectionRequestService {
  /**
   * Send a connection request to another user (via backend API)
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
      // Get authentication token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to send connection requests');
      }

      const idToken = await currentUser.getIdToken();

      // Call backend API to create connection request
      const response = await fetch('/api/connection-request/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetId: toUid,
          eventId: options.eventId,
          message: options.message
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to create connection request`);
      }

      console.log('✅ Connection request sent via API:', data.requestId);
      return data.requestId;

    } catch (error: any) {
      console.error('❌ Error sending connection request:', error);
      throw error;
    }
  }

  /**
   * Respond to a connection request (via backend API)
   */
  static async respondToRequest(
    requestId: string,
    response: 'accepted' | 'rejected',
    respondingUserId: string
  ): Promise<void> {
    try {
      // Get authentication token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to respond to connection requests');
      }

      const idToken = await currentUser.getIdToken();

      // Call backend API to respond to request
      const action = response === 'accepted' ? 'accept' : 'reject';
      const apiResponse = await fetch('/api/connection-request/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          requestId,
          action
        })
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${apiResponse.status}: Failed to respond to connection request`);
      }

      console.log('✅ Connection request responded to via API:', requestId, response);
      if (response === 'accepted' && data.connectionCreated) {
        console.log('✅ Connection created from accepted request:', requestId);
      }

    } catch (error: any) {
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