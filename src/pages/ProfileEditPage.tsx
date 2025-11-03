import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  MapPin, 
  Shield, 
  CheckCircle,
  AlertCircle,
  X,
  Camera,
  Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { UserService } from '../services/userService';
import { UserProfile, UserProfileForm } from '../types/user';
import { validateUserProfile } from '../utils/validation';
import { uploadProfilePicture, deleteProfilePicture } from '../services/profileService';
import AdminHeader from '../components/admin/AdminHeader';
import ProfilePictureUploader from '../components/profile/ProfilePictureUploader';
import ProfileBasicsStep from '../components/signup/steps/ProfileBasicsStep';
import AboutYouStep from '../components/signup/steps/AboutYouStep';
import ContactLocationStep from '../components/signup/steps/ContactLocationStep';
import PrivacyStep from '../components/signup/steps/PrivacyStep';

const ProfileEditPage: React.FC = () => {
  const { user } = useAuth();
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
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [profilePictureUploadError, setProfilePictureUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  useEffect(() => {
    if (user?.uid) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const userProfile = await UserService.getUser(user.uid, user.uid, user.role);
      
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        
        // Convert profile to form data - map actual field names from database
        // Handle LinkedIn URL conversion
        let linkedinUrl = '';
        if (userProfile.linkedin) {
          linkedinUrl = userProfile.linkedin;
        } else if (userProfile.linkedinUsername) {
          // Convert username to full URL if it's just a username
          const username = userProfile.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
          linkedinUrl = username ? `https://linkedin.com/in/${username}` : '';
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
        
        setFormData(profileFormData);
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      showToast('Failed to load user profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Mark field as touched
    setTouchedFields(prev => new Set([...prev, field]));
    
    // Clear any existing error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const saveProfile = async () => {
    if (!user?.uid || !profile) {
      return;
    }

    // Validate form
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

    try {
      setSaving(true);
      setErrors({});
      
      // Map form data back to database field names
      // Extract LinkedIn username from URL for storage
      let linkedinUsername = '';
      if (formData.linkedin) {
        if (formData.linkedin.includes('linkedin.com')) {
          // Extract username from URL
          linkedinUsername = formData.linkedin.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
        } else {
          // If it's just a username, use as is
          linkedinUsername = formData.linkedin;
        }
      }
      
      const updateData = {
        name: `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName,
        displayName: formData.displayName,
        email: formData.email,
        position: formData.title,
        company: formData.company,
        work: formData.bioTitle,
        bio: formData.bio,
        skills: formData.skills,
        phone: formData.phone,
        linkedin: formData.linkedin, // Store full URL
        linkedinUsername: linkedinUsername, // Store just username
        website: formData.website,
        twitter: formData.twitter,
        city: formData.city,
        country: formData.country,
        timezone: formData.timezone,
        showPhone: formData.showPhone,
        profileVisibility: formData.profileVisibility
      };
      
      // For regular users, update their own profile using UserService
      await UserService.updateUser(user.uid, updateData);
      
      // Update local profile state with the mapped data
      const updatedProfile = { 
        ...profile, 
        ...updateData
      };
      setProfile(updatedProfile);
      
      showToast('Profile updated successfully', 'success');
      
      // Log profile update activity
      const changedFields = Object.keys(updateData);
      logProfileUpdate(changedFields);
      
      // Reload the profile to ensure we have the latest data
      await loadProfile();
      
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      showToast(error.message || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
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
      setProfile(prev => prev ? { ...prev, avatarUrl: undefined, profileImage: undefined } : null);
    } catch (error: any) {
      console.error('Error deleting avatar:', error);
      showToast('Failed to delete profile picture', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Edit Profile" subtitle="Profile not found" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
            <p className="text-gray-600 mb-8">Unable to load your profile data.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
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
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Header with Save Button - IDENTICAL TO ADMIN */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit User Profile</h2>
              <p className="text-gray-600 mt-1">Modify user information and settings</p>
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>

          {/* Profile Picture Section - IDENTICAL TO ADMIN */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Camera className="h-5 w-5 mr-2 text-brand-light" />
              Profile Picture
            </h3>
            
            <div className="flex items-start space-x-6">
              <ProfilePictureUploader
                currentImageUrl={profile.avatarUrl || profile.profileImage}
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

          {/* IDENTICAL PROFILE EDITING SECTIONS - SAME AS ADMIN EDIT */}
          <div className="space-y-8">
            
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

          </div>

          {/* Save Button (Mobile) - IDENTICAL TO ADMIN */}
          <div className="mt-8 md:hidden">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditPage;