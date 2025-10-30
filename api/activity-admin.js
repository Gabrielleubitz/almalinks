// Admin Activity API - Server-side activity log management
import admin from 'firebase-admin';

// Firebase Admin should already be initialized by the main server
// We'll just use the existing instance
const db = admin.firestore();
const auth = admin.auth();

// Activity logging from server-side
export async function logServerActivity(userId, userEmail, userName, activityType, description, metadata = {}, req = null) {
  try {
    const activityLog = {
      userId,
      userEmail,
      userName,
      activityType,
      description,
      metadata: {
        ...metadata,
        ipAddress: getClientIP(req),
        userAgent: req?.headers['user-agent'] || 'unknown',
        serverSide: true
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('activity_logs').add(activityLog);
    console.log(`✅ Server activity logged: ${activityType} for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Failed to log server activity:', error);
  }
}

// Extract client IP from request
function getClientIP(req) {
  if (!req) return 'unknown';
  
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

// Main API handler
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization token provided' 
      });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const currentUserId = decodedToken.uid;

    // Verify admin role
    if (decodedToken.role !== 'admin') {
      await logServerActivity(
        currentUserId,
        decodedToken.email,
        decodedToken.name || decodedToken.email,
        'admin_action',
        'Unauthorized activity API access attempt',
        { attemptedAction: req.body.action },
        req
      );
      
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    const { action } = req.body;

    // Route to appropriate handler based on action
    switch (action) {
      case 'get-activities':
        return await getActivities(req, res, currentUserId);
      case 'get-activity-stats':
        return await getActivityStats(req, res, currentUserId);
      case 'cleanup-old-logs':
        return await cleanupOldLogs(req, res, currentUserId);
      case 'log-activity':
        return await logActivity(req, res, currentUserId);
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown action: ${action}. Available actions: get-activities, get-activity-stats, cleanup-old-logs, log-activity` 
        });
    }
  } catch (error) {
    console.error('❌ Activity API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

// Get activities with filtering and pagination
async function getActivities(req, res, adminId) {
  const { filters = {}, limitCount = 50, lastDocId } = req.body;

  try {
    console.log('🔍 Admin getting activities:', { filters, limitCount, adminId });

    // Build query
    let query = db.collection('activity_logs').orderBy('timestamp', 'desc');

    // Apply filters
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }

    if (filters.activityType) {
      query = query.where('activityType', '==', filters.activityType);
    }

    if (filters.startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(filters.startDate)));
    }

    if (filters.endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(new Date(filters.endDate)));
    }

    // Add pagination
    if (lastDocId) {
      const lastDoc = await db.collection('activity_logs').doc(lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limitCount + 1); // Get one extra to check pagination

    const snapshot = await query.get();
    const docs = snapshot.docs;
    
    const hasMore = docs.length > limitCount;
    const activities = docs.slice(0, limitCount);

    const activityData = activities.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate?.() || new Date(),
        formattedTime: (data.timestamp?.toDate?.() || new Date()).toLocaleString()
      };
    });

    // Apply text search filter (server-side)
    let filteredActivities = activityData;
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredActivities = activityData.filter(activity => 
        activity.description?.toLowerCase().includes(searchTerm) ||
        activity.userName?.toLowerCase().includes(searchTerm) ||
        activity.userEmail?.toLowerCase().includes(searchTerm)
      );
    }

    // Log admin activity
    await logServerActivity(
      adminId,
      req.body.adminEmail || 'admin@example.com',
      req.body.adminName || 'Admin',
      'admin_action',
      'Viewed activity logs',
      { 
        filtersApplied: Object.keys(filters).filter(key => filters[key]),
        resultsCount: filteredActivities.length 
      },
      req
    );

    return res.status(200).json({
      success: true,
      activities: filteredActivities,
      hasMore,
      lastDocId: activities.length > 0 ? activities[activities.length - 1].id : null,
      total: filteredActivities.length
    });

  } catch (error) {
    console.error('❌ Error getting activities:', error);
    throw error;
  }
}

// Get activity statistics
async function getActivityStats(req, res, adminId) {
  const { days = 30 } = req.body;

  try {
    console.log('📊 Getting activity stats for last', days, 'days');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = db.collection('activity_logs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .orderBy('timestamp', 'desc');

    const snapshot = await query.get();
    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate stats
    const uniqueUsers = new Set(activities.map(a => a.userId)).size;
    
    // Count activities by type
    const activityCounts = {};
    activities.forEach(activity => {
      activityCounts[activity.activityType] = (activityCounts[activity.activityType] || 0) + 1;
    });

    const topActivities = Object.entries(activityCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily stats
    const dailyStats = {};
    activities.forEach(activity => {
      const date = activity.timestamp?.toDate?.()?.toDateString() || new Date().toDateString();
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    const dailyStatsArray = Object.entries(dailyStats)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // User activity distribution
    const userActivityCounts = {};
    activities.forEach(activity => {
      userActivityCounts[activity.userId] = (userActivityCounts[activity.userId] || 0) + 1;
    });

    const topUsers = Object.entries(userActivityCounts)
      .map(([userId, count]) => {
        const userActivity = activities.find(a => a.userId === userId);
        return {
          userId,
          userName: userActivity?.userName || 'Unknown',
          userEmail: userActivity?.userEmail || 'Unknown',
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const stats = {
      totalActivities: activities.length,
      uniqueUsers,
      topActivities,
      dailyStats: dailyStatsArray,
      topUsers,
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString()
      }
    };

    // Log admin activity
    await logServerActivity(
      adminId,
      req.body.adminEmail || 'admin@example.com',
      req.body.adminName || 'Admin',
      'admin_action',
      'Viewed activity statistics',
      { daysRequested: days },
      req
    );

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error getting activity stats:', error);
    throw error;
  }
}

// Clean up old activity logs
async function cleanupOldLogs(req, res, adminId) {
  const { daysToKeep = 90 } = req.body;

  try {
    console.log('🧹 Cleaning up activity logs older than', daysToKeep, 'days');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Get documents to delete in batches
    const query = db.collection('activity_logs')
      .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
      .limit(500); // Process in batches

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No old activity logs to clean up',
        deletedCount: 0
      });
    }

    // Delete in batches
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Log admin activity
    await logServerActivity(
      adminId,
      req.body.adminEmail || 'admin@example.com',
      req.body.adminName || 'Admin',
      'admin_action',
      `Cleaned up ${snapshot.docs.length} old activity logs`,
      { 
        daysToKeep,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: snapshot.docs.length
      },
      req
    );

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${snapshot.docs.length} old activity logs`,
      deletedCount: snapshot.docs.length
    });

  } catch (error) {
    console.error('❌ Error cleaning up activity logs:', error);
    throw error;
  }
}

// Server-side activity logging endpoint
async function logActivity(req, res, adminId) {
  const { userId, userEmail, userName, activityType, description, metadata = {} } = req.body;

  if (!userId || !activityType || !description) {
    return res.status(400).json({
      success: false,
      error: 'userId, activityType, and description are required'
    });
  }

  try {
    await logServerActivity(userId, userEmail, userName, activityType, description, metadata, req);

    return res.status(200).json({
      success: true,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    console.error('❌ Error logging activity:', error);
    throw error;
  }
}