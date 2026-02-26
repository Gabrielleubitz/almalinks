import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  and
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { ActivityType, ActivityLog, ActivityFilters, ActivityStats, ActivityLogDisplay } from '../types/activity';

export class ActivityService {
  private static sessionId: string = this.generateSessionId();
  private static recentLogs: Map<string, number> = new Map(); // Track recent logs to prevent duplicates
  private static DUPLICATE_THRESHOLD = 30000; // 30 seconds (default)

  // Activity-specific throttle periods (in milliseconds)
  private static THROTTLE_PERIODS: Partial<Record<ActivityType, number>> = {
    'chat_message': 300000,      // 5 minutes - only log chat activity once per 5 min per chat
    'page_view': 600000,          // 10 minutes - if re-enabled, throttle heavily
    'profile_update': 60000,      // 1 minute
    'event_register': 5000,       // 5 seconds (keep tight, important action)
    'connection_request': 5000,   // 5 seconds (keep tight, important action)
    'login': 5000,                // 5 seconds (keep tight, important action)
    'logout': 5000,               // 5 seconds (keep tight, important action)
    'admin_action': 10000         // 10 seconds
  };

  // Generate a unique session ID for this browser session
  private static generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate a unique key for deduplication
  private static generateLogKey(
    userId: string,
    activityType: ActivityType,
    description: string
  ): string {
    return `${userId}-${activityType}-${description}`;
  }

  // Check if this exact activity was logged recently (within threshold)
  private static isDuplicateLog(logKey: string, activityType: ActivityType): boolean {
    const now = Date.now();
    const lastLogTime = this.recentLogs.get(logKey);

    // Use activity-specific throttle period, or default threshold
    const throttlePeriod = this.THROTTLE_PERIODS[activityType] || this.DUPLICATE_THRESHOLD;

    if (lastLogTime && (now - lastLogTime) < throttlePeriod) {
      console.log(`[Throttled] ${activityType} - last logged ${Math.round((now - lastLogTime) / 1000)}s ago (throttle: ${throttlePeriod / 1000}s)`);
      return true; // This is a duplicate/throttled
    }

    // Update the timestamp for this log
    this.recentLogs.set(logKey, now);

    // Clean up old entries (keep map size manageable)
    if (this.recentLogs.size > 1000) {
      // Use the longest throttle period for cleanup (10 minutes)
      const cutoff = now - 600000;
      for (const [key, timestamp] of this.recentLogs.entries()) {
        if (timestamp < cutoff) {
          this.recentLogs.delete(key);
        }
      }
    }

    return false;
  }

  // Get client IP address (basic implementation)
  private static async getClientIP(): Promise<string | undefined> {
    try {
      // In production, you might want to use a more reliable IP detection service
      // For now, we'll just return undefined and handle IP detection on the backend
      return undefined;
    } catch (error) {
      console.warn('Could not detect IP address:', error);
      return undefined;
    }
  }

  // Get user agent
  private static getUserAgent(): string {
    return navigator.userAgent;
  }

