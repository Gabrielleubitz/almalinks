import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  Search,
  RefreshCw,
  TrendingUp,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertTriangle,
  MessageCircle,
  X,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ActivityLogDisplay, ActivityFilters, ActivityStats, ActivityType } from '../../types/activity';
import AdminHeader from '../../components/admin/AdminHeader';
import { auth } from '../../firebase/config';
import { AdminChatService } from '../../services/adminChatService';
import { ChatMessage } from '../../types/chat';

// Helper function to format timestamp without seconds
const formatTimestamp = (timestamp: any): string => {
  try {
    let date: Date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else {
      return String(timestamp);
    }
    
    // Format as: MM/DD/YYYY, HH:MM AM/PM
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return String(timestamp);
  }
};

// Activity type labels and colors
const ACTIVITY_TYPES: Record<ActivityType, { label: string; color: string }> = {
  login: { label: 'Login', color: 'bg-green-100 text-green-800' },
  logout: { label: 'Logout', color: 'bg-gray-100 text-gray-800' },
  page_view: { label: 'Page View', color: 'bg-blue-50 text-blue-800' },
  profile_update: { label: 'Profile Update', color: 'bg-purple-100 text-purple-800' },
  event_register: { label: 'Event Registration', color: 'bg-orange-100 text-orange-800' },
  event_unregister: { label: 'Event Unregistration', color: 'bg-red-100 text-red-800' },
  connection_request: { label: 'Connection Request', color: 'bg-indigo-100 text-indigo-800' },
  connection_accept: { label: 'Connection Accept', color: 'bg-emerald-100 text-emerald-800' },
  chat_create: { label: 'Chat Created', color: 'bg-cyan-100 text-cyan-800' },
  chat_join: { label: 'Chat Joined', color: 'bg-teal-100 text-teal-800' },
  chat_message: { label: 'Chat Message', color: 'bg-blue-50 text-blue-800' },
  admin_action: { label: 'Admin Action', color: 'bg-purple-100 text-purple-800' },
  user_created: { label: 'User Created', color: 'bg-green-100 text-green-800' },
  password_reset: { label: 'Password Reset', color: 'bg-yellow-100 text-yellow-800' }
};

const ActivityManagement: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLogDisplay[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLogDisplay | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load activities from API
  const loadActivities = useCallback(async (reset = true) => {
    if (!user?.uid) {
      console.log('⚠️ Cannot load activities - user not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading activities...', { reset, filters, userId: user.uid });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch('/api/activity-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          },
          body: JSON.stringify({
            action: 'get-activities',
            filters,
            limitCount: 25, // Reduced from 50 for faster initial load
            lastDocId: reset ? null : lastDocId,
            adminEmail: user.email,
            adminName: user.displayName
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Try to get error details from response body
          let errorDetails = '';
          try {
            const errorData = await response.json();
            errorDetails = errorData.error || errorData.message || response.statusText;
            console.error('❌ API Error Response:', {
              status: response.status,
              statusText: response.statusText,
              error: errorData.error,
              code: errorData.code,
              details: errorData.details
            });
          } catch (e) {
            errorDetails = response.statusText;
          }
          
          throw new Error(`HTTP ${response.status}: ${errorDetails}`);
        }

        const data = await response.json();

        console.log('📊 Activities response:', {
          success: data.success,
          count: data.activities?.length,
          hasMore: data.hasMore,
          activities: data.activities
        });

        if (!data.success) {
          throw new Error(data.error || 'Failed to load activities');
        }

        if (reset) {
          setActivities(data.activities);
        } else {
          setActivities(prev => [...prev, ...data.activities]);
        }

        setHasMore(data.hasMore);
        setLastDocId(data.lastDocId);

        console.log(`✅ Loaded ${data.activities.length} activities`);

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds. Please check your internet connection and try again.');
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error('❌ Error loading activities:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: '/api/activity-admin',
        method: 'POST',
        userId: user?.uid,
        email: user?.email,
        filters
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load activities';
      
      // Provide user-friendly error message
      let userMessage = errorMessage;
      if (errorMessage.includes('503') || errorMessage.includes('Service temporarily unavailable') || errorMessage.includes('SERVICE_UNAVAILABLE')) {
        userMessage = 'Activity service is currently unavailable. Please ensure the API server is running and try again.';
      } else if (errorMessage.includes('Cannot connect') || errorMessage.includes('PROXY_CONNECTION_ERROR')) {
        userMessage = 'Cannot connect to the API server. Make sure the development server is running on port 3001.';
      }
      
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  }, [user, filters, lastDocId]);

  // Load activity statistics
  const loadStats = useCallback(async () => {
    if (!user?.uid) {
      console.log('⚠️ Cannot load stats - user not authenticated');
      return;
    }
    
    try {
      const response = await fetch('/api/activity-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          action: 'get-activity-stats',
          days: 30,
          adminEmail: user.email,
          adminName: user.displayName
        })
      });

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || errorData.message || response.statusText;
          console.error('❌ Stats API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error,
            code: errorData.code,
            details: errorData.details
          });
        } catch (e) {
          errorDetails = response.statusText;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to load stats');
      }

    } catch (error: any) {
      console.error('❌ Error loading stats:', error);
      console.error('Stats Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: '/api/activity-admin',
        method: 'POST',
        action: 'get-activity-stats',
        userId: user?.uid,
        email: user?.email,
        errorDetails: error
      });
    }
  }, [user]);

  // Load activities and stats on mount - only once when user is available
  useEffect(() => {
    if (user?.uid && !hasInitialized) {
      setHasInitialized(true);
      loadActivities(true);
      loadStats();
    }
  }, [user?.uid, hasInitialized, loadActivities, loadStats]);

  // Load activities when filters change (but not on initial load)
  useEffect(() => {
    if (user?.uid && hasInitialized && !error?.includes('RESOURCE_EXHAUSTED') && Object.keys(filters).length > 0) {
      loadActivities(true);
    }
  }, [user?.uid, hasInitialized, error, JSON.stringify(filters)]);

  // Handle filter changes
  const handleFilterChange = (key: keyof ActivityFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Load chat messages for viewing
  const loadChatMessages = async (chatId: string) => {
    try {
      setLoadingChat(true);
      const messages = await AdminChatService.getAllChatMessages(chatId);
      setChatMessages(messages);
      setSelectedChatId(chatId);
    } catch (error) {
      console.error('❌ Error loading chat messages:', error);
      alert('Failed to load chat messages');
    } finally {
      setLoadingChat(false);
    }
  };

  // Handle viewing chat from activity
  const handleViewChat = (activity: ActivityLogDisplay) => {
    const chatId = activity.metadata?.chatId;
    if (chatId) {
      loadChatMessages(chatId);
      setSelectedActivity(null); // Close activity detail modal
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
  };

  // Format page path for display
  const formatPagePath = (page?: string): string => {
    if (!page) return 'N/A';

    // Common page mappings
    const pageNames: { [key: string]: string } = {
      '/dashboard': 'Dashboard',
      '/events': 'Events',
      '/members': 'Members',
      '/chats': 'Chats',
      '/profile': 'Profile',
      '/admin': 'Admin',
    };

    // Check for exact matches
    if (pageNames[page]) return pageNames[page];

    // Check for partial matches
    for (const [path, name] of Object.entries(pageNames)) {
      if (page.startsWith(path)) return name;
    }

    // Return cleaned path
    return page.replace(/^\//, '').split('/')[0] || 'Unknown';
  };

  // Export activities (basic CSV export)
  const exportActivities = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Email', 'Activity Type', 'Description', 'Page/Location', 'User Agent'].join(','),
      ...activities.map(activity => [
        formatTimestamp(activity.timestamp),
        activity.userName,
        activity.userEmail,
        activity.activityType,
        activity.description.replace(/,/g, ';'), // Replace commas to avoid CSV issues
        formatPagePath(activity.metadata?.page),
        activity.metadata?.userAgent || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clean up duplicate logs
  const cleanupDuplicates = async () => {
    if (!user?.uid || !confirm('Are you sure you want to remove duplicate activity entries? This will keep the earliest entry for each duplicate group.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/activity-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          action: 'cleanup-duplicates',
          adminEmail: user.email,
          adminName: user.displayName
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully identified ${data.duplicateCount} duplicate entries for cleanup`);
        loadActivities(true);
      } else {
        throw new Error(data.error || 'Failed to cleanup duplicates');
      }

    } catch (error) {
      console.error('❌ Error cleaning up duplicates:', error);
      alert('Failed to clean up duplicate entries');
    } finally {
      setLoading(false);
    }
  };

  // Clean up old logs
  const cleanupOldLogs = async () => {
    if (!user?.uid || !confirm('Are you sure you want to delete activity logs older than 90 days?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/activity-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          action: 'cleanup-old-logs',
          daysToKeep: 90,
          adminEmail: user.email,
          adminName: user.displayName
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully cleaned up ${data.deletedCount} old activity logs`);
        loadActivities(true);
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('❌ Error cleaning up logs:', error);
      alert('Failed to clean up old logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader title="Activity Management" />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-x-hidden w-full max-w-full box-border">
        {/* Back */}
        <div className="mb-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-brand-dark transition-colors font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Admin
          </Link>
        </div>

        {/* Page title & intro */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Activity Management</h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl">
            View and filter user activity across the site. Activity is tracked automatically (logins, page views, events, chats, connections, and more).
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
          <button
            onClick={() => {
              setError(null);
              loadActivities(true);
              loadStats();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white hover:opacity-90 disabled:opacity-50 text-sm font-medium shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportActivities}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={cleanupDuplicates}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm font-medium"
          >
            <AlertTriangle className="h-4 w-4" />
            Remove Duplicates
          </button>
          <button
            onClick={cleanupOldLogs}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"
          >
            <AlertTriangle className="h-4 w-4" />
            Cleanup Old Logs
          </button>
        </div>

        {/* Stats (last 30 days) */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-brand-light">
                  <Activity className="h-6 w-6 text-brand-dark" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total activities</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalActivities.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-green-50">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Active users</p>
                  <p className="text-xl font-bold text-gray-900">{stats.uniqueUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-purple-50">
                  <TrendingUp className="h-6 w-6 text-brand-dark" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Top activity type</p>
                  <p className="text-lg font-bold text-gray-900 truncate" title={stats.topActivities[0]?.type}>
                    {ACTIVITY_TYPES[stats.topActivities[0]?.type as ActivityType]?.label || stats.topActivities[0]?.type || '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-amber-50">
                  <BarChart3 className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Daily average</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.dailyStats?.length ? Math.round(stats.totalActivities / stats.dailyStats.length) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-gray-900">
              <Filter className="h-5 w-5 text-gray-500" />
              Filters
            </span>
            {showFilters ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
          </button>
          {showFilters && (
            <div className="px-4 pb-4 pt-0 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search || ''}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="User, description..."
                      className="pl-9 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Activity type</label>
                  <select
                    value={filters.activityType || ''}
                    onChange={(e) => handleFilterChange('activityType', e.target.value || undefined)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  >
                    <option value="">All types</option>
                    {Object.entries(ACTIVITY_TYPES).map(([type, { label }]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">From date</label>
                  <input
                    type="date"
                    value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">To date</label>
                  <input
                    type="date"
                    value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
            <p className="text-sm text-gray-500">Showing {activities.length} {activities.length === 1 ? 'entry' : 'entries'}</p>
          </div>

          {error && (
            <div className={`mx-4 mt-4 p-4 rounded-xl border ${error.includes('RESOURCE_EXHAUSTED') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <p className="text-sm">
                {error.includes('RESOURCE_EXHAUSTED')
                  ? 'Firebase quota temporarily exceeded. Data loading is paused; quota resets in 24 hours. Use Refresh to retry.'
                  : error}
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Page</th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Loading activities…</span>
                      </div>
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                      No activities match the current filters.
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-brand-dark" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{activity.userName}</div>
                            <div className="text-xs text-gray-500 truncate">{activity.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-lg ${ACTIVITY_TYPES[activity.activityType]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {ACTIVITY_TYPES[activity.activityType]?.label || activity.activityType}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-sm text-gray-900 max-w-xs">
                        <span className="truncate block" title={activity.description}>{activity.description}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {formatPagePath(activity.metadata?.page)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-right">
                        <button
                          onClick={() => setSelectedActivity(activity)}
                          className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-brand-dark hover:bg-brand-light transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && !loading && (
            <div className="p-4 border-t border-gray-100 text-center">
              <button
                onClick={() => loadActivities(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-light text-brand-dark hover:bg-brand-blue hover:text-white transition-colors text-sm font-medium"
              >
                Load more
              </button>
            </div>
          )}
        </div>

        {/* Activity detail modal */}
        {selectedActivity && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 id="activity-detail-title" className="text-lg font-semibold text-gray-900">Activity details</h3>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time</p>
                    <p className="text-sm text-gray-900 mt-0.5">{formatTimestamp(selectedActivity.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">User</p>
                    <p className="text-sm text-gray-900 mt-0.5">{selectedActivity.userName} ({selectedActivity.userEmail})</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</p>
                    <p className="text-sm text-gray-900 mt-0.5">{ACTIVITY_TYPES[selectedActivity.activityType]?.label || selectedActivity.activityType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</p>
                    <p className="text-sm text-gray-900 mt-0.5">{selectedActivity.description}</p>
                  </div>
                  {selectedActivity.activityType === 'chat_message' && selectedActivity.metadata?.chatId && (
                    <div>
                      <button
                        onClick={() => handleViewChat(selectedActivity)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white hover:opacity-90 text-sm font-medium"
                      >
                        <MessageCircle className="h-4 w-4" />
                        View full chat
                      </button>
                    </div>
                  )}
                  {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</p>
                      <pre className="text-xs text-gray-700 bg-gray-100 p-3 rounded-xl mt-1 overflow-x-auto max-h-40">{JSON.stringify(selectedActivity.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat viewer modal */}
        {selectedChatId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]" role="dialog" aria-modal="true" aria-labelledby="chat-viewer-title">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 id="chat-viewer-title" className="text-lg font-semibold text-gray-900">Chat conversation</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{chatMessages.length} messages · Admin view</p>
                </div>
                <button
                  onClick={() => { setSelectedChatId(null); setChatMessages([]); }}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {loadingChat ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <p className="text-center py-12 text-gray-500">No messages in this chat.</p>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="h-10 w-10 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-brand-dark" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{message.userName}</p>
                          <p className="text-xs text-gray-500">{message.createdAt?.toDate?.()?.toLocaleString() ?? '—'}</p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{message.text}</p>
                        {message.userEmail && <p className="text-xs text-gray-400 mt-1">{message.userEmail}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityManagement;