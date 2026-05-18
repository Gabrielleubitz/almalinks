import React, { useState } from 'react';
import { User, Mail, Phone, Briefcase, ArrowRight, ChevronDown } from 'lucide-react';
import BackButton from '../ui/BackButton';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoSvg from '../../assets/alma-links-logo.svg';

interface LoginFormProps {
  onSuccess: () => void;
}

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

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    work: ''
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972'); // Default to Israel
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithProfile, error } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate required fields
    if (!formData.name.trim() || !formData.email.trim() || !formData.phoneNumber.trim() || !formData.work.trim()) {
      return;
    }

    try {
      // Format phone number
      const formattedPhone = formatPhoneNumber(selectedCountryCode, formData.phoneNumber);
      
      setIsSubmitting(true);
      await loginWithProfile({
        ...formData,
        phone: formattedPhone
      });
      onSuccess();
    } catch (err: any) {
      console.error('Authentication error:', err);
      // Error handling is done by useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.phoneNumber.trim() && formData.work.trim();

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 relative">
      {/* Logo in top left corner */}
      <div className="absolute top-6 left-6 z-10">
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
          <BackButton
            fallbackTo="/"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium"
            iconClassName="h-4 w-4"
          />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Join AlmaLinks
            </h2>
            <p className="text-gray-600">
              Enter your details to access events and your dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your full name"
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
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
                    className="appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 pr-8 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-sm"
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    placeholder={selectedCountryCode === '+972' ? '0501234567' : 'Phone number'}
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., CEO at TechCorp, Software Engineer, Investor"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              By continuing, you agree to receive event updates and communications from AlmaLinks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;