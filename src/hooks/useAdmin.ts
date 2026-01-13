import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

/**
 * useAdmin Hook - Checks if the current user has admin privileges
 * 
 * SECURITY: Admin status is determined by the 'role' field in the user's Firestore document.
 * This role is set by administrators and stored securely in Firestore.
 * Firebase Custom Claims are also set server-side for additional security.
 * 
 * The role check is performed in this order:
 * 1. Check user.role from Firestore (already loaded by useAuth)
 * 2. Fallback to Firestore document if role not in user object
 * 
 * This ensures admin status is always verified against the database, not hardcoded values.
 */
export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) {
        setLoading(true);
        return;
      }
      
      if (!user?.uid) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Primary check: Use role from user object (already loaded from Firestore by useAuth)
        if (user.role === 'admin') {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // Fallback: If role not in user object, check Firestore directly
        // This is a security measure to ensure we always verify against the database
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const hasAdminRole = userData.role === 'admin';
          
          if (import.meta.env.DEV) {
            console.log('🔍 Admin status check:', {
              uid: user.uid,
              email: user.email,
              role: userData.role,
              isAdmin: hasAdminRole
            });
          }
          
          setIsAdmin(hasAdminRole);
        } else {
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