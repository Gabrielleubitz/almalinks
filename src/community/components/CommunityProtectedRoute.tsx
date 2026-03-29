import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCommunityAccess } from '../hooks/useCommunityAccess';

export default function CommunityProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { enabled, loading: communityLoading, hasAnyMembership } = useCommunityAccess();

  if (!enabled) {
    // Requirement allows 404 or redirect; we choose redirect to main app.
    return <Navigate to="/dashboard" replace />;
  }

  if (authLoading || communityLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Loading community access…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Critical: community access is NOT inherited from Altius admin.
  if (!hasAnyMembership) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
}

