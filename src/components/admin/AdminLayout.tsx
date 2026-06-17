import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserPlus,
  Mail,
  Megaphone,
  MessageCircle,
  ClipboardCheck,
  Link2,
  Download,
  Activity,
  Wrench,
  LogOut,
  Menu,
  Home,
  User,
  ChevronDown,
  HelpCircle,
  Heart,
  Star,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import logoSvg from '../../assets/alma-links-logo.svg';

const navSections = [
  {
    label: 'Main',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/events', label: 'Events', icon: Calendar },
      { to: '/admin/reviews', label: 'Event reviews', icon: Star },
      { to: '/admin/event-registrations', label: 'Event Registrations', icon: ClipboardCheck },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/pending-registrations', label: 'Membership Applicants', icon: UserPlus },
      { to: '/admin/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/admin/email', label: 'Email', icon: Mail },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/admin/chats', label: 'Chats', icon: MessageCircle },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/admin/check-in', label: 'Check-in', icon: ClipboardCheck },
      { to: '/admin/connections', label: 'Connections', icon: Link2 },
      { to: '/admin/hubspot-import', label: 'HubSpot Import', icon: Download },
      { to: '/admin/system-test', label: 'System test', icon: Wrench },
    ],
  },
];

const pathToTitle: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/email': 'Email',
  '/admin/announcements': 'Announcements',
  '/admin/chats': 'Chats',
  '/admin/chats/create': 'Create chat group',
  '/admin/events': 'Events',
  '/admin/reviews': 'Event reviews',
  '/admin/events/create': 'Create event',
  '/admin/events/add': 'Add event',
  '/admin/check-in': 'Check-in',
  '/admin/users': 'Users',
  '/admin/event-registrations': 'Event registrations',
  '/admin/pending-registrations': 'Membership Applicants',
  '/admin/connections': 'Connections',
  '/admin/activity': 'Activity',
  '/admin/hubspot-import': 'HubSpot import',
  '/admin/system-test': 'System test',
};

function getPageTitle(pathname: string): string {
  if (pathToTitle[pathname]) return pathToTitle[pathname];
  if (pathname.startsWith('/admin/events/') && pathname.endsWith('/edit')) return 'Edit event';
  if (pathname.startsWith('/admin/users/') && pathname.endsWith('/edit')) return 'Edit user';
  return 'Admin';
}

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isInUserView, switchToAdminView, switchToUserView, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState<number | null>(null);

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const pageTitle = getPageTitle(location.pathname);

  const displayName = user?.displayName || user?.email || 'Admin';
  const avatarUrl = (user as { profileImage?: string | null })?.profileImage ?? null;
  const initials = displayName
    ? displayName
        .split(/[\s@]+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'A';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  };

  // Realtime listener for pending registrations count (joinRequests with status == 'pending')
  useEffect(() => {
    if (!user?.uid || !isAdmin) {
      setPendingRegistrations(null);
      return;
    }

    const requestsRef = collection(db, 'joinRequests');
    const q = query(requestsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingRegistrations(snapshot.size);
      },
      (error) => {
        console.error('❌ Error listening for pending registrations:', error);
        setPendingRegistrations(null);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, isAdmin]);

  const navContent = (
    <div className="flex flex-col h-full">
      <Link
        to="/admin"
        className="flex flex-col gap-2 px-4 py-5 border-b border-[rgba(0,0,0,0.06)]"
        onClick={() => setSidebarOpen(false)}
      >
        <img src={logoSvg} alt="AlmaLinks" className="h-8 w-auto" />
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748B]">
          Admin
        </span>
      </Link>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="px-3 mb-1.5 text-[11px] font-medium text-gray-400 tracking-wide">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                const showPendingBadge =
                  item.to === '/admin/pending-registrations' &&
                  pendingRegistrations !== null &&
                  pendingRegistrations > 0;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-[rgba(59,130,246,0.06)] text-gray-900 border-l-[3px] border-l-[#3B82F6] pl-[9px] pr-3'
                        : 'text-gray-600 hover:bg-[rgba(0,0,0,0.04)] hover:text-gray-900 px-3'
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#3B82F6]' : 'opacity-80'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {showPendingBadge && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-semibold rounded-full bg-red-500 text-white flex-shrink-0">
                        {pendingRegistrations! > 99 ? '99+' : pendingRegistrations}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-[rgba(0,0,0,0.06)] space-y-0.5">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-[rgba(0,0,0,0.04)] hover:text-gray-900 transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        {isInUserView ? (
          <button
            type="button"
            onClick={() => { switchToAdminView(); navigate('/admin'); setSidebarOpen(false); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Back to admin
          </button>
        ) : (
          <Link
            to="/dashboard"
            onClick={() => { switchToUserView(); setSidebarOpen(false); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-[rgba(0,0,0,0.04)] hover:text-gray-900 transition-colors"
          >
            <User className="h-4 w-4" />
            User dashboard
          </Link>
        )}
        <button
          type="button"
          onClick={() => { handleLogout(); setSidebarOpen(false); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(to bottom, #F8FAFC, #F3F6FA)' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-[rgba(0,0,0,0.06)] z-30"
      >
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed left-0 top-0 bottom-0 w-[260px] max-w-[85vw] bg-white border-r border-[rgba(0,0,0,0.06)] z-50 lg:hidden shadow-xl"
          >
            {navContent}
          </aside>
        </>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[240px]">
        {/* Top bar — subtle glass */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3 bg-white/80 backdrop-blur-md border-b border-[rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-[rgba(0,0,0,0.04)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {pageTitle}
          </h1>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.04)] transition-colors duration-200"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(0,0,0,0.06)] bg-gray-100 text-xs font-medium text-gray-600">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <span className="hidden sm:inline truncate max-w-[140px] font-medium text-gray-900">
                {displayName}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1 py-1 w-52 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.06)] z-50 max-h-[min(80vh,400px)] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-[rgba(0,0,0,0.06)]">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName || 'Admin'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => { setUserMenuOpen(false); switchToUserView(); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <User className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link
                    to="/events"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <Calendar className="h-4 w-4" />
                    Events
                  </Link>
                  <Link
                    to="/members"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <Users className="h-4 w-4" />
                    Members
                  </Link>
                  <Link
                    to="/chats"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chats
                  </Link>
                  <Link
                    to="/help"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help
                  </Link>
                  {user?.uid && (
                    <Link
                      to={`/profile/${user.uid}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                    >
                      <User className="h-4 w-4" />
                      My profile
                    </Link>
                  )}
                  <a
                    href="https://almalinks.org/donate.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <Heart className="h-4 w-4" />
                    Donate
                  </a>
                  <div className="border-t border-[rgba(0,0,0,0.06)] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[60vh]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
