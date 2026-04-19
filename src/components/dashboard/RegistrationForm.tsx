import React, { useState } from 'react';
import { User, Phone, Briefcase, Check, Calendar, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRegistration } from '../../hooks/useRegistration';
import RegistrationConfirmation from './RegistrationConfirmation';

interface RegistrationFormProps {
  onSuccess: () => void;
  eventId?: string;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSuccess, eventId = 'default-event' }) => {
  const { user } = useAuth();
  const { submitRegistration, submitting, error } = useRegistration();
  
  // Form state - email is automatically taken from authenticated user
  const [fullName, setFullName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [work, setWork] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!fullName.trim()) {
      setFormError('Please enter your full name');
      return;
    }

    if (!user?.email) {
      setFormError('User email not found. Please log out and log back in.');
      return;
    }

    if (!phone.trim()) {
      setFormError('Please enter your phone number');
      return;
    }

    if (!work.trim()) {
      setFormError('Please tell us about your work');
      return;
    }

    try {
      setFormError(null);
      // Use authenticated user's email automatically
      const registrationData = await submitRegistration(fullName, user.email, phone, work);
      
      // Store submitted data for confirmation display
      setSubmittedData({
        name: fullName,
        email: user.email,
        phone: phone,
        work: work
      });
      
      // Show confirmation instead of form
      setShowConfirmation(true);
      onSuccess();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Show confirmation if registration was successful
  if (showConfirmation && submittedData) {
    return <RegistrationConfirmation data={submittedData} eventId={eventId} />;
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
          <Calendar className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Register for AlmaLinks 4.0
        </h2>
        <p className="text-gray-600">
          Secure your spot at our most exclusive event yet
        </p>
      </div>

      {/* Event Details */}
      <div className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Event Details</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-red-700" />
            <span className="text-gray-700">June 28th, 2025</span>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-brand-light" />
            <span className="text-gray-700">18:30 - 22:00</span>
          </div>
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-red-700" />
            <span className="text-gray-700">Deli Vino, Netanya</span>
          </div>
        </div>
      </div>

      {/* User Email Display */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Registering as:</span>
          <span className="font-semibold text-gray-900">{user?.email}</span>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {formError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{formError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your full name"
            />
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your phone number"
            />
          </div>
        </div>

        {/* Work / What do you do? */}
        <div>
          <label htmlFor="work" className="block text-sm font-medium text-gray-700 mb-2">
            Work / What do you do? *
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="work"
              type="text"
              required
              value={work}
              onChange={(e) => setWork(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              placeholder="e.g., CEO at TechCorp, Software Engineer, Investor"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Reserving Your Spot...</span>
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              <span>Reserve My Spot</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          By registering, you agree to receive event updates and communications from AlmaLinks.
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;