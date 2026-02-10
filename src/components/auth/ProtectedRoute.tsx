import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'member';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, loading, isAdmin, isMember, isPending, isRejected, networkError, roleLoading } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);

  // Show retry button after multiple attempts
  useEffect(() => {
    if (networkError && retryCount >= 2) {
      setShowRetryButton(true);
    }
  }, [networkError, retryCount]);

  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setShowRetryButton(false);
    window.location.reload();
  };

  // Show loading while checking authentication or roles
  if (loading || roleLoading) {
    console.log('⏳ ProtectedRoute - Loading state:', { loading, roleLoading });
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {roleLoading ? 'Loading user permissions...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  // Show network error message
  if (networkError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Network Connection Error</h2>
          <p className="text-gray-600 mb-6">
            You appear to be offline. Please check your internet connection and try again.
          </p>
          {showRetryButton && (
            <button
              onClick={handleRetry}
              className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('❌ ProtectedRoute - User not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check if user is pending approval - CRITICAL CHECK
  if (isPending) {
    console.log('⏳ ProtectedRoute - User is pending approval, redirecting to pending page');
    return <Navigate to="/pending" replace />;
  }

  // Check if user is rejected
  if (isRejected) {
    console.log('❌ ProtectedRoute - User is rejected, redirecting to re-request access');
    return <Navigate to="/re-request-access" replace />;
  }

  // Check if user must change password - CRITICAL CHECK
  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    console.log('🔐 ProtectedRoute - User must change password, redirecting to change password page');
    return <Navigate to="/change-password" replace />;
  }

  // First sign-in: redirect to welcome onboarding if not yet completed (except when already on /welcome)
  if (user.hasSeenOnboarding !== true && window.location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  // Check role-based access
  if (requiredRole) {
    console.log('🔍 ProtectedRoute - Role check:', { 
      requiredRole, 
      userRole: user?.role, 
      isAdmin, 
      isMember,
      loading
    });
    
    if (requiredRole === 'admin' && !isAdmin) {
      console.log('❌ ProtectedRoute - Admin access required but user is not admin');
      console.log('   User data:', { uid: user?.uid, role: user?.role, email: user?.email });
      return <Navigate to="/unauthorized" replace />;
    }
    
    if (requiredRole === 'member' && !isMember && !isAdmin) {
      console.log('❌ ProtectedRoute - Member access required but user has no valid role');
      return <Navigate to="/unauthorized" replace />;
    }
    
    // For member routes, also check that user is approved (not pending or rejected)
    if (requiredRole === 'member' && !isApproved && !isAdmin) {
      console.log('❌ ProtectedRoute - Member access required but user is not approved');
      return <Navigate to="/pending" replace />;
    }
  }

  console.log('✅ ProtectedRoute - Access granted for role:', user.role);
  return <>{children}</>;
};

export default ProtectedRoute;