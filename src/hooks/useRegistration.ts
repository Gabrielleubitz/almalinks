import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

export interface RegistrationData {
  id?: string; // Document ID
  name: string;
  email: string;
  phone: string;
  work: string;
  source: 'dashboard' | 'ai-agent';
  status: 'registered' | 'attended';
  timestamp: any;
  checkedInAt?: any;
  uid?: string; // For linking to Firebase Auth user
  eventId?: string; // For ticket cancellation
  eventDate?: string; // For ticket cancellation
}

export const useRegistration = () => {
  const { user } = useAuth();
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load existing registration when user changes
  useEffect(() => {
    const loadRegistration = async () => {
      if (!user?.uid) {
        setRegistration(null);
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Loading registration for user UID:', user.uid);
        setError(null);
        
        // Check if registration exists for this user's UID (primary method)
        const userDocRef = doc(db, 'registrations', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = { id: userDocSnap.id, ...userDocSnap.data() } as RegistrationData;
          console.log('✅ Registration found by UID:', data);
          setRegistration(data);
        } else {
          // Fallback: Check by email for existing registrations
          const q = query(collection(db, 'registrations'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const registrationDoc = querySnapshot.docs[0];
            const data = { id: registrationDoc.id, ...registrationDoc.data() } as RegistrationData;
            console.log('✅ Registration found by email (migrating to UID-based):', data);
            
            // Migrate to UID-based document if it's not already
            if (registrationDoc.id !== user.uid) {
              console.log('🔄 Migrating registration to UID-based document');
              await setDoc(doc(db, 'registrations', user.uid), {
                ...data,
                uid: user.uid
              });
              // Note: We keep the old document for now to avoid data loss
            }
            
            setRegistration(data);
          } else {
            console.log('📝 No registration found for user');
            setRegistration(null);
          }
        }
      } catch (err: any) {
        console.error('❌ Error loading registration:', err);
        setError(`Failed to load registration: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadRegistration();
  }, [user]);

  const checkExistingRegistration = async (uid: string): Promise<boolean> => {
    try {
      // Check by UID first (primary method)
      const userDocRef = doc(db, 'registrations', uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        return true;
      }

      // Fallback: Check by email
      if (user?.email) {
        const q = query(collection(db, 'registrations'), where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking existing registration:', error);
      return false;
    }
  };

  const submitRegistration = async (name: string, email: string, phone: string, work: string) => {
    if (!user?.uid) {
      throw new Error('User must be logged in to register');
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log('📝 Submitting registration for UID:', user.uid);
      
      // Check for existing registration by UID
      const exists = await checkExistingRegistration(user.uid);
      if (exists) {
        throw new Error("You've already reserved a spot for this event.");
      }
      
      const registrationData: RegistrationData = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        work: work.trim(),
        source: 'dashboard',
        status: 'registered',
        timestamp: serverTimestamp(),
        uid: user.uid
      };

      // Use user UID as document ID to ensure uniqueness and prevent duplicates
      const docRef = doc(db, 'registrations', user.uid);
      await setDoc(docRef, registrationData);

      // Add the document ID to the returned data
      const finalData = { id: user.uid, ...registrationData };

      console.log('✅ Registration saved successfully with UID as ID:', user.uid);
      setRegistration(finalData);

      // Send email notifications
      try {
        // Prepare event details for email
        const eventDetails = {
          name: "AlmaLinks 4.0",
          date: "June 28th, 2025", 
          time: "18:30 - 22:00",
          location: "Deli Vino, Netanya",
          address: "Natan Yonatan St 10, Netanya, Israel",
          description: "Join us for AlmaLinks 4.0 - where bold ideas meet real conversations. This exclusive event brings together founders, investors, and operators for meaningful networking and discussions about AI agents in business."
        };

        // Send confirmation email to user
        await fetch('/api/email-service', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'registration',
            email: finalData.email,
            name: finalData.name,
            eventDetails: eventDetails
          })
        });

        // Send admin notification
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@wineandgrind.com';
        await fetch('/api/email-service', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'admin-notification',
            email: adminEmail,
            subject: 'New Event Registration',
            name: finalData.name,
            userEmail: finalData.email,
            phone: finalData.phone,
            work: finalData.work,
            eventDetails: eventDetails
          })
        });

        console.log('✅ Email notifications sent');
      } catch (emailError) {
        console.warn('⚠️ Email notifications failed:', emailError);
        // Don't throw error - registration was successful even if emails failed
      }
      
      return finalData;
    } catch (err: any) {
      console.error('❌ Registration failed:', err);
      const errorMessage = err.message || 'Failed to save registration. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const updateAttendanceStatus = async (registrationId: string, status: 'registered' | 'attended') => {
    try {
      const docRef = doc(db, 'registrations', registrationId);
      const updateData: any = { 
        status,
        ...(status === 'attended' ? { checkedInAt: serverTimestamp() } : {})
      };
      
      await updateDoc(docRef, updateData);
      console.log('✅ Attendance status updated:', status);
      
      // Update local state if this is the current user's registration
      if (registration && registration.id === registrationId) {
        setRegistration({ ...registration, status, checkedInAt: updateData.checkedInAt });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error updating attendance status:', error);
      throw error;
    }
  };

  const cancelRegistration = async (registrationId: string) => {
    if (!user?.uid) {
      throw new Error('User must be logged in to cancel registration');
    }

    if (registrationId !== user.uid) {
      throw new Error('You can only cancel your own registration');
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log('🔄 Cancelling registration for UID:', user.uid);
      
      // Delete the registration document
      const docRef = doc(db, 'registrations', user.uid);
      await deleteDoc(docRef);

      console.log('✅ Registration cancelled successfully');
      setRegistration(null);
      
      return true;
    } catch (err: any) {
      console.error('❌ Registration cancellation failed:', err);
      const errorMessage = err.message || 'Failed to cancel registration. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    registration,
    loading,
    error,
    submitting,
    submitRegistration,
    updateAttendanceStatus,
    cancelRegistration,
    isRegistered: !!registration
  };
};