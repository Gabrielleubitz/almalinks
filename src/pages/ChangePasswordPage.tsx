import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowRight, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { TempPasswordService } from '../services/tempPasswordService';
import logoSvg from '../assets/alma-links-logo.svg';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordRequirement, setPasswordRequirement] = useState<{ required: boolean; reason?: string } | null>(null);

  // Check if password change is required
  useEffect(() => {
    const checkRequirement = async () => {
      if (user?.uid) {
        const requirement = await TempPasswordService.checkPasswordChangeRequired(user.uid);
        setPasswordRequirement(requirement);

        // If no password change required, redirect to events
        if (!requirement.required) {
          console.log('✅ No password change required, redirecting to events');
          navigate('/events', { replace: true });
        }
      }
    };

    if (!loading && user) {
      checkRequirement();
    }
  }, [user, loading, navigate]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  const getRequirementMessage = () => {
    if (!passwordRequirement?.reason) return 'You are required to change your password.';

    switch (passwordRequirement.reason) {
      case 'temporary_password':
        return 'You are using a temporary password and must set a new password to continue.';
      case 'admin_forced_reset':
        return 'An administrator has required you to change your password for security reasons.';
      default:
        return 'You are required to change your password.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !user?.uid) return;

    setError(null);

    // Validate passwords
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    setIsSubmitting(true);

    try {
      // First, re-authenticate with current password
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('../firebase/config');

      if (!user.email) {
        throw new Error('User email not found');
      }

      await signInWithEmailAndPassword(auth, user.email, currentPassword);
      console.log('✅ Re-authentication successful');

      // Now change the password
      await TempPasswordService.changePassword(user.uid, newPassword);
      console.log('✅ Password changed successfully');

      setSuccess(true);

      // Redirect to events after 2 seconds
      setTimeout(() => {
        navigate('/events', { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error('❌ Error changing password:', err);

      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Current password is incorrect');
      } else if (err.code === 'auth/weak-password') {
        setError('New password is too weak. Please choose a stronger password.');
      } else {
        setError(err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !passwordRequirement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 relative">
        {/* Logo */}
        <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-10">
          <Link to="/" className="hover:opacity-80 transition-opacity duration-200">
            <img
              src={logoSvg}
              alt="AlmaLinks Logo"
              className="h-8 md:h-10 w-auto"
            />
          </Link>
        </div>

        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Password Changed Successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              Your password has been updated. Redirecting you to events...
            </p>
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 relative">
      {/* Logo */}
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
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Password Change Required
            </h2>
            <p className="text-gray-600">
              {getRequirementMessage()}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your current password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your new password (min. 8 characters)"
                  minLength={8}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and number
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your new password"
                  minLength={8}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Changing Password...</span>
                </>
              ) : (
                <>
                  <span>Change Password</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Password Requirements:</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• At least 8 characters long</li>
              <li>• Contains uppercase and lowercase letters</li>
              <li>• Contains at least one number</li>
              <li>• Different from your current password</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