  // Check if identical activity already exists in database
  private static async checkDatabaseDuplicate(
    userId: string,
    activityType: ActivityType,
    description: string,
    sessionId: string
  ): Promise<boolean> {
    try {
      // Check for exact matches within the last 30 seconds
      const thirtySecondsAgo = new Date();
      thirtySecondsAgo.setSeconds(thirtySecondsAgo.getSeconds() - 30);

      const q = query(
        collection(db, 'activity_logs'),
        and(
          where('userId', '==', userId),
          where('activityType', '==', activityType),
          where('description', '==', description),
          where('sessionId', '==', sessionId),
          where('timestamp', '>=', Timestamp.fromDate(thirtySecondsAgo))
        ),
        limit(1)
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      return !snapshot.empty;

    } catch (error) {
      console.warn('❌ Error checking database duplicates:', error);
      // If check fails, allow the log to proceed (fail open)
      return false;
    }
  }

  // Log activity (main method used by the app)
  static async logActivity(
    userId: string,
    userEmail: string,
    userName: string,
    activityType: ActivityType,
    description: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Don't log if user is not authenticated
      if (!userId) {
        console.log(`[DEV] Activity skipped - no userId: ${activityType} - ${description}`, metadata);
        return;
      }

      // Optional: Skip activity logging if explicitly disabled via env variable
      if (import.meta.env.VITE_SKIP_ACTIVITY_LOGGING === 'true') {
        console.log(`[DEV] Activity logging disabled: ${activityType} - ${description}`, metadata);
        return;
      }

      // Check for duplicate logs (prevent logging the same activity too frequently)
      const logKey = this.generateLogKey(userId, activityType, description);
      if (this.isDuplicateLog(logKey, activityType)) {
        // Log is throttled (console message already shown in isDuplicateLog)
        return;
      }

      // Check database for existing identical records
      const isDatabaseDuplicate = await this.checkDatabaseDuplicate(
        userId, 
        activityType, 
        description, 
        this.sessionId
      );
      
      if (isDatabaseDuplicate) {
        console.log(`[DEV] Database duplicate prevented: ${activityType} - ${description}`);
        return;
      }

      const ipAddress = await this.getClientIP();

      // Build metadata without undefined values (Firestore doesn't allow undefined)
      const activityMetadata: Record<string, any> = {
        ...metadata,
        userAgent: this.getUserAgent(),
        page: window.location.pathname,
      };

      // Only add ipAddress if it's defined
      if (ipAddress !== undefined) {
        activityMetadata.ipAddress = ipAddress;
      }

      const activityLog: Omit<ActivityLog, 'id'> = {
        userId,
        userEmail,
        userName,
        activityType,
        description,
        metadata: activityMetadata,
        timestamp: Timestamp.now(),
        sessionId: this.sessionId
      };

      // Add to Firestore
      await retryOnNetworkFailure(() =>
        addDoc(collection(db, 'activity_logs'), activityLog)
      );

      console.log(`✅ Activity logged: ${activityType}`);
      
    } catch (error) {
      // Don't throw errors for activity logging to avoid disrupting the main app flow
      console.warn('❌ Failed to log activity:', error);
    }
  }

