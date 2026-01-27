import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, RotateCcw, LogOut, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import logoSvg from '../../assets/alma-links-logo.svg';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const navigate = useNavigate();
  const { isAdmin, isInUserView, switchToUserView, switchToAdminView, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <Link to="/" className="hover:opacity-80 transition-opacity duration-200 flex-shrink-0">
              <img 
                src={logoSvg}
                alt="Alma Links Logo" 
                className="h-8 sm:h-10 w-auto"
              />
            </Link>
            <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-brand-dark flex-shrink-0" />
              <span className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</span>
              {isInUserView && (
                <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-800 flex-shrink-0">
                  User View
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:flex-shrink-0">
            {/* Admin View Toggle Button */}
            {isAdmin && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                {isInUserView ? (
                  <button
                    onClick={switchToAdminView}
                    className="flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-3 sm:px-4 py-2 rounded-full hover:from-brand-blue-mid hover:to-brand-blue-dark transition-all duration-300 font-medium shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px] sm:min-h-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Back to Admin</span>
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                    <Link
                      to="/dashboard"
                      onClick={switchToUserView}
                      className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 py-2 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-medium shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px] sm:min-h-0"
                    >
                      <User className="h-4 w-4" />
                      <span className="whitespace-nowrap">View User Dashboard</span>
                    </Link>
                    
                    <Link
                      to="/events"
                      onClick={switchToUserView}
                      className="flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-4 py-2 rounded-full hover:from-green-700 hover:to-green-800 transition-all duration-300 font-medium shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px] sm:min-h-0"
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="whitespace-nowrap">View Events</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100 min-h-[44px] sm:min-h-0"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
      {subtitle && (
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 pb-4 sm:pb-6">
          <p className="text-base sm:text-xl text-gray-600">{subtitle}</p>
        </div>
      )}
    </header>
  );
};

export default AdminHeader;