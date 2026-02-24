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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
          
        </div>

        {/* Quick links — compact, minimal sections */}
        <div className="space-y-8">
          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Events & people</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Link to="/admin/events" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Calendar className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Manage Events</span>
                  <span className="mt-0.5 block text-xs text-gray-500">View and edit events</span>
                </div>
              </Link>
              <Link to="/admin/events/create" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Calendar className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Create Event</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Add new event</span>
                </div>
              </Link>
              <Link to="/admin/users" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><UserCog className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Users</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Manage roles</span>
                </div>
              </Link>
              <Link to="/admin/activity" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Activity className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Activity</span>
                  <span className="mt-0.5 block text-xs text-gray-500">User activity</span>
                </div>
              </Link>
              <Link to="/admin/pending-registrations" className="group relative flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><UserPlus className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Registrations</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Approve signups</span>
                </div>
                {!loadingPendingCount && pendingCount > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{pendingCount}</span>
                )}
              </Link>
            </div>
          </section>

          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Communication</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Link to="/admin/email" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Mail className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Email</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Send to members</span>
                </div>
              </Link>
              <Link to="/admin/announcements" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Megaphone className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Announcements</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Publish updates</span>
                </div>
              </Link>
              <Link to="/admin/chats/create" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><MessageCircle className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Create Chat Group</span>
                  <span className="mt-0.5 block text-xs text-gray-500">New group chat</span>
                </div>
              </Link>
            </div>
          </section>

          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Tools</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Link to="/admin/check-in" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><CheckCircle className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Check-in</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Event attendees</span>
                </div>
              </Link>
              <Link to="/admin/connections" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Users className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Connections</span>
                  <span className="mt-0.5 block text-xs text-gray-500">User connections</span>
                </div>
              </Link>
              <Link to="/admin/hubspot-import" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Download className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">HubSpot Import</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Sync contacts</span>
                </div>
              </Link>
              <Link to="/admin/system-test" className="group flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 group-hover:text-gray-900"><Zap className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">System Test</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Integrations</span>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Igani Watermark */}
      <IganiWatermark position="bottom-right" size="sm" opacity={0.3} />
    </div>
  );
};

export default AdminDashboard;