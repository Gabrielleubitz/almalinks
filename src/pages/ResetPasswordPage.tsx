import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { Eye, EyeOff, Lock, ArrowRight, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { PasswordResetService } from '../services/passwordResetService';
import logoSvg from '../assets/alma-links-logo.svg';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [token, setToken] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [useFirebaseFlow, setUseFirebaseFlow] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const customToken = searchParams.get('token');
    const firebaseCode = searchParams.get('oobCode');

    if (customToken) {
      setToken(customToken);
      setUseFirebaseFlow(false);
      verifyCustomToken(customToken);
      return;
    }

    if (firebaseCode) {
      setOobCode(firebaseCode);
      setUseFirebaseFlow(true);
      verifyFirebaseCode(firebaseCode);
      return;
    }

    setError('Invalid or missing reset link. Please try requesting a new password reset.');
    setIsVerifying(false);
  }, [location]);

  const verifyCustomToken = async (code: string) => {
    try {
      const result = await PasswordResetService.verifyToken(code);
      if (!result.valid) {
        setError('This password reset link is invalid or has already been used. Please request a new one.');
        setIsVerifying(false);
        return;
      }
      setEmail(result.email || null);
      setIsVerifying(false);
    } catch (err) {
      console.error('❌ Error verifying reset token:', err);
      setError('This password reset link is invalid. Please request a new one.');
      setIsVerifying(false);
    }
  };

  const verifyFirebaseCode = async (code: string) => {
    try {
      const { auth } = await import('../firebase/config');
      const { verifyPasswordResetCode } = await import('firebase/auth');
      const emailAddress = await verifyPasswordResetCode(auth, code);
      setEmail(emailAddress);
      setIsVerifying(false);
    } catch (err) {
      console.error('❌ Error verifying Firebase reset code:', err);
      setError('This password reset link is invalid or has expired. Please request a new one.');
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (useFirebaseFlow && oobCode) {
        const { auth } = await import('../firebase/config');
        const { confirmPasswordReset } = await import('firebase/auth');
        await confirmPasswordReset(auth, oobCode, newPassword);
      } else if (token) {
        const ok = await PasswordResetService.resetPassword(token, newPassword);
        if (!ok) {
          setError('Failed to reset password. The link may have already been used.');
          return;
        }
      } else {
        setError('Invalid reset link. Please request a new one.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      console.error('❌ Error resetting password:', err);
      if (err.code === 'auth/expired-action-code') {
        setError('This password reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This password reset link is invalid. Please request a new one.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 relative overflow-x-hidden w-full max-w-full">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verifying Reset Link
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your password reset link...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 relative overflow-x-hidden w-full max-w-full">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Password Reset Successful
            </h2>
            <p className="text-gray-600 mb-6">
              Your password has been reset successfully. You will be redirected to the login page.
            </p>
            <Link
              to="/login"
              className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
            >
              <span>Go to Login</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 relative overflow-x-hidden w-full max-w-full">
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
        <div className="mb-6">
          <BackButton
            fallbackTo="/login"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium"
            iconClassName="h-4 w-4"
          />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Reset Your Password
            </h2>
            {email && (
              <p className="text-gray-600">
                Create a new password for <span className="font-medium">{email}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter new password (min. 6 characters)"
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your new password"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
