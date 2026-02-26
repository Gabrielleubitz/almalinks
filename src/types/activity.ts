// Activity tracking types
import { Timestamp } from 'firebase/firestore';

export type ActivityType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'profile_update'
  | 'event_register'
  | 'event_unregister'
  | 'connection_request'
  | 'connection_accept'
  | 'chat_create'
  | 'chat_join'
  | 'chat_message'
  | 'admin_action'
  | 'user_created'
  | 'password_reset';

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  activityType: ActivityType;
  description: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    page?: string;
    targetUserId?: string;
    eventId?: string;
    chatId?: string;
    previousValue?: any;
    newValue?: any;
    [key: string]: any;
  };
  timestamp: Timestamp;
  sessionId?: string;
}

export interface ActivityFilters {
  userId?: string;
  activityType?: ActivityType;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface ActivityStats {
  totalActivities: number;
  uniqueUsers: number;
  topActivities: { type: ActivityType; count: number }[];
  dailyStats: { date: string; count: number }[];
  /**
   * Approximate real-time active users based on recent activity.
   * Typically counts distinct users with any activity within the last N minutes.
   */
  recentActiveUsers?: number;
  /**
   * Window size (in minutes) used to compute recentActiveUsers.
   */
  recentWindowMinutes?: number;
}

// For frontend display
export interface ActivityLogDisplay extends Omit<ActivityLog, 'timestamp'> {
  timestamp: Date;
  formattedTime: string;
  userAvatar?: string;
}