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
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import logoSvg from '../assets/alma-links-logo.svg';
import ProfilePictureUploader from './profile/ProfilePictureUploader';

const SpeakerAwareHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isPending } = useAuth(); // Added isPending check
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);


  // Update profile image when user changes
  useEffect(() => {
    if (user?.profileImage) {
      setProfileImageUrl(user.profileImage);
    }
  }, [user?.profileImage]);

  // Close dropdowns when clicking outside or navigating
  useEffect(() => {
    setShowProfileMenu(false);
    setShowMobileMenu(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const mobileContainer = target.closest('.mobile-menu-container');
      
      // Close profile menu if clicking outside
      if (showProfileMenu && !target.closest('[data-profile-dropdown]')) {
        setShowProfileMenu(false);
      }
      
      // Close mobile menu if clicking outside
      if (!mobileContainer && showMobileMenu) {
        setShowMobileMenu(false);
      }
    };

    if (showProfileMenu || showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu, showMobileMenu]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setShowProfileMenu(false);
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


  // Handle profile picture upload success
  const handleProfilePictureSuccess = (imageUrl: string) => {
    setProfileImageUrl(imageUrl);
    setImageUploadError(null);
    setShowProfileMenu(false); // Close menu after successful upload
  };

  // Handle profile picture upload error
  const handleProfilePictureError = (errorMessage: string) => {
    setImageUploadError(errorMessage);
  };

  // If user is pending, don't render navigation options that would lead to protected routes
  if (user && isPending) {
    return (
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="flex items-center"
              >
                <img 
                  src={logoSvg}
                  alt="AlmaLinks Logo" 
                  className="h-8 sm:h-10 w-auto"
                />
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Don't render anything if no user (not authenticated)
  if (!user) {
    return (
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="flex items-center"
              >
                <img 
                  src={logoSvg}
                  alt="AlmaLinks Logo" 
                  className="h-8 sm:h-10 w-auto"
                />
              </button>
            </div>
            <nav className="hidden md:flex space-x-8">
              <button 
                onClick={() => navigate('/events')}
                className="text-gray-600 hover:text-red-600 font-medium transition-colors"
              >
                Events
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="text-gray-600 hover:text-red-600 font-medium transition-colors"
              >
                Login
              </button>
            </nav>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-3 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors touch-manipulation"
              aria-label="Toggle mobile menu"
            >
              {showMobileMenu ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
          </div>
          
          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <button 
                onClick={() => {
                  navigate('/events');
                  setShowMobileMenu(false);
                }}
                className="block w-full text-left px-4 py-4 text-base text-gray-600 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors touch-manipulation"
              >
                Events
              </button>
              <button 
                onClick={() => {
                  navigate('/login');
                  setShowMobileMenu(false);
                }}
                className="block w-full text-left px-4 py-4 text-base text-gray-600 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors touch-manipulation"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-[200]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
        <div className="flex items-center justify-between py-4 overflow-visible">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => handleNavigation('/')}
              className="flex items-center"
            >
              <img 
                src={logoSvg}
                alt="Alma Links Logo" 
                className="h-8 sm:h-10 w-auto"
              />
            </button>
          </div>

          {/* Desktop Navigation - Center */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* Regular Navigation Items */}
            <button 
              onClick={() => handleNavigation('/dashboard')}
              className={`font-medium transition-colors ${
                location.pathname === '/dashboard' 
                  ? 'text-red-600' 
                  : 'text-gray-600 hover:text-red-600'
              }`}
            >
              Dashboard
            </button>
            
            <button 
              onClick={() => handleNavigation('/events')}
              className={`font-medium transition-colors ${
                location.pathname === '/events' 
                  ? 'text-red-600' 
                  : 'text-gray-600 hover:text-red-600'
              }`}
            >
              Events
            </button>
            
            <button 
              onClick={() => handleNavigation('/members')}
              className={`font-medium transition-colors ${
                location.pathname === '/members' 
                  ? 'text-red-600' 
                  : 'text-gray-600 hover:text-red-600'
              }`}
            >
              Members
            </button>

            <button 
              onClick={() => handleNavigation('/chats')}
              className={`flex items-center space-x-1 font-medium transition-colors ${
                location.pathname.startsWith('/chats')
                  ? 'text-brand-light' 
                  : 'text-gray-600 hover:text-brand-light'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chats</span>
            </button>


            {/* Admin Navigation - Only show if user is admin */}
            {isAdmin && (
              <button 
                onClick={() => handleNavigation('/admin')}
                className={`flex items-center space-x-2 font-medium transition-colors px-3 py-2 rounded-full ${
                  location.pathname.startsWith('/admin')
                    ? 'text-purple-700 bg-purple-100'
                    : 'text-brand-dark hover:text-purple-700 bg-purple-50 hover:bg-purple-100'
                }`}
                title="Admin Panel"
              >
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Profile Dropdown - Right side */}
          <div className="flex items-center space-x-4">
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

                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999]">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        {user.profileImage ? (
                          <img 
                            src={user.profileImage} 
                            alt={user.displayName || 'User'} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-500 to-blue-500 flex items-center justify-center text-white font-bold">
                            {user?.displayName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {user?.displayName || user?.name || 'User'}
                        </div>
                        <div className="text-sm text-gray-500">{user?.email}</div>
                        {/* Role Badges */}
                        <div className="flex flex-wrap gap-1 mt-1">
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
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate('/profile/edit');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/dashboard');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>My Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/events');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Browse Events</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        navigate('/members');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      <span>Browse Members</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/chats');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Chats</span>
                    </button>


                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigate('/admin');
                          setShowProfileMenu(false);
                        }}
                        className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin Panel</span>
                      </button>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-2">
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="mobile-menu-container">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-3 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors touch-manipulation"
                aria-label="Toggle mobile menu"
              >
                {showMobileMenu ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-4 mobile-menu-container">
            <div className="space-y-2">
              <button 
                onClick={() => handleNavigation('/dashboard')}
                className={`block w-full text-left px-4 py-4 text-base rounded-lg transition-colors touch-manipulation ${
                  location.pathname === '/dashboard'
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 hover:text-red-600 hover:bg-gray-50'
                }`}
              >
                Dashboard
              </button>
              
              <button 
                onClick={() => handleNavigation('/events')}
                className={`block w-full text-left px-4 py-4 text-base rounded-lg transition-colors touch-manipulation ${
                  location.pathname === '/events'
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 hover:text-red-600 hover:bg-gray-50'
                }`}
              >
                Events
              </button>
              
              <button 
                onClick={() => handleNavigation('/members')}
                className={`block w-full text-left px-4 py-4 text-base rounded-lg transition-colors touch-manipulation ${
                  location.pathname === '/members'
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 hover:text-red-600 hover:bg-gray-50'
                }`}
              >
                Members
              </button>

              <button 
                onClick={() => handleNavigation('/chats')}
                className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation ${
                  location.pathname.startsWith('/chats')
                    ? 'text-brand-light bg-blue-50'
                    : 'text-gray-600 hover:text-brand-light hover:bg-blue-50'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chats</span>
              </button>


              {/* Admin Mobile Menu Item */}
              {isAdmin && (
                <button 
                  onClick={() => handleNavigation('/admin')}
                  className={`flex items-center space-x-3 w-full px-4 py-4 text-base rounded-lg transition-colors touch-manipulation ${
                    location.pathname.startsWith('/admin')
                      ? 'text-purple-700 bg-purple-50'
                      : 'text-brand-dark hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Panel</span>
                </button>
              )}

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
      </div>
    </header>
  );
};

export default SpeakerAwareHeader;