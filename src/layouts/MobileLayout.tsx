import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  User,
  Users,
  Calendar,
  MessageCircle,
  Shield,
  LogOut,
  Heart,
  Settings
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import logoSvg from '../assets/alma-links-logo.svg';
import LayoutPreferenceToggle from '../components/LayoutPreferenceToggle';

interface MobileLayoutProps {
  children: ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isPending } = useAuth();
  const { counts: notificationCounts } = useNotifications(user?.uid, isAdmin);
  
  const [showMenu, setShowMenu] = useState(false);

  // Close menu when location changes
  useEffect(() => {
    setShowMenu(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (showMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setShowMenu(false);
  };

  // Navigation: Members, Events, Chats, My Profile, Admin
  const navItems = [
    {
      label: 'Members',
      path: '/members',
      icon: Users,
      show: user && !isPending,
      badge: notificationCounts.pendingConnectionRequests > 0 ? notificationCounts.pendingConnectionRequests : undefined
    },
    {
      label: 'Events',
      path: '/events',
      icon: Calendar,
      show: true
    },
    {
      label: 'Chats',
      path: '/chats',
      icon: MessageCircle,
      show: user && !isPending,
      badge: notificationCounts.unreadChats > 0 ? notificationCounts.unreadChats : undefined
    },
    {
      label: 'My Profile',
      path: '/dashboard',
      icon: User,
      show: user && !isPending,
      highlight: true as const
    },
    {
      label: 'Admin',
      path: '/admin',
      icon: Shield,
      show: isAdmin && !isPending,
      badge: notificationCounts.pendingRegistrations > 0 ? notificationCounts.pendingRegistrations : undefined
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Compact Mobile Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              onClick={() => handleNavigation('/')}
              className="flex items-center space-x-2"
            >
              <img
                src={logoSvg}
                alt="AlmaLinks"
                className="h-7 w-auto"
              />
            </button>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Notifications indicator */}
              {(notificationCounts.unreadChats > 0 || notificationCounts.pendingRegistrations > 0 || (notificationCounts.pendingConnectionRequests ?? 0) > 0) && (
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              )}
              
              {/* Profile Avatar */}
              {user && (
                <button
                  onClick={() => handleNavigation('/dashboard')}
                  className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-brand-dark text-white font-bold text-sm ring-2 ring-brand-light"
                  title="My Profile"
                >
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.displayName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || '?'
                  )}
                </button>
              )}

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setShowMenu(true)}
                className="p-2 -mr-2 text-gray-600 hover:text-gray-900 transition-colors"
                style={{ minHeight: '44px', minWidth: '44px' }} // Ensure 44px tap target
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Menu Overlay */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <img src={logoSvg} alt="AlmaLinks" className="h-6 w-auto" />
                  <span className="font-semibold text-gray-900">Menu</span>
                </div>
                <button
                  onClick={() => setShowMenu(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* User Info */}
              {user && (
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-brand-dark text-white font-bold">
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.displayName || 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user?.displayName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.displayName || user.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                      {isPending && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                          Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="flex-1 p-2">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    if (!item.show) return null;
                    
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.path ||
                      (item.path === '/events' && location.pathname.startsWith('/events/')) ||
                      (item.path === '/chats' && location.pathname.startsWith('/chats/')) ||
                      (item.path === '/admin' && location.pathname.startsWith('/admin'));
                    const isMyProfile = 'highlight' in item && item.highlight;
                    
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigation(item.path)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors border ${
                          isActive && isMyProfile
                            ? 'bg-brand-dark text-white border-brand-dark'
                            : isActive
                            ? 'bg-blue-50 text-brand-blue border-l-4 border-brand-blue border-y-transparent border-r-transparent'
                            : isMyProfile
                            ? 'text-brand-dark border-brand-light bg-brand-light/40 hover:bg-brand-light'
                            : 'text-gray-700 hover:bg-gray-100 border-transparent'
                        }`}
                        style={{ minHeight: '48px' }} // Larger tap target for mobile
                      >
                        <div className="flex items-center space-x-3">
                          <Icon
                            className={`h-5 w-5 ${
                              isActive && isMyProfile
                                ? 'text-white'
                                : isActive
                                  ? 'text-brand-blue'
                                  : isMyProfile
                                    ? 'text-brand-dark'
                                    : 'text-gray-500'
                            }`}
                          />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Menu Footer */}
              <div className="border-t border-gray-200 p-4 space-y-2">
                {/* Layout Preference Toggle */}
                {user && (
                  <LayoutPreferenceToggle className="mb-4" />
                )}

                {/* Donate Button */}
                <a
                  href="https://almalinks.org/donate.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-gold to-amber-500 hover:from-brand-gold-hover hover:to-amber-600 text-white p-3 rounded-lg transition-all duration-200 font-medium"
                  style={{ minHeight: '48px' }}
                >
                  <Heart className="h-5 w-5 fill-current" />
                  <span>Donate</span>
                </a>

                {/* Logout Button */}
                {user && (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 text-red-600 hover:bg-red-50 p-3 rounded-lg transition-colors duration-200 font-medium"
                    style={{ minHeight: '48px' }}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;