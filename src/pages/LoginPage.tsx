import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import logoSvg from '../assets/alma-links-logo.svg';
import IganiWatermark from '../components/IganiWatermark';
import AlmaAuthCard from '../components/ui/AlmaAuthCard';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login, error, loading, checkProfileComplete, isPending, isRejected, resetPassword, signInWithGoogle } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      if (isPending) {
        navigate('/pending');
      } else if (isRejected) {
        navigate('/re-request-access');
      } else if (checkProfileComplete()) {
        navigate('/events');
      } else {
        navigate('/complete-profile');
      }
    }
  }, [user, loading, navigate, checkProfileComplete, isPending, isRejected]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation errors when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setValidationError('Please enter your email address');
      return false;
    }
    
    if (!formData.password.trim()) {
      setValidationError('Please enter your password');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Clear previous errors
    setValidationError(null);
    setStatusMessage(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('🔐 Attempting login for:', formData.email);
      await login(formData.email, formData.password);
      
      // Set success state
      setLoginSuccess(true);
      
      // Navigation will be handled by useEffect above
    } catch (err: any) {
      console.error('Login error:', err);
      // Error is handled by the useAuth hook
      
      // Check for specific error messages
      if (err.message === 'Account pending approval') {
        setStatusMessage('Your account is pending admin approval. We will notify you when approved.');
      } else if (err.message === 'Account rejected') {
        setStatusMessage('Your account application was not approved. Please contact us for more information.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResettingPassword) return;

    // Validate email
    if (!forgotPasswordEmail.trim()) {
      setValidationError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    setIsResettingPassword(true);
    try {
      const success = await resetPassword(forgotPasswordEmail);
      if (success) {
        setResetEmailSent(true);
        setValidationError(null);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      // Error is handled by the useAuth hook
    } finally {
      setIsResettingPassword(false);
    }
  };

  const isFormValid = formData.email.trim() && formData.password.trim();
  const displayError = validationError || error;

  // Show success message if login was successful and user is pending
  if (loginSuccess && user && isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 relative overflow-x-hidden w-full max-w-full box-border">
        <div className="max-w-md w-full text-center px-0 sm:px-0">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 lg:p-8 border border-gray-100 w-full max-w-full">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full mb-4 sm:mb-6">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Login Successful
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              Your account is pending admin approval. You'll be redirected to the pending page.
            </p>
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#DCE8F6] via-white to-[#eef4fc] flex flex-col items-center justify-center px-3 sm:px-4 pt-16 sm:pt-20 pb-12 sm:pb-16 relative overflow-x-hidden w-full max-w-full box-border">
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] sm:top-6 sm:left-6 z-10">
        <Link to="/login" className="hover:opacity-80 transition-opacity duration-200 inline-block touch-manipulation py-2 pr-2">
          <img src={logoSvg} alt="Alma Links" className="h-7 sm:h-8 md:h-10 w-auto" />
        </Link>
      </div>

      <div className="w-full max-w-4xl flex-shrink-0">
        <AlmaAuthCard
          title="Alma Links"
          subtitle="Sign in to connect with members, discover events, and join conversations worldwide."
          logoUrl={logoSvg}
        >
          <div className="mb-3 sm:mb-4">
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-xs sm:text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 flex-shrink-0" />
              <span>Back</span>
            </Link>
          </div>
          <div className="w-full">
          {showForgotPassword ? (
            <>
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-3 sm:mb-4">
                  <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  Reset Password
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  Enter your email to receive a password reset link
                </p>
              </div>

              {displayError && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 sm:space-x-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-600 text-xs sm:text-sm">{displayError}</p>
                </div>
              )}

              {resetEmailSent && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-2 sm:space-x-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-600 text-xs sm:text-sm">If an account exists with that email, a password reset link has been sent.</p>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4 sm:space-y-6">
                {/* Email Address */}
                <div>
                  <label htmlFor="forgotPasswordEmail" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      id="forgotPasswordEmail"
                      name="forgotPasswordEmail"
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="w-full pl-9 sm:pl-10 pr-4 py-3 sm:py-4 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] sm:min-h-0"
                      placeholder="Enter your email"
                      disabled={isResettingPassword}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isResettingPassword || !forgotPasswordEmail.trim()}
                  className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 sm:py-4 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  {isResettingPassword ? (
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

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-gray-600 hover:text-gray-800 font-medium text-xs sm:text-sm min-h-[44px] sm:min-h-0 inline-flex items-center justify-center"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
                  Welcome back
                </h2>
                <p className="text-sm text-gray-600">
                  Sign in to your Alma Links account
                </p>
              </div>

              {displayError && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 sm:space-x-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-600 text-xs sm:text-sm">{displayError}</p>
                </div>
              )}

              {/* When account is Google-only, show prominent Google sign-in option */}
              {displayError && displayError.toLowerCase().includes('google') && (
                <div className="mb-4 sm:mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-sm font-medium mb-3">Use Google to sign in to this account</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        await signInWithGoogle();
                      } catch (_) {
                        // Error shown by useAuth
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 sm:py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 font-semibold disabled:opacity-50 text-sm"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              )}

              {statusMessage && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center space-x-2 sm:space-x-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-yellow-600 text-xs sm:text-sm">{statusMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-9 sm:pl-10 pr-4 py-3 sm:py-4 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] sm:min-h-0 touch-manipulation"
                      placeholder="Enter your email"
                      disabled={isSubmitting}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full pl-9 sm:pl-10 pr-11 sm:pr-12 py-3 sm:py-4 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-blue-dark)] focus:border-transparent transition-all duration-200 min-h-[44px] sm:min-h-0 touch-manipulation"
                      placeholder="Enter your password"
                      disabled={isSubmitting}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 p-2 sm:p-1 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                      disabled={isSubmitting}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 sm:py-4 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm">
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
                className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 sm:py-4 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation min-h-[44px] sm:min-h-0"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
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
                <span className="whitespace-nowrap">Continue with Google</span>
              </button>

              <div className="mt-3 text-center">
                <Link
                  to="/forgot-password"
                  className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium min-h-[44px] sm:min-h-0 inline-flex items-center justify-center"
                >
                  Forgot your password?
                </Link>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs sm:text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="text-red-600 hover:text-red-700 font-semibold transition-colors duration-200"
                  >
                    Sign up
                  </Link>
                </p>
              </div>

              {/* Help Text */}
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm text-gray-500">
                  Having trouble? Contact us at{' '}
                  <a 
                    href="mailto:info@almalinks.org" 
                    className="text-red-600 hover:text-red-700 font-medium break-all"
                  >
                    info@almalinks.org
                  </a>
                </p>
              </div>
            </>
          )}
          </div>
        </AlmaAuthCard>
      </div>

      <div className="w-full flex items-center justify-center mt-auto sm:mt-6 pb-4 sm:pb-0 z-0">
        <IganiWatermark position="bottom-center" size="sm" opacity={0.3} />
      </div>
    </div>
  );
};

export default LoginPage;