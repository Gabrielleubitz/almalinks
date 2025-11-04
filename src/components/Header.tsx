import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Users,
  Settings,
  LogOut,
  Calendar,
  Mic,
  Shield,
  ChevronDown,
  Menu,
  X,
  MessageCircle,
  Heart
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import logoSvg from '../assets/alma-links-logo.svg';
import ProfilePictureUploader from './profile/ProfilePictureUploader';

const SpeakerAwareHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isPending } = useAuth();
  
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // Update profile image when user changes
  useEffect(() => {
    if (user?.profileImage) {
      setProfileImageUrl(user.profileImage);
    }
  }, [user?.profileImage]);

  // Close mobile menu when navigating
  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const mobileContainer = target.closest('.mobile-menu-container');
      
      // Close mobile menu if clicking outside
      if (!mobileContainer && showMobileMenu) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMobileMenu]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setShowMobileMenu(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  // If user is pending, don't render navigation options that would lead to protected routes
  if (user && isPending) {
    return (
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center">
              <img
                src={logoSvg}
                alt="Logo"
                className="h-8 w-auto"
                onClick={() => navigate('/')}
                style={{ cursor: 'pointer' }}
              />
            </div>
            
            {/* Pending Status */}
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Pending Approval
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center">
              <img
                src={logoSvg}
                alt="Logo"
                className="h-8 w-auto"
                onClick={() => navigate('/')}
                style={{ cursor: 'pointer' }}
              />
            </div>
            
            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              <a
                href="https://almalinks.org/donate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center space-x-2 bg-gradient-to-r from-brand-gold to-amber-500 hover:from-brand-gold-hover hover:to-amber-600 text-white px-3 py-2 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                <Heart className="h-4 w-4 fill-current" />
                <span className="text-sm">Donate</span>
              </a>
              <button
                onClick={() => navigate('/login')}
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-brand-blue-hover transition-colors duration-200 font-medium"
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Mobile Menu Toggle */}
          <div className="flex items-center">
            <img
              src={logoSvg}
              alt="Logo"
              className="h-8 w-auto"
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => navigate('/dashboard')}
              className={`text-sm font-medium transition-colors duration-200 ${
                location.pathname === '/dashboard'
                  ? 'text-brand-dark font-semibold'
                  : 'text-gray-600 hover:text-brand-blue'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/events')}
              className={`text-sm font-medium transition-colors duration-200 ${
                location.pathname === '/events'
                  ? 'text-brand-dark font-semibold'
                  : 'text-gray-600 hover:text-brand-blue'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => navigate('/members')}
              className={`text-sm font-medium transition-colors duration-200 ${
                location.pathname === '/members'
                  ? 'text-brand-dark font-semibold'
                  : 'text-gray-600 hover:text-brand-blue'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => navigate('/chats')}
              className={`text-sm font-medium transition-colors duration-200 ${
                location.pathname === '/chats'
                  ? 'text-brand-dark font-semibold'
                  : 'text-gray-600 hover:text-brand-blue'
              }`}
            >
              Chats
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className={`text-sm font-medium transition-colors duration-200 ${
                  location.pathname.startsWith('/admin')
                    ? 'text-brand-dark font-semibold'
                    : 'text-brand-dark hover:text-brand-dark-hover'
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Right side - Profile and Actions */}
          <div className="flex items-center space-x-4">
            {/* Donate Button */}
            <a
              href="https://almalinks.org/donate.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center space-x-2 bg-gradient-to-r from-brand-gold to-amber-500 hover:from-brand-gold-hover hover:to-amber-600 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span className="text-sm">Donate</span>
            </a>

            {/* Profile Button - Direct to Edit */}
            <button
              onClick={() => navigate('/profile/edit')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-red-500 to-blue-500 text-white font-bold text-sm">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.displayName || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                    }}
                  />
                ) : (
                  user?.displayName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || '?'
                )}
              </div>
              <span className="font-medium text-sm sm:text-base hidden sm:inline">
                {user?.displayName?.split(' ')[0] || user?.name?.split(' ')[0] || 'User'}
              </span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden bg-white border-t border-gray-200 mobile-menu-container">
          <div className="px-4 py-4 space-y-2">
            <button
              onClick={() => handleNavigation('/dashboard')}
              className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium ${
                location.pathname === '/dashboard'
                  ? 'text-brand-dark bg-brand-light font-semibold'
                  : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleNavigation('/events')}
              className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium ${
                location.pathname === '/events'
                  ? 'text-brand-dark bg-brand-light font-semibold'
                  : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Events</span>
            </button>

            <button
              onClick={() => handleNavigation('/members')}
              className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium ${
                location.pathname === '/members'
                  ? 'text-brand-dark bg-brand-light font-semibold'
                  : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Members</span>
            </button>

            <button
              onClick={() => handleNavigation('/chats')}
              className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium ${
                location.pathname === '/chats'
                  ? 'text-brand-dark bg-brand-light font-semibold'
                  : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chats</span>
            </button>

            {/* Admin Mobile Menu Item */}
            {isAdmin && (
              <button
                onClick={() => handleNavigation('/admin')}
                className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium ${
                  location.pathname.startsWith('/admin')
                    ? 'text-brand-dark bg-brand-light font-semibold'
                    : 'text-brand-dark hover:text-brand-dark-hover hover:bg-gray-50'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>Admin Panel</span>
              </button>
            )}

            {/* Donate Button (Mobile) */}
            <a
              href="https://almalinks.org/donate.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation font-medium bg-gradient-to-r from-brand-gold to-amber-500 hover:from-brand-gold-hover hover:to-amber-600 text-white"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span>Support AlmaLinks</span>
            </a>

            {/* Mobile User Info */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center space-x-3 px-4 py-2">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  {user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={user.displayName || 'User'} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {user?.displayName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {user?.displayName || user?.name || 'User'}
                  </div>
                  <div className="text-sm text-gray-600">{user?.email}</div>
                </div>
              </div>
              
              {/* Mobile Role Badges */}
              <div className="flex flex-wrap gap-2 px-4 py-2">
                {isAdmin && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </span>
                )}
                {!isAdmin && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                    <User className="h-3 w-3 mr-1" />
                    Member
                  </span>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full px-4 py-4 text-base text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2 touch-manipulation"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default SpeakerAwareHeader;