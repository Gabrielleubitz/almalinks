import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { PasswordResetService } from '../services/passwordResetService';
import logoSvg from '../assets/alma-links-logo.svg';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create a reset token
      const token = await PasswordResetService.createResetToken(email);
      
      // If token is null, user doesn't exist, but we don't reveal that
      if (token) {
        // Send reset email
        await PasswordResetService.sendResetEmail(email, token);
      }
      
      // Show success message regardless of whether user exists
      setSuccess(true);
    } catch (err: any) {
      console.error('❌ Error in password reset flow:', err);
      setError('An error occurred while processing your request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 relative">
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
          <Link 
            to="/login"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Login</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Forgot Password
            </h2>
            <p className="text-gray-600">
              Enter your email to receive a password reset link
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h3>
                <p className="text-gray-600">
                  If an account exists with the email <span className="font-medium">{email}</span>, we've sent a password reset link.
                </p>
              </div>
              
              <p className="text-sm text-gray-500 mb-6">
                Please check your inbox and spam folder. The reset link will expire in 24 hours.
              </p>
              
              <Link
                to="/login"
                className="inline-flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Address */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Remember your password?{' '}
              <Link
                to="/login"
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;