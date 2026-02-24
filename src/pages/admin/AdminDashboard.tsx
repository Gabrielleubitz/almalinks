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
    <div className="min-h-screen bg-gradient-to-br from-brand-light/40 via-white to-brand-blue/5 overflow-x-hidden w-full max-w-full">
      <AdminHeader title="Admin Dashboard" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section — Alma brand gradient */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12 px-2">
          <div className="rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 bg-gradient-to-r from-brand-dark/10 via-brand-light/60 to-brand-blue/20 border border-brand-blue/10 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-center mb-4 gap-3 sm:gap-0">
              <div className="bg-brand-dark p-2 sm:p-3 rounded-full mr-0 sm:mr-4 flex-shrink-0 text-white shadow-md">
                <UserCog className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                  Welcome back, <span className="text-brand-dark">{user?.displayName?.split(' ')[0] || 'Admin'}</span>! 👋
                </h2>
                <p className="text-sm sm:text-base text-gray-700 mt-1">Manage events, users, and communications</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links — Alma colors per section */}
        <div className="space-y-8">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark mb-3">Events & people</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Link to="/admin/events" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark group-hover:bg-brand-blue group-hover:text-white"><Calendar className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Manage Events</span>
                  <span className="mt-0.5 block text-xs text-gray-600">View and edit events</span>
                </div>
              </Link>
              <Link to="/admin/events/create" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-blue group-hover:bg-brand-blue group-hover:text-white"><Calendar className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Create Event</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Add new event</span>
                </div>
              </Link>
              <Link to="/admin/users" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark group-hover:bg-brand-blue group-hover:text-white"><UserCog className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Users</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Manage roles</span>
                </div>
              </Link>
              <Link to="/admin/activity" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark group-hover:bg-brand-blue group-hover:text-white"><Activity className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Activity</span>
                  <span className="mt-0.5 block text-xs text-gray-600">User activity</span>
                </div>
              </Link>
              <Link to="/admin/pending-registrations" className="group relative flex items-center gap-4 rounded-xl border border-brand-gold/25 bg-white px-4 py-3.5 transition-all hover:border-brand-gold/50 hover:bg-amber-50/50 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 group-hover:bg-brand-gold group-hover:text-white"><UserPlus className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Registrations</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Approve signups</span>
                </div>
                {!loadingPendingCount && pendingCount > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-brand-gold px-1.5 text-[10px] font-semibold text-white shadow-sm">{pendingCount}</span>
                )}
              </Link>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark mb-3">Communication</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Link to="/admin/email" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-blue group-hover:bg-brand-blue group-hover:text-white"><Mail className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Email</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Send to members</span>
                </div>
              </Link>
              <Link to="/admin/announcements" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 group-hover:bg-brand-gold group-hover:text-white"><Megaphone className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Announcements</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Publish updates</span>
                </div>
              </Link>
              <Link to="/admin/chats/create" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white"><MessageCircle className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Create Chat Group</span>
                  <span className="mt-0.5 block text-xs text-gray-600">New group chat</span>
                </div>
              </Link>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark mb-3">Tools</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Link to="/admin/check-in" className="group flex items-center gap-4 rounded-xl border border-emerald-200/80 bg-white px-4 py-3.5 transition-all hover:border-emerald-400/60 hover:bg-emerald-50/60 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white"><CheckCircle className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Check-in</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Event attendees</span>
                </div>
              </Link>
              <Link to="/admin/connections" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark group-hover:bg-brand-blue group-hover:text-white"><Users className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">Connections</span>
                  <span className="mt-0.5 block text-xs text-gray-600">User connections</span>
                </div>
              </Link>
              <Link to="/admin/hubspot-import" className="group flex items-center gap-4 rounded-xl border border-amber-200/80 bg-white px-4 py-3.5 transition-all hover:border-brand-gold/50 hover:bg-amber-50/50 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 group-hover:bg-brand-gold group-hover:text-white"><Download className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">HubSpot Import</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Sync contacts</span>
                </div>
              </Link>
              <Link to="/admin/system-test" className="group flex items-center gap-4 rounded-xl border border-brand-blue/15 bg-white px-4 py-3.5 transition-all hover:border-brand-blue/35 hover:bg-brand-light/30 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-blue group-hover:bg-brand-blue group-hover:text-white"><Zap className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-900">System Test</span>
                  <span className="mt-0.5 block text-xs text-gray-600">Integrations</span>
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