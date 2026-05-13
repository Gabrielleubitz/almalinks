import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ArrowLeft, AlertCircle, ChevronDown, Linkedin, CheckCircle, MapPin, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../firebase/config';
import { extractLinkedInVanity } from '../utils/linkedInUrl';
import logoSvg from '../assets/alma-links-logo.svg';
import RichTextBioEditor from '../components/profile/RichTextBioEditor';
import AlmaAuthCard from '../components/ui/AlmaAuthCard';

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
  const { user, register, error, loading, isPending, isNeedsSignup, signInWithGoogle } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    industry: '',
    linkedinProfile: '',
    bioTitle: '',
    expertiseAreas: '',
    lookingToGain: '',
    offerToMembers: '',
    bio: '',
    heardAboutAlma: '',
    password: ''
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972'); // Default to Israel
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [signedInWithGoogle, setSignedInWithGoogle] = useState(false);

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
    if (user.status === 'needs_signup' && !signedInWithGoogle) {
      // Returned after Google OAuth but before form submission — treat as Google signup
      setSignedInWithGoogle(true);
    }
  }, [user, loading, navigate, signedInWithGoogle]);

  // ── Post-registration navigation ─────────────────────────────────────────
  useEffect(() => {
    if (!registrationSuccess) return;

    // Google path: status remains 'needs_signup' after createJoinRequest (auth state
    // doesn't re-fire), so we navigate directly rather than relying on isPending.
    if (signedInWithGoogle) {
      navigate('/pending', { replace: true });
      return;
    }

    // Email path: onAuthStateChanged will update user.status to 'pending' once the
    // join request is created, so we wait for that to propagate.
    if (user && !loading) {
      navigate(isPending ? '/pending' : '/events', { replace: true });
    }
  }, [user, loading, navigate, isPending, registrationSuccess, signedInWithGoogle]);

  // ── Google pre-fill ───────────────────────────────────────────────────────
  // When the user has connected Google on this page, prefill name/email once.
  useEffect(() => {
    if (!signedInWithGoogle || !user) return;
    const full = (user.displayName || '').trim();
    const parts = full ? full.split(/\s+/) : [];
    setFormData(prev => ({
      ...prev,
      firstName: prev.firstName || (parts[0] || ''),
      lastName: prev.lastName || (parts.slice(1).join(' ') || ''),
      email: prev.email || user.email || ''
    }));
  }, [signedInWithGoogle, user]);

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
      setValidationError('Please enter your industry');
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
      setValidationError('Please enter your current role and company');
      return false;
    }
    if (!formData.expertiseAreas.trim()) {
      setValidationError('Please describe your key areas of expertise');
      return false;
    }
    if (!formData.lookingToGain.trim()) {
      setValidationError('Please tell us what you are looking to gain from AlmaLinks');
      return false;
    }
    if (!formData.offerToMembers.trim()) {
      setValidationError('Please tell us what you can offer to other members');
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
    
    // Password required only for email/password signups (not Google SSO)
    if (!signedInWithGoogle) {
      if (!formData.password.trim()) {
        setValidationError('Please choose a portal password');
        return false;
      }
      if (formData.password.length < 6) {
        setValidationError('Password must be at least 6 characters long');
        return false;
      }
    }

    // Ensure the Google user is actually signed-in before allowing form submission
    if (signedInWithGoogle && !auth.currentUser) {
      setValidationError('Google sign-in session expired. Please click "Continue with Google" again.');
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
        company: formData.bioTitle.trim(),
        linkedinUsername,
        position: 'other',
        bioTitle: formData.bioTitle.trim(),
        bio: formData.bio || undefined,
        address: formData.address.trim(),
        industry: formData.industry.trim(),
        expertiseAreas: formData.expertiseAreas.trim(),
        lookingToGain: formData.lookingToGain.trim(),
        offerToMembers: formData.offerToMembers.trim(),
        heardAboutAlma: formData.heardAboutAlma.trim(),
      };

      if (signedInWithGoogle && user) {
        const { JoinRequestService } = await import('../services/joinRequestService');
        await JoinRequestService.createJoinRequest(user.uid, {
          email: formData.email,
          name: fullName,
          displayName: fullName,
          ...joinPayload,
        });
      } else {
        await register(formData.email, formData.password, fullName, {
          ...joinPayload,
          status: 'pending'
        });
      }
      
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
    formData.linkedinProfile.trim() &&
    formData.bioTitle.trim() &&
    formData.expertiseAreas.trim() &&
    formData.lookingToGain.trim() &&
    formData.offerToMembers.trim() &&
    stripHtmlToText(formData.bio) &&
    formData.heardAboutAlma.trim() &&
    (signedInWithGoogle || (formData.password.trim() && formData.password.length >= 6));

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
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium bg-transparent border-0 cursor-pointer p-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to sign in</span>
            </button>
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

          <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Industry */}
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                Industry *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="industry"
                  name="industry"
                  type="text"
                  required
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="e.g., venture capital, fintech, consulting"
                  disabled={isSubmitting}
                />
              </div>
            </div>

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
                Current role and company (bio short) *
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

            {/* Key areas of expertise */}
            <div>
              <label htmlFor="expertiseAreas" className="block text-sm font-medium text-gray-700 mb-2">
                Key areas of expertise *
              </label>
              <textarea
                id="expertiseAreas"
                name="expertiseAreas"
                required
                rows={3}
                value={formData.expertiseAreas}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 resize-y"
                placeholder="Topics, sectors, or skills where you can add value"
                disabled={isSubmitting}
              />
            </div>

            {/* What are you looking to gain */}
            <div>
              <label htmlFor="lookingToGain" className="block text-sm font-medium text-gray-700 mb-2">
                What are you looking to gain from AlmaLinks? *
              </label>
              <textarea
                id="lookingToGain"
                name="lookingToGain"
                required
                rows={3}
                value={formData.lookingToGain}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 resize-y"
                placeholder="Goals, introductions, learning, community — whatever matters to you"
                disabled={isSubmitting}
              />
            </div>

            {/* What can you offer */}
            <div>
              <label htmlFor="offerToMembers" className="block text-sm font-medium text-gray-700 mb-2">
                What can you offer to other members (locally and globally)? *
              </label>
              <textarea
                id="offerToMembers"
                name="offerToMembers"
                required
                rows={3}
                value={formData.offerToMembers}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 resize-y"
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

            {/* Password — only for email/password signup, hidden when using Google */}
            {signedInWithGoogle ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <svg className="w-5 h-5 flex-shrink-0" aria-hidden viewBox="0 0 24 24">
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>
                  <strong>Connected with Google</strong> — no password needed. Your account will use Google sign-in.
                </span>
              </div>
            ) : (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Choose a password for your AlmaLinks portal *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  If your application is approved, you&rsquo;ll use this password to sign in at almalinks.org. (You can change it anytime.)
                </p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                    placeholder="At least 6 characters"
                    minLength={6}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

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

          {/* Google button — hidden once the user is already connected */}
          {!signedInWithGoogle && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    await signInWithGoogle('signup');
                    setSignedInWithGoogle(true);
                  } catch (err) {
                    // Error is handled by useAuth hook
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
              >
                <svg className="w-5 h-5" aria-hidden viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

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