  // Convenience methods for common activities
  static async logLogin(userId: string, userEmail: string, userName: string): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'login', 
      'User logged in',
      { loginMethod: 'email' }
    );
  }

  static async logLogout(userId: string, userEmail: string, userName: string): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'logout', 
      'User logged out'
    );
  }

  static async logPageView(userId: string, userEmail: string, userName: string, page: string): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'page_view', 
      `Viewed ${page}`,
      { page }
    );
  }

  static async logProfileUpdate(userId: string, userEmail: string, userName: string, changes: string[]): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'profile_update', 
      `Updated profile: ${changes.join(', ')}`,
      { changedFields: changes }
    );
  }

  static async logEventRegistration(userId: string, userEmail: string, userName: string, eventId: string, eventName: string): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'event_register', 
      `Registered for event: ${eventName}`,
      { eventId, eventName }
    );
  }

  static async logConnectionRequest(userId: string, userEmail: string, userName: string, targetUserId: string, targetName: string): Promise<void> {
    await this.logActivity(
      userId, 
      userEmail, 
      userName, 
      'connection_request', 
      `Sent connection request to ${targetName}`,
      { targetUserId, targetName }
    );
  }

  static async logAdminAction(userId: string, userEmail: string, userName: string, action: string, details?: any): Promise<void> {
    await this.logActivity(
      userId,
      userEmail,
      userName,
      'admin_action',
      action,
      details
    );
  }

  static async logChatMessage(userId: string, userEmail: string, userName: string, chatId: string, chatName: string): Promise<void> {
    await this.logActivity(
      userId,
      userEmail,
      userName,
      'chat_message',
      `Sent message in ${chatName}`,
      { chatId, chatName }
    );
  }

  // Admin-only methods for retrieving activity data
  static async getActivities(
    filters: ActivityFilters = {},
    limitCount: number = 50,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ activities: ActivityLogDisplay[]; hasMore: boolean; lastDoc?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      console.log('🔍 Getting activities with filters:', filters);

      // Base query
      let q = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc')
      );

      // Apply filters
      if (filters.userId) {
        q = query(q, where('userId', '==', filters.userId));
      }

      if (filters.activityType) {
        q = query(q, where('activityType', '==', filters.activityType));
      }

      if (filters.startDate) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(filters.startDate)));
      }

      if (filters.endDate) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(filters.endDate)));
      }

      // Add pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      q = query(q, limit(limitCount + 1)); // Get one extra to check if there are more

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const docs = snapshot.docs;
      
      const hasMore = docs.length > limitCount;
      const activities = docs.slice(0, limitCount);
      const newLastDoc = activities.length > 0 ? activities[activities.length - 1] : undefined;

      const activityLogs: ActivityLogDisplay[] = activities.map(doc => {
        const data = doc.data() as Omit<ActivityLog, 'id'>;
        const timestamp = data.timestamp.toDate();
        
        return {
          id: doc.id,
          ...data,
          timestamp,
          formattedTime: timestamp.toLocaleString()
        };
      });

      // Apply text search filter (client-side for now)
      let filteredActivities = activityLogs;
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredActivities = activityLogs.filter(activity => 
          activity.description.toLowerCase().includes(searchTerm) ||
          activity.userName.toLowerCase().includes(searchTerm) ||
          activity.userEmail.toLowerCase().includes(searchTerm)
        );
      }

      console.log(`✅ Retrieved ${filteredActivities.length} activities`);
      
      return {
        activities: filteredActivities,
        hasMore,
        lastDoc: newLastDoc
      };

    } catch (error) {
      console.error('❌ Error getting activities:', error);
      throw error;
    }
  }

  // Get activity statistics for admin dashboard
  static async getActivityStats(days: number = 30): Promise<ActivityStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const now = new Date();
      const recentWindowMinutes = 15;
      const recentCutoff = new Date(now.getTime() - recentWindowMinutes * 60 * 1000);

      const q = query(
        collection(db, 'activity_logs'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[];

      // Calculate stats
      const uniqueUsers = new Set(activities.map(a => a.userId)).size;
      const recentActiveUsers = new Set(
        activities
          .filter(activity => {
            try {
              const ts = activity.timestamp;
              const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts as any);
              return !Number.isNaN(date.getTime()) && date >= recentCutoff;
            } catch {
              return false;
            }
          })
          .map(a => a.userId)
      ).size;
      
      // Count activities by type
      const activityCounts: { [key: string]: number } = {};
      activities.forEach(activity => {
        activityCounts[activity.activityType] = (activityCounts[activity.activityType] || 0) + 1;
      });

      const topActivities = Object.entries(activityCounts)
        .map(([type, count]) => ({ type: type as ActivityType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Daily stats
      const dailyStats: { [key: string]: number } = {};
      activities.forEach(activity => {
        const date = activity.timestamp.toDate().toDateString();
        dailyStats[date] = (dailyStats[date] || 0) + 1;
      });

      const dailyStatsArray = Object.entries(dailyStats)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        totalActivities: activities.length,
        uniqueUsers,
        topActivities,
        dailyStats: dailyStatsArray,
        recentActiveUsers,
        recentWindowMinutes
      };

    } catch (error) {
      console.error('❌ Error getting activity stats:', error);
      throw error;
    }
  }

  // Clean up duplicate activity logs (admin function)
  static async cleanupDuplicateLogs(): Promise<{ removed: number; errors: number }> {
    try {
      console.log('🧹 Starting duplicate cleanup...');
      
      // Get all activity logs ordered by timestamp
      const q = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc'),
        limit(1000) // Process in batches for performance
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (ActivityLog & { id: string })[];

      // Group by user, activity type, description, and timestamp (within 30 seconds)
      const groups = new Map<string, (ActivityLog & { id: string })[]>();
      
      activities.forEach(activity => {
        // Round timestamp to 30-second intervals for grouping
        const timestamp = activity.timestamp.toDate();
        const roundedTime = Math.floor(timestamp.getTime() / 30000) * 30000;
        
        const key = `${activity.userId}-${activity.activityType}-${activity.description}-${roundedTime}`;
        
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(activity);
      });

      // Find duplicates and mark for deletion (keep the first one, remove others)
      const toDelete: string[] = [];
      groups.forEach(group => {
        if (group.length > 1) {
          // Sort by timestamp and keep the earliest
          group.sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
          // Mark all but the first for deletion
          for (let i = 1; i < group.length; i++) {
            toDelete.push(group[i].id);
          }
        }
      });

      console.log(`📋 Found ${toDelete.length} duplicate activities to remove`);
      
      // Note: In production, you'd want to use writeBatch for atomic deletions
      // For now, we'll return the count that would be deleted
      return {
        removed: toDelete.length,
        errors: 0
      };

    } catch (error) {
      console.error('❌ Error cleaning up duplicate logs:', error);
      return {
        removed: 0,
        errors: 1
      };
    }
  }

  // Clean up old activity logs (to be called periodically by admin)
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const q = query(
        collection(db, 'activity_logs'),
        where('timestamp', '<', Timestamp.fromDate(cutoffDate)),
        limit(500) // Process in batches
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      
      // In a real implementation, you'd want to use batch deletes
      // For now, we'll just return the count of documents that would be deleted
      console.log(`🧹 Found ${snapshot.docs.length} old activity logs to clean up`);
      
      return snapshot.docs.length;

    } catch (error) {
      console.error('❌ Error cleaning up activity logs:', error);
      throw error;
    }
  }
}