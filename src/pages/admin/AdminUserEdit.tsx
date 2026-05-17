import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  MapPin, 
  Shield, 
  Mic,
  CheckCircle,
  AlertCircle,
  X,
  Camera,
  Trash2,
  Link,
} from 'lucide-react';
import { auth } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import { UserService } from '../../services/userService';
import { UserProfile, UserProfileForm } from '../../types/user';
import { validateUserProfile } from '../../utils/validation';
import { extractLinkedInVanity, linkedInProfileHref } from '../../utils/linkedInUrl';
import { uploadProfilePicture, deleteProfilePicture, deleteCoverPhoto } from '../../services/profileService';
import ProfilePictureUploader from '../../components/profile/ProfilePictureUploader';
import CoverPhotoUploader from '../../components/profile/CoverPhotoUploader';
import ProfileBasicsStep from '../../components/signup/steps/ProfileBasicsStep';
import AboutYouStep from '../../components/signup/steps/AboutYouStep';
import ContactLocationStep from '../../components/signup/steps/ContactLocationStep';
import PrivacyStep from '../../components/signup/steps/PrivacyStep';
import SavedIndicator from '../../components/ui/SavedIndicator';

interface AdminUserEditProps {}

const AdminUserEdit: React.FC<AdminUserEditProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  
  console.log('🔧 AdminUserEdit component loaded for userId:', userId);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { logAdminAction } = useActivityTracking();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordBusy, setTempPasswordBusy] = useState(false);
  const [tempPasswordError, setTempPasswordError] = useState<string | null>(null);

  const [setupLinkBusy, setSetupLinkBusy] = useState(false);
  const [setupLinkSent, setSetupLinkSent] = useState(false);
  const [setupLinkError, setSetupLinkError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserProfileForm>({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    title: '',
    company: '',
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
    profileVisibility: 'event_only'
  });
  
  const [userRole, setUserRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [profilePictureUploadError, setProfilePictureUploadError] = useState<string | null>(null);
  const [coverPhotoUploadError, setCoverPhotoUploadError] = useState<string | null>(null);
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

  const handleGenerateTempPassword = async () => {
    if (!userId || !currentUser?.uid) return;
    setTempPasswordBusy(true);
    setTempPasswordError(null);
    setTempPassword(null);
    try {
      const response = await fetch('/api/user-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-temp-password',
          adminId: currentUser.uid,
          targetUserId: userId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to generate temporary password');
      }
      setTempPassword(String(data.tempPassword || '').trim());
      logAdminAction('Generated temporary password for member', {
        targetUserId: userId,
        targetEmail: profile?.email,
        targetName: profile?.displayName || profile?.firstName,
      });
    } catch (err: any) {
      console.error('Failed to generate temp password', err);
      setTempPasswordError(err?.message || 'Failed to generate temporary password');
    } finally {
      setTempPasswordBusy(false);
    }
  };

  const handleCopyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      showToast('Temporary password copied to clipboard.', 'success');
    } catch (_) {
      showToast('Could not copy automatically. Select and copy manually.', 'error');
    }
  };

  const handleSendSetupLink = async () => {
    if (!userId || !profile?.email || !auth.currentUser) return;
    setSetupLinkBusy(true);
    setSetupLinkError(null);
    setSetupLinkSent(false);
    try {
      const idToken = await auth.currentUser.getIdToken();

      // 1. Generate Firebase password-setup link
      const linkRes = await fetch('/api/generate-setup-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetEmail: profile.email }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok || !linkData.ok) {
        throw new Error(linkData.error || 'Failed to generate setup link');
      }
      if (!linkData.setupLink) {
        throw new Error(linkData.warn || 'No Firebase Auth account found for this email. Ask the member to sign up first.');
      }

      // 2. Email the link using the existing reset-password email template
      const emailRes = await fetch('/api/email-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reset',
          email: profile.email,
          name: profile.displayName || profile.firstName || 'there',
          resetLink: linkData.setupLink,
        }),
      });
      const emailData = await emailRes.json().catch(() => ({}));
      if (!emailRes.ok || (!emailData.success && !emailData.ok)) {
        throw new Error(emailData.error || 'Failed to send email');
      }

      setSetupLinkSent(true);
      logAdminAction('Sent password setup link to member', {
        targetUserId: userId,
        targetEmail: profile.email,
        targetName: profile.displayName || profile.firstName,
      });
      showToast('Password setup link emailed to the member.', 'success');
    } catch (err: any) {
      console.error('Failed to send setup link', err);
      setSetupLinkError(err?.message || 'Failed to send setup link');
    } finally {
      setSetupLinkBusy(false);
    }
  };

  useEffect(() => {
    console.log('🔧 AdminUserEdit useEffect - currentUser:', currentUser, 'userId:', userId);
    
    // Don't redirect if user is still loading
    if (!currentUser) {
      console.log('⏳ Current user not loaded yet, waiting...');
      return;
    }
    
    if (currentUser.role !== 'admin') {
      console.log('❌ Access denied - user role:', currentUser.role, 'redirecting to /admin');
      navigate('/admin');
      return;
    }
    
    console.log('✅ Admin access confirmed, loading user profile for:', userId);
    if (userId) {
      loadUserProfile();
    }
  }, [userId, currentUser, navigate]);

  const loadUserProfile = async (background = false) => {
    if (!userId) return;

    try {
      if (!background) setLoading(true);
      const userProfile = await UserService.getUser(userId, currentUser?.uid, currentUser?.role);
      
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        setUserRole((userProfile as any).role || 'member');
        
        // Convert profile to form data - map actual field names from database
        // Handle LinkedIn URL conversion (canonical; fixes doubled /in/ paths)
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
          profileVisibility: userProfile.profileVisibility || 'event_only'
        };
        
        console.log('📝 Loaded profile data:', userProfile);
        console.log('📝 Mapped form data:', profileFormData);
        
        setFormData(profileFormData);
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      if (!background) showToast('Failed to load user profile', 'error');
    } finally {
      if (!background) setLoading(false);
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

  const performSave = async () => {
    if (!userId || !profile || !currentUser?.uid) return;
    const validation = validateUserProfile(formData);
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      showToast(`Please fix form validation errors: ${validation.errors[0].message}`, 'error');
      return;
    }
    
    console.log('✅ Form validation passed, proceeding with save...');

    try {
      setSaving(true);
      setErrors({});
      
      // Map form data back to database field names
      let linkedinUsername = '';
      let linkedinCanonical = '';
      if (formData.linkedin?.trim()) {
        linkedinUsername = extractLinkedInVanity(formData.linkedin);
        linkedinCanonical = linkedInProfileHref(formData.linkedin) || formData.linkedin.trim();
      }
      
      const updateData: Record<string, unknown> = {
        name: `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName,
        displayName: formData.displayName,
        email: formData.email,
        position: formData.title,
        company: formData.company,
        work: formData.bioTitle,
        bio: formData.bio,
        skills: formData.skills,
        phone: formData.phone,
        linkedin: linkedinCanonical || formData.linkedin,
        linkedinUsername: linkedinUsername,
        website: formData.website,
        twitter: formData.twitter,
        city: formData.city,
        country: formData.country,
        timezone: formData.timezone,
        showPhone: formData.showPhone,
        profileVisibility: formData.profileVisibility,
        role: userRole
      };
      if (profile.profileImage !== undefined) {
        updateData.profileImage = profile.profileImage;
        updateData.avatarUrl = profile.profileImage ?? profile.avatarUrl ?? null;
        updateData.profileImageUpdatedAt = new Date().toISOString();
      }
      if (profile.profileImagePublicId !== undefined) {
        updateData.profileImagePublicId = profile.profileImagePublicId;
      }
      if (profile.profileImageCrop !== undefined) {
        updateData.profileImageCrop = profile.profileImageCrop;
      }
      if (profile.coverPhotoUrl !== undefined) {
        updateData.coverPhotoUrl = profile.coverPhotoUrl;
      }
      
      // Call the user update API
      const response = await fetch('/api/user-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-user',
          adminId: currentUser.uid,
          targetUserId: userId,
          updateData: updateData
        })
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update user');
      }
      
      // Update local profile state with the mapped data
      const updatedProfile = { 
        ...profile, 
        ...updateData,  // Use the mapped data, not the form data
        role: userRole 
      };
      setProfile(updatedProfile);
      setLastSavedAt(Date.now());
      showToast('Profile updated', 'success');
      await loadUserProfile(true);

      // Log admin profile update activity
      logAdminAction('Updated member profile', {
        targetUserId: userId,
        changedFields: Object.keys(updateData)
      });
      
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      showToast(error.message || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (imageUrl: string, crop?: { scale: number; panX: number; panY: number }) => {
    setProfile(prev => prev ? { ...prev, avatarUrl: imageUrl, profileImage: imageUrl, profileImageCrop: crop ?? null } : null);
    setProfilePictureUploadError(null);
  };

  const handleAvatarError = (error: string) => {
    setProfilePictureUploadError(error);
  };

  const handleDeleteAvatar = async () => {
    if (!userId) return;
    
    try {
      await deleteProfilePicture(userId, (profile as any)?.profileImagePublicId ?? undefined);
      setProfile(prev => prev ? { ...prev, avatarUrl: undefined, profileImage: undefined, profileImagePublicId: undefined, profileImageCrop: undefined } : null);
    } catch (error: any) {
      console.error('Error deleting avatar:', error);
      showToast('Failed to delete profile picture', 'error');
    }
  };

  const handleCoverPhotoSuccess = (url: string) => {
    setProfile(prev => prev ? { ...prev, coverPhotoUrl: url } : null);
    setCoverPhotoUploadError(null);
    scheduleAutoSave();
  };
  const handleCoverPhotoError = (message: string) => {
    setCoverPhotoUploadError(message);
  };
  const handleCoverPhotoRemove = async () => {
    if (!userId) return;
    try {
      await deleteCoverPhoto(userId);
      setProfile(prev => prev ? { ...prev, coverPhotoUrl: null } : null);
    } catch (e: unknown) {
      setCoverPhotoUploadError(e instanceof Error ? e.message : 'Failed to remove cover');
    }
  };
  const handleCoverTemplateSelect = (url: string) => {
    setProfile(prev => prev ? { ...prev, coverPhotoUrl: url } : null);
    setCoverPhotoUploadError(null);
    scheduleAutoSave();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  // Show loading while currentUser is being loaded
  if (!currentUser) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading user profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h2>
            <p className="text-gray-600 mb-8">The user you're looking for doesn't exist or has been deleted.</p>
            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to User Management</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
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
          <button
            onClick={() => navigate('/admin/users')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to User Management</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Header with Saved indicator and Done */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit User Profile</h2>
              <p className="text-gray-600 mt-1">Changes save automatically when you click away or after you stop typing.</p>
            </div>
            <div className="flex items-center gap-4">
              <SavedIndicator savedAt={lastSavedAt} saving={saving} />
              <button
                onClick={() => navigate('/admin/users')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Camera className="h-5 w-5 mr-2 text-brand-light" />
              Profile Picture
            </h3>
            
            <div className="flex items-start space-x-6">
              <ProfilePictureUploader
                currentImageUrl={profile.avatarUrl || profile.profileImage}
                currentCrop={profile.profileImageCrop ?? null}
                onUploadSuccess={handleAvatarUpload}
                onUploadError={handleAvatarError}
                size="lg"
                targetUserId={userId}
              />
              
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-4">
                  Upload a professional photo for this user. This will be visible on their profile and connection cards.
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

          {/* Cover Photo Section */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Camera className="h-5 w-5 mr-2 text-brand-light" />
              Cover photo
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Add, change, or remove the background image above this user&apos;s profile picture on their public profile.
            </p>
            <CoverPhotoUploader
              currentCoverUrl={profile.coverPhotoUrl ?? null}
              onUploadSuccess={handleCoverPhotoSuccess}
              onUploadError={handleCoverPhotoError}
              onRemove={handleCoverPhotoRemove}
              onTemplateSelect={handleCoverTemplateSelect}
              targetUserId={userId}
            />
            {coverPhotoUploadError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{coverPhotoUploadError}</p>
              </div>
            )}
          </div>

          {/* User Role Selection - ADMIN ONLY FEATURE */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Role</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['member', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => { setUserRole(role); scheduleAutoSave(); }}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                    userRole === role
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    {getRoleIcon(role)}
                    <span className="font-medium capitalize">{role}</span>
                  </div>
                </button>
              ))}
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
                <User className="h-5 w-5 mr-2 text-brand-light" />
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
                <Briefcase className="h-5 w-5 mr-2 text-brand-light" />
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
                <MapPin className="h-5 w-5 mr-2 text-brand-light" />
                Contact & Location
              </h3>
              <ContactLocationStep
                formData={formData}
                errors={errors}
                touchedFields={touchedFields}
                onUpdate={updateFormData}
              />
            </div>

            {/* Privacy Settings Section */}
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-brand-light" />
                Privacy Settings
              </h3>
              <PrivacyStep
                formData={formData}
                errors={errors}
                touchedFields={touchedFields}
                onUpdate={updateFormData}
              />
            </div>

            {/* Admin: one-time temporary password */}
            <div className="p-6 border border-amber-200 bg-amber-50/50 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-amber-600" />
                Issue temporary password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Member passwords cannot be viewed after they change them &mdash; Firebase only stores hashes.
                Use this to generate a one-time strong temporary password the member can use to sign in;
                they will be forced to change it on next login. Share it through a secure channel.
              </p>

              {tempPasswordError ? (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {tempPasswordError}
                </div>
              ) : null}

              {tempPassword ? (
                <div className="mb-3 p-3 bg-white border border-amber-300 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Temporary password (shown once)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-base text-gray-900 break-all select-all">
                      {tempPassword}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyTempPassword}
                      className="px-3 py-2 rounded-lg bg-brand-dark text-white text-xs font-semibold hover:bg-brand-mid"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempPassword(null)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Hide
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mt-2">
                    Once you leave this page or click Hide, we cannot show this password again.
                    The member must change it on next login.
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGenerateTempPassword}
                disabled={tempPasswordBusy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {tempPasswordBusy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <span>{tempPassword ? 'Regenerate temporary password' : 'Generate temporary password'}</span>
                )}
              </button>

              {/* Send password setup link by email */}
              <div className="mt-6 pt-5 border-t border-amber-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <Link className="h-4 w-4 text-brand-dark" />
                  Send password setup link by email
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Generates a secure Firebase one-time link (valid&nbsp;<strong>1&nbsp;hour</strong>) and emails it directly to the member.
                  They click it to set their own password — no temporary password to share.
                </p>

                {setupLinkError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {setupLinkError}
                  </div>
                )}
                {setupLinkSent && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    Setup link sent to <strong>{profile?.email}</strong>.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendSetupLink}
                  disabled={setupLinkBusy || !profile?.email}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark text-white text-sm font-semibold hover:bg-brand-mid disabled:opacity-50"
                >
                  {setupLinkBusy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4" />
                      <span>Email setup link to member</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Done (Mobile) - changes auto-save */}
          <div className="mt-8 md:hidden flex flex-col gap-3">
            <SavedIndicator savedAt={lastSavedAt} saving={saving} />
            <button
              onClick={() => navigate('/admin/users')}
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

export default AdminUserEdit;