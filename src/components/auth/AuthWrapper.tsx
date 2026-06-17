import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const AuthWrapper: React.FC = () => {
  const { user, loading, isAdmin, checkProfileComplete, isPending, isRejected } = useAuth();
  const navigate = useNavigate();

  // Handle role-based navigation after login
  useEffect(() => {
    if (user && !loading) {
      console.log('🔄 AuthWrapper - User authenticated, checking role and profile:', user.role);
      
      // First check if user is pending or rejected
      if (isPending) {
        console.log('⏳ AuthWrapper - User is pending approval, redirecting to pending page');
        navigate('/pending', { replace: true });
        return;
      }
      
      if (isRejected) {
        console.log('❌ AuthWrapper - User is rejected, redirecting to re-request access');
        navigate('/re-request-access', { replace: true });
        return;
      }
      
      // Then handle role-based navigation
      if (isAdmin) {
        console.log('👑 Redirecting admin to /admin');
        navigate('/admin', { replace: true });
      } else if (user.role === 'member' || user.status === 'approved') {
        if (checkProfileComplete()) {
          console.log('👤 Redirecting member to /members');
          navigate('/members', { replace: true });
        } else {
          console.log('👤 Redirecting member to complete profile');
          navigate('/complete-profile', { replace: true });
        }
      } else {
        console.log('❓ Unknown role, redirecting to unauthorized');
        navigate('/unauthorized', { replace: true });
      }
    } else if (!loading && !user) {
      console.log('❌ No user, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate, isAdmin, checkProfileComplete, isPending, isRejected]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // This component just handles redirects, so we don't render anything
  return null;
};

export default AuthWrapper;