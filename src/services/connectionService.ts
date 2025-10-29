import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';

// Connection reason with timestamp and context
export interface ConnectionReason {
  type: 'event' | 'admin' | 'user';
  timestamp: Date; // Use Date instead of Firestore timestamp for arrays
  eventId?: string; // For event-based connections
  adminId?: string; // For admin-created connections
  requestId?: string; // For user-requested connections
  context?: string; // Additional context (e.g., "auto-connect on check-in")
}

// Updated connection interface with multiple reasons
export interface Connection {
  id: string;
  uid1: string; // Always the lexicographically smaller UID
  uid2: string; // Always the lexicographically larger UID
  reasons: ConnectionReason[]; // Array of reasons for this connection
  createdAt: any; // Initial connection timestamp
  updatedAt: any; // Last update timestamp
  // User data cached for display (updated when new reasons are added)
  uid1Name?: string;
  uid2Name?: string;
  uid1Work?: string;
  uid2Work?: string;
  uid1Position?: string;
  uid2Position?: string;
  uid1Linkedin?: string;
  uid2Linkedin?: string;
  uid1Email?: string;
  uid2Email?: string;
  uid1ProfileImage?: string | null;
  uid2ProfileImage?: string | null;
}

// Legacy interface for backward compatibility
export interface LegacyConnection {
  id: string;
  fromUid: string;
  toUid: string;
  eventId: string;
  connectionType?: 'auto' | 'manual' | 'scan';
  timestamp: any;
  fromName?: string;
  toName?: string;
  fromWork?: string;
  toWork?: string;
  fromPosition?: string;
  toPosition?: string;
  fromLinkedin?: string;
  toLinkedin?: string;
  fromEmail?: string;
  toEmail?: string;
  fromProfileImage?: string | null;
  toProfileImage?: string | null;
}

export class ConnectionService {
  // Helper method to generate consistent connection ID from two UIDs
  static generateConnectionId(uid1: string, uid2: string): string {
    const [smaller, larger] = uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
    return `${smaller}_${larger}`;
  }

  // Helper method to normalize UIDs (smaller first)
  static normalizeUids(uid1: string, uid2: string): [string, string] {
    return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
  }

