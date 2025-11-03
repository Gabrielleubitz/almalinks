import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

// Admin email list - in production, this should be in Firestore or Firebase Custom Claims
const ADMIN_EMAILS = [
  'admin@almalinks.com',
  'gabriel@almalinks.com',
  'info@almalinks.com',
  // Add more admin emails here
];

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user?.email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Checking admin status for:', user.email);
        
        // Check if user email is in admin list
        const isAdminEmail = ADMIN_EMAILS.includes(user.email.toLowerCase());
        
        if (isAdminEmail) {
          console.log('✅ User is admin:', user.email);
          setIsAdmin(true);
        } else {
          console.log('❌ User is not admin:', user.email);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('❌ Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  return {
    isAdmin,
    loading: loading || authLoading,
    user
  };
};