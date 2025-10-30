import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { ActivityService } from '../services/activityService';
import { ActivityType } from '../types/activity';

// Hook for tracking page views and user activities
export const useActivityTracking = () => {
  const { user } = useAuth();
  const lastPageRef = useRef<string | null>(null);

  // Track page views when location changes
  useEffect(() => {
    if (!user?.uid) return;

    const currentPage = window.location.pathname;
    
    // Don't track the same page twice in a row
    if (lastPageRef.current === currentPage) return;
    lastPageRef.current = currentPage;

    // Only track meaningful pages (skip admin pages and edit pages for regular users)
    const pagesToTrack = [
      '/dashboard',
      '/events',
      '/members',
      '/chats',
      '/profile'
    ];

    const isTrackedPage = pagesToTrack.some(page => currentPage.startsWith(page));
    
    if (isTrackedPage) {
      const pageDisplayName = getPageDisplayName(currentPage);
      ActivityService.logPageView(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        pageDisplayName
      );
    }
  }, [user, window.location.pathname]);

  // Helper function to get display name for pages
  const getPageDisplayName = (path: string): string => {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/events')) return 'Events';
    if (path.startsWith('/members')) return 'Members Directory';
    if (path.startsWith('/chats')) return 'Chats';
    if (path.startsWith('/profile')) return 'Profile';
    return path;
  };

  // Return tracking functions for manual use
  return {
    logActivity: (
      activityType: ActivityType, 
      description: string, 
      metadata?: any
    ) => {
      if (!user?.uid) return;
      
      ActivityService.logActivity(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        activityType,
        description,
        metadata
      );
    },

    logLogin: () => {
      if (!user?.uid) return;
      ActivityService.logLogin(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User'
      );
    },

    logLogout: () => {
      if (!user?.uid) return;
      ActivityService.logLogout(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User'
      );
    },

    logProfileUpdate: (changes: string[]) => {
      if (!user?.uid) return;
      ActivityService.logProfileUpdate(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        changes
      );
    },

    logEventRegistration: (eventId: string, eventName: string) => {
      if (!user?.uid) return;
      ActivityService.logEventRegistration(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        eventId,
        eventName
      );
    },

    logConnectionRequest: (targetUserId: string, targetName: string) => {
      if (!user?.uid) return;
      ActivityService.logConnectionRequest(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        targetUserId,
        targetName
      );
    },

    logAdminAction: (action: string, details?: any) => {
      if (!user?.uid) return;
      ActivityService.logAdminAction(
        user.uid,
        user.email || '',
        user.displayName || user.name || 'User',
        action,
        details
      );
    }
  };
};