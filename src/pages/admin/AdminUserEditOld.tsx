import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserService } from '../../services/userService';
import { UserProfile, UserProfileForm } from '../../types/user';
import { validateUserProfile } from '../../utils/validation';
import { uploadProfilePicture, deleteProfilePicture } from '../../services/profileService';
import AdminHeader from '../../components/admin/AdminHeader';
import ProfilePictureUploader from '../../components/profile/ProfilePictureUploader';
import ProfileBasicsStep from '../../components/signup/steps/ProfileBasicsStep';
import AboutYouStep from '../../components/signup/steps/AboutYouStep';
import ContactLocationStep from '../../components/signup/steps/ContactLocationStep';
import PrivacyStep from '../../components/signup/steps/PrivacyStep';

interface AdminUserEditProps {}

const AdminUserEdit: React.FC<AdminUserEditProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  
  console.log('🔧 AdminUserEdit component loaded for userId:', userId);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
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
  
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'speaker'>('member');
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

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const userProfile = await UserService.getUser(userId, currentUser?.uid, currentUser?.role);
      
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        setUserRole((userProfile as any).role || 'member');
        
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
        
        console.log('📝 Loaded profile data:', userProfile);
        console.log('📝 Mapped form data:', profileFormData);
        
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
    console.log('🚀 Save button clicked!');
    console.log('🔍 Checking requirements:', { userId, profile: !!profile, currentUserId: currentUser?.uid });
    
    if (!userId || !profile || !currentUser?.uid) {
      console.log('❌ Missing requirements, cannot save');
      return;
    }

    // Validate form
    console.log('🔍 Validating form data:', formData);
    const validation = validateUserProfile(formData);
    console.log('🔍 Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('❌ Form validation failed:', validation.errors);
      validation.errors.forEach(error => {
        console.log(`❌ Validation error - Field: ${error.field}, Message: ${error.message}`);
      });
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
        profileVisibility: formData.profileVisibility,
        role: userRole
      };
      
      console.log('💾 Saving profile with mapped data:', updateData);
      console.log('📝 Original form data:', formData);
      console.log('🎯 Specific fields - bio:', formData.bio, 'phone:', formData.phone, 'company:', formData.company);
      
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
      console.log('📬 API Response:', responseData);
      
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
      
      showToast('User profile updated successfully', 'success');
      
      // Reload the profile to ensure we have the latest data
      await loadUserProfile();
      
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
    if (!userId) return;
    
    try {
      await deleteProfilePicture(userId);
      setProfile(prev => prev ? { ...prev, avatarUrl: null, profileImage: null } : null);
    } catch (error) {
      console.error('❌ Error deleting avatar:', error);
      setProfilePictureUploadError('Failed to delete profile picture');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-brand-dark" />;
      default:
        return <User className="h-4 w-4 text-brand-light" />;
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Edit User" subtitle="Loading..." />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Edit User" subtitle="Loading user profile..." />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Edit User" subtitle="User not found" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h2>
            <p className="text-gray-600 mb-8">The user profile you're trying to edit doesn't exist.</p>
            <button
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center space-x-2 text-brand-dark hover:text-purple-700 font-medium"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Edit User" 
        subtitle={`Editing profile for ${profile.displayName || profile.firstName || 'User'}`}
      />

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in">
          <div 
            className={`flex items-center p-4 rounded-xl shadow-lg border ${
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
          {/* Header with Save Button */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit User Profile</h2>
              <p className="text-gray-600 mt-1">Modify user information and settings</p>
            </div>
            <button
              onClick={(e) => {
                console.log('🖱️ Button clicked event:', e);
                saveProfile();
              }}
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

          {/* Profile Picture Section */}
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

          {/* User Role Selection */}
          <div className="mb-8 p-6 border border-gray-200 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Role</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['member', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setUserRole(role)}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                    userRole === role 
                      ? getRoleBadgeClass(role)
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
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

          {/* Profile Editing Sections - Same as User Edit */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => updateFormData('lastName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Last name"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => updateFormData('displayName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="How should this user be displayed?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="user@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Software Engineer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => updateFormData('company', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="ACME Corp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateFormData('city', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="New York"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio Title
              </label>
              <input
                type="text"
                value={formData.bioTitle}
                onChange={(e) => updateFormData('bioTitle', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Short tagline or professional headline"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile
              </label>
              <input
                type="url"
                value={formData.linkedin}
                onChange={(e) => updateFormData('linkedin', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            {/* Bio - Full Width */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => updateFormData('bio', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Tell us about this user's background, experience, and interests..."
              />
            </div>
          </div>

          {/* Save Button (Mobile) */}
          <div className="mt-8 md:hidden">
            <button
              onClick={(e) => {
                console.log('🖱️ Mobile button clicked event:', e);
                saveProfile();
              }}
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

export default AdminUserEdit;