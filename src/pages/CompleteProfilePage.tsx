import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { User, Phone, Briefcase, ArrowRight, ArrowLeft, CheckCircle, ChevronDown, Building2, Linkedin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hubspotDoNotCollectFormProps } from '../utils/hubspotForm';
import { apiRequest } from '../utils/apiClient';
import { extractLinkedInVanity } from '../utils/linkedInUrl';
import logoSvg from '../assets/alma-links-logo.svg';
import MultiSelectField from '../components/form/MultiSelectField';
import { POSITION_OPTIONS, parseMultiSelectValue, formatMultiSelectValue } from '../constants/memberFieldOptions';

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

const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, error, loading, checkProfileComplete } = useAuth();
  
  // Local state for form inputs - prevents glitches
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972'); // Default to Israel
  const [work, setWork] = useState('');
  const [company, setCompany] = useState('');
  const [linkedinUsername, setLinkedinUsername] = useState('');
  const [position, setPosition] = useState('');
  const [profileInitialized, setProfileInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Parse existing phone number to extract country code and number
  const parseExistingPhone = (phone: string) => {
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

  // Initialize form with existing user data ONLY ONCE
  useEffect(() => {
    if (user && !profileInitialized) {
      console.log('🔄 Initializing profile form with user data:', user);

      const fn = user.firstName ?? (user.displayName || '').trim().split(/\s+/)[0] ?? '';
      const ln = user.lastName ?? (user.displayName || '').trim().split(/\s+/).slice(1).join(' ') ?? '';
      setFirstName(fn);
      setLastName(ln);
      setWork(user.work || '');
      setCompany(user.company || '');
      setLinkedinUsername(user.linkedinUsername || '');
      setPosition(user.position || '');

      // Parse existing phone number
      if (user.phone) {
        const { countryCode, phoneNumber } = parseExistingPhone(user.phone);
        setSelectedCountryCode(countryCode);
        setPhoneNumber(phoneNumber);
      }

      setProfileInitialized(true);

      // Determine which fields are missing
      const missing: string[] = [];
      if (!(fn || ln)) missing.push('name');
      if (!user.phone) missing.push('phone');
      if (!user.company) missing.push('company');
      if (!user.work) missing.push('work');
      if (!user.position) missing.push('position');

      setMissingFields(missing);
      console.log('📝 Missing fields:', missing);

      // If profile is already complete, redirect to main member home
      if (checkProfileComplete()) {
        console.log('✅ Profile already complete, redirecting to members');
        navigate('/members');
      }
    }
  }, [user, profileInitialized, navigate, checkProfileComplete]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log('❌ User not authenticated, redirecting to login');
      navigate('/login');
    }
  }, [user, loading, navigate]);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPhoneNumber(digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate that all missing fields are now filled
    const stillMissing = missingFields.filter(field => {
      switch (field) {
        case 'name': return !firstName.trim() && !lastName.trim();
        case 'phone': return !phoneNumber.trim();
        case 'company': return !company.trim();
        case 'work': return !work.trim();
        case 'linkedinUsername': return !linkedinUsername.trim();
        case 'position': return !position;
        default: return false;
      }
    });

    if (stillMissing.length > 0) {
      console.log('❌ Still missing fields:', stillMissing);
      return;
    }

    setIsSubmitting(true);
    try {
      // Format phone number if provided
      let formattedPhone = '';
      if (phoneNumber.trim()) {
        formattedPhone = formatPhoneNumber(selectedCountryCode, phoneNumber);
      }

      // Format LinkedIn username (slug only; tolerates pasted full URLs and doubled /in/ paths)
      const formattedLinkedin = extractLinkedInVanity(linkedinUsername);

      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      console.log('📝 Updating profile with:', { firstName, lastName, phone: formattedPhone, company, work, linkedinUsername: formattedLinkedin, position });
      await updateProfile({
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: formattedPhone,
        company,
        work,
        linkedinUsername: formattedLinkedin,
        position
      });
      // Trigger HubSpot sync for this user (new approved users never hit ProfileEditPage; sync runs only via PATCH /api/profile)
      try {
        const profilePayload = {
          name: fullName,
          fullName,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: formattedPhone || undefined,
          company: company.trim() || undefined,
          work: work.trim() || undefined,
          position: position || undefined,
          linkedinUsername: formattedLinkedin || undefined,
          linkedinUrl: formattedLinkedin ? `https://www.linkedin.com/in/${formattedLinkedin}` : undefined,
        };
        const res = await apiRequest('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profilePayload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn('HubSpot sync after complete-profile failed (non-blocking):', (data as { error?: string }).error);
        }
      } catch (hubErr) {
        console.warn('HubSpot sync after complete-profile failed (non-blocking):', hubErr);
      }
      console.log('✅ Profile updated successfully');
      navigate('/members');
    } catch (err) {
      console.error('Profile update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = missingFields.every(field => {
    switch (field) {
      case 'name': return firstName.trim() || lastName.trim();
      case 'phone': return phoneNumber.trim();
      case 'company': return company.trim();
      case 'work': return work.trim();
      case 'linkedinUsername': return linkedinUsername.trim();
      case 'position': return Boolean(position.trim());
      default: return true;
    }
  });

  if (loading || !profileInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 overflow-x-hidden w-full max-w-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 relative overflow-x-hidden w-full max-w-full">
      {/* Logo in top left corner */}
      <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-10">
        <Link to="/" className="hover:opacity-80 transition-opacity duration-200">
          <img 
            src={logoSvg}
            alt="AlmaLinks Logo" 
            className="h-8 md:h-10 w-auto"
          />
        </Link>
      </div>

      <div className="max-w-md w-full">
        {/* Back button */}
        <div className="mb-6">
          <BackButton fallbackTo="/events" className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium" iconClassName="h-4 w-4" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h2>
            <p className="text-gray-600">
              Please fill in the missing information to access events
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" {...hubspotDoNotCollectFormProps}>
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name {missingFields.includes('name') && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required={missingFields.includes('name')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!missingFields.includes('name') || isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                    !missingFields.includes('name') ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="First name"
                  autoComplete="given-name"
                />
                {!missingFields.includes('name') && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name {missingFields.includes('name') && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required={missingFields.includes('name')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!missingFields.includes('name') || isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                    !missingFields.includes('name') ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
                {!missingFields.includes('name') && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Phone Number with Country Code */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number {missingFields.includes('phone') && <span className="text-red-500">*</span>}
              </label>
              <div className="flex space-x-2">
                {/* Country Code Dropdown */}
                <div className="relative">
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    disabled={!missingFields.includes('phone') || isSubmitting}
                    className={`appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 pr-8 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-sm ${
                      !missingFields.includes('phone') ? 'bg-gray-50 text-gray-500' : ''
                    }`}
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
                    required={missingFields.includes('phone')}
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    disabled={!missingFields.includes('phone') || isSubmitting}
                    className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                      !missingFields.includes('phone') ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    placeholder={selectedCountryCode === '+972' ? '0501234567' : 'Phone number'}
                  />
                  {!missingFields.includes('phone') && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                  )}
                </div>
              </div>
              
              {/* Phone Preview */}
              {phoneNumber && missingFields.includes('phone') && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Preview:</span> {selectedCountryCode}{phoneNumber.replace(/^0/, '')}
                </div>
              )}
              
              {/* Country Info */}
              {selectedCountry && missingFields.includes('phone') && (
                <div className="mt-1 text-xs text-gray-500">
                  {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
                </div>
              )}
            </div>

            {/* Work */}
            <div>
              <label htmlFor="work" className="block text-sm font-medium text-gray-700 mb-2">
                Work / What do you do? {missingFields.includes('work') && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="work"
                  name="work"
                  type="text"
                  required={missingFields.includes('work')}
                  value={work}
                  onChange={(e) => setWork(e.target.value)}
                  disabled={!missingFields.includes('work') || isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                    !missingFields.includes('work') ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="e.g., CEO at TechCorp, Software Engineer, Investor"
                />
                {!missingFields.includes('work') && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company {missingFields.includes('company') && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  required={missingFields.includes('company')}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={!missingFields.includes('company') || isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                    !missingFields.includes('company') ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="e.g., TechCorp, Google, Self-employed"
                />
                {!missingFields.includes('company') && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
              </div>
            </div>

            {/* LinkedIn Username (optional) */}
            <div>
              <label htmlFor="linkedinUsername" className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Username
              </label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="linkedinUsername"
                  name="linkedinUsername"
                  type="text"
                  value={linkedinUsername}
                  onChange={(e) => setLinkedinUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., johndoe (optional)"
                />
              </div>
              {linkedinUsername && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Preview:</span> linkedin.com/in/{linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}
                </div>
              )}
            </div>

            <MultiSelectField
              id="complete-profile-position"
              label={`Position${missingFields.includes('position') ? ' *' : ''}`}
              options={POSITION_OPTIONS}
              value={parseMultiSelectValue(position)}
              onChange={(vals) => setPosition(formatMultiSelectValue(vals))}
              required={missingFields.includes('position')}
              disabled={!missingFields.includes('position') || isSubmitting}
            />

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Profile...</span>
                </>
              ) : (
                <>
                  <span>Complete Profile</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              All fields marked with <span className="text-red-500">*</span> are required to access events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;