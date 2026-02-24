import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit
} from 'firebase/firestore';
import { db, retryOnNetworkFailure, auth } from '../firebase/config';
import { ConnectionService, Connection, ConnectionReason } from './connectionService';
import { EventService } from './eventService';

export interface AdminConnectionOptions {
  eventId?: string;
  reason?: string;
  bypassPrivacy?: boolean; // Admin can connect users regardless of privacy settings
  sourceRequestId?: string; // For accept flow - pass requestId to allow non-admin access
}

export interface UserConnectionStats {
  uid: string;
  name: string;
  email: string;
  work: string;
  totalConnections: number;
  autoConnections: number;
  manualConnections: number;
  adminConnections: number;
  registeredEvents: string[];
}

export class AdminConnectionService {
  /**
   * Manually create connection between two users (admin only, via backend API)
   */
  static async createAdminConnection(
    fromUid: string,
    toUid: string,
    adminUid: string,
    options: AdminConnectionOptions = {}
  ): Promise<string> {
    // Log entry (DEV only)
    if (import.meta.env.DEV) {
      console.log('[ADMIN_CONNECT_USED] ENTRY', {
        userA: fromUid,
        userB: toUid,
        adminUid,
        eventId: options.eventId,
        reason: options.reason,
        sourceRequestId: (options as any).sourceRequestId,
        source: 'AdminConnectionService.createAdminConnection',
        endpoint: '/api/connections/admin-create',
        note: 'Admin connection creator called - will return connectionId'
      });
    }
    
    try {
      // Get authentication token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to create admin connections');
      }

      const idToken = await currentUser.getIdToken();

      // Call backend API to create admin connection
      const response = await fetch('/api/connections/admin-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userIdA: fromUid,
          userIdB: toUid,
          eventId: options.eventId,
          reason: options.reason || 'Admin-created connection',
          sourceRequestId: (options as any).sourceRequestId // Pass through if provided (for accept flow)
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        // API returned error - throw with details
        const errorMsg = data.error || `HTTP ${response.status}: Failed to create admin connection`;
        console.error('[AdminConnectionService] API returned error', {
          status: response.status,
          error: errorMsg,
          response: data,
          fromUid,
          toUid
        });
        throw new Error(`Admin connect failed: ${errorMsg}`);
      }

      // CRITICAL: connectionId MUST be non-null string
      if (!data.connectionId || typeof data.connectionId !== 'string' || data.connectionId.length === 0) {
        console.error('[AdminConnectionService] CRITICAL: API returned invalid connectionId', {
          response: data,
          connectionId: data.connectionId,
          connectionIdType: typeof data.connectionId,
          connectionIdIsNull: data.connectionId === null,
          connectionIdIsUndefined: data.connectionId === undefined,
          fromUid,
          toUid
        });
        throw new Error(`Admin connect failed: API returned invalid connectionId (${data.connectionId === null ? 'null' : data.connectionId === undefined ? 'undefined' : `type: ${typeof data.connectionId}`}). Check [ADMIN_CONNECT_RETURN] log.`);
      }

      // Log successful return (DEV only)
      if (import.meta.env.DEV) {
        console.log('[ADMIN_CONNECT_USED] SUCCESS', {
          userA: fromUid,
          userB: toUid,
          adminUid,
          connectionId: data.connectionId,
          connectionPath: data.connectionPath,
          created: data.created,
          existed: data.existed,
          eventId: options.eventId,
          reason: options.reason,
          source: 'AdminConnectionService.createAdminConnection',
          endpoint: '/api/connections/admin-create',
          note: 'connectionId is non-null and will be returned'
        });
      }

      // Log return value RIGHT BEFORE returning
      console.log('[ADMIN_CONNECT_RETURN] CLIENT', {
        connectionId: data.connectionId,
        connectionPath: data.connectionPath,
        connectionIdType: typeof data.connectionId,
        connectionIdIsNull: data.connectionId === null,
        connectionIdIsUndefined: data.connectionId === undefined,
        connectionIdLength: data.connectionId.length,
        note: 'AdminConnectionService.createAdminConnection returning connectionId RIGHT NOW'
      });

      console.log('✅ Admin connection created via API:', {
        connectionId: data.connectionId,
        connectionPath: data.connectionPath,
        fromUid,
        toUid,
        adminUid,
        created: data.created,
        existed: data.existed,
        eventId: options.eventId,
        reason: options.reason
      });

      // Return connectionId - guaranteed non-null at this point
      return data.connectionId;

    } catch (error: any) {
      console.error('❌ Error creating admin connection:', error);
      
      // Log error with context (DEV only)
      if (import.meta.env.DEV) {
        console.error('[ADMIN_CONNECT_RETURN] ERROR PATH', {
          error: error.message,
          fromUid,
          toUid,
          adminUid,
          note: 'AdminConnectionService.createAdminConnection threw error - NOT returning null, throwing error instead'
        });
      }
      
      // Re-throw error - NEVER return null
      throw error;
    }
  }

  /**
   * Get connection statistics for all users (admin overview)
   */
  static async getUserConnectionStats(limit: number = 100): Promise<UserConnectionStats[]> {
    try {
      // Get all users
      const usersSnapshot = await retryOnNetworkFailure(() => 
        getDocs(collection(db, 'users'))
      );
      
      const userStats: UserConnectionStats[] = [];

      // Get all connections to analyze
      const connectionsSnapshot = await retryOnNetworkFailure(() => 
        getDocs(collection(db, 'connections'))
      );
      const allConnections = connectionsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Connection[];

      // Process each user
      for (const userDoc of usersSnapshot.docs.slice(0, limit)) {
        const userData = userDoc.data();
        const uid = userDoc.id;

        // Count connections for this user
        const userConnections = allConnections.filter(conn => 
          conn.fromUid === uid || conn.toUid === uid
        );

        // Count by connection type: by event (auto), by request (manual), by admin (admin)
        let autoConnections = 0;
        let manualConnections = 0;
        let adminConnections = 0;

        userConnections.forEach(conn => {
          switch (conn.connectionType) {
            case 'auto':
              autoConnections++;
              break;
            case 'manual':
              manualConnections++;
              break;
            case 'admin':
              adminConnections++;
              break;
            default:
              break;
          }
        });

        // Get registered events
        const registeredEvents = await this.getUserRegisteredEventIds(uid);

        userStats.push({
          uid,
          name: userData.displayName || userData.name || 'Unknown User',
          email: userData.email || '',
          work: userData.work || 'Not specified',
          totalConnections: userConnections.length,
          autoConnections,
          manualConnections,
          adminConnections,
          registeredEvents
        });
      }

      // Sort by total connections desc
      userStats.sort((a, b) => b.totalConnections - a.totalConnections);

      return userStats;

    } catch (error) {
      console.error('❌ Error getting user connection stats:', error);
      return [];
    }
  }

  /**
   * Get detailed connections for a specific user (admin view)
   */
  static async getUserDetailedConnections(userId: string): Promise<{
    user: any;
    connections: (Connection & { partnerInfo: any })[];
    events: any[];
  }> {
    try {
      // Get user info
      const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', userId)));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();

      // Get user's connections
      const userConnections = await ConnectionService.getUserConnections(userId);

      // Enrich connections with partner info
      const enrichedConnections = [];
      for (const connection of userConnections) {
        const partnerUid = connection.fromUid === userId ? connection.toUid : connection.fromUid;
        const partnerDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', partnerUid)));
        
        const partnerInfo = partnerDoc.exists() ? {
          uid: partnerUid,
          name: partnerDoc.data().displayName || partnerDoc.data().name || 'Unknown',
          email: partnerDoc.data().email || '',
          work: partnerDoc.data().work || '',
          profileImage: partnerDoc.data().profileImage || null
        } : null;

        enrichedConnections.push({
          ...connection,
          partnerInfo
        });
      }

      // Get user's registered events
      const registeredEventIds = await this.getUserRegisteredEventIds(userId);
      const events = [];
      for (const eventId of registeredEventIds) {
        const event = await EventService.getEventById(eventId);
        if (event) {
          events.push(event);
        }
      }

      return {
        user: userData,
        connections: enrichedConnections,
        events
      };

    } catch (error) {
      console.error('❌ Error getting user detailed connections:', error);
      throw error;
    }
  }

  /**
   * Search users for admin connection creation
   */
  static async searchUsersForConnection(
    searchQuery: string,
    excludeUserIds: string[] = [],
    eventId?: string
  ): Promise<Array<{
    uid: string;
    name: string;
    email: string;
    work: string;
    position?: string;
    profileImage?: string;
    isRegisteredForEvent?: boolean;
    connectionCount: number;
  }>> {
    try {
      const usersSnapshot = await retryOnNetworkFailure(() => 
        getDocs(collection(db, 'users'))
      );

      const candidates = [];
      const query = searchQuery.toLowerCase().trim();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const uid = userDoc.id;

        // Skip excluded users
        if (excludeUserIds.includes(uid)) continue;

        // Apply search filter
        const name = (userData.displayName || userData.name || '').toLowerCase();
        const email = (userData.email || '').toLowerCase();
        const work = (userData.work || '').toLowerCase();

        if (query && !name.includes(query) && !email.includes(query) && !work.includes(query)) {
          continue;
        }

        // Check if registered for specific event
        let isRegisteredForEvent = false;
        if (eventId) {
          try {
            const registration = await EventService.getUserRegistration(eventId, uid);
            isRegisteredForEvent = !!registration;
          } catch (error) {
            // Skip registration check error
          }
        }

        // Get connection count
        const userConnections = await ConnectionService.getUserConnections(uid);

        candidates.push({
          uid,
          name: userData.displayName || userData.name || 'Unknown User',
          email: userData.email || '',
          work: userData.work || 'Not specified',
          position: userData.position || '',
          profileImage: userData.profileImage || null,
          isRegisteredForEvent,
          connectionCount: userConnections.length
        });
      }

      // Sort by relevance (registered for event first, then by name)
      candidates.sort((a, b) => {
        if (eventId) {
          if (a.isRegisteredForEvent && !b.isRegisteredForEvent) return -1;
          if (!a.isRegisteredForEvent && b.isRegisteredForEvent) return 1;
        }
        return a.name.localeCompare(b.name);
      });

      return candidates.slice(0, 50); // Limit results

    } catch (error) {
      console.error('❌ Error searching users for connection:', error);
      return [];
    }
  }

  /**
   * Bulk connect users within an event (admin utility)
   */
  static async bulkConnectEventUsers(
    eventId: string,
    adminUid: string,
    options: { 
      connectAll?: boolean; 
      specificUserIds?: string[];
      reason?: string;
    } = {}
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    try {
      const { connectAll = false, specificUserIds = [], reason } = options;

      // Get event registrations
      const registrations = await EventService.getEventRegistrations(eventId);
      if (registrations.length === 0) {
        return { created: 0, skipped: 0, errors: ['No registrations found for event'] };
      }

      // Get user IDs to connect
      let userIds: string[];
      if (connectAll) {
        userIds = registrations.map((reg, index) => {
          // Handle both document ID and nested uid field
          return reg.uid || Object.keys(registrations)[index] || '';
        }).filter(Boolean);
      } else {
        userIds = specificUserIds;
      }

      if (userIds.length < 2) {
        return { created: 0, skipped: 0, errors: ['Need at least 2 users to create connections'] };
      }

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Create connections between all pairs
      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          const fromUid = userIds[i];
          const toUid = userIds[j];

          try {
            // Check if connection already exists
            const existing = await ConnectionService.checkExistingConnection(fromUid, toUid, eventId);
            if (existing) {
              skipped++;
              continue;
            }

            // Create admin connection
            await this.createAdminConnection(fromUid, toUid, adminUid, {
              eventId,
              reason: reason || 'Bulk admin connection'
            });

            created++;

          } catch (error) {
            errors.push(`Failed to connect ${fromUid} and ${toUid}: ${error.message}`);
          }
        }
      }

      console.log('✅ Bulk admin connections completed:', { created, skipped, errors: errors.length });

      return { created, skipped, errors };

    } catch (error) {
      console.error('❌ Error in bulk admin connections:', error);
      return { created: 0, skipped: 0, errors: [error.message] };
    }
  }

  /**
   * Remove connection between users (admin only)
   */
  static async removeConnection(
    connectionId: string,
    adminUid: string,
    reason?: string
  ): Promise<void> {
    try {
      // Validate connection exists
      const connectionDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connections', connectionId))
      );

      if (!connectionDoc.exists()) {
        throw new Error('Connection not found');
      }

      const connectionData = connectionDoc.data();

      // Log admin action before deletion
      console.log('⚠️ Admin removing connection:', {
        connectionId,
        fromUid: connectionData.fromUid,
        toUid: connectionData.toUid,
        adminUid,
        reason
      });

      // Use existing ConnectionService method if available, or implement deletion
      // For now, we'll reference the doc but not delete it directly
      // You may want to add a soft delete or archive mechanism
      
      throw new Error('Connection removal not implemented - consider archiving instead');

    } catch (error) {
      console.error('❌ Error removing connection:', error);
      throw error;
    }
  }

  /**
   * Get user's registered event IDs (helper method)
   */
  private static async getUserRegisteredEventIds(userId: string): Promise<string[]> {
    try {
      const events = await EventService.getPublicEvents();
      const registeredEventIds: string[] = [];
      
      for (const event of events) {
        try {
          const registration = await EventService.getUserRegistration(event.id, userId);
          if (registration) {
            registeredEventIds.push(event.id);
          }
        } catch (error) {
          // Skip individual event errors
          console.warn('⚠️ Error checking registration for event:', event.id, error);
        }
      }
      
      return registeredEventIds;
    } catch (error) {
      console.error('❌ Error getting user registered events:', error);
      return [];
    }
  }

  /**
   * Get admin dashboard connection stats
   */
  static async getAdminDashboardStats(): Promise<{
    totalConnections: number;
    autoConnections: number;
    manualConnections: number;
    adminConnections: number;
    activeUsers: number;
    connectionsToday: number;
  }> {
    try {
      // Get all connections
      const connectionsSnapshot = await retryOnNetworkFailure(() => 
        getDocs(collection(db, 'connections'))
      );
      const connections = connectionsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Connection[];

      // Count by type: by event (auto), by request (manual), by admin (admin)
      let autoConnections = 0;
      let manualConnections = 0;
      let adminConnections = 0;
      let connectionsToday = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      connections.forEach(conn => {
        switch (conn.connectionType) {
          case 'auto':
            autoConnections++;
            break;
          case 'manual':
            manualConnections++;
            break;
          case 'admin':
            adminConnections++;
            break;
          default:
            break;
        }
        const connDate = conn.timestamp?.toDate?.() || new Date(0);
        if (connDate >= today) {
          connectionsToday++;
        }
      });

      const activeUserIds = new Set<string>();
      connections.forEach(conn => {
        activeUserIds.add(conn.fromUid);
        activeUserIds.add(conn.toUid);
      });

      return {
        totalConnections: connections.length,
        autoConnections,
        manualConnections,
        adminConnections,
        activeUsers: activeUserIds.size,
        connectionsToday
      };
    } catch (error) {
      console.error('❌ Error getting admin dashboard stats:', error);
      return {
        totalConnections: 0,
        autoConnections: 0,
        manualConnections: 0,
        adminConnections: 0,
        activeUsers: 0,
        connectionsToday: 0
      };
    }
  }

  /**
   * Get all connections for CSV export (admin only).
   * Returns rows with connection id, user ids, names, emails, type, date.
   */
  static async getConnectionsForExport(): Promise<{
    id: string;
    fromUid: string;
    toUid: string;
    fromName: string;
    toName: string;
    fromEmail: string;
    toEmail: string;
    connectionType: string;
    date: string;
  }[]> {
    const connectionsSnapshot = await retryOnNetworkFailure(() =>
      getDocs(collection(db, 'connections'))
    );
    const connections = connectionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as (Connection & { fromUid?: string; toUid?: string; connectionType?: string; timestamp?: any })[];
    const userIds = new Set<string>();
    connections.forEach(c => {
      const from = (c as any).fromUid ?? c.uid1;
      const to = (c as any).toUid ?? c.uid2;
      if (from) userIds.add(from);
      if (to) userIds.add(to);
    });
    const userDocs = new Map<string, { name: string; email: string }>();
    for (const uid of userIds) {
      const snap = await getDoc(doc(db, 'users', uid));
      const d = snap.data();
      userDocs.set(uid, {
        name: d?.name ?? d?.displayName ?? uid,
        email: d?.email ?? ''
      });
    }
    const rows: { id: string; fromUid: string; toUid: string; fromName: string; toName: string; fromEmail: string; toEmail: string; connectionType: string; date: string }[] = [];
    for (const c of connections) {
      const fromUid = (c as any).fromUid ?? c.uid1 ?? '';
      const toUid = (c as any).toUid ?? c.uid2 ?? '';
      const from = userDocs.get(fromUid) ?? { name: fromUid, email: '' };
      const to = userDocs.get(toUid) ?? { name: toUid, email: '' };
      const connType = (c as any).connectionType ?? 'unknown';
      const ts = (c as any).timestamp;
      const date = ts?.toDate?.() ? ts.toDate().toISOString().slice(0, 10) : (ts ? new Date(ts).toISOString().slice(0, 10) : '');
      rows.push({
        id: c.id,
        fromUid,
        toUid,
        fromName: from.name,
        toName: to.name,
        fromEmail: from.email,
        toEmail: to.email,
        connectionType: connType,
        date
      });
    }
    return rows;
  }
}