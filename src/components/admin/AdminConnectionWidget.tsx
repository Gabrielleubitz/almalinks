import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Link2, 
  TrendingUp,
  Zap,
  QrCode
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
    scanConnections: 0,
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
      <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-light flex-shrink-0" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Connection Overview</h3>
        </div>
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 flex-shrink-0">
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="whitespace-nowrap">{stats.connectionsToday} today</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-light flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-blue-900">
                {stats.totalConnections.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-brand-light font-medium">Total Connections</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-green-900">
                {stats.autoConnections.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-green-600 font-medium">Auto Connections</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-brand-dark flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-purple-900">
                {stats.manualConnections.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-brand-dark font-medium">Manual Connections</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-orange-900">
                {stats.scanConnections.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-orange-600 font-medium">QR Connections</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Type Breakdown */}
      <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Connection Types</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Auto-Connect</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {stats.totalConnections > 0 
                ? Math.round((stats.autoConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm text-gray-600">Manual</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {stats.totalConnections > 0 
                ? Math.round((stats.manualConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm text-gray-600">QR Scan</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {stats.totalConnections > 0 
                ? Math.round((stats.scanConnections / stats.totalConnections) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Active Users */}
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
          <span className="text-xs sm:text-sm text-gray-600">Active Users (with connections)</span>
          <span className="text-xs sm:text-sm font-semibold text-gray-900">
            {stats.activeUsers.toLocaleString()} users
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminConnectionWidget;