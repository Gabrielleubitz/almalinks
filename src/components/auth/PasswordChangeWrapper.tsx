import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { TempPasswordService } from '../../services/tempPasswordService';
import PasswordChangeModal from './PasswordChangeModal';

interface PasswordChangeWrapperProps {
  children: React.ReactNode;
}

const PasswordChangeWrapper: React.FC<PasswordChangeWrapperProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const [passwordChangeRequired, setPasswordChangeRequired] = useState<{
    required: boolean;
    reason?: string;
  }>({ required: false });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkPasswordRequirement = async () => {
      if (!user?.uid) {
        setPasswordChangeRequired({ required: false });
        return;
      }

      setIsChecking(true);
      try {
        const result = await TempPasswordService.checkPasswordChangeRequired(user.uid);
        setPasswordChangeRequired(result);
      } catch (error) {
        console.error('❌ Error checking password change requirement:', error);
        setPasswordChangeRequired({ required: false });
      } finally {
        setIsChecking(false);
      }
    };

    // Check password requirement when user logs in or changes
    checkPasswordRequirement();
  }, [user?.uid]);

  const handlePasswordChangeSuccess = async () => {
    console.log('✅ Password changed successfully, signing out user for security');
    
    try {
      // Sign out the user for security - they'll need to log in with new password
      await TempPasswordService.signOutUser();
      
      // Reset state
      setPasswordChangeRequired({ required: false });
      
      // Optionally redirect to login page
      window.location.href = '/login';
      
    } catch (error) {
      console.error('❌ Error signing out after password change:', error);
      // Force reload to ensure user is signed out
      window.location.reload();
    }
  };

  // Show loading state while checking
  if (isChecking && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking security requirements...</p>
        </div>
      </div>
    );
  }

  // Show password change modal if required
  if (passwordChangeRequired.required && user) {
    return (
      <>
        {children}
        <PasswordChangeModal
          isOpen={true}
          onSuccess={handlePasswordChangeSuccess}
          reason={passwordChangeRequired.reason || 'general_reset_required'}
        />
      </>
    );
  }

  // Normal app rendering
  return <>{children}</>;
};

export default PasswordChangeWrapper;