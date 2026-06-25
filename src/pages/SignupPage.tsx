import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { Mail, User, Phone, ArrowRight, ArrowLeft, AlertCircle, ChevronDown, Linkedin, CheckCircle, MapPin, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { extractLinkedInVanity } from '../utils/linkedInUrl';
import logoSvg from '../assets/alma-links-logo.svg';
import RichTextBioEditor from '../components/profile/RichTextBioEditor';
import AlmaAuthCard from '../components/ui/AlmaAuthCard';
import { hubspotDoNotCollectFormProps } from '../utils/hubspotForm';
import MultiSelectField from '../components/form/MultiSelectField';
import {
  SPECIALTY_OPTIONS,
  INDUSTRY_OPTIONS,
  POSITION_OPTIONS,
  LOOKING_TO_GAIN_OPTIONS,
  ASSIST_MEMBERS_PLACEHOLDER,
  parseMultiSelectValue,
  formatMultiSelectValue,
} from '../constants/memberFieldOptions';

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

function stripHtmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, register, error, loading, isPending } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    company: '',
    industry: '',
    specialty: '',
    position: '',
    linkedinProfile: '',
    bioTitle: '',
    lookingToGain: '',
    offerToMembers: '',
    bio: '',
    heardAboutAlma: ''
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972'); // Default to Israel
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // ── Guard: redirect users who shouldn't be on /signup ───────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (user.status === 'approved') {
      // Already a full member — send them into the app
      navigate('/members', { replace: true });
      return;
    }
    if (user.status === 'pending') {
      // Already submitted a join request — show the waiting page
      navigate('/pending', { replace: true });
      return;
    }
    if (user.status === 'needs_signup') {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // ── Post-registration navigation ─────────────────────────────────────────
  useEffect(() => {
    if (!registrationSuccess) return;

    // Email path: onAuthStateChanged will update user.status to 'pending' once the
    // join request is created, so we wait for that to propagate.
    if (user && !loading) {
      navigate(isPending ? '/pending' : '/events', { replace: true });
    }
  }, [user, loading, navigate, isPending, registrationSuccess]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
    
    // Clear validation errors when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

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

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setValidationError('Please enter your first name');
      return false;
    }
    if (!formData.lastName.trim()) {
      setValidationError('Please enter your last name');
      return false;
    }

    if (!formData.email.trim()) {
      setValidationError('Please enter your email address');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    
    if (!formData.phoneNumber.trim()) {
      setValidationError('Please enter your mobile number');
      return false;
    }
    
    // Validate phone number format
    try {
      formatPhoneNumber(selectedCountryCode, formData.phoneNumber);
    } catch (error) {
      setValidationError('Please enter a valid mobile number');
      return false;
    }
    
    if (!formData.address.trim()) {
      setValidationError('Please enter your address');
      return false;
    }
    if (!formData.industry.trim()) {
      setValidationError('Please select at least one industry');
      return false;
    }
    if (!formData.specialty.trim()) {
      setValidationError('Please select at least one specialty');
      return false;
    }
    if (!formData.position.trim()) {
      setValidationError('Please select at least one position');
      return false;
    }
    if (!formData.company.trim()) {
      setValidationError('Please enter your company');
      return false;
    }
    if (!formData.linkedinProfile.trim()) {
      setValidationError('Please enter your LinkedIn profile URL or username');
      return false;
    }
    if (!extractLinkedInVanity(formData.linkedinProfile)) {
      setValidationError('Please enter a valid LinkedIn profile URL or username');
      return false;
    }
    if (!formData.bioTitle.trim()) {
      setValidationError('Please enter your bio one-liner');
      return false;
    }
    if (!formData.lookingToGain.trim()) {
      setValidationError('Please select what you are looking to gain from AlmaLinks this year');
      return false;
    }
    if (!formData.offerToMembers.trim()) {
      setValidationError('Please tell us how you would like to assist other members');
      return false;
    }
    if (!stripHtmlToText(formData.bio)) {
      setValidationError('Please describe your entrepreneurial or business background');
      return false;
    }
    if (!formData.heardAboutAlma.trim()) {
      setValidationError('Please tell us how you heard about AlmaLinks');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Clear previous errors
    setValidationError(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      // Format phone number
      const formattedPhone = formatPhoneNumber(selectedCountryCode, formData.phoneNumber);
      const linkedinUsername = extractLinkedInVanity(formData.linkedinProfile);
      
      setIsSubmitting(true);
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const joinPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formattedPhone,
        company: formData.company.trim(),
        linkedinUsername,
        position: formData.position.trim(),
        specialty: formData.specialty.trim(),
        expertiseAreas: formData.specialty.trim(),
        bioTitle: formData.bioTitle.trim(),
        bio: formData.bio || undefined,
        address: formData.address.trim(),
        industry: formData.industry.trim(),
        lookingToGain: formData.lookingToGain.trim(),
        offerToMembers: formData.offerToMembers.trim(),
        heardAboutAlma: formData.heardAboutAlma.trim(),
      };

      await register(formData.email, undefined, fullName, {
        ...joinPayload,
        status: 'pending'
      });
      
      // Set success state to show message
      // The useEffect hook will handle navigation once user state updates
      setRegistrationSuccess(true);
      
    } catch (err) {
      // Error is handled by the useAuth hook which provides user-friendly messages
      // Console error for development debugging only (not shown in UI)
      if (import.meta.env.DEV) {
        console.error('Registration error:', err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.email.trim() &&
    formData.phoneNumber.trim() &&
    formData.address.trim() &&
    formData.industry.trim() &&
    formData.specialty.trim() &&
    formData.position.trim() &&
    formData.company.trim() &&
    formData.linkedinProfile.trim() &&
    formData.bioTitle.trim() &&
    formData.lookingToGain.trim() &&
    formData.offerToMembers.trim() &&
    stripHtmlToText(formData.bio) &&
    formData.heardAboutAlma.trim();

  const displayError = validationError || error;
  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  // Show success message if registration was successful
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 relative">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Thank you for applying
            </h2>
            <p className="text-gray-600 mb-6">
              We received your application. Taking you to the next steps…
            </p>
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#DCE8F6] via-white to-[#eef4fc] flex flex-col items-center justify-center px-3 sm:px-4 pt-4 sm:pt-6 pb-4 sm:pb-6 relative overflow-x-hidden w-full max-w-full">
      <div className="w-full max-w-4xl flex-shrink-0 my-4 mb-0">
        <AlmaAuthCard
          title="Apply to AlmaLinks"
          subtitle="Complete this application so our team can review your fit with the community."
          logoUrl={logoSvg}
        >
          <div className="mb-6">
            <BackButton
              fallbackTo="/login"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium bg-transparent border-0 cursor-pointer p-0"
              iconClassName="h-4 w-4"
            />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[var(--brand-blue-dark)] to-[var(--brand-blue-light)] rounded-full mb-3">
              <User className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Application</h2>
            <p className="text-sm text-gray-600">Application questions</p>
          </div>

          {displayError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-600 text-sm mb-3">{displayError}</p>
                  {error && error.includes('already exists') && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-red-700 text-sm mb-2">
                        This email already has an account. Please log in to submit a new approval request.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="inline-flex items-center space-x-2 text-red-700 hover:text-red-800 font-semibold text-sm transition-colors duration-200 bg-transparent border-0 cursor-pointer p-0"
                      >
                        <span>Go to Login</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" {...hubspotDoNotCollectFormProps}>
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="First name"
                  disabled={isSubmitting}
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoComplete="given-name"
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Last name"
                  disabled={isSubmitting}
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Mobile with country code */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Mobile *
              </label>
              <div className="flex space-x-2">
                {/* Country Code Dropdown */}
                <div className="relative">
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    disabled={isSubmitting}
                    className="appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 pr-8 focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 text-sm min-h-[44px] touch-manipulation disabled:opacity-50"
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
                    className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                    placeholder={selectedCountryCode === '+972' ? '0501234567' : 'Phone number'}
                    autoComplete="tel"
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

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  id="address"
                  name="address"
                  required
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation resize-y"
                  placeholder="City, country, and any detail that helps us place you"
                  disabled={isSubmitting}
                  autoComplete="street-address"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  required
                  value={formData.company}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Organization or firm name"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <MultiSelectField
              id="signup-specialty"
              label="Specialty"
              options={SPECIALTY_OPTIONS}
              value={parseMultiSelectValue(formData.specialty)}
              onChange={(vals) => setFormData((prev) => ({ ...prev, specialty: formatMultiSelectValue(vals) }))}
              required
              disabled={isSubmitting}
            />

            <MultiSelectField
              id="signup-industry"
              label="Industry"
              options={INDUSTRY_OPTIONS}
              value={parseMultiSelectValue(formData.industry)}
              onChange={(vals) => setFormData((prev) => ({ ...prev, industry: formatMultiSelectValue(vals) }))}
              required
              disabled={isSubmitting}
            />

            <MultiSelectField
              id="signup-position"
              label="Position"
              options={POSITION_OPTIONS}
              value={parseMultiSelectValue(formData.position)}
              onChange={(vals) => setFormData((prev) => ({ ...prev, position: formatMultiSelectValue(vals) }))}
              required
              disabled={isSubmitting}
            />

            {/* LinkedIn Profile */}
            <div>
              <label htmlFor="linkedinProfile" className="block text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile *
              </label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="linkedinProfile"
                  name="linkedinProfile"
                  type="text"
                  required
                  value={formData.linkedinProfile}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Profile URL or username (e.g. johndoe or linkedin.com/in/johndoe)"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Current role and company (short) */}
            <div>
              <label htmlFor="bioTitle" className="block text-sm font-medium text-gray-700 mb-2">
                Bio one-liner (short professional headline) *
              </label>
              <input
                id="bioTitle"
                name="bioTitle"
                type="text"
                required
                value={formData.bioTitle}
                onChange={handleInputChange}
                maxLength={120}
                className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                placeholder="e.g., Partner at Example Capital"
                disabled={isSubmitting}
              />
            </div>

            <MultiSelectField
              id="signup-lookingToGain"
              label="What are you looking to gain from AlmaLinks this year?"
              options={LOOKING_TO_GAIN_OPTIONS}
              value={parseMultiSelectValue(formData.lookingToGain)}
              onChange={(vals) => setFormData((prev) => ({ ...prev, lookingToGain: formatMultiSelectValue(vals) }))}
              required
              disabled={isSubmitting}
            />

            {/* What can you offer */}
            <div>
              <label htmlFor="offerToMembers" className="block text-sm font-medium text-gray-700 mb-2">
                How would you like to assist other members (in your city and globally)? *
              </label>
              <textarea
                id="offerToMembers"
                name="offerToMembers"
                required
                rows={4}
                value={formData.offerToMembers}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 resize-y"
                placeholder={ASSIST_MEMBERS_PLACEHOLDER}
                disabled={isSubmitting}
              />
            </div>

            {/* Entrepreneurial / business background (long) */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                Please briefly describe your entrepreneurial or business background (bio long) *
              </label>
              <RichTextBioEditor
                value={formData.bio}
                onChange={(html) => setFormData(prev => ({ ...prev, bio: html }))}
                placeholder="Use the toolbar for emphasis where helpful."
                disabled={isSubmitting}
                maxLength={4000}
              />
            </div>

            {/* How did you hear about AlmaLinks */}
            <div>
              <label htmlFor="heardAboutAlma" className="block text-sm font-medium text-gray-700 mb-2">
                How did you hear about AlmaLinks? (including referral details if applicable) *
              </label>
              <textarea
                id="heardAboutAlma"
                name="heardAboutAlma"
                required
                rows={2}
                value={formData.heardAboutAlma}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 resize-y"
                placeholder="Member referral, event, social media, etc."
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <span>Submit application</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-red-600 hover:text-red-700 font-semibold transition-colors duration-200 bg-transparent border-0 cursor-pointer p-0 inline"
              >
                Sign in
              </button>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Applications are reviewed by the AlmaLinks team. You will see confirmation and next steps after you submit.
            </p>
          </div>
        </AlmaAuthCard>
      </div>
    </div>
  );
};

export default SignupPage;