import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit as firestoreLimit,
  where,
  documentId
} from 'firebase/firestore';
import { db, retryOnNetworkFailure, auth } from '../firebase/config';
import { ConnectionService, Connection } from './connectionService';
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

/** How a connection row is classified for stats (matches Firestore `reasons[].type`). */
export type PrimaryConnectionKind = 'auto' | 'manual' | 'admin';

/**
 * Firestore stores `uid1`/`uid2` and `reasons[]` — not top-level `connectionType`.
 * Priority: admin > event > user request.
 */
export function getPrimaryConnectionKind(conn: Connection): PrimaryConnectionKind {
  const reasons = Array.isArray(conn.reasons) ? conn.reasons : [];
  if (reasons.length === 0) {
    const legacy = (conn as { connectionType?: string }).connectionType;
    if (legacy === 'admin') return 'admin';
    if (legacy === 'auto') return 'auto';
    return 'manual';
  }
  if (reasons.some(r => r.type === 'admin')) return 'admin';
  if (reasons.some(r => r.type === 'event')) return 'auto';
  if (reasons.some(r => r.type === 'user')) return 'manual';
  return 'manual';
}

function humanPrimaryLabel(kind: PrimaryConnectionKind): string {
  switch (kind) {
    case 'auto':
      return 'By event';
    case 'admin':
      return 'By admin';
    default:
      return 'By request';
  }
}

/** Build human-readable source lines from reasons (optional event title map). */
export function describeConnectionSources(
  conn: Connection,
  eventTitles: Map<string, string>
): { primaryKind: PrimaryConnectionKind; primaryLabel: string; sourceLines: string[] } {
  const reasons = Array.isArray(conn.reasons) ? conn.reasons : [];
  const primaryKind = getPrimaryConnectionKind(conn);
  const primaryLabel = humanPrimaryLabel(primaryKind);
  const lines: string[] = [];

  if (reasons.length === 0) {
    const legacy = (conn as { connectionType?: string }).connectionType;
    if (legacy) lines.push(`Legacy: ${legacy}`);
    else lines.push('No reasons recorded (legacy or import)');
    return { primaryKind, primaryLabel, sourceLines: lines };
  }

  for (const r of reasons) {
    if (r.type === 'event') {
      const id = r.eventId;
      const title = id ? eventTitles.get(id) || id : '';
      lines.push(title ? `Event: ${title}` : 'Event');
    } else if (r.type === 'admin') {
      lines.push(
        r.adminId
          ? `Admin (${r.adminId.slice(0, 8)}…)`
          : 'Admin'
      );
      if (r.context) lines.push(`Note: ${r.context}`);
    } else if (r.type === 'user') {
      lines.push(r.requestId ? 'Connection request' : 'Member request');
    }
  }

  // Dedupe while preserving order
  const seen = new Set<string>();
  const sourceLines = lines.filter(l => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
  return { primaryKind, primaryLabel, sourceLines };
}

export interface AdminConnectionListRow {
  id: string;
  uid1: string;
  uid2: string;
  personAName: string;
  personBName: string;
  personAEmail: string;
  personBEmail: string;
  primaryKind: PrimaryConnectionKind;
  primaryLabel: string;
  sourceSummary: string;
  updatedAtLabel: string;
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Firestore `in` / `not-in` queries allow up to 30 values. */
const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Batched user profile reads (replaces N sequential getDoc calls). */
async function fetchUserSummariesByIds(
  uids: Iterable<string>
): Promise<Map<string, { name: string; email: string; work: string }>> {
  const unique = [...new Set([...uids].filter(Boolean))];
  const map = new Map<string, { name: string; email: string; work: string }>();
  if (unique.length === 0) return map;

  const chunks = chunkArray(unique, FIRESTORE_IN_LIMIT);
  await Promise.all(
    chunks.map(async chunk => {
      const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
      const snap = await retryOnNetworkFailure(() => getDocs(q));
      snap.forEach(d => {
        const data = d.data();
        map.set(d.id, {
          name: (data.displayName || data.name || d.id) as string,
          email: (data.email || '') as string,
          work: (data.work || '') as string
        });
      });
    })
  );
  return map;
}

/** Batched event title reads for connection reasons / export. */
async function fetchEventTitlesByIds(
  eventIds: Iterable<string>
): Promise<Map<string, string>> {
  const unique = [...new Set([...eventIds].filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const chunks = chunkArray(unique, FIRESTORE_IN_LIMIT);
  await Promise.all(
    chunks.map(async chunk => {
      const q = query(collection(db, 'events'), where(documentId(), 'in', chunk));
      const snap = await retryOnNetworkFailure(() => getDocs(q));
      snap.forEach(d => {
        const data = d.data();
        const name = (data.name as string) || d.id;
        map.set(d.id, name);
      });
    })
  );
  return map;
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

      if (import.meta.env.DEV) {
        console.log('[ADMIN_CONNECT] success', {
          userA: fromUid,
          userB: toUid,
          adminUid,
          connectionId: data.connectionId,
          connectionPath: data.connectionPath,
          created: data.created,
          existed: data.existed,
          eventId: options.eventId
        });
      }

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
   * Get connection statistics for users who have at least one connection (top N by total).
   * Uses real schema: uid1/uid2 + reasons[] (not legacy fromUid/toUid/connectionType).
   */
  static async getUserConnectionStats(limit: number = 100): Promise<UserConnectionStats[]> {
    try {
      const connectionsSnapshot = await retryOnNetworkFailure(() =>
        getDocs(collection(db, 'connections'))
      );
      const allConnections = connectionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Connection[];

      const statsMap = new Map<
        string,
        { auto: number; manual: number; admin: number; total: number }
      >();

      for (const conn of allConnections) {
        const u1 = conn.uid1;
        const u2 = conn.uid2;
        if (!u1 || !u2) continue;

        const kind = getPrimaryConnectionKind(conn);
        for (const uid of [u1, u2]) {
          if (!statsMap.has(uid)) {
            statsMap.set(uid, { auto: 0, manual: 0, admin: 0, total: 0 });
          }
          const s = statsMap.get(uid)!;
          s.total++;
          if (kind === 'admin') s.admin++;
          else if (kind === 'auto') s.auto++;
          else s.manual++;
        }
      }

      const sorted = [...statsMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, limit);

      const uids = sorted.map(([uid]) => uid);
      const [userSummaries, regByUser] = await Promise.all([
        fetchUserSummariesByIds(uids),
        this.buildRegisteredEventIdsForUsers(uids)
      ]);

      const userStats: UserConnectionStats[] = [];
      for (const [uid, counts] of sorted) {
        const summary = userSummaries.get(uid);
        if (!summary) continue;

        userStats.push({
          uid,
          name: summary.name,
          email: summary.email,
          work: summary.work || 'Not specified',
          totalConnections: counts.total,
          autoConnections: counts.auto,
          manualConnections: counts.manual,
          adminConnections: counts.admin,
          registeredEvents: regByUser.get(uid) ?? []
        });
      }

      return userStats;
    } catch (error) {
      console.error('❌ Error getting user connection stats:', error);
      return [];
    }
  }

  /**
   * All connections with member names and human-readable sources (newest first).
   */
  static async getAllConnectionsEnriched(maxRows: number = 500): Promise<AdminConnectionListRow[]> {
    let connections: Connection[];
    try {
      const q = query(
        collection(db, 'connections'),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(maxRows)
      );
      const snap = await retryOnNetworkFailure(() => getDocs(q));
      connections = snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
    } catch (e) {
      console.warn('[getAllConnectionsEnriched] ordered query failed, falling back to full scan', e);
      const all = await retryOnNetworkFailure(() => getDocs(collection(db, 'connections')));
      const list = all.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
      list.sort((a, b) => {
        const ta = timestampToDate(a.updatedAt)?.getTime() ?? 0;
        const tb = timestampToDate(b.updatedAt)?.getTime() ?? 0;
        return tb - ta;
      });
      connections = list.slice(0, maxRows);
    }

    const eventIds = new Set<string>();
    const userIds = new Set<string>();
    for (const c of connections) {
      if (c.uid1) userIds.add(c.uid1);
      if (c.uid2) userIds.add(c.uid2);
      for (const r of Array.isArray(c.reasons) ? c.reasons : []) {
        if (r.type === 'event' && r.eventId) eventIds.add(r.eventId);
      }
    }

    const [eventTitles, userDocs] = await Promise.all([
      fetchEventTitlesByIds(eventIds),
      fetchUserSummariesByIds(userIds)
    ]);

    const rows: AdminConnectionListRow[] = [];
    for (const c of connections) {
      const u1 = c.uid1 || '';
      const u2 = c.uid2 || '';
      const a = userDocs.get(u1) || { name: u1, email: '' };
      const b = userDocs.get(u2) || { name: u2, email: '' };
      const { primaryKind, primaryLabel, sourceLines } = describeConnectionSources(c, eventTitles);
      const updated = timestampToDate(c.updatedAt) || timestampToDate(c.createdAt);
      const updatedAtLabel = updated
        ? updated.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
        : '—';

      rows.push({
        id: c.id,
        uid1: u1,
        uid2: u2,
        personAName: a.name,
        personBName: b.name,
        personAEmail: a.email,
        personBEmail: b.email,
        primaryKind,
        primaryLabel,
        sourceSummary: sourceLines.join(' · ') || primaryLabel,
        updatedAtLabel
      });
    }

    return rows;
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
        const partnerUid =
          userId === connection.uid1 ? connection.uid2 : connection.uid1;
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
        const event = await EventService.getEventById(eventId, { skipAudienceVisibility: true });
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

      if (import.meta.env.DEV) {
        console.log('[bulkConnectEventUsers]', { created, skipped, errorCount: errors.length });
      }

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

      if (import.meta.env.DEV) {
        console.warn('[removeConnection] not implemented; attempted:', {
          connectionId,
          adminUid,
          reason
        });
      }

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
   * For each user id, list public events they are registered for.
   * One `getPublicEvents` + parallel `getEventRegistrations` per event (not users × events sequential reads).
   */
  private static async buildRegisteredEventIdsForUsers(
    userIds: string[]
  ): Promise<Map<string, string[]>> {
    const uidSet = new Set(userIds.filter(Boolean));
    const result = new Map<string, string[]>();
    userIds.forEach(uid => result.set(uid, []));

    if (uidSet.size === 0) return result;

    try {
      const events = await EventService.getPublicEvents();
      await Promise.all(
        events.map(async event => {
          try {
            const regs = await EventService.getEventRegistrations(event.id);
            for (const reg of regs) {
              const uid = reg.userId;
              if (uidSet.has(uid)) {
                result.get(uid)!.push(event.id);
              }
            }
          } catch (error) {
            console.warn('⚠️ Error loading registrations for event:', event.id, error);
          }
        })
      );
    } catch (error) {
      console.error('❌ Error building registered events for users:', error);
    }

    return result;
  }

  /**
   * Get user's registered event IDs (helper method)
   */
  private static async getUserRegisteredEventIds(userId: string): Promise<string[]> {
    const map = await this.buildRegisteredEventIdsForUsers([userId]);
    return map.get(userId) ?? [];
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

      let autoConnections = 0;
      let manualConnections = 0;
      let adminConnections = 0;
      let connectionsToday = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      connections.forEach(conn => {
        const kind = getPrimaryConnectionKind(conn);
        if (kind === 'admin') adminConnections++;
        else if (kind === 'auto') autoConnections++;
        else manualConnections++;

        const connDate =
          timestampToDate(conn.updatedAt) ||
          timestampToDate(conn.createdAt) ||
          timestampToDate((conn as { timestamp?: unknown }).timestamp) ||
          new Date(0);
        if (connDate >= today) {
          connectionsToday++;
        }
      });

      const activeUserIds = new Set<string>();
      connections.forEach(conn => {
        if (conn.uid1) activeUserIds.add(conn.uid1);
        if (conn.uid2) activeUserIds.add(conn.uid2);
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
    sourceSummary: string;
    date: string;
  }[]> {
    const connectionsSnapshot = await retryOnNetworkFailure(() =>
      getDocs(collection(db, 'connections'))
    );
    const connections = connectionsSnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as Connection[];

    const eventIds = new Set<string>();
    for (const c of connections) {
      for (const r of Array.isArray(c.reasons) ? c.reasons : []) {
        if (r.type === 'event' && r.eventId) eventIds.add(r.eventId);
      }
    }
    const userIds = new Set<string>();
    connections.forEach(c => {
      if (c.uid1) userIds.add(c.uid1);
      if (c.uid2) userIds.add(c.uid2);
    });

    const [eventTitles, userDocs] = await Promise.all([
      fetchEventTitlesByIds(eventIds),
      fetchUserSummariesByIds(userIds)
    ]);

    const rows: {
      id: string;
      fromUid: string;
      toUid: string;
      fromName: string;
      toName: string;
      fromEmail: string;
      toEmail: string;
      connectionType: string;
      sourceSummary: string;
      date: string;
    }[] = [];

    for (const c of connections) {
      const fromUid = c.uid1 ?? '';
      const toUid = c.uid2 ?? '';
      const from = userDocs.get(fromUid) ?? { name: fromUid, email: '' };
      const to = userDocs.get(toUid) ?? { name: toUid, email: '' };
      const kind = getPrimaryConnectionKind(c);
      const connType =
        kind === 'admin' ? 'by_admin' : kind === 'auto' ? 'by_event' : 'by_request';
      const { sourceLines } = describeConnectionSources(c, eventTitles);
      const sourceSummary = sourceLines.join(' | ');
      const updated =
        timestampToDate(c.updatedAt) ||
        timestampToDate(c.createdAt) ||
        new Date(0);
      const date = updated.toISOString().slice(0, 10);
      rows.push({
        id: c.id,
        fromUid,
        toUid,
        fromName: from.name,
        toName: to.name,
        fromEmail: from.email,
        toEmail: to.email,
        connectionType: connType,
        sourceSummary,
        date
      });
    }
    return rows;
  }
}