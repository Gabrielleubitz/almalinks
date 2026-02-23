import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, Briefcase, ArrowRight, ArrowLeft, AlertCircle, ChevronDown, Linkedin, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, register, error, loading, isPending, signInWithGoogle } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    company: '',
    work: '',
    linkedinUsername: '',
    position: '',
    chapter: '',
    bioTitle: '',
    bio: '',
    password: ''
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972'); // Default to Israel
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      if (isPending) {
        navigate('/pending');
      } else {
        navigate('/events');
      }
    }
  }, [user, loading, navigate, isPending]);

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
    if (!formData.name.trim()) {
      setValidationError('Please enter your full name');
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
      setValidationError('Please enter your phone number');
      return false;
    }
    
    // Validate phone number format
    try {
      formatPhoneNumber(selectedCountryCode, formData.phoneNumber);
    } catch (error) {
      setValidationError('Please enter a valid phone number');
      return false;
    }
    
    if (!formData.company.trim()) {
      setValidationError('Please enter your company name');
      return false;
    }
    
    if (!formData.work.trim()) {
      setValidationError('Please tell us about your work');
      return false;
    }
    
    if (!formData.linkedinUsername.trim()) {
      setValidationError('Please enter your LinkedIn username');
      return false;
    }
    
    if (!formData.position) {
      setValidationError('Please select your position');
      return false;
    }

    if (!formData.chapter.trim()) {
      setValidationError('Please enter your chapter');
      return false;
    }
    
    if (!formData.password.trim()) {
      setValidationError('Please create a password');
      return false;
    }
    
    if (formData.password.length < 6) {
      setValidationError('Password must be at least 6 characters long');
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
      
      setIsSubmitting(true);
      // Console logs for development debugging (not shown in UI)
      if (import.meta.env.DEV) {
        console.log('📝 Attempting registration for:', formData.email);
        console.log('📝 Profile data:', {
          phone: formattedPhone,
          company: formData.company,
          work: formData.work,
          linkedinUsername: formData.linkedinUsername,
          position: formData.position
        });
      }
      
      await register(formData.email, formData.password, formData.name, {
        phone: formattedPhone,
        company: formData.company,
        work: formData.work,
        linkedinUsername: formData.linkedinUsername,
        position: formData.position,
        chapter: formData.chapter || undefined,
        bioTitle: formData.bioTitle || undefined,
        bio: formData.bio || undefined,
        status: 'pending' // Set initial status as pending
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

  const isFormValid = formData.name.trim() &&
                     formData.email.trim() &&
                     formData.phoneNumber.trim() &&
                     formData.company.trim() &&
                     formData.work.trim() &&
                     formData.linkedinUsername.trim() &&
                     formData.position &&
                     formData.chapter.trim() &&
                     formData.password.trim() &&
                     formData.password.length >= 6;

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
              Registration Successful!
            </h2>
            <p className="text-gray-600 mb-6">
              Your account has been created and is pending admin approval. Setting up your account...
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
          title="Join Alma Links"
          subtitle="Create your account to connect with members, discover events, and join conversations worldwide."
          logoUrl={logoSvg}
        >
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to sign in</span>
            </Link>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[var(--brand-blue-dark)] to-[var(--brand-blue-light)] rounded-full mb-3">
              <User className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
            <p className="text-sm text-gray-600">Fill in your details to join Alma Links</p>
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
                      <Link
                        to="/login"
                        className="inline-flex items-center space-x-2 text-red-700 hover:text-red-800 font-semibold text-sm transition-colors duration-200"
                      >
                        <span>Go to Login</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
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
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Enter your full name"
                  disabled={isSubmitting}
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoComplete="name"
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

            {/* Phone Number with Country Code */}
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

            {/* Company */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  required
                  value={formData.company}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="e.g., TechCorp, Google, Self-Employed"
                  autoComplete="organization"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Work */}
            <div>
              <label htmlFor="work" className="block text-sm font-medium text-gray-700 mb-2">
                Job Description *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="work"
                  name="work"
                  type="text"
                  required
                  value={formData.work}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="e.g., Leading product development, Managing investments"
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
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="e.g., johndoe (without linkedin.com/in/)"
                  disabled={isSubmitting}
                />
              </div>
              {formData.linkedinUsername && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Preview:</span> linkedin.com/in/{formData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '')}
                </div>
              )}
            </div>

            {/* Position */}
            <div>
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
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 appearance-none min-h-[44px] touch-manipulation"
                  disabled={isSubmitting}
                  aria-label="Position"
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

            {/* Chapter */}
            <div>
              <label htmlFor="chapter" className="block text-sm font-medium text-gray-700 mb-2">
                Chapter *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="chapter"
                  name="chapter"
                  type="text"
                  required
                  value={formData.chapter}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="e.g., North America, Europe"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Bio (short) - optional */}
            <div>
              <label htmlFor="bioTitle" className="block text-sm font-medium text-gray-700 mb-2">
                Bio (short)
              </label>
              <input
                id="bioTitle"
                name="bioTitle"
                type="text"
                value={formData.bioTitle}
                onChange={handleInputChange}
                maxLength={60}
                className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                placeholder="A short tagline (max 60 characters)"
                disabled={isSubmitting}
              />
            </div>

            {/* Bio (long) - optional */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                Bio (long)
              </label>
              <RichTextBioEditor
                value={formData.bio}
                onChange={(html) => setFormData(prev => ({ ...prev, bio: html }))}
                placeholder="Tell us about your background. Use the toolbar for bold, italic, underline, and highlight."
                disabled={isSubmitting}
                maxLength={2000}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] touch-manipulation"
                  placeholder="Create a password (min. 6 characters)"
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

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={async () => {
              try {
                setIsSubmitting(true);
                await signInWithGoogle();
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
            <span>Continue with Google</span>
          </button>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-red-600 hover:text-red-700 font-semibold transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              We will review your LinkedIn profile before granting access. All signups require admin approval.
            </p>
          </div>
        </AlmaAuthCard>
      </div>
    </div>
  );
};

export default SignupPage;