import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, retryOnNetworkFailure } from '../firebase/config';
import { ActivityService } from '../services/activityService';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  status?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  profileImage?: string | null;
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
  mustChangePassword?: boolean;
  tempPasswordSet?: boolean;
  passwordResetForcedAt?: any;
  passwordResetForcedBy?: string;
}

export interface ProfileData {
  name?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  status?: string;
  profileImage?: string | null;
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
}

const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please try logging in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user'>('admin'); // Track admin view mode
  const [networkError, setNetworkError] = useState<boolean>(false);

  // Function to get user profile from Firestore
  const getUserProfile = async (uid: string): Promise<AuthUser | null> => {
    try {
      console.log('🔍 Checking user profile for UID:', uid);
      const userDoc = await retryOnNetworkFailure(async () => getDoc(doc(db, 'users', uid)));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('📄 User profile data:', userData);
        
        return {
          uid,
          email: userData.email || null,
          displayName: userData.name || userData.displayName || null,
          role: userData.role || 'member',
          status: userData.status || 'approved', // Default to approved for existing users
          phone: userData.phone || '',
          company: userData.company || '',
          work: userData.work || '',
          linkedinUsername: userData.linkedinUsername || '',
          position: userData.position || '',
          profileImage: userData.profileImage || null,
          bioTitle: userData.bioTitle || '',
          bio: userData.bio || '',
          city: userData.city || '',
          country: userData.country || '',
          timezone: userData.timezone || '',
          website: userData.website || '',
          twitter: userData.twitter || '',
          skills: userData.skills || [],
          mustChangePassword: userData.mustChangePassword || false,
          tempPasswordSet: userData.tempPasswordSet || false,
          passwordResetForcedAt: userData.passwordResetForcedAt || null,
          passwordResetForcedBy: userData.passwordResetForcedBy || null
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return null;
    }
  };

  // Function to create or update user profile
  const createOrUpdateUserProfile = async (firebaseUser: User, profileData?: ProfileData) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await retryOnNetworkFailure(async () => getDoc(userDocRef));
      
      const baseData = {
        email: firebaseUser.email,
        lastLogin: serverTimestamp()
      };

      if (!userDoc.exists()) {
        // Create new user profile
        const newUserData = {
          ...baseData,
          name: profileData?.name || firebaseUser.displayName || '',
          phone: profileData?.phone || '',
          company: profileData?.company || '',
          work: profileData?.work || '',
          linkedinUsername: profileData?.linkedinUsername || '',
          position: profileData?.position || '',
          profileImage: profileData?.profileImage || null,
          bioTitle: profileData?.bioTitle || '',
          bio: profileData?.bio || '',
          city: profileData?.city || '',
          country: profileData?.country || '',
          timezone: profileData?.timezone || '',
          website: profileData?.website || '',
          twitter: profileData?.twitter || '',
          skills: profileData?.skills || [],
          role: 'member',
          status: 'pending', // New users start with pending status
          createdAt: serverTimestamp()
        };
        
        await retryOnNetworkFailure(async () => setDoc(userDocRef, newUserData));
        console.log('✅ Created new user profile with pending status');
        
        // Send signup confirmation email to user
        try {
          await fetch('/api/email-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'signup',
              email: newUserData.email,
              name: newUserData.name
            })
          });
          console.log('✅ Signup confirmation email sent to user');
        } catch (emailError) {
          console.error('❌ Failed to send signup confirmation email:', emailError);
        }
        
        // Send admin notifications for pending approval (both SMS and email)
        try {
          // Send SMS notification
          await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: '+972584477757',
              body: `🔔 New user pending approval: ${newUserData.name} (${newUserData.email}). Please review in admin panel.`
            })
          });
          console.log('✅ Admin SMS notification sent for pending user');
        } catch (smsError) {
          console.error('❌ Failed to send admin SMS notification:', smsError);
        }
        
        // Send email notification to admin
        try {
          await fetch('/api/email-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'admin-notification',
              email: process.env.REACT_APP_ADMIN_EMAIL || 'admin@wineandgrind.com',
              subject: 'New User Registration - Pending Approval',
              name: newUserData.name,
              userEmail: newUserData.email,
              phone: newUserData.phone || 'Not provided',
              work: `${newUserData.work || 'Not provided'} at ${newUserData.company || 'Not provided'}`
            })
          });
          console.log('✅ Admin email notification sent for pending user');
        } catch (emailError) {
          console.error('❌ Failed to send admin email notification:', emailError);
        }
        
        return newUserData;
      } else {
        // Update existing user profile
        const existingData = userDoc.data();
        const updatedData = {
          ...baseData,
          ...(profileData?.name && { name: profileData.name }),
          ...(profileData?.phone && { phone: profileData.phone }),
          ...(profileData?.company && { company: profileData.company }),
          ...(profileData?.work && { work: profileData.work }),
          ...(profileData?.linkedinUsername && { linkedinUsername: profileData.linkedinUsername }),
          ...(profileData?.position && { position: profileData.position }),
          ...(profileData?.profileImage !== undefined && { profileImage: profileData.profileImage }),
          ...(profileData?.bioTitle !== undefined && { bioTitle: profileData.bioTitle }),
          ...(profileData?.bio !== undefined && { bio: profileData.bio }),
          ...(profileData?.city !== undefined && { city: profileData.city }),
          ...(profileData?.country !== undefined && { country: profileData.country }),
          ...(profileData?.timezone !== undefined && { timezone: profileData.timezone }),
          ...(profileData?.website !== undefined && { website: profileData.website }),
          ...(profileData?.twitter !== undefined && { twitter: profileData.twitter }),
          ...(profileData?.skills !== undefined && { skills: profileData.skills })
        };
        
        await retryOnNetworkFailure(async () => setDoc(userDocRef, updatedData, { merge: true }));
        console.log('✅ Updated user profile');
        return { ...existingData, ...updatedData };
      }
    } catch (error) {
      console.error('❌ Error creating/updating user profile:', error);
      throw error;
    }
  };

  // Function to check if profile is complete
  const checkProfileComplete = (): boolean => {
    if (!user) return false;
    return !!(user.displayName && user.phone && user.company && user.work && user.linkedinUsername && user.position);
  };

  // Function to update user profile
  const updateUserProfile = async (profileData: ProfileData) => {
    if (!user?.uid) {
      throw new Error('User must be logged in to update profile');
    }

    try {
      setError(null);
      const userDocRef = doc(db, 'users', user.uid);
      
      const updateData = {
        ...(profileData.name && { name: profileData.name }),
        ...(profileData.phone && { phone: profileData.phone }),
        ...(profileData.company && { company: profileData.company }),
        ...(profileData.work && { work: profileData.work }),
        ...(profileData.linkedinUsername && { linkedinUsername: profileData.linkedinUsername }),
        ...(profileData.position && { position: profileData.position }),
        ...(profileData.profileImage !== undefined && { profileImage: profileData.profileImage }),
        ...(profileData.bioTitle !== undefined && { bioTitle: profileData.bioTitle }),
        ...(profileData.bio !== undefined && { bio: profileData.bio }),
        ...(profileData.city !== undefined && { city: profileData.city }),
        ...(profileData.country !== undefined && { country: profileData.country }),
        ...(profileData.timezone !== undefined && { timezone: profileData.timezone }),
        ...(profileData.website !== undefined && { website: profileData.website }),
        ...(profileData.twitter !== undefined && { twitter: profileData.twitter }),
        ...(profileData.skills !== undefined && { skills: profileData.skills }),
        updatedAt: serverTimestamp()
      };

      await retryOnNetworkFailure(async () => setDoc(userDocRef, updateData, { merge: true }));
      
      // Update local user state
      setUser(prev => prev ? {
        ...prev,
        displayName: profileData.name || prev.displayName,
        phone: profileData.phone || prev.phone,
        company: profileData.company || prev.company,
        work: profileData.work || prev.work,
        linkedinUsername: profileData.linkedinUsername || prev.linkedinUsername,
        position: profileData.position || prev.position,
        profileImage: profileData.profileImage !== undefined ? profileData.profileImage : prev.profileImage,
        bioTitle: profileData.bioTitle !== undefined ? profileData.bioTitle : prev.bioTitle,
        bio: profileData.bio !== undefined ? profileData.bio : prev.bio,
        city: profileData.city !== undefined ? profileData.city : prev.city,
        country: profileData.country !== undefined ? profileData.country : prev.country,
        timezone: profileData.timezone !== undefined ? profileData.timezone : prev.timezone,
        website: profileData.website !== undefined ? profileData.website : prev.website,
        twitter: profileData.twitter !== undefined ? profileData.twitter : prev.twitter,
        skills: profileData.skills !== undefined ? profileData.skills : prev.skills
      } : null);

      console.log('✅ Profile updated successfully');
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      throw error;
    }
  };

  // Admin view mode functions
  const switchToUserView = () => {
    console.log('🔄 Admin switching to user view');
    setAdminViewMode('user');
  };

  const switchToAdminView = () => {
    console.log('🔄 Admin switching back to admin view');
    setAdminViewMode('admin');
  };

  // Set up auth state listener on app mount
  useEffect(() => {
    console.log('🔄 Setting up Firebase Auth state listener with local persistence...');
    
    // Set persistence immediately
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('✅ Local persistence set successfully');
      })
      .catch((error) => {
        console.error('❌ Error setting local persistence:', error);
        if (error.code === 'auth/network-request-failed') {
          setNetworkError(true);
        }
      });
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser ? 'User signed in' : 'User signed out');
      
      if (firebaseUser) {
        console.log('✅ User is signed in:', firebaseUser.email);
        console.log('🔍 User UID:', firebaseUser.uid);
        
        setRoleLoading(true);
        
        try {
          // Get user profile from Firestore
          let userProfile = await getUserProfile(firebaseUser.uid);
          
          if (!userProfile) {
            // If no Firestore profile exists, create one from Firebase Auth data
            console.log('📝 Creating missing Firestore profile from Firebase Auth data');
            const userData = await createOrUpdateUserProfile(firebaseUser);
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: userData.name || firebaseUser.displayName,
              role: userData.role || 'member',
              status: userData.status || 'pending',
              phone: userData.phone || '',
              company: userData.company || '',
              work: userData.work || '',
              linkedinUsername: userData.linkedinUsername || '',
              position: userData.position || '',
              profileImage: userData.profileImage || null,
              bioTitle: userData.bioTitle || '',
              bio: userData.bio || '',
              city: userData.city || '',
              country: userData.country || '',
              timezone: userData.timezone || '',
              website: userData.website || '',
              twitter: userData.twitter || '',
              skills: userData.skills || []
            };
          }
          
          console.log('✅ Setting auth user with profile:', userProfile);
          setUser(userProfile);

          // Log login activity only on actual new login (not page refresh)
          // Use sessionStorage to track if login was already logged this session
          const sessionKey = `login_logged_${userProfile.uid}`;
          const loginAlreadyLogged = sessionStorage.getItem(sessionKey);

          if (!loginAlreadyLogged) {
            // This is a new session/login
            ActivityService.logLogin(
              userProfile.uid,
              userProfile.email || '',
              userProfile.displayName || userProfile.name || 'User'
            );
            // Mark login as logged for this session
            sessionStorage.setItem(sessionKey, 'true');
            console.log('✅ Login activity logged for new session');
          } else {
            console.log('🔄 Session restored, skipping login activity log');
          }
          
          // Set initial admin view mode based on role
          if (userProfile.role === 'admin') {
            setAdminViewMode('admin');
          }
          
          // Check for pending connection in localStorage
          const pendingConnection = localStorage.getItem('pendingConnection');
          if (pendingConnection) {
            try {
              const { targetUserId, eventId } = JSON.parse(pendingConnection);
              if (targetUserId) {
                console.log('🔄 Found pending connection, redirecting to connect page');
                window.location.href = `/connect?to=${targetUserId}&event=${eventId || 'default'}`;
              }
            } catch (e) {
              console.error('❌ Error parsing pending connection:', e);
            } finally {
              // Clear pending connection
              localStorage.removeItem('pendingConnection');
            }
          }
        } catch (error) {
          console.error('❌ Error setting up user:', error);
          // Set user with minimal data on error
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            role: 'member',
            status: 'pending',
            phone: '',
            company: '',
            work: '',
            linkedinUsername: '',
            position: '',
            bioTitle: '',
            bio: '',
            city: '',
            country: '',
            timezone: '',
            website: '',
            twitter: '',
            skills: []
          });
          
          if (error.code === 'auth/network-request-failed' || error.code === 'unavailable') {
            setNetworkError(true);
          }
        } finally {
          setRoleLoading(false);
        }
      } else {
        console.log('❌ User is signed out');
        setUser(null);
        setAdminViewMode('admin'); // Reset to admin mode
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up Firebase Auth listener');
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      console.log('🔐 Attempting to sign in user:', email);
      
      // Ensure local persistence is set before signing in
      await setPersistence(auth, browserLocalPersistence);
      console.log('✅ Local persistence confirmed');
      
      // Attempt Firebase Auth login with retry logic
      const result = await retryOnNetworkFailure(async () => {
        return signInWithEmailAndPassword(auth, email, password);
      });
      
      console.log('✅ Firebase Auth sign in successful:', result.user.email);
      
      // Check if Firestore profile exists, create if missing
      const userProfile = await getUserProfile(result.user.uid);
      if (!userProfile) {
        console.log('📝 Creating missing Firestore profile after login');
        await createOrUpdateUserProfile(result.user);
      }
      
      // The onAuthStateChanged listener will handle role fetching and navigation
      // We don't need to check status here anymore - we'll let the ProtectedRoute component handle that
      
    } catch (err: any) {
      console.error('❌ Sign in failed:', err.code, err.message);
      
      // Handle specific Firebase Auth errors
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address. Please sign up first.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
        setNetworkError(true);
      } else {
        const friendlyMessage = getAuthErrorMessage(err.code);
        setError(friendlyMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string, profileData?: ProfileData) => {
    try {
      setError(null);
      setLoading(true);
      console.log('📝 Attempting to register user:', email);
      
      // Ensure local persistence is set before registering
      await setPersistence(auth, browserLocalPersistence);
      console.log('✅ Local persistence confirmed for registration');
      
      // Create Firebase Auth account with retry logic
      const result = await retryOnNetworkFailure(async () => {
        return createUserWithEmailAndPassword(auth, email, password);
      });
      
      console.log('✅ Firebase Auth account created:', result.user.uid);
      
      // Update the user's display name in Firebase Auth
      if (result.user) {
        await updateProfile(result.user, {
          displayName: displayName
        });
        
        // Create user profile in Firestore
        await createOrUpdateUserProfile(result.user, {
          name: displayName,
          ...profileData
        });
        
        console.log('✅ Registration and profile creation successful');
      }
      
      // The onAuthStateChanged listener will handle role fetching and navigation
    } catch (err: any) {
      console.error('❌ Registration failed:', err.code, err.message);
      
      // Handle specific Firebase Auth errors
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please try logging in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
        setNetworkError(true);
      } else {
        const friendlyMessage = getAuthErrorMessage(err.code);
        setError(friendlyMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);

      // Log logout activity before signing out
      if (user?.uid) {
        await ActivityService.logLogout(
          user.uid,
          user.email || '',
          user.displayName || user.name || 'User'
        );

        // Clear session tracking
        const sessionKey = `login_logged_${user.uid}`;
        sessionStorage.removeItem(sessionKey);
        console.log('✅ Logout activity logged and session cleared');
      }

      console.log('🚪 Signing out user...');
      await signOut(auth);
      console.log('✅ Sign out successful');
    } catch (err: any) {
      console.error('❌ Sign out failed:', err.code, err.message);
      const friendlyMessage = getAuthErrorMessage(err.code);
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    }
  };

  // Function to send password reset email
  const resetPassword = async (email: string) => {
    try {
      setError(null);
      console.log('🔑 Sending password reset email to:', email);
      
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent successfully');
      return true;
    } catch (err: any) {
      console.error('❌ Password reset failed:', err.code, err.message);
      
      // Handle specific Firebase Auth errors
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
        setNetworkError(true);
      } else {
        const friendlyMessage = getAuthErrorMessage(err.code);
        setError(friendlyMessage);
      }
      return false;
    }
  };

  // Computed values with explicit logging
  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  const isPending = user?.status === 'pending';
  const isApproved = user?.status === 'approved';
  const isRejected = user?.status === 'rejected';
  const isInUserView = isAdmin && adminViewMode === 'user';
  const isInAdminView = isAdmin && adminViewMode === 'admin';
  
  // Debug logging for role checks
  useEffect(() => {
    if (user) {
      console.log('🔍 Role check - User role:', user.role);
      console.log('🔍 Role check - User status:', user.status);
      console.log('🔍 Role check - Is Admin:', isAdmin);
      console.log('🔍 Role check - Is Member:', isMember);
      console.log('🔍 Role check - Is Pending:', isPending);
      console.log('🔍 Role check - Is Approved:', isApproved);
      console.log('🔍 Role check - Admin View Mode:', adminViewMode);
      console.log('🔍 Role check - Is In User View:', isInUserView);
    }
  }, [user, isAdmin, isMember, isPending, isApproved, adminViewMode, isInUserView]);

  return {
    user,
    loading: loading || roleLoading,
    error,
    login,
    register,
    logout,
    resetPassword,
    isAdmin,
    isMember,
    isPending,
    isApproved,
    isRejected,
    roleLoading,
    checkProfileComplete,
    updateProfile: updateUserProfile,
    // Admin view mode functions
    adminViewMode,
    isInUserView,
    isInAdminView,
    switchToUserView,
    switchToAdminView,
    // Network status
    networkError
  };
};