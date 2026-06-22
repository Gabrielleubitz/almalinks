import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, setPersistence, browserLocalPersistence, signInWithPopup, GoogleAuthProvider, linkWithPopup, getAdditionalUserInfo, fetchSignInMethodsForEmail, reauthenticateWithPopup, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, retryOnNetworkFailure } from '../firebase/config';
import type { CropValue } from '../types/crop';
import { ActivityService } from '../services/activityService';
import { isMemberProfileSetupComplete } from '../utils/memberLanding';
import { isAppAdminUser } from '../utils/adminAccess';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  firstName?: string;
  lastName?: string;
  role?: string;
  /** Legacy/alternate admin flag (Firestore users.admin === true). */
  admin?: boolean;
  status?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  profileImage?: string | null;
  profileImageCrop?: CropValue | null;
  coverPhotoUrl?: string | null;
  coverCrop?: CropValue | null;
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
  googleLinked?: boolean;
  googleEmail?: string;
  hasSeenOnboarding?: boolean;
}

export interface ProfileData {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  work?: string;
  linkedinUsername?: string;
  position?: string;
  chapter?: string;
  status?: string;
  profileImage?: string | null;
  profileImagePublicId?: string | null;
  profileImageCrop?: CropValue | null;
  coverPhotoUrl?: string | null;
  coverCrop?: CropValue | null;
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
  /** Join-request / signup only — never written to users/{uid} profile */
  address?: string;
  industry?: string;
  expertiseAreas?: string;
  lookingToGain?: string;
  offerToMembers?: string;
  heardAboutAlma?: string;
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
    case 'auth/account-exists-with-different-credential':
      return 'This email is already registered with another sign-in method. Please use the method you used when you first signed up.';
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
          firstName: userData.firstName ?? undefined,
          lastName: userData.lastName ?? undefined,
          role: userData.role || 'member',
          admin: userData.admin === true,
          status: userData.status || 'approved', // Default to approved for existing users
          phone: userData.phone || '',
          company: userData.company || '',
          work: userData.work || '',
          linkedinUsername: userData.linkedinUsername || '',
          position: userData.position || '',
          profileImage: userData.profileImage || null,
          profileImageCrop: userData.profileImageCrop || null,
          coverPhotoUrl: userData.coverPhotoUrl || null,
          coverCrop: userData.coverCrop || null,
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
          passwordResetForcedBy: userData.passwordResetForcedBy || null,
          googleLinked: userData.googleLinked || false,
          googleEmail: userData.googleEmail || null,
          hasSeenOnboarding: userData.hasSeenOnboarding === true
        };
      }
      
      // If no user document exists, check join request status
      console.log('⚠️ No user document found, checking join request...');
      const { JoinRequestService } = await import('../services/joinRequestService');
      const joinRequest = await JoinRequestService.getJoinRequest(uid);
      
      if (joinRequest) {
        // Return minimal profile with status from join request
        return {
          uid,
          email: joinRequest.email || null,
          displayName: joinRequest.displayName || joinRequest.name || null,
          firstName: joinRequest.firstName ?? undefined,
          lastName: joinRequest.lastName ?? undefined,
          role: 'member',
          status: joinRequest.status, // pending, approved, or rejected
          phone: joinRequest.phone || '',
          company: joinRequest.company || '',
          work: joinRequest.work || '',
          linkedinUsername: joinRequest.linkedinUsername || '',
          position: joinRequest.position || '',
          profileImage: null,
          bioTitle: joinRequest.bioTitle || '',
          bio: joinRequest.bio || '',
          city: joinRequest.city || '',
          country: joinRequest.country || '',
          timezone: joinRequest.timezone || '',
          website: joinRequest.website || '',
          twitter: joinRequest.twitter || '',
          skills: joinRequest.skills || [],
          mustChangePassword: false,
          tempPasswordSet: false,
          passwordResetForcedAt: null,
          passwordResetForcedBy: null,
          googleLinked: false,
          googleEmail: null,
          hasSeenOnboarding: false
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
        // NEW BEHAVIOR: Create join request instead of user document
        // User documents are only created when admin approves
        console.log('📝 New user detected - creating join request instead of user document');
        
        const { JoinRequestService } = await import('../services/joinRequestService');
        
        const fullName = profileData?.name || firebaseUser.displayName || [profileData?.firstName, profileData?.lastName].filter(Boolean).join(' ') || '';
        const joinRequestData = {
          email: firebaseUser.email || '',
          firstName: profileData?.firstName,
          lastName: profileData?.lastName,
          name: fullName,
          displayName: fullName,
          phone: profileData?.phone,
          company: profileData?.company,
          work: profileData?.work,
          linkedinUsername: profileData?.linkedinUsername,
          position: profileData?.position,
          chapter: profileData?.chapter,
          profileImage: profileData?.profileImage ?? undefined,
          profileImagePublicId: profileData?.profileImagePublicId ?? undefined,
          bioTitle: profileData?.bioTitle,
          bio: profileData?.bio,
          city: profileData?.city,
          country: profileData?.country,
          timezone: profileData?.timezone,
          website: profileData?.website,
          twitter: profileData?.twitter,
          skills: profileData?.skills,
          address: profileData?.address,
          industry: profileData?.industry,
          expertiseAreas: profileData?.expertiseAreas,
          lookingToGain: profileData?.lookingToGain,
          offerToMembers: profileData?.offerToMembers,
          heardAboutAlma: profileData?.heardAboutAlma,
        };

        const createdRequest = await JoinRequestService.createJoinRequest(firebaseUser.uid, joinRequestData);
        console.log('✅ Created join request (user document will be created on approval):', {
          uid: firebaseUser.uid,
          email: createdRequest.email,
          name: createdRequest.name,
          status: createdRequest.status
        });
        
        // Verify the join request was created
        const verifyRequest = await JoinRequestService.getJoinRequest(firebaseUser.uid);
        if (verifyRequest) {
          console.log('✅ Verified join request exists in Firestore');
        } else {
          console.error('❌ WARNING: Join request verification failed - request not found after creation');
        }
        
        // User welcome email: sent only via POST /api/welcome-email (Mailchimp Marketing) from joinRequestService.createJoinRequest.
        // Admin notification: sent via POST /api/notify-signup from joinRequestService (no /api/email-service).
        // Return null since no user document exists yet
        return null;
      } else {
        // Update existing user profile (only if user document exists - i.e., approved)
        const existingData = userDoc.data();
        const updatedData: any = {
          ...baseData
        };
        
        // Only include fields that are defined (not undefined)
        if (profileData?.name) updatedData.name = profileData.name;
        if (profileData?.firstName !== undefined) updatedData.firstName = profileData.firstName;
        if (profileData?.lastName !== undefined) updatedData.lastName = profileData.lastName;
        if (profileData?.phone) updatedData.phone = profileData.phone;
        if (profileData?.company) updatedData.company = profileData.company;
        if (profileData?.work) updatedData.work = profileData.work;
        if (profileData?.linkedinUsername) updatedData.linkedinUsername = profileData.linkedinUsername;
        if (profileData?.position) updatedData.position = profileData.position;
        if (profileData?.profileImage !== undefined) updatedData.profileImage = profileData.profileImage;
        if (profileData?.profileImagePublicId !== undefined) updatedData.profileImagePublicId = profileData.profileImagePublicId;
        if (profileData?.profileImageCrop !== undefined) updatedData.profileImageCrop = profileData.profileImageCrop;
        if (profileData?.coverPhotoUrl !== undefined) updatedData.coverPhotoUrl = profileData.coverPhotoUrl;
        if (profileData?.coverCrop !== undefined) updatedData.coverCrop = profileData.coverCrop;
        if (profileData?.bioTitle !== undefined && profileData.bioTitle !== null) updatedData.bioTitle = profileData.bioTitle;
        if (profileData?.bio !== undefined && profileData.bio !== null) updatedData.bio = profileData.bio;
        if (profileData?.city !== undefined && profileData.city !== null) updatedData.city = profileData.city;
        if (profileData?.country !== undefined && profileData.country !== null) updatedData.country = profileData.country;
        if (profileData?.timezone !== undefined && profileData.timezone !== null) updatedData.timezone = profileData.timezone;
        if (profileData?.website !== undefined && profileData.website !== null) updatedData.website = profileData.website;
        if (profileData?.twitter !== undefined && profileData.twitter !== null) updatedData.twitter = profileData.twitter;
        if (profileData?.skills !== undefined && profileData.skills !== null) updatedData.skills = profileData.skills;
        
        // Sanitize to remove any undefined values (safety check)
        const { sanitizeForFirestore } = await import('../utils/firestoreHelpers');
        const sanitizedData = sanitizeForFirestore(updatedData);
        
        await retryOnNetworkFailure(async () => setDoc(userDocRef, sanitizedData, { merge: true }));
        console.log('✅ Updated user profile');
        return { ...existingData, ...sanitizedData };
      }
    } catch (error) {
      console.error('❌ Error creating/updating user profile:', error);
      throw error;
    }
  };

  // Function to check if profile is complete (required for member home access)
  const checkProfileComplete = (): boolean => isMemberProfileSetupComplete(user);

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
        ...(profileData.firstName !== undefined && { firstName: profileData.firstName }),
        ...(profileData.lastName !== undefined && { lastName: profileData.lastName }),
        ...(profileData.phone && { phone: profileData.phone }),
        ...(profileData.company && { company: profileData.company, organization: profileData.company }),
        ...(profileData.work && { work: profileData.work }),
        ...(profileData.linkedinUsername && { linkedinUsername: profileData.linkedinUsername }),
        ...(profileData.position && { position: profileData.position }),
        ...(profileData.profileImage !== undefined && { profileImage: profileData.profileImage }),
        ...(profileData.profileImageCrop !== undefined && { profileImageCrop: profileData.profileImageCrop }),
        ...(profileData.coverPhotoUrl !== undefined && { coverPhotoUrl: profileData.coverPhotoUrl }),
        ...(profileData.coverCrop !== undefined && { coverCrop: profileData.coverCrop }),
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
        ...(profileData.firstName !== undefined && { firstName: profileData.firstName }),
        ...(profileData.lastName !== undefined && { lastName: profileData.lastName }),
        phone: profileData.phone || prev.phone,
        company: profileData.company || prev.company,
        work: profileData.work || prev.work,
        linkedinUsername: profileData.linkedinUsername || prev.linkedinUsername,
        position: profileData.position || prev.position,
        profileImage: profileData.profileImage !== undefined ? profileData.profileImage : prev.profileImage,
        profileImageCrop: profileData.profileImageCrop !== undefined ? profileData.profileImageCrop : prev.profileImageCrop,
        coverPhotoUrl: profileData.coverPhotoUrl !== undefined ? profileData.coverPhotoUrl : prev.coverPhotoUrl,
        coverCrop: profileData.coverCrop !== undefined ? profileData.coverCrop : prev.coverCrop,
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

  const markOnboardingComplete = async () => {
    if (!user?.uid) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await retryOnNetworkFailure(() =>
        setDoc(userDocRef, { hasSeenOnboarding: true, updatedAt: serverTimestamp() }, { merge: true })
      );
      setUser((prev) => (prev ? { ...prev, hasSeenOnboarding: true } : null));
    } catch (error) {
      console.error('❌ Error marking onboarding complete:', error);
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
            // If no Firestore profile exists, check if join request exists first
            // IMPORTANT: Do NOT auto-create join requests on login - user must explicitly re-request
            // This prevents rejected users from auto-creating new requests
            const { JoinRequestService } = await import('../services/joinRequestService');
            const existingJoinRequest = await JoinRequestService.getJoinRequest(firebaseUser.uid);
            
            if (existingJoinRequest) {
              // Join request exists - use it to build profile
              console.log('📝 Found existing join request, using it for profile');
              userProfile = {
                uid: firebaseUser.uid,
                email: existingJoinRequest.email || firebaseUser.email,
                displayName: existingJoinRequest.displayName || existingJoinRequest.name || firebaseUser.displayName,
                firstName: existingJoinRequest.firstName ?? undefined,
                lastName: existingJoinRequest.lastName ?? undefined,
                role: 'member',
                status: existingJoinRequest.status, // pending, approved, or rejected
                phone: existingJoinRequest.phone || '',
                company: existingJoinRequest.company || '',
                work: existingJoinRequest.work || '',
                linkedinUsername: existingJoinRequest.linkedinUsername || '',
                position: existingJoinRequest.position || '',
                profileImage: null,
                bioTitle: existingJoinRequest.bioTitle || '',
                bio: existingJoinRequest.bio || '',
                city: existingJoinRequest.city || '',
                country: existingJoinRequest.country || '',
                timezone: existingJoinRequest.timezone || '',
                website: existingJoinRequest.website || '',
                twitter: existingJoinRequest.twitter || '',
                skills: existingJoinRequest.skills || [],
                mustChangePassword: false,
                tempPasswordSet: false,
                passwordResetForcedAt: null,
          passwordResetForcedBy: null,
          googleLinked: false,
          googleEmail: null,
          hasSeenOnboarding: false
        };
      } else {
        // No join request and no user doc.
              // This happens when a user completes Google OAuth on the signup page but
              // hasn't yet submitted the registration form.  We use a special sentinel
              // status so ProtectedRoute can redirect them back to /signup rather than
              // sending them to /pending with no actual join request.
              console.log('⚠️ No user profile or join request found. User must complete signup form.');
              
              // Create minimal profile from Auth data only (no Firestore writes)
              userProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                role: 'member',
                status: 'needs_signup', // sentinel: Google-authed but form not yet submitted
                phone: '',
                company: '',
                work: '',
                linkedinUsername: '',
                position: '',
                profileImage: null,
                bioTitle: '',
                bio: '',
                city: '',
                country: '',
                timezone: '',
                website: '',
                twitter: '',
                skills: [],
                mustChangePassword: false,
                tempPasswordSet: false,
                passwordResetForcedAt: null,
                passwordResetForcedBy: null,
                googleLinked: false,
                googleEmail: null,
                hasSeenOnboarding: false
              };
            }
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
          if (userProfile.role === 'admin' || userProfile.admin === true) {
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
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('This email is registered with Google. Please use "Sign in with Google" to access your account.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address. Please sign up first.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        // Check if this email is registered with Google only (no password set)
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.length > 0 && methods.includes('google.com') && !methods.includes('password')) {
            setError('This account uses Google sign-in. Sign in with Google below, then you can set a password in Profile so both work.');
          } else {
            setError('Invalid email or password. Please try again.');
          }
        } catch (_) {
          setError('Invalid email or password. Please try again.');
        }
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

  const register = async (email: string, password: string | undefined, displayName: string, profileData?: ProfileData) => {
    try {
      setError(null);
      setLoading(true);
      console.log('📝 Attempting to register user:', email);
      
      await setPersistence(auth, browserLocalPersistence);

      const effectivePassword =
        (password && password.trim()) ||
        `${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!A1`;
      
      const result = await retryOnNetworkFailure(async () => {
        return createUserWithEmailAndPassword(auth, email, effectivePassword);
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
      // Welcome email is sent from joinRequestService after join request is created (Mailchimp Marketing, server-side).

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

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      console.log('🔑 Sending password reset email to:', email);

      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to send password reset email.');
        return false;
      }

      console.log('✅ Password reset email sent successfully');
      return true;
    } catch (err: any) {
      console.error('❌ Password reset failed:', err?.message || err);
      setError('Network error. Please check your connection and try again.');
      setNetworkError(true);
      return false;
    }
  };

  // Google sign-in provider
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });

  // Sign in with Google
  // mode = 'login' (default) keeps existing behavior.
  // mode = 'signup' signs the user in but defers creating a join request
  // until the signup form is submitted.
  const signInWithGoogle = async (mode: 'login' | 'signup' = 'login') => {
    try {
      setError(null);
      setLoading(true);
      console.log('🔐 Attempting Google sign-in');
      
      // Ensure local persistence is set
      await setPersistence(auth, browserLocalPersistence);
      
      // Sign in with Google. If this email is already registered with email/password,
      // user must sign in with password first, then link Google in Profile (same account, both methods work).
      const result = await retryOnNetworkFailure(async () => {
        return signInWithPopup(auth, googleProvider);
      });
      
      console.log('✅ Google sign-in successful:', result.user.email);
      
      // Check if Firestore profile exists
      const userProfile = await getUserProfile(result.user.uid);
      
      if (!userProfile) {
        if (mode === 'signup') {
          // New user coming from the signup page:
          // do NOT create join request yet. The signup form will validate
          // required fields and explicitly create the join request.
          console.log('📝 Google signup: deferring join request until form submit');
        } else {
          // Login mode and no member profile exists.
          // We must NOT auto-create a thin join request from Google data — that
          // produces useless "ghost" applications in HubSpot/Firestore. Instead,
          // check if the user already has an in-flight join request (e.g. they
          // applied earlier with the same Google account and we are now letting
          // them sign back in to the pending page). If so, we leave their auth
          // session in place so onAuthStateChanged can route them to /pending.
          const existingRequest = await getDoc(doc(db, 'joinRequests', result.user.uid));
          if (!existingRequest.exists()) {
            console.warn('🚫 Google login blocked: no member profile and no application on file');
            await signOut(auth);
            const blockErr: any = new Error(
              'You need to submit an application before signing in with Google.'
            );
            blockErr.code = 'auth/needs-application';
            setError(blockErr.message);
            throw blockErr;
          }
          console.log('ℹ️ Google login: existing pending/rejected join request – allowing sign-in');
        }
      } else {
        // Existing profile - mark Google as linked; pull profile picture from Google if none set
        console.log('📝 Updating existing user profile with Google account info');
        const userRef = doc(db, 'users', result.user.uid);
        await updateDoc(userRef, {
          googleLinked: true,
          googleEmail: result.user.email,
          ...(result.user.photoURL && !userProfile.profileImage && { profileImage: result.user.photoURL, profileImagePublicId: null }), // Google photo when no image yet
          ...(result.user.displayName && !userProfile.displayName && { name: result.user.displayName })
        });
      }

      // onAuthStateChanged will handle role fetching and navigation
    } catch (err: any) {
      console.error('❌ Google sign-in failed:', err.code, err.message);

      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('This email is already registered with email and password. Sign in with your password above, then go to Profile to link Google so you can use both.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups and try again.');
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

  // Link Google account to existing account
  const linkGoogleAccount = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (!auth.currentUser) {
        throw new Error('You must be logged in to link a Google account');
      }
      
      const currentUser = auth.currentUser;
      const currentUid = currentUser.uid;
      const currentEmail = currentUser.email;
      
      if (!currentEmail) {
        throw new Error('Current account does not have an email address');
      }
      
      console.log('🔗 Linking Google account to existing account:', currentEmail);
      
      // Link Google to the *current* user (same UID); do not use signInWithPopup (that would switch accounts)
      const result = await retryOnNetworkFailure(async () => {
        return linkWithPopup(currentUser, googleProvider);
      });
      
      // result.user is the same account with Google now linked; UID unchanged
      if (result.user.uid !== currentUid) {
        console.warn('⚠️ UID changed after link (unexpected)');
      }
      
      // Update Firestore: mark Google linked and optionally pull profile picture from Google
      const userRef = doc(db, 'users', currentUid);
      await updateDoc(userRef, {
        googleLinked: true,
        googleEmail: result.user.email ?? currentEmail,
        ...(result.user.photoURL && { profileImage: result.user.photoURL, profileImagePublicId: null })
      });
      
      console.log('✅ Google account linked successfully; you can sign in with email/password or Google');
      return true;
    } catch (err: any) {
      console.error('❌ Failed to link Google account:', err.code, err.message);
      
      if (err.code === 'auth/credential-already-in-use') {
        setError('This Google account is already linked to another account.');
      } else if (err.code === 'auth/provider-already-linked') {
        setError('Google is already linked to this account.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Linking was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups and try again.');
      } else if (err.message && err.message.includes('does not match')) {
        setError(err.message);
      } else {
        const friendlyMessage = getAuthErrorMessage(err.code);
        setError(friendlyMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Check if Google account is linked
  const isGoogleLinked = async (): Promise<boolean> => {
    try {
      if (!auth.currentUser) return false;
      
      const userProfile = await getUserProfile(auth.currentUser.uid);
      return userProfile ? (userProfile as any).googleLinked === true : false;
    } catch (error) {
      console.error('❌ Error checking Google link status:', error);
      return false;
    }
  };

  /** Get which sign-in methods are enabled for the current account (password and/or Google). */
  const getSignInMethods = async (): Promise<{ hasPassword: boolean; hasGoogle: boolean }> => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.providerData?.length) {
      return { hasPassword: false, hasGoogle: false };
    }
    const hasPassword = fbUser.providerData.some((p) => p.providerId === 'password');
    const hasGoogle = fbUser.providerData.some((p) => p.providerId === 'google.com');
    return { hasPassword, hasGoogle };
  };

  /**
   * Add a password to an account that currently has only Google sign-in.
   * User must be signed in with Google. Re-authenticates with Google, then sets the password.
   * After this, the user can sign in with either Google or email/password.
   */
  const setPasswordForGoogleUser = async (newPassword: string): Promise<void> => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error('You must be signed in to set a password.');
    }
    const { hasPassword, hasGoogle } = await getSignInMethods();
    if (hasPassword) {
      throw new Error('Your account already has a password. Use Change password if you want to update it.');
    }
    if (!hasGoogle) {
      throw new Error('Set password is only available for accounts that sign in with Google.');
    }
    setError(null);
    setLoading(true);
    try {
      await reauthenticateWithPopup(fbUser, googleProvider);
      await updatePassword(fbUser, newPassword);
      console.log('✅ Password set successfully; you can now sign in with email/password or Google.');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Computed values with explicit logging
  const isAdmin = isAppAdminUser(user);
  const isMember = user?.role === 'member';
  const isPending = user?.status === 'pending';
  const isApproved = user?.status === 'approved';
  const isRejected = user?.status === 'rejected';
  /** True when the user authenticated with Google but has not yet submitted the signup form. */
  const isNeedsSignup = user?.status === 'needs_signup';
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
    signInWithGoogle,
    linkGoogleAccount,
    isGoogleLinked,
    getSignInMethods,
    setPasswordForGoogleUser,
    isAdmin,
    isMember,
    isPending,
    isApproved,
    isRejected,
    isNeedsSignup,
    roleLoading,
    checkProfileComplete,
    updateProfile: updateUserProfile,
    markOnboardingComplete,
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