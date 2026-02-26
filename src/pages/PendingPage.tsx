import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/config';
import logoSvg from '../assets/alma-links-logo.svg';

const PendingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  // When admin approves, the user document is created. Redirect to dashboard for onboarding.
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.status === 'approved') {
          navigate('/dashboard', { replace: true });
        }
      }
    }, (err) => {
      console.warn('[PendingPage] Listener error:', err?.message);
    });
    return () => unsubscribe();
  }, [user?.uid, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading state while auth is being set up
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 overflow-x-hidden w-full max-w-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 overflow-x-hidden w-full max-w-full relative">
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
            to="/"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to site</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Account Pending Approval
            </h2>
            <p className="text-gray-600 mb-6">
              Thanks for signing up. Your application is under review. We&apos;ll email you as soon as you&apos;re approved.
            </p>
            
            <div className="bg-yellow-50 rounded-xl p-6 mb-6 text-left">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-yellow-800 mb-2">What happens next?</h3>
                  <ul className="text-sm text-yellow-700 space-y-2">
                    <li>• Our team will review your LinkedIn profile</li>
                    <li>• We&apos;ll verify your professional information</li>
                    <li>• You&apos;ll receive an email notification when approved</li>
                    <li>• Once approved, you can log in and access all features</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-6 text-left">
              <div className="flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 text-brand-blue flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">Need assistance?</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    If you have any questions or need to update your information, please contact us:
                  </p>
                  <a
                    href="mailto:info@almalinks.org"
                    className="text-sm text-brand-blue hover:text-brand-blue-hover font-medium"
                  >
                    info@almalinks.org
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white text-sm font-semibold hover:shadow-lg transition-all duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingPage;