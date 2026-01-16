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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-4">
            <Link to="/" className="hover:opacity-80 transition-opacity duration-200">
              <img 
                src={logoSvg}
                alt="Alma Links Logo" 
                className="h-10 w-auto"
              />
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-brand-dark" />
              <span className="text-lg font-semibold text-gray-900">{title}</span>
              {isInUserView && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                  User View
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Admin View Toggle Button */}
            {isAdmin && (
              <div className="flex items-center space-x-2">
                {isInUserView ? (
                  <button
                    onClick={switchToAdminView}
                    className="flex items-center space-x-2 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 py-2 rounded-full hover:from-brand-blue-mid hover:to-brand-blue-dark transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Back to Admin</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      to="/dashboard"
                      onClick={switchToUserView}
                      className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                    >
                      <User className="h-4 w-4" />
                      <span>View User Dashboard</span>
                    </Link>
                    
                    <Link
                      to="/events"
                      onClick={switchToUserView}
                      className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-full hover:from-green-700 hover:to-green-800 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>View Events</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
      {subtitle && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <p className="text-xl text-gray-600">{subtitle}</p>
        </div>
      )}
    </header>
  );
};

export default AdminHeader;