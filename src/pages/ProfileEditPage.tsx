import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/ui/BackButton';
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  CheckCircle,
  AlertCircle,
  X,
  Camera,
  Trash2,
  Lock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { UserService } from '../services/userService';
import { apiRequest } from '../utils/apiClient';
import { UserProfile, UserProfileForm } from '../types/user';
import { validateUserProfile } from '../utils/validation';
import { linkedInProfileHref } from '../utils/linkedInUrl';
import { uploadProfilePicture, deleteProfilePicture } from '../services/profileService';
import AdminHeader from '../components/admin/AdminHeader';
import ProfilePictureUploader from '../components/profile/ProfilePictureUploader';
import ProfileBasicsStep from '../components/signup/steps/ProfileBasicsStep';
import AboutYouStep from '../components/signup/steps/AboutYouStep';
import ContactLocationStep from '../components/signup/steps/ContactLocationStep';

const ProfileEditPage: React.FC = () => {
  const { user, linkGoogleAccount, isGoogleLinked, getSignInMethods, setPasswordForGoogleUser } = useAuth();
  const navigate = useNavigate();
  const { logProfileUpdate } = useActivityTracking();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UserProfileForm>({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    title: '',
    company: '',
    chapter: '',
    bioTitle: '',
    bio: '',
    skills: [],
    phone: '',
    linkedin: '',
    website: '',
    twitter: '',
    city: '',
    country: '',
    timezone: '',
    showPhone: false,
    // User-facing privacy chooser was removed: members are public by default.
    // Admins can still change visibility from AdminUserEdit if needed.
    profileVisibility: 'public',
    specialty: '',
    industry: '',
    position: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [profilePictureUploadError, setProfilePictureUploadError] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [signInMethods, setSignInMethods] = useState<{ hasPassword: boolean; hasGoogle: boolean } | null>(null);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  useEffect(() => {
    if (user?.uid) {
      loadProfile();
      checkGoogleLinkStatus();
      getSignInMethods().then(setSignInMethods);
    }
  }, [user]);

  const checkGoogleLinkStatus = async () => {
    if (user?.googleLinked) {
      setGoogleLinked(true);
    } else {
      const linked = await isGoogleLinked();
      setGoogleLinked(linked);
    }
  };

  const handleLinkGoogle = async () => {
    try {
      setLinkingGoogle(true);
      await linkGoogleAccount();
      setGoogleLinked(true);
      showToast('Google account linked successfully!', 'success');
      if (user?.uid) {
        await loadProfile();
      }
      getSignInMethods().then(setSignInMethods);
    } catch (error: any) {
      console.error('Failed to link Google account:', error);
      showToast(error.message || 'Failed to link Google account. Please try again.', 'error');
    } finally {
      setLinkingGoogle(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetPasswordError(null);
    if (newPassword.length < 8) {
      setSetPasswordError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetPasswordError('Passwords do not match');
      return;
    }
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
      setSetPasswordError('Password must include uppercase, lowercase, and a number');
      return;
    }
    setSetPasswordLoading(true);
    try {
      await setPasswordForGoogleUser(newPassword);
      showToast('Password set! You can now sign in with email/password or Google.', 'success');
      setNewPassword('');
      setConfirmPassword('');
      getSignInMethods().then(setSignInMethods);
    } catch (err: any) {
      setSetPasswordError(err.message || 'Failed to set password.');
    } finally {
      setSetPasswordLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const userProfile = await UserService.getUser(user.uid, user.uid, user.role);
      
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        
        // Convert profile to form data - map actual field names from database
        // Handle LinkedIn URL conversion (canonical URL; fixes doubled /in/ paths in stored data)
        let linkedinUrl = '';
        if (userProfile.linkedin) {
          linkedinUrl = linkedInProfileHref(userProfile.linkedin) || userProfile.linkedin;
        } else if (userProfile.linkedinUsername) {
          linkedinUrl = linkedInProfileHref(userProfile.linkedinUsername) || '';
        }
        
        const profileFormData: UserProfileForm = {
          firstName: userProfile.firstName || userProfile.name?.split(' ')[0] || '',
          lastName: userProfile.lastName || userProfile.name?.split(' ').slice(1).join(' ') || '',
          displayName: userProfile.displayName || userProfile.name || '',
          email: userProfile.email || '',
          title: userProfile.title || userProfile.position || '',
          company: userProfile.company || '',
          chapter: userProfile.chapter || '',
          bioTitle: userProfile.bioTitle || userProfile.work || '',
          bio: userProfile.bio || '',
          skills: userProfile.skills || [],
          phone: userProfile.phone || '',
          linkedin: linkedinUrl,
          website: userProfile.website || '',
          twitter: userProfile.twitter || '',
          city: userProfile.city || '',
          country: userProfile.country || '',
          timezone: userProfile.timezone || '',
          showPhone: userProfile.showPhone || false,
          profileVisibility: userProfile.profileVisibility || 'public',
          specialty: (userProfile as any).specialty || (userProfile as any).expertiseAreas || '',
          industry: userProfile.industry || '',
          position: (userProfile as any).position || userProfile.title || '',
        };
        
        setFormData(profileFormData);
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      showToast('Failed to load user profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const performSave = async () => {
    if (!user?.uid || !profile) return;
    const validation = validateUserProfile(formData);
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach(error => { errorMap[error.field] = error.message; });
      setErrors(errorMap);
      showToast(`Please fix form validation errors: ${validation.errors[0].message}`, 'error');
      return;
    }
    try {
      setSaving(true);
      setErrors({});
      const linkedinCanonical = formData.linkedin?.trim()
        ? linkedInProfileHref(formData.linkedin) || formData.linkedin.trim()
        : '';
      const updatePayload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName,
        displayName: formData.displayName,
        email: formData.email,
        title: formData.title,
        company: formData.company,
        chapter: formData.chapter || null,
        bioTitle: formData.bioTitle,
        bio: formData.bio,
        skills: formData.skills,
        phone: formData.phone,
        linkedinUrl: linkedinCanonical || undefined,
        website: formData.website,
        twitter: formData.twitter,
        city: formData.city,
        country: formData.country,
        timezone: formData.timezone,
        showPhone: formData.showPhone,
        profileVisibility: formData.profileVisibility,
        specialty: formData.specialty || undefined,
        industry: formData.industry || undefined,
        position: formData.position || undefined,
        expertiseAreas: formData.specialty || undefined,
      };
      const res = await apiRequest('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to update profile');
      }
      setProfile(prev => prev ? { ...prev, ...updatePayload } : null);
      setLastSavedAt(Date.now());
      showToast((data as { hubspotSync?: boolean }).hubspotSync ? 'Profile updated and synced to HubSpot' : 'Profile updated', 'success');
      logProfileUpdate(Object.keys(updatePayload));
      await loadProfile();
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      showToast(error.message || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutoSave = () => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    autoSaveDebounceRef.current = setTimeout(performSave, 1200);
  };

  const handleBlurSave = () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
      autoSaveDebounceRef.current = null;
    }
    performSave();
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => new Set([...prev, field]));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    scheduleAutoSave();
  };

  const handleAvatarUpload = async (imageUrl: string) => {
    setProfile(prev => prev ? { ...prev, avatarUrl: imageUrl, profileImage: imageUrl } : null);
    setProfilePictureUploadError(null);
  };

  const handleAvatarError = (error: string) => {
    setProfilePictureUploadError(error);
  };

  const handleDeleteAvatar = async () => {
    if (!user?.uid) return;
    
    try {
      await deleteProfilePicture(user.uid);
      setProfile(prev => prev ? { ...prev, avatarUrl: undefined, profileImage: undefined, profileImageCrop: undefined } : null);
    } catch (error: any) {
      console.error('Error deleting avatar:', error);
      showToast('Failed to delete profile picture', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <AdminHeader title="Edit Profile" subtitle="Loading your profile..." />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <AdminHeader title="Edit Profile" subtitle="Profile not found" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
            <p className="text-gray-600 mb-8">Unable to load your profile data.</p>
            <BackButton fallbackTo="/dashboard" className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200" iconClassName="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <AdminHeader 
        title="Edit Profile" 
        subtitle={`Editing your profile`}
      />

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
          <div
            className={`max-w-md w-full mx-auto rounded-xl border p-4 shadow-lg flex items-center space-x-3 ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <p 
              className={`mx-3 text-sm font-medium ${
                toast.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {toast.message}
            </p>
            <button
              onClick={() => setToast(prev => ({ ...prev, visible: false }))}
              className={`p-1 rounded-full ${
                toast.type === 'success' 
                  ? 'text-green-600 hover:bg-green-100' 
                  : 'text-red-600 hover:bg-red-100'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <BackButton fallbackTo="/dashboard" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Header with Saved indicator and Done */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
              <p className="text-gray-600 mt-1">Changes save automatically when you click away or after you stop typing.</p>
            </div>
            <div className="flex items-center gap-4">
              <SavedIndicator savedAt={lastSavedAt} saving={saving} />
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Google Account Linking - Compact at Top */}
          {/* Set password for Google-only accounts (so they can also sign in with email/password) */}
          {signInMethods?.hasGoogle && !signInMethods?.hasPassword && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Lock className="h-5 w-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-900">Set a password</h3>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Add a password so you can sign in with email/password or Google.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setSetPasswordError(null); }}
                  placeholder="New password (min 8 chars)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  minLength={8}
                  disabled={setPasswordLoading}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setSetPasswordError(null); }}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  disabled={setPasswordLoading}
                />
                {setPasswordError && (
                  <p className="text-xs text-red-600">{setPasswordError}</p>
                )}
                <button
                  type="submit"
                  disabled={setPasswordLoading || !newPassword || !confirmPassword}
                  className="px-3 py-1.5 text-xs font-medium bg-brand-dark text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {setPasswordLoading ? 'Setting...' : 'Set password'}
                </button>
              </form>
            </div>
          )}

          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {googleLinked ? 'Google Account Linked' : 'Link Google Account'}
                  </p>
                  {googleLinked && (
                    <p className="text-xs text-gray-500">{user?.googleEmail || 'Your Google account'}</p>
                  )}
                </div>
              </div>
              {googleLinked ? (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Linked</span>
                </div>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  disabled={linkingGoogle}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  {linkingGoogle ? (
                    <>
                      <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Linking...</span>
                    </>
                  ) : (
                    <span>Link</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Profile Picture Section - IDENTICAL TO ADMIN */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Camera className="h-5 w-5 mr-2 text-brand-blue" />
              Profile Picture
            </h3>
            
            <div className="flex items-start space-x-6">
              <ProfilePictureUploader
                currentImageUrl={profile.avatarUrl || profile.profileImage}
                currentCrop={profile.profileImageCrop ?? null}
                onUploadSuccess={handleAvatarUpload}
                onUploadError={handleAvatarError}
                size="lg"
              />
              
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-4">
                  Upload a professional photo. This will be visible on your profile and connection cards.
                </p>
                
                {profilePictureUploadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-red-800 text-sm">{profilePictureUploadError}</p>
                  </div>
                )}
                
                {(profile.avatarUrl || profile.profileImage) && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="inline-flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-700 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form: save when focus leaves (click away) */}
          <div
            className="space-y-8"
            onBlur={(e) => {
              const related = e.relatedTarget as Node | null;
              if (!related || !e.currentTarget.contains(related)) handleBlurSave();
            }}
          >
            {/* Basic Information Section */}
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-brand-blue" />
                Basic Information
              </h3>
              <ProfileBasicsStep
                formData={formData}
                errors={errors}
                touchedFields={touchedFields}
                onUpdate={updateFormData}
              />
            </div>

            {/* About & Professional Section */}
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Briefcase className="h-5 w-5 mr-2 text-brand-blue" />
                About & Professional
              </h3>
              <AboutYouStep
                formData={formData}
                errors={errors}
                touchedFields={touchedFields}
                onUpdate={updateFormData}
              />
            </div>

            {/* Contact & Location Section */}
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-brand-blue" />
                Contact & Location
              </h3>
              <ContactLocationStep
                formData={formData}
                errors={errors}
                touchedFields={touchedFields}
                onUpdate={updateFormData}
              />
            </div>

          </div>

          {/* Done (Mobile) - changes auto-save */}
          <div className="mt-8 md:hidden flex flex-col gap-3">
            <SavedIndicator savedAt={lastSavedAt} saving={saving} />
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
            >
              <CheckCircle className="h-5 w-5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditPage;