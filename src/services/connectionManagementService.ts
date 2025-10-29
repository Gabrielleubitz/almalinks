import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { Connection, EnhancedConnection } from '../types/connection';
import { ConnectionService } from './connectionService';

export class ConnectionManagementService {
  /**
   * Get all connections for a specific user (both incoming and outgoing)
   * Uses new connection schema with uid1/uid2 and legacy schema for backwards compatibility
   */
  static async getUserConnections(userId: string, limitCount = 50): Promise<EnhancedConnection[]> {
    try {
      console.log('🔍 Getting connections for user:', userId);
      
      const connectionsRef = collection(db, 'connections');
      
      // NEW SCHEMA: Get connections where user is uid1 or uid2
      const q1 = query(
        connectionsRef,
        where('uid1', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );
      
      const q2 = query(
        connectionsRef,
        where('uid2', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );
      
      // LEGACY SCHEMA: Get connections where user is fromUid or toUid (fallback)
      const q3 = query(
        connectionsRef,
        where('fromUid', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const q4 = query(
        connectionsRef,
        where('toUid', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const [snapshot1, snapshot2, snapshot3, snapshot4] = await Promise.all([
        retryOnNetworkFailure(() => getDocs(q1)).catch(() => ({ docs: [] })),
        retryOnNetworkFailure(() => getDocs(q2)).catch(() => ({ docs: [] })),
        retryOnNetworkFailure(() => getDocs(q3)).catch(() => ({ docs: [] })),
        retryOnNetworkFailure(() => getDocs(q4)).catch(() => ({ docs: [] }))
      ]);
      
      // Process new schema connections
      const newConnections = [...snapshot1.docs, ...snapshot2.docs].map(doc => {
        const data = doc.data() as Connection;
        const otherUserId = data.uid1 === userId ? data.uid2 : data.uid1;
        
        // Convert new schema to legacy format for compatibility
        return {
          id: doc.id,
          fromUid: userId,
          toUid: otherUserId,
          fromName: data.uid1CachedData?.displayName || data.uid1CachedData?.name || 'Unknown User',
          toName: data.uid2CachedData?.displayName || data.uid2CachedData?.name || 'Unknown User',
          fromEmail: data.uid1CachedData?.email || '',
          toEmail: data.uid2CachedData?.email || '',
          timestamp: data.updatedAt,
          connectionType: this.getConnectionTypeFromReasons(data.reasons),
          eventId: this.getEventFromReasons(data.reasons),
          // Store original new schema data for access
          _originalConnection: data
        } as EnhancedConnection;
      });
      
      // Process legacy schema connections
      const legacyConnections = [...snapshot3.docs, ...snapshot4.docs].map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EnhancedConnection[];
      
      // Combine and deduplicate connections
      const allConnections = [...newConnections, ...legacyConnections];
      const uniqueConnections = allConnections.filter((connection, index, self) => 
        index === self.findIndex(c => c.id === connection.id)
      );
      
      // Sort by timestamp (most recent first)
      uniqueConnections.sort((a, b) => {
        const timestampA = a.timestamp instanceof Date ? a.timestamp.getTime() : 
                          a.timestamp?.toDate?.()?.getTime() || 0;
        const timestampB = b.timestamp instanceof Date ? b.timestamp.getTime() : 
                          b.timestamp?.toDate?.()?.getTime() || 0;
        return timestampB - timestampA;
      });
      
      console.log(`✅ Found ${uniqueConnections.length} connections for user:`, userId, '(', newConnections.length, 'new schema,', legacyConnections.length, 'legacy)');
      return uniqueConnections.slice(0, limitCount);
      
    } catch (error) {
      console.error('❌ Error getting user connections:', error);
      return [];
    }
  }
  
  /**
   * Helper to determine connection type from reasons array
   */
  private static getConnectionTypeFromReasons(reasons: any[] = []): string {
    if (!reasons || reasons.length === 0) return 'unknown';
    
    // Check for admin reasons first (highest priority)
    if (reasons.some(r => r.type === 'admin')) return 'admin';
    // Check for event reasons
    if (reasons.some(r => r.type === 'event')) return 'auto';
    // Check for user request reasons
    if (reasons.some(r => r.type === 'user')) return 'manual';
    
    return 'unknown';
  }
  
  /**
   * Helper to get event ID from reasons array
   */
  private static getEventFromReasons(reasons: any[] = []): string {
    if (!reasons || reasons.length === 0) return '';
    
    const eventReason = reasons.find(r => r.type === 'event' || r.type === 'admin');
    return eventReason?.eventId || '';
  }
  
  /**
   * Get connections between two specific users
   */
  static async getConnectionsBetweenUsers(userId1: string, userId2: string): Promise<EnhancedConnection[]> {
    try {
      console.log('🔍 Getting connections between users:', userId1, '↔', userId2);
      
      const connectionsRef = collection(db, 'connections');
      
      // Check connections in both directions
      const q1 = query(
        connectionsRef,
        where('fromUid', '==', userId1),
        where('toUid', '==', userId2)
      );
      
      const q2 = query(
        connectionsRef,
        where('fromUid', '==', userId2),
        where('toUid', '==', userId1)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        retryOnNetworkFailure(() => getDocs(q1)),
        retryOnNetworkFailure(() => getDocs(q2))
      ]);
      
      const connections = [
        ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ] as EnhancedConnection[];
      
      console.log(`✅ Found ${connections.length} connections between users`);
      return connections;
      
    } catch (error) {
      console.error('❌ Error getting connections between users:', error);
      return [];
    }
  }
  
  /**
   * Delete a specific connection by ID
   * For new schema connections with multiple reasons, this removes specific reasons if specified
   */
  static async deleteConnection(connectionId: string, reasonToRemove?: 'admin' | 'event' | 'user'): Promise<void> {
    try {
      console.log('🗑️ Deleting connection:', connectionId, reasonToRemove ? `(reason: ${reasonToRemove})` : '(entire connection)');
      
      const connectionRef = doc(db, 'connections', connectionId);
      
      if (reasonToRemove) {
        // For new schema, try to remove specific reason instead of entire connection
        try {
          const connectionDoc = await retryOnNetworkFailure(() => getDoc(connectionRef));
          if (connectionDoc.exists()) {
            const data = connectionDoc.data() as Connection;
            if (data.reasons && data.reasons.length > 1) {
              // Remove specific reason, keep other reasons
              const updatedReasons = data.reasons.filter(r => r.type !== reasonToRemove);
              await retryOnNetworkFailure(() => updateDoc(connectionRef, {
                reasons: updatedReasons,
                updatedAt: new Date()
              }));
              console.log('✅ Removed reason from connection:', connectionId, reasonToRemove);
              return;
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not update connection reasons, deleting entire connection:', error);
        }
      }
      
      // Delete entire connection (legacy behavior or when only one reason remains)
      await retryOnNetworkFailure(() => deleteDoc(connectionRef));
      console.log('✅ Connection deleted successfully:', connectionId);
      
    } catch (error) {
      console.error('❌ Error deleting connection:', error);
      throw error;
    }
  }
  
  /**
   * Delete all connections between two users (admin function)
   */
  static async deleteAllConnectionsBetweenUsers(
    userId1: string, 
    userId2: string, 
    eventId?: string
  ): Promise<number> {
    try {
      console.log('🗑️ Deleting all connections between users:', userId1, '↔', userId2, eventId ? `(event: ${eventId})` : '(all events)');
      
      let connections = await this.getConnectionsBetweenUsers(userId1, userId2);
      
      // Filter by event if specified
      if (eventId) {
        connections = connections.filter(conn => conn.eventId === eventId);
      }
      
      if (connections.length === 0) {
        console.log('ℹ️ No connections found to delete');
        return 0;
      }
      
      // Delete all found connections
      const deletePromises = connections.map(connection => 
        this.deleteConnection(connection.id)
      );
      
      await Promise.all(deletePromises);
      
      console.log(`✅ Deleted ${connections.length} connections between users`);
      return connections.length;
      
    } catch (error) {
      console.error('❌ Error deleting connections between users:', error);
      throw error;
    }
  }
  
  /**
   * Get connection statistics for a user
   */
  static async getUserConnectionStats(userId: string): Promise<{
    total: number;
    byType: { [key: string]: number };
    byEvent: { [key: string]: number };
  }> {
    try {
      const connections = await this.getUserConnections(userId, 1000); // Get all connections
      
      const stats = {
        total: connections.length,
        byType: {} as { [key: string]: number },
        byEvent: {} as { [key: string]: number }
      };
      
      connections.forEach(connection => {
        // Count by connection type
        const type = connection.connectionType || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        
        // Count by event
        const eventId = connection.eventId || 'unknown';
        stats.byEvent[eventId] = (stats.byEvent[eventId] || 0) + 1;
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting user connection stats:', error);
      return { total: 0, byType: {}, byEvent: {} };
    }
  }
  
  /**
   * Get all connections for an event (admin function)
   */
  static async getEventConnections(eventId: string, limitCount = 100): Promise<EnhancedConnection[]> {
    try {
      console.log('🔍 Getting connections for event:', eventId);
      
      const connectionsRef = collection(db, 'connections');
      const q = query(
        connectionsRef,
        where('eventId', '==', eventId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const connections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EnhancedConnection[];
      
      console.log(`✅ Found ${connections.length} connections for event:`, eventId);
      return connections;
      
    } catch (error) {
      console.error('❌ Error getting event connections:', error);
      return [];
    }
  }
  
  /**
   * Delete all connections for a specific event (admin function)
   */
  static async deleteAllEventConnections(eventId: string): Promise<number> {
    try {
      console.log('🗑️ Deleting all connections for event:', eventId);
      
      const connections = await this.getEventConnections(eventId, 1000);
      
      if (connections.length === 0) {
        console.log('ℹ️ No connections found to delete for event:', eventId);
        return 0;
      }
      
      // Delete all connections in batches
      const BATCH_SIZE = 20;
      let deletedCount = 0;
      
      for (let i = 0; i < connections.length; i += BATCH_SIZE) {
        const batch = connections.slice(i, i + BATCH_SIZE);
        const deletePromises = batch.map(connection => 
          this.deleteConnection(connection.id)
        );
        
        await Promise.all(deletePromises);
        deletedCount += batch.length;
      }
      
      console.log(`✅ Deleted ${deletedCount} connections for event:`, eventId);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Error deleting event connections:', error);
      throw error;
    }
  }
}