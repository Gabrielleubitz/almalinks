import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/config';
import logoSvg from '../assets/alma-links-logo.svg';
import AlmaAuthCard from '../components/ui/AlmaAuthCard';

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
          navigate('/complete-profile', { replace: true });
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
    <div className="min-h-screen bg-gradient-to-br from-[#DCE8F6] via-white to-[#eef4fc] flex flex-col items-center justify-center px-3 sm:px-4 pt-16 sm:pt-20 pb-16 sm:pb-20 relative overflow-x-hidden w-full max-w-full box-border">
      <div className="w-full max-w-4xl flex-shrink-0 mb-0">
        <AlmaAuthCard
          title="Thank you for applying"
          subtitle="We appreciate your interest in the AlmaLinks community."
          logoUrl={logoSvg}
        >
          {/* Back to sign in */}
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

          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-yellow-100 rounded-full mb-4">
              <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              We received your application
            </h2>
            <p className="text-sm sm:text-base text-gray-600 text-left max-w-2xl mx-auto">
              Thank you for applying to join the AlmaLinks community. We truly appreciate your interest and the time you took to share your background with us. Our team will review your application and will be in touch.
            </p>
          </div>

          <div className="space-y-4 sm:space-y-5 mb-6">
            <div className="bg-yellow-50 rounded-2xl p-4 sm:p-5 border border-yellow-100 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-800 mb-1.5">What happens next</h3>
                  <ul className="text-sm text-yellow-800 space-y-1.5 list-disc list-inside">
                    <li>Our team will review your application.</li>
                    <li>We will follow up with next steps once the review process is complete.</li>
                    <li>If any additional information is needed, we will reach out via email.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 sm:p-5 border border-blue-100 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-brand-blue" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1.5">Need to update something?</h3>
                  <p className="text-sm text-blue-800 mb-2">
                    If you have any questions or would like to share additional information, feel free to contact us at:
                  </p>
                  <a
                    href="mailto:communications@almalinks.org"
                    className="text-sm text-brand-blue hover:text-brand-blue-hover font-medium"
                  >
                    communications@almalinks.org
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 border border-gray-200 bg-gray-50/80 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">Disclaimer</h3>
              <p className="text-sm text-gray-700">
                AlmaLinks reserves the right to approve membership based on organizational considerations and community composition, ensuring alignment with our values, criteria and the overall view.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              type="button"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white text-sm font-semibold hover:shadow-lg transition-all duration-200"
            >
              Sign out
            </button>
          </div>
        </AlmaAuthCard>
      </div>
    </div>
  );
};

export default PendingPage;