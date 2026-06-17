import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { isAppAdminDoc } from '../utils/adminAccess';

/**
 * useAdmin Hook - Checks if the current user has admin privileges
 *
 * Admin status: Firestore users/{uid}.role === 'admin' OR users/{uid}.admin === true
 * (also mirrored in Firebase custom claims when updated via user-admin API).
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
        if (isAppAdminDoc(user)) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const hasAdmin = isAppAdminDoc(userData);
          if (import.meta.env.DEV) {
            console.log('🔍 Admin status check:', {
              uid: user.uid,
              email: user.email,
              role: userData.role,
              admin: userData.admin,
              isAdmin: hasAdmin,
            });
          }
          setIsAdmin(hasAdmin);
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

    void checkAdminStatus();
  }, [user, authLoading]);

  return {
    isAdmin,
    loading: loading || authLoading,
    user,
  };
};
