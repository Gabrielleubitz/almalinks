import React, { useState, useEffect } from 'react';
import { User, Phone, Briefcase, Save, X, Linkedin, ChevronDown } from 'lucide-react';
import { useAuth, AuthUser } from '../../hooks/useAuth';
import ProfilePictureUploader from '../profile/ProfilePictureUploader';

interface ProfileEditorProps {
  user: AuthUser | null;
  onCancel: () => void;
  onSuccess: () => void;
}

// Position options
const POSITION_OPTIONS = [
  { value: 'investor', label: 'Investor' },
  { value: 'c_level', label: 'C-Level Executive (CEO, CTO, etc.)' },
  { value: 'vp_level', label: 'VP Level' },
  { value: 'director', label: 'Director' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_contributor', label: 'Senior Contributor' },
  { value: 'individual_contributor', label: 'Individual Contributor' },
  { value: 'junior_level', label: 'Junior Level' },
  { value: 'founder', label: 'Founder' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'student', label: 'Student' },
  { value: 'other', label: 'Other' }
];

// Country codes data
const COUNTRY_CODES = [
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+852', name: 'Hong Kong', flag: '🇭🇰' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
];

const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, onCancel, onSuccess }) => {
  const { updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    work: '',
    linkedinUsername: '',
    position: ''
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      // Parse phone number to extract country code and number
      const { countryCode, phoneNumber } = parsePhoneNumber(user.phone || '');
      
      setFormData({
        name: user.displayName || '',
        phoneNumber: phoneNumber,
        work: user.work || '',
        linkedinUsername: user.linkedinUsername || '',
        position: user.position || ''
      });
      
      setSelectedCountryCode(countryCode);
      setProfileImageUrl(user.profileImage || null);
    }
  }, [user]);

  // Parse existing phone number to extract country code and number
  const parsePhoneNumber = (phone: string) => {
    if (!phone) return { countryCode: '+972', phoneNumber: '' };
    
    // Find matching country code
    const matchingCountry = COUNTRY_CODES.find(country => phone.startsWith(country.code));
    
    if (matchingCountry) {
      return {
        countryCode: matchingCountry.code,
        phoneNumber: phone.substring(matchingCountry.code.length)
      };
    }
    
    // Default fallback
    return { countryCode: '+972', phoneNumber: phone.replace(/^\+/, '') };
  };

  // Format phone number with country code
  const formatPhoneNumber = (countryCode: string, phoneInput: string): string => {
    if (!phoneInput) return '';
    
    let cleanPhone = phoneInput.replace(/\D/g, '');
    
    // Remove leading zero if country code is included
    if (cleanPhone.startsWith('0') && countryCode) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    // Combine country code with phone number
    const fullNumber = `${countryCode}${cleanPhone}`;
    
    // Validate E.164 format (starts with + followed by digits only)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(fullNumber)) {
      throw new Error('Invalid phone number format');
    }
    
    return fullNumber;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // For phone number, only allow digits
    if (name === 'phoneNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: digitsOnly
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user types
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }
    
    if (!formData.work.trim()) {
      setError('Work information is required');
      return;
    }
    
    if (!formData.linkedinUsername.trim()) {
      setError('LinkedIn username is required');
      return;
    }
    
    if (!formData.position) {
      setError('Position is required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Format phone number
      const formattedPhone = formatPhoneNumber(selectedCountryCode, formData.phoneNumber);
      
      // Format LinkedIn username (remove any linkedin.com prefix)
      const formattedLinkedin = formData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
      
      // Update profile
      await updateProfile({
        name: formData.name,
        phone: formattedPhone,
        work: formData.work,
        linkedinUsername: formattedLinkedin,
        position: formData.position,
        profileImage: profileImageUrl
      });
      
      onSuccess();
    } catch (err: any) {
      console.error('❌ Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle profile picture upload success
  const handleProfilePictureSuccess = (imageUrl: string) => {
    setProfileImageUrl(imageUrl);
    setImageUploadError(null);
  };

  // Handle profile picture upload error
  const handleProfilePictureError = (errorMessage: string) => {
    setImageUploadError(errorMessage);
  };

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
      {/* Profile Picture Section */}
      <div className="flex flex-col items-center mb-6">
        <ProfilePictureUploader
          currentImageUrl={user?.profileImage || null}
          onUploadSuccess={handleProfilePictureSuccess}
          onUploadError={handleProfilePictureError}
          size="lg"
        />
        
        {imageUploadError && (
          <p className="text-red-600 text-sm mt-2">{imageUploadError}</p>
        )}
        
        <p className="text-sm text-gray-500 mt-2">
          Click on the image to upload a new profile picture
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your full name"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Phone with Country Code */}
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="flex space-x-2">
            {/* Country Code Dropdown */}
            <div className="relative">
              <select
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
                disabled={isSubmitting}
                className="appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Phone Number Input */}
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder={selectedCountryCode === '+972' ? '0501234567' : 'Phone number'}
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          {/* Phone Preview */}
          {formData.phoneNumber && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Preview:</span> {selectedCountryCode}{formData.phoneNumber.replace(/^0/, '')}
            </div>
          )}
          
          {/* Country Info */}
          {selectedCountry && (
            <div className="mt-1 text-xs text-gray-500">
              {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
            </div>
          )}
        </div>

        {/* Work */}
        <div>
          <label htmlFor="work" className="block text-sm font-medium text-gray-700 mb-2">
            Work / What do you do? *
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="work"
              name="work"
              type="text"
              required
              value={formData.work}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="e.g., CEO at TechCorp, Software Engineer, Investor"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* LinkedIn Username */}
        <div>
          <label htmlFor="linkedinUsername" className="block text-sm font-medium text-gray-700 mb-2">
            LinkedIn Username *
          </label>
          <div className="relative">
            <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="linkedinUsername"
              name="linkedinUsername"
              type="text"
              required
              value={formData.linkedinUsername}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="e.g., johndoe (without linkedin.com/in/)"
              disabled={isSubmitting}
            />
          </div>
          {formData.linkedinUsername && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Preview:</span> linkedin.com/in/{formData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}
            </div>
          )}
        </div>

        {/* Position */}
        <div className="md:col-span-2">
          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
            Position *
          </label>
          <div className="relative">
            <select
              id="position"
              name="position"
              required
              value={formData.position}
              onChange={handleInputChange}
              className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
              disabled={isSubmitting}
            >
              <option value="" disabled>Select your position...</option>
              {POSITION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
        >
          <div className="flex items-center space-x-2">
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </div>
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProfileEditor;