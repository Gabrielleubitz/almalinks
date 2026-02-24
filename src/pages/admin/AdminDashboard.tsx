import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  Mail,
  MessageCircle,
  UserCog,
  Megaphone,
  Activity,
  UserPlus,
  Zap,
  Download,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import IganiWatermark from '../../components/IganiWatermark';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loadingPendingCount, setLoadingPendingCount] = useState(true);

  useEffect(() => {
    loadPendingCount();
  }, []);

  // Load pending registrations count
  const loadPendingCount = async () => {
    try {
      setLoadingPendingCount(true);
      
      // Get count of users with pending status
      const pendingUsers = await getPendingUsersCount();
      setPendingCount(pendingUsers);
      
    } catch (error) {
      console.error('❌ Error loading pending count:', error);
      setPendingCount(0);
    } finally {
      setLoadingPendingCount(false);
    }
  };

  // Get count of pending users (from joinRequests collection)
  const getPendingUsersCount = async (): Promise<number> => {
    try {
      const { JoinRequestService } = await import('../../services/joinRequestService');
      const pendingRequests = await JoinRequestService.getPendingRequests();
      return pendingRequests.length;
    } catch (error) {
      console.error('❌ Error getting pending users count:', error);
      return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <AdminHeader title="Admin Dashboard" />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        {/* Welcome Section */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12 px-2">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-center justify-center mb-4 gap-3 sm:gap-0">
              <div className="bg-purple-100 p-2 sm:p-3 rounded-full mr-0 sm:mr-4 flex-shrink-0">
                <UserCog className="h-5 w-5 sm:h-6 sm:w-6 text-brand-dark" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                  Welcome back, <span className="text-brand-dark">{user?.displayName?.split(' ')[0] || 'Admin'}</span>! 👋
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mt-1">Manage events, users, and communications</p>
              </div>
            </div>
          </div>
          
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 lg:mb-4">
            Admin <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto px-2">
            Quick links to manage events, users, and communications
          </p>
        </div>

        {/* Core Admin Functions */}
        <div className="space-y-6 sm:space-y-8">
          
          {/* Event & User Management */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">📅 Event & User Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Link
                to="/admin/events"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-brand-dark" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Manage Events</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">View and edit existing events</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/events/create"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Create Event</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Add a new Alma Links event</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <UserCog className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Users</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Manage user roles</p>
                  </div>
                </div>
              </Link>
              <Link
                to="/admin/activity"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Activity</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Monitor user activities</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/pending-registrations"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift relative w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Registrations</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Approve new signups</p>
                  </div>
                </div>
                
                {!loadingPendingCount && pendingCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold">
                    {pendingCount}
                  </div>
                )}
              </Link>
            </div>
          </div>

          {/* Communication Tools */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">📢 Communication</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Link
                to="/admin/email"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Mail className="h-6 w-6 sm:h-8 sm:w-8 text-brand-light" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Email Messages</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Send emails to members</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/announcements"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Megaphone className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Announcements</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Publish updates</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/chats/create"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <MessageCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Create Chat Group</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Create new group chats</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Event Tools */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">🎯 Event Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              <Link
                to="/admin/check-in"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Check-in</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Check in attendees at events</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/connections"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-brand-light" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Connections</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Manage user connections</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/hubspot-import"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Download className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">Import from HubSpot</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Sync HubSpot CRM contacts</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/system-test"
                className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift w-full"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <Zap className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900">System Test</h4>
                    <p className="text-gray-600 text-xs sm:text-sm">Test integrations</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Igani Watermark */}
      <IganiWatermark position="bottom-right" size="sm" opacity={0.3} />
    </div>
  );
};

export default AdminDashboard;