import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Link2, 
  TrendingUp,
  Zap
} from 'lucide-react';
import { AdminConnectionService } from '../../services/adminConnectionService';

interface AdminConnectionWidgetProps {
  eventId?: string;
  className?: string;
}

const AdminConnectionWidget: React.FC<AdminConnectionWidgetProps> = ({ 
  eventId,
  className = '' 
}) => {
  const [stats, setStats] = useState({
    totalConnections: 0,
    autoConnections: 0,
    manualConnections: 0,
    adminConnections: 0,
    activeUsers: 0,
    connectionsToday: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const dashboardStats = await AdminConnectionService.getAdminDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('❌ Error loading connection stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-5" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
          <h3 className="text-lg font-bold text-gray-900 truncate">Connection Overview</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-700 flex-shrink-0">
          <TrendingUp className="h-4 w-4 text-gray-500" />
          <span className="whitespace-nowrap font-medium">{stats.connectionsToday} today</span>
        </div>
      </div>

      {/* Stats Grid: By event, By request, By admin only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <div className="flex items-center space-x-2">
            <Link2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold text-blue-900 tabular-nums">
                {stats.totalConnections.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-blue-800">Total Connections</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold text-green-900 tabular-nums">
                {stats.autoConnections.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-green-800">By event</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-purple-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold text-purple-900 tabular-nums">
                {stats.manualConnections.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-purple-800">By request</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
          <div className="flex items-center space-x-2">
            <Link2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold text-amber-900 tabular-nums">
                {stats.adminConnections.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-amber-800">By admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection type breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">By type</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-800">By event</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {stats.totalConnections > 0
                ? Math.round((stats.autoConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm font-medium text-gray-800">By request</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {stats.totalConnections > 0
                ? Math.round((stats.manualConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-gray-800">By admin</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {stats.totalConnections > 0
                ? Math.round((stats.adminConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Active Users */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <span className="text-sm font-medium text-gray-700">Active users (with connections)</span>
        <span className="text-sm font-bold text-gray-900">{stats.activeUsers.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default AdminConnectionWidget;