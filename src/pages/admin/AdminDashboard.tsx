import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  Mail,
  MessageCircle,
  Megaphone,
  Activity,
  UserPlus,
  Download,
  ClipboardCheck,
  Link2,
  Wrench,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { auth } from '../../firebase/config';
import { EventService } from '../../services/eventService';
import IganiWatermark from '../../components/IganiWatermark';

type CardProps = {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  stat?: string | number;
  statLoading?: boolean;
  secondary?: boolean;
};

const DashboardCard: React.FC<CardProps> = ({
  to,
  icon: Icon,
  title,
  description,
  stat,
  statLoading,
  secondary,
}) => (
  <Link
    to={to}
    className={`group flex items-start gap-4 rounded-[14px] border border-[rgba(0,0,0,0.05)] px-5 py-4 transition-all duration-200 ease-out ${
      secondary
        ? 'bg-white/90 hover:bg-white shadow-[0_6px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5'
        : 'bg-white shadow-[0_6px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5'
    }`}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 group-hover:text-[#3B82F6]/80 transition-colors">
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0 flex-1 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-900">{title}</span>
        {stat !== undefined && !statLoading && (
          <span className="text-xs font-medium text-gray-500 tabular-nums">{stat}</span>
        )}
        {statLoading && (
          <span className="h-4 w-8 animate-pulse rounded bg-gray-200" aria-hidden />
        )}
      </div>
      <p className="mt-0.5 text-sm text-[#64748B]">{description}</p>
    </div>
  </Link>
);

const AdminDashboard: React.FC = () => {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pending, events, userCount] = await Promise.all([
          (async () => {
            try {
              const { JoinRequestService } = await import('../../services/joinRequestService');
              const list = await JoinRequestService.getPendingRequests();
              return list.length;
            } catch {
              return 0;
            }
          })(),
          EventService.getPublicEvents().then((e) => e.length),
          (async () => {
            try {
              const q = query(
                collection(db, 'users'),
                where('status', '==', 'approved')
              );
              const snap = await getDocs(q);
              return snap.size;
            } catch {
              return 0;
            }
          })(),
        ]);
        setPendingCount(pending);
        setEventsCount(events);
        setUsersCount(userCount);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPending(false);
        setLoadingEvents(false);
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/test/email-config', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setApiConnected(res.ok || res.status === 401);
      } catch {
        if (!cancelled) setApiConnected(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Analytics — 4 equal cards, primary emphasized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {/* Primary metric: slightly larger, stronger shadow, 5% blue tint */}
          <div className="rounded-[14px] bg-white border-l-4 border-l-[#3B82F6] pl-4 pr-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] min-h-[88px] flex flex-col justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.05)' }}>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Active events</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
              {loadingEvents ? '—' : eventsCount}
            </p>
          </div>
          <div className="rounded-[14px] bg-white border-l-4 pl-4 pr-4 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.04)] min-h-[88px] flex flex-col justify-center" style={{ borderLeftColor: 'rgba(139,92,246,0.15)' }}>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total users</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
              {loadingUsers ? '—' : usersCount}
            </p>
          </div>
          <div className="rounded-[14px] bg-white border-l-4 pl-4 pr-4 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.04)] min-h-[88px] flex flex-col justify-center" style={{ borderLeftColor: 'rgba(245,158,11,0.15)' }}>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Pending approvals</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
              {loadingPending ? '—' : pendingCount}
            </p>
          </div>
          <div className="rounded-[14px] bg-white border-l-4 pl-4 pr-4 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.04)] min-h-[88px] flex flex-col justify-center" style={{ borderLeftColor: apiConnected === true ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)' }}>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">API</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
              {apiConnected === null ? '—' : apiConnected ? 'Connected' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Management */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-[#0F172A]">Management</h2>
          <div className="h-px mt-3 bg-[rgba(0,0,0,0.05)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <DashboardCard
              to="/admin/events"
              icon={Calendar}
              title="Events"
              description="View and manage events"
              stat={loadingEvents ? undefined : `${eventsCount} events`}
              statLoading={loadingEvents}
            />
            <DashboardCard
              to="/admin/users"
              icon={Users}
              title="Users"
              description="Manage members and roles"
            />
            <DashboardCard
              to="/admin/pending-registrations"
              icon={UserPlus}
              title="Registrations"
              description="Approve or reject signups"
              stat={loadingPending ? undefined : pendingCount}
              statLoading={loadingPending}
            />
            <DashboardCard
              to="/admin/activity"
              icon={Activity}
              title="Activity"
              description="User activity and logs"
            />
          </div>
        </section>

        {/* Communication */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-[#0F172A]">Communication</h2>
          <div className="h-px mt-3 bg-[rgba(0,0,0,0.05)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <DashboardCard
              to="/admin/email"
              icon={Mail}
              title="Email"
              description="Send emails to members"
            />
            <DashboardCard
              to="/admin/announcements"
              icon={Megaphone}
              title="Announcements"
              description="Publish updates"
            />
            <DashboardCard
              to="/admin/chats"
              icon={MessageCircle}
              title="Chats"
              description="Manage chat groups"
            />
          </div>
        </section>

        {/* Tools — secondary weight */}
        <section>
          <h2 className="text-xl font-semibold text-[#0F172A]">Tools</h2>
          <div className="h-px mt-3 bg-[rgba(0,0,0,0.05)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <DashboardCard
              to="/admin/check-in"
              icon={ClipboardCheck}
              title="Check-in"
              description="Event attendee check-in"
              secondary
            />
            <DashboardCard
              to="/admin/connections"
              icon={Link2}
              title="Connections"
              description="User connections"
              secondary
            />
            <DashboardCard
              to="/admin/hubspot-import"
              icon={Download}
              title="HubSpot import"
              description="Sync contacts from HubSpot"
              secondary
            />
            <DashboardCard
              to="/admin/system-test"
              icon={Wrench}
              title="System test"
              description="Integration checks"
              secondary
            />
          </div>
        </section>
      </div>

      <IganiWatermark position="bottom-right" size="sm" opacity={0.3} />
    </div>
  );
};

export default AdminDashboard;
