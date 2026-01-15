import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

export type LayoutPreference = 'auto' | 'mobile' | 'desktop';

export const useLayoutPreference = () => {
  const { user } = useAuth();
  const [preference, setPreference] = useState<LayoutPreference>('auto');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const layoutPref = data.layoutPreference as LayoutPreference;
        setPreference(layoutPref || 'auto');
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching layout preference:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const updatePreference = async (newPreference: LayoutPreference) => {
    if (!user?.uid) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        layoutPreference: newPreference
      });
      setPreference(newPreference);
    } catch (error) {
      console.error('Error updating layout preference:', error);
      throw error;
    }
  };

  return {
    preference,
    updatePreference,
    loading
  };
};