  // Create or update a connection between two users with a new reason
  static async createOrUpdateConnection(
    fromUid: string, 
    toUid: string, 
    reason: Omit<ConnectionReason, 'timestamp'>,
    adminId?: string
  ): Promise<string> {
    try {
      // Normalize UIDs for consistent storage
      const [uid1, uid2] = this.normalizeUids(fromUid, toUid);
      const connectionId = this.generateConnectionId(uid1, uid2);

      // Check if users exist
      const [uid1Doc, uid2Doc] = await Promise.all([
        retryOnNetworkFailure(() => getDoc(doc(db, 'users', uid1))),
        retryOnNetworkFailure(() => getDoc(doc(db, 'users', uid2)))
      ]);
      
      if (!uid1Doc.exists()) {
        throw new Error(`User not found: ${uid1}`);
      }
      
      if (!uid2Doc.exists()) {
        throw new Error(`User not found: ${uid2}`);
      }

      // Get existing connection if it exists
      const existingConnectionDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connections', connectionId))
      );

      const uid1Data = uid1Doc.data();
      const uid2Data = uid2Doc.data();
      const reasonTimestamp = new Date(); // Client timestamp for reasons (can't use serverTimestamp in arrays)
      const serverNow = serverTimestamp(); // Server timestamp for main fields

      // Create the new reason
      const newReason: ConnectionReason = {
        ...reason,
        timestamp: reasonTimestamp,
        ...(adminId && { adminId })
      };

      let connection: Connection;

      if (existingConnectionDoc.exists()) {
        // Update existing connection
        const existingConnection = existingConnectionDoc.data() as Connection;
        
        // Check if this exact reason already exists
        const reasonExists = existingConnection.reasons.some(r => 
          r.type === reason.type && 
          r.eventId === reason.eventId &&
          r.adminId === adminId &&
          r.requestId === reason.requestId
        );

        if (reasonExists) {
          console.log('✅ Connection reason already exists:', connectionId);
          return connectionId;
        }

        // Add new reason to existing connection
        connection = {
          ...existingConnection,
          reasons: [...existingConnection.reasons, newReason],
          updatedAt: serverNow,
          // Update cached user data in case it changed
          uid1Name: uid1Data.displayName || uid1Data.name || '',
          uid2Name: uid2Data.displayName || uid2Data.name || '',
          uid1Work: uid1Data.work || '',
          uid2Work: uid2Data.work || '',
          uid1Position: uid1Data.position || '',
          uid2Position: uid2Data.position || '',
          uid1Linkedin: uid1Data.linkedinUsername || '',
          uid2Linkedin: uid2Data.linkedinUsername || '',
          uid1Email: uid1Data.email || '',
          uid2Email: uid2Data.email || '',
          uid1ProfileImage: uid1Data.profileImage || null,
          uid2ProfileImage: uid2Data.profileImage || null
        };

        console.log('🔄 Updated existing connection with new reason:', connectionId);
      } else {
        // Create new connection
        connection = {
          id: connectionId,
          uid1,
          uid2,
          reasons: [newReason],
          createdAt: serverNow,
          updatedAt: serverNow,
          // Cache user data for display
          uid1Name: uid1Data.displayName || uid1Data.name || '',
          uid2Name: uid2Data.displayName || uid2Data.name || '',
          uid1Work: uid1Data.work || '',
          uid2Work: uid2Data.work || '',
          uid1Position: uid1Data.position || '',
          uid2Position: uid2Data.position || '',
          uid1Linkedin: uid1Data.linkedinUsername || '',
          uid2Linkedin: uid2Data.linkedinUsername || '',
          uid1Email: uid1Data.email || '',
          uid2Email: uid2Data.email || '',
          uid1ProfileImage: uid1Data.profileImage || null,
          uid2ProfileImage: uid2Data.profileImage || null
        };

        console.log('✅ Created new connection:', connectionId);
      }
      
      // Save to Firestore
      await retryOnNetworkFailure(() => 
        setDoc(doc(db, 'connections', connectionId), connection)
      );
      
      return connectionId;
    } catch (error) {
      console.error('❌ Error creating/updating connection:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  static async createConnection(
    fromUid: string, 
    toUid: string, 
    eventId: string,
    connectionType: 'auto' | 'manual' | 'scan' = 'scan'
  ): Promise<string> {
    // Map legacy connection type to reason type
    let reasonType: 'event' | 'admin' | 'user';
    let context: string;
    
    switch (connectionType) {
      case 'auto':
        reasonType = 'event';
        context = 'auto-connect on event';
        break;
      case 'manual':
        reasonType = 'admin';
        context = 'manual admin connection';
        break;
      case 'scan':
      default:
        reasonType = 'user';
        context = 'user-initiated connection';
        break;
    }

    const reason: Omit<ConnectionReason, 'timestamp'> = {
      type: reasonType,
      eventId,
      context
    };

    return this.createOrUpdateConnection(fromUid, toUid, reason);
  }
  
  // Check if a connection exists between two users (regardless of event)
  static async checkExistingConnection(uid1: string, uid2: string): Promise<Connection | null> {
    try {
      const connectionId = this.generateConnectionId(uid1, uid2);
      const connectionDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connections', connectionId))
      );
      
      if (connectionDoc.exists()) {
        return { id: connectionDoc.id, ...connectionDoc.data() } as Connection;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error checking existing connection:', error);
      return null;
    }
  }

  // Check if a connection exists for a specific event
  static async checkExistingConnectionForEvent(uid1: string, uid2: string, eventId: string): Promise<boolean> {
    try {
      const connection = await this.checkExistingConnection(uid1, uid2);
      
      if (!connection) return false;
      
      // Check if any reason is for this specific event
      return connection.reasons.some(reason => 
        reason.type === 'event' && reason.eventId === eventId
      );
    } catch (error) {
      console.error('❌ Error checking connection for event:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility (checks specific event)
  static async checkExistingConnection_Legacy(fromUid: string, toUid: string, eventId: string): Promise<LegacyConnection | null> {
    try {
      const connection = await this.checkExistingConnection(fromUid, toUid);
      
      if (!connection) return null;
      
      // Find the event-specific reason
      const eventReason = connection.reasons.find(reason => 
        reason.type === 'event' && reason.eventId === eventId
      );
      
      if (!eventReason) return null;
      
      // Convert to legacy format for backward compatibility
      const [uid1, uid2] = this.normalizeUids(fromUid, toUid);
      const isFromUid1 = fromUid === uid1;
      
      return {
        id: connection.id,
        fromUid,
        toUid,
        eventId,
        connectionType: eventReason.type === 'event' ? 'auto' : 
                       eventReason.type === 'admin' ? 'manual' : 'scan',
        timestamp: eventReason.timestamp,
        fromName: isFromUid1 ? connection.uid1Name : connection.uid2Name,
        toName: isFromUid1 ? connection.uid2Name : connection.uid1Name,
        fromWork: isFromUid1 ? connection.uid1Work : connection.uid2Work,
        toWork: isFromUid1 ? connection.uid2Work : connection.uid1Work,
        fromPosition: isFromUid1 ? connection.uid1Position : connection.uid2Position,
        toPosition: isFromUid1 ? connection.uid2Position : connection.uid1Position,
        fromLinkedin: isFromUid1 ? connection.uid1Linkedin : connection.uid2Linkedin,
        toLinkedin: isFromUid1 ? connection.uid2Linkedin : connection.uid1Linkedin,
        fromEmail: isFromUid1 ? connection.uid1Email : connection.uid2Email,
        toEmail: isFromUid1 ? connection.uid2Email : connection.uid1Email,
        fromProfileImage: isFromUid1 ? connection.uid1ProfileImage : connection.uid2ProfileImage,
        toProfileImage: isFromUid1 ? connection.uid2ProfileImage : connection.uid1ProfileImage
      };
    } catch (error) {
      console.error('❌ Error checking existing connection (legacy):', error);
      return null;
    }
  }
  
  // Get all connections for a user
  static async getUserConnections(userId: string, limitCount = 50): Promise<Connection[]> {
    try {
      const connectionsRef = collection(db, 'connections');
      
      // Get connections where user is either uid1 or uid2
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
      
      const [snapshot1, snapshot2] = await Promise.all([
        retryOnNetworkFailure(() => getDocs(q1)),
        retryOnNetworkFailure(() => getDocs(q2))
      ]);
      
      // Combine results
      const connections: Connection[] = [];
      
      snapshot1.forEach(doc => {
        const data = doc.data();
        console.log('📸 Connection where user is uid1:', {
          id: doc.id,
          uid1ProfileImage: data.uid1ProfileImage,
          uid2ProfileImage: data.uid2ProfileImage
        });
        connections.push({ id: doc.id, ...data } as Connection);
      });
      
      snapshot2.forEach(doc => {
        const data = doc.data();
        console.log('📸 Connection where user is uid2:', {
          id: doc.id,
          uid1ProfileImage: data.uid1ProfileImage,
          uid2ProfileImage: data.uid2ProfileImage
        });
        connections.push({ id: doc.id, ...data } as Connection);
      });
      
      // Sort by updatedAt (newest first)
      connections.sort((a, b) => {
        const timeA = a.updatedAt?.toDate?.() || new Date(0);
        const timeB = b.updatedAt?.toDate?.() || new Date(0);
        return timeB.getTime() - timeA.getTime();
      });
      
      // Remove duplicates (if any)
      const uniqueConnections = connections.filter((connection, index, self) =>
        index === self.findIndex(c => c.id === connection.id)
      );
      
      return uniqueConnections.slice(0, limitCount);
    } catch (error) {
      console.error('❌ Error fetching user connections:', error);
      return [];
    }
  }

  // Get legacy format connections for backward compatibility
  static async getUserConnectionsLegacy(userId: string, limitCount = 50): Promise<LegacyConnection[]> {
    try {
      const connections = await this.getUserConnections(userId, limitCount);
      const legacyConnections: LegacyConnection[] = [];
      
      connections.forEach(connection => {
        // For each connection, create legacy entries for each reason that involves this user
        connection.reasons.forEach(reason => {
          const isUid1 = userId === connection.uid1;
          const otherUid = isUid1 ? connection.uid2 : connection.uid1;
          
          legacyConnections.push({
            id: `${connection.id}_${reason.type}_${reason.eventId || 'general'}`,
            fromUid: userId,
            toUid: otherUid,
            eventId: reason.eventId || '',
            connectionType: reason.type === 'event' ? 'auto' : 
                           reason.type === 'admin' ? 'manual' : 'scan',
            timestamp: reason.timestamp,
            fromName: isUid1 ? connection.uid1Name : connection.uid2Name,
            toName: isUid1 ? connection.uid2Name : connection.uid1Name,
            fromWork: isUid1 ? connection.uid1Work : connection.uid2Work,
            toWork: isUid1 ? connection.uid2Work : connection.uid1Work,
            fromPosition: isUid1 ? connection.uid1Position : connection.uid2Position,
            toPosition: isUid1 ? connection.uid2Position : connection.uid1Position,
            fromLinkedin: isUid1 ? connection.uid1Linkedin : connection.uid2Linkedin,
            toLinkedin: isUid1 ? connection.uid2Linkedin : connection.uid1Linkedin,
            fromEmail: isUid1 ? connection.uid1Email : connection.uid2Email,
            toEmail: isUid1 ? connection.uid2Email : connection.uid1Email,
            fromProfileImage: isUid1 ? connection.uid1ProfileImage : connection.uid2ProfileImage,
            toProfileImage: isUid1 ? connection.uid2ProfileImage : connection.uid1ProfileImage
          });
        });
      });
      
      // Sort by timestamp (newest first)
      legacyConnections.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0);
        const timeB = b.timestamp?.toDate?.() || new Date(0);
        return timeB.getTime() - timeA.getTime();
      });
      
      return legacyConnections.slice(0, limitCount);
    } catch (error) {
      console.error('❌ Error fetching user connections (legacy):', error);
      return [];
    }
  }
  
  // Get connections for a user filtered by event
  static async getUserConnectionsByEvent(userId: string, eventId: string): Promise<Connection[]> {
    try {
      const allConnections = await this.getUserConnections(userId);
      
      // Filter connections that have a reason for this specific event
      const eventConnections = allConnections.filter(connection =>
        connection.reasons.some(reason => 
          reason.type === 'event' && reason.eventId === eventId
        )
      );
      
      return eventConnections;
    } catch (error) {
      console.error('❌ Error fetching user connections by event:', error);
      return [];
    }
  }

  // Get legacy format connections for a specific event
  static async getUserConnectionsByEventLegacy(userId: string, eventId: string): Promise<LegacyConnection[]> {
    try {
      const connections = await this.getUserConnectionsByEvent(userId, eventId);
      const legacyConnections: LegacyConnection[] = [];
      
      connections.forEach(connection => {
        // Find the event-specific reason
        const eventReason = connection.reasons.find(reason => 
          reason.type === 'event' && reason.eventId === eventId
        );
        
        if (eventReason) {
          const isUid1 = userId === connection.uid1;
          const otherUid = isUid1 ? connection.uid2 : connection.uid1;
          
          legacyConnections.push({
            id: connection.id,
            fromUid: userId,
            toUid: otherUid,
            eventId,
            connectionType: 'auto', // Event connections are auto
            timestamp: eventReason.timestamp,
            fromName: isUid1 ? connection.uid1Name : connection.uid2Name,
            toName: isUid1 ? connection.uid2Name : connection.uid1Name,
            fromWork: isUid1 ? connection.uid1Work : connection.uid2Work,
            toWork: isUid1 ? connection.uid2Work : connection.uid1Work,
            fromPosition: isUid1 ? connection.uid1Position : connection.uid2Position,
            toPosition: isUid1 ? connection.uid2Position : connection.uid1Position,
            fromLinkedin: isUid1 ? connection.uid1Linkedin : connection.uid2Linkedin,
            toLinkedin: isUid1 ? connection.uid2Linkedin : connection.uid1Linkedin,
            fromEmail: isUid1 ? connection.uid1Email : connection.uid2Email,
            toEmail: isUid1 ? connection.uid2Email : connection.uid1Email,
            fromProfileImage: isUid1 ? connection.uid1ProfileImage : connection.uid2ProfileImage,
            toProfileImage: isUid1 ? connection.uid2ProfileImage : connection.uid1ProfileImage
          });
        }
      });
      
      return legacyConnections;
    } catch (error) {
      console.error('❌ Error fetching user connections by event (legacy):', error);
      return [];
    }
  }
  
  // Get other user's info from a connection
  static getOtherUser(connection: Connection, currentUserId: string): {
    uid: string;
    name?: string;
    work?: string;
    position?: string;
    linkedin?: string;
    email?: string;
    profileImage?: string | null;
  } {
    const isUid1 = currentUserId === connection.uid1;
    
    return {
      uid: isUid1 ? connection.uid2 : connection.uid1,
      name: isUid1 ? connection.uid2Name : connection.uid1Name,
      work: isUid1 ? connection.uid2Work : connection.uid1Work,
      position: isUid1 ? connection.uid2Position : connection.uid1Position,
      linkedin: isUid1 ? connection.uid2Linkedin : connection.uid1Linkedin,
      email: isUid1 ? connection.uid2Email : connection.uid1Email,
      profileImage: isUid1 ? connection.uid2ProfileImage : connection.uid1ProfileImage,
    };
  }

  // Format timestamp for display
  static formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Format connection reasons for display
  static formatReasons(reasons: ConnectionReason[]): string {
    const reasonTypes = reasons.map(r => {
      switch (r.type) {
        case 'event': return 'Event';
        case 'admin': return 'Admin';
        case 'user': return 'Request';
        default: return r.type;
      }
    });
    
    return [...new Set(reasonTypes)].join(', ');
  }
  
  // Format position for display
  static formatPosition(position: string | undefined): string {
    if (!position) return '';
    
    const positionMap: Record<string, string> = {
      'investor': 'Investor',
      'c_level': 'C-Level Executive',
      'vp_level': 'VP Level',
      'director': 'Director',
      'senior_manager': 'Senior Manager',
      'manager': 'Manager',
      'senior_contributor': 'Senior Contributor',
      'individual_contributor': 'Individual Contributor',
      'junior_level': 'Junior Level',
      'founder': 'Founder',
      'consultant': 'Consultant',
      'student': 'Student',
      'other': 'Other'
    };
    
    return positionMap[position] || position;
  }
  
  // Format LinkedIn username for display
  static formatLinkedinUrl(username: string | undefined): string {
    if (!username) return '';
    
    // Remove any linkedin.com prefix if present
    const cleanUsername = username.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '');
    
    // Remove trailing slash if present
    return cleanUsername.replace(/\/$/, '');
  }
}