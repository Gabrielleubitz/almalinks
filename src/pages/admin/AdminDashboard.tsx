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
    className={`group flex items-start gap-4 rounded-[14px] border px-5 py-4 transition-all duration-200 ease-out ${
      secondary
        ? 'bg-[rgba(255,255,255,0.7)] border-[rgba(0,0,0,0.06)] hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]'
        : 'bg-white border-[rgba(0,0,0,0.05)] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5'
    }`}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 group-hover:text-gray-800 transition-colors">
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
      <p className="mt-0.5 text-sm text-gray-500">{description}</p>
    </div>
  </Link>
);

const AdminDashboard: React.FC = () => {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pending, events] = await Promise.all([
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
        ]);
        setPendingCount(pending);
        setEventsCount(events);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPending(false);
        setLoadingEvents(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto">
        {/* Optional stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
          <div className="rounded-xl bg-white/80 border border-[rgba(0,0,0,0.05)] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-medium text-gray-500">Active events</p>
            <p className="mt-0.5 text-xl font-semibold text-gray-900 tabular-nums">
              {loadingEvents ? '—' : eventsCount}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 border border-[rgba(0,0,0,0.05)] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-medium text-gray-500">Pending approvals</p>
            <p className="mt-0.5 text-xl font-semibold text-gray-900 tabular-nums">
              {loadingPending ? '—' : pendingCount}
            </p>
          </div>
        </div>

        {/* Management */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Communication</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
