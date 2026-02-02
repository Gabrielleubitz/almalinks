import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Shield,
  User,
  RotateCcw,
  LogOut,
  Calendar,
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  Users,
  UserPlus,
  MessageCircle,
  Mail,
  Megaphone,
  Link2,
  Activity,
  Wrench,
  Image,
  Sync,
  Home,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import logoSvg from '../../assets/alma-links-logo.svg';

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
}

const adminNavGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/pending-registrations', label: 'Pending Registrations', icon: UserPlus },
    ],
  },
  {
    label: 'Events',
    items: [
      { to: '/admin/events', label: 'Manage Events', icon: Calendar },
      { to: '/admin/events/add', label: 'Add Event', icon: Calendar },
    ],
  },
  {
    label: 'Chat & Comms',
    items: [
      { to: '/admin/chats/create', label: 'Create Chat Group', icon: MessageCircle },
      { to: '/admin/email', label: 'Email', icon: Mail },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'More',
    items: [
      { to: '/admin/connections', label: 'Connections', icon: Link2 },
      { to: '/admin/activity', label: 'Activity', icon: Activity },
      { to: '/admin/system-test', label: 'System Test', icon: Wrench },
      { to: '/admin/ad-generator', label: 'Ad Generator', icon: Image },
      { to: '/admin/profile-sync', label: 'Profile Sync', icon: Sync },
    ],
  },
];

const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isInUserView, switchToUserView, switchToAdminView, logout } = useAuth();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAdminMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (adminMenuRef.current && !adminMenuRef.current.contains(target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-2 py-3 sm:py-4">
          {/* Left: Logo + optional title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link to="/" className="flex-shrink-0 hover:opacity-80 transition-opacity" aria-label="Alma Links Home">
              <img src={logoSvg} alt="Alma Links" className="h-8 sm:h-9 w-auto" />
            </Link>
            {(title || subtitle) && (
              <div className="min-w-0 hidden sm:block">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-brand-dark flex-shrink-0" />
                  {title && (
                    <span className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {title}
                    </span>
                  )}
                  {isInUserView && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 flex-shrink-0">
                      User View
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Center/Right: Desktop nav */}
          <div className="hidden lg:flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Admin dropdown */}
            <div className="relative" ref={adminMenuRef}>
              <button
                type="button"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-brand-light text-brand-dark'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>Admin</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {adminMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-white shadow-lg border border-gray-200 py-2 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto">
                  {adminNavGroups.map((group) => (
                    <div key={group.label} className="py-1">
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.to);
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              active
                                ? 'bg-brand-light text-brand-dark font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Site links */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
            {isAdmin && (
              isInUserView ? (
                <button
                  type="button"
                  onClick={() => { switchToAdminView(); navigate('/admin'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Back to Admin</span>
                </button>
              ) : (
                <>
                  <Link
                    to="/dashboard"
                    onClick={switchToUserView}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>User Dashboard</span>
                  </Link>
                  <Link
                    to="/events"
                    onClick={switchToUserView}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Events</span>
                  </Link>
                </>
              )
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile: menu button + optional title */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            {title && !subtitle && (
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-none">
                {title}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="space-y-4">
              {adminNavGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                            active ? 'bg-brand-light text-brand-dark' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Site
                </div>
                <div className="space-y-0.5">
                  <Link
                    to="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                  {isAdmin && (isInUserView ? (
                    <button
                      type="button"
                      onClick={() => { switchToAdminView(); navigate('/admin'); setMobileMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Back to Admin
                    </button>
                  ) : (
                    <>
                      <Link
                        to="/dashboard"
                        onClick={() => { switchToUserView(); setMobileMenuOpen(false); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <User className="h-4 w-4" />
                        User Dashboard
                      </Link>
                      <Link
                        to="/events"
                        onClick={() => { switchToUserView(); setMobileMenuOpen(false); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <Calendar className="h-4 w-4" />
                        Events
                      </Link>
                    </>
                  ))}
                  <button
                    type="button"
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {subtitle && (
        <div className="hidden sm:block max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 pb-3">
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      )}
    </header>
  );
};

export default AdminHeader;
