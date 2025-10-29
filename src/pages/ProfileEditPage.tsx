import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Eye, User, Briefcase, MapPin, Shield, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { UserProfile, UserProfileForm } from '../types/user';
import { validateUserProfile, calculateProfileCompletion } from '../utils/validation';
import { uploadProfilePicture, deleteProfilePicture } from '../services/profileService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProfileBasicsStep from '../components/signup/steps/ProfileBasicsStep';
import AboutYouStep from '../components/signup/steps/AboutYouStep';
import ContactLocationStep from '../components/signup/steps/ContactLocationStep';
import PrivacyStep from '../components/signup/steps/PrivacyStep';
import ProfilePictureUploader from '../components/profile/ProfilePictureUploader';
import ProfilePreviewCard from '../components/profile/ProfilePreviewCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

const EDIT_SECTIONS = [
  {
    id: 'basics',
    title: 'Basic Information',
    icon: User,
    component: ProfileBasicsStep
  },
  {
    id: 'about',
    title: 'About & Professional',
    icon: Briefcase,
    component: AboutYouStep
  },
  {
    id: 'contact',
    title: 'Contact & Location',
    icon: MapPin,
    component: ContactLocationStep
  },
  {
    id: 'privacy',
    title: 'Privacy Settings',
    icon: Shield,
    component: PrivacyStep
  }
];

const ProfileEditPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [activeSection, setActiveSection] = useState('basics');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [profilePictureUploadError, setProfilePictureUploadError] = useState<string | null>(null);

  // Load user profile on mount
  useEffect(() => {
    if (user?.uid) {
      loadProfile();
    }
  }, [user]);

  // Calculate completion percentage when form data changes
  useEffect(() => {
    if (profile) {
      const updatedProfile = { ...profile, ...formData };
      const percentage = calculateProfileCompletion(updatedProfile);
      setCompletionPercentage(percentage);
    }
  }, [formData, profile]);

  // Track unsaved changes
  useEffect(() => {
    if (profile) {
      const hasChanges = Object.keys(formData).some(key => {
        const formValue = formData[key as keyof UserProfileForm];
        const profileValue = profile[key as keyof UserProfile];
        
        if (Array.isArray(formValue) && Array.isArray(profileValue)) {
          return JSON.stringify(formValue) !== JSON.stringify(profileValue);
        }
        
        return formValue !== profileValue;
      });
      
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, profile]);

  const loadProfile = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const userProfile = await UserService.getUser(user.uid, user.uid, user.role);
      
      if (userProfile) {
        setProfile(userProfile as UserProfile);
        
        // Convert profile to form data
        const profileFormData: UserProfileForm = {
          firstName: userProfile.firstName || '',
          lastName: userProfile.lastName || '',
          displayName: userProfile.displayName || '',
          email: userProfile.email || '',
          title: userProfile.title || '',
          company: userProfile.company || '',
          bioTitle: userProfile.bioTitle || '',
          bio: userProfile.bio || '',
          skills: userProfile.skills || [],
          phone: userProfile.phone || '',
          linkedin: userProfile.linkedin || '',
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
    if (!user?.uid || !profile) return;

    // Validate form
    const validation = validateUserProfile(formData);
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      return;
    }

    try {
      setSaving(true);
      setErrors({});
      
      await UserService.updateUser(user.uid, formData);
      
      // Update local profile state
      const updatedProfile = { ...profile, ...formData };
      setProfile(updatedProfile);
      setHasUnsavedChanges(false);
      
      // Show success message
      // You might want to use a toast notification here
      console.log('✅ Profile updated successfully');
      
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      setErrors({ general: 'Failed to save profile. Please try again.' });
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
      setProfile(prev => prev ? { ...prev, avatarUrl: null, profileImage: null } : null);
    } catch (error) {
      console.error('❌ Error deleting avatar:', error);
      setProfilePictureUploadError('Failed to delete profile picture');
    }
  };

  const renderSectionContent = () => {
    const section = EDIT_SECTIONS.find(s => s.id === activeSection);
    if (!section) return null;

    const SectionComponent = section.component;
    return (
      <SectionComponent
        formData={formData}
        errors={errors}
        touchedFields={touchedFields}
        onUpdate={updateFormData}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
            <p className="text-gray-600 mb-8">Unable to load your profile information.</p>
            <Link
              to="/dashboard"
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Dashboard</span>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
                <p className="text-gray-600 mt-1">
                  Profile {completionPercentage}% complete
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to={`/profile/${user?.uid}`}
                className="inline-flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200"
              >
                <Eye className="h-5 w-5" />
                <span>Preview Profile</span>
              </Link>

              <button
                onClick={saveProfile}
                disabled={saving || !hasUnsavedChanges}
                className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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

          {/* Completion Progress Bar */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">Profile Completion</h3>
                <span className="text-sm font-medium text-blue-600">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              {completionPercentage < 100 && (
                <p className="text-sm text-gray-600 mt-2">
                  Complete your profile to improve your visibility and networking opportunities
                </p>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Navigation & Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Section Navigation */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <nav className="flex space-x-2 overflow-x-auto">
                  {EDIT_SECTIONS.map((section) => {
                    const isActive = activeSection === section.id;
                    const IconComponent = section.icon;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`
                          flex items-center space-x-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all duration-200
                          ${isActive
                            ? 'bg-blue-100 text-blue-700 shadow-md'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <IconComponent className="h-5 w-5" />
                        <span className="font-medium">{section.title}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Profile Picture Section */}
              {activeSection === 'basics' && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Camera className="h-5 w-5 mr-2 text-blue-600" />
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
                        Upload a professional photo that represents you well. This will be visible on your profile and connection cards.
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
              )}

              {/* Form Section */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {renderSectionContent()}
              </div>

              {/* Unsaved Changes Warning */}
              {hasUnsavedChanges && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                  <p className="text-yellow-800 text-sm">
                    You have unsaved changes. Don't forget to save your profile updates!
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Live Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <ProfilePreviewCard
                  profile={{ ...profile, ...formData }}
                  showEditMode={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProfileEditPage;