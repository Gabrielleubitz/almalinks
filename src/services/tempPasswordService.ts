import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { db, auth } from '../firebase/config';

interface TempPasswordData {
  mustChangePassword?: boolean;
  tempPasswordSet?: boolean;
  passwordResetForcedAt?: any;
  passwordResetForcedBy?: string;
}

export class TempPasswordService {
  
  // Check if user must change password on login
  static async checkPasswordChangeRequired(uid: string): Promise<{ required: boolean; reason?: string }> {
    try {
      console.log('🔐 Checking password change requirement for user:', uid);
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        console.log('⚠️ User document not found');
        return { required: false };
      }
      
      const userData = userDoc.data() as TempPasswordData;
      
      // Check if user has temporary password or was forced to reset
      if (userData.mustChangePassword) {
        const reason = userData.tempPasswordSet 
          ? 'temporary_password' 
          : userData.passwordResetForcedBy 
            ? 'admin_forced_reset'
            : 'general_reset_required';
            
        console.log('🚨 Password change required:', reason);
        return { required: true, reason };
      }
      
      console.log('✅ No password change required');
      return { required: false };
      
    } catch (error) {
      console.error('❌ Error checking password change requirement:', error);
      return { required: false };
    }
  }
  
  // Change user's password and clear temporary password flags
  static async changePassword(uid: string, newPassword: string): Promise<boolean> {
    try {
      console.log('🔄 Changing password for user:', uid);
      
      // Validate password strength
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Update password in Firebase Auth
      await updatePassword(auth.currentUser, newPassword);
      console.log('✅ Password updated in Firebase Auth');
      
      // Update user profile to clear temporary password flags
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        mustChangePassword: false,
        tempPasswordSet: false,
        passwordChangedAt: serverTimestamp(),
        passwordResetForcedAt: null,
        passwordResetForcedBy: null
      });
      
      console.log('✅ User profile updated to clear temp password flags');
      return true;
      
    } catch (error: any) {
      console.error('❌ Error changing password:', error);
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }
  
  // Force user to change password (admin action)
  static async forcePasswordChange(targetUserId: string, adminId: string): Promise<boolean> {
    try {
      console.log('🔐 Forcing password change for user:', targetUserId);
      
      // Use relative URL - Vite proxy will forward to localhost:3000 in dev
      // In production, this will hit the same origin
      const url = '/api/user-admin';
      
      if (import.meta.env.DEV) {
        console.log('[tempPasswordService] Calling API:', {
          url,
          method: 'POST',
          action: 'force-password-reset',
          targetUserId,
          adminId,
          note: 'Using relative URL - Vite proxy should forward to localhost:3000'
        });
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'force-password-reset',
          adminId: adminId,
          targetUserId: targetUserId
        })
      });
      
      // Log the actual URL that was called (for debugging)
      if (import.meta.env.DEV) {
        console.log('[tempPasswordService] Response received:', {
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
      }
      
      if (!response.ok) {
        // Try to read error message from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData: any = null;
        
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorData.message || errorText;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (parseError) {
          console.warn('[tempPasswordService] Failed to parse error response:', parseError);
        }
        
        if (import.meta.env.DEV) {
          console.error('[tempPasswordService] API error response:', {
            url,
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            errorData
          });
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (import.meta.env.DEV) {
        console.log('[tempPasswordService] Success response:', result);
      }
      
      console.log('✅ Password reset forced successfully');
      return result.success !== false; // Return true if success is not explicitly false
      
    } catch (error: any) {
      console.error('❌ Error forcing password reset:', error);
      
      // Provide more helpful error messages for network errors
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        const isDev = import.meta.env.DEV;
        const errorMsg = isDev
          ? `Network error: Could not reach API server at ${url}. ` +
            `Make sure 'vercel dev --listen 3000' is running. ` +
            `The Vite proxy forwards /api/* requests from localhost:5173 to localhost:3000.`
          : `Network error: Could not reach API server. Please check your connection and try again.`;
        
        throw new Error(errorMsg);
      }
      
      // Check if error is from proxy connection failure
      if (error.message?.includes('PROXY_CONNECTION_ERROR') || error.message?.includes('Cannot connect to API server')) {
        throw new Error(
          `API server not available. Please run 'vercel dev --listen 3000' in a separate terminal. ` +
          `The frontend (localhost:5173) proxies /api/* requests to the API server (localhost:3000).`
        );
      }
      
      throw new Error(`Failed to force password reset: ${error.message}`);
    }
  }
  
  // Sign out user immediately (useful after password change)
  static async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Error signing out user:', error);
      throw error;
    }
  }
  
  // Generate secure temporary password
  static generateTempPassword(): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each type
    password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 25)]; // Uppercase
    password += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 25)]; // Lowercase  
    password += '23456789'[Math.floor(Math.random() * 8)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
    
    // Fill remaining length with random characters
    for (let i = 4; i < 12; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  // Get password change history (for audit)
  static async getPasswordHistory(uid: string): Promise<any[]> {
    try {
      // This would typically query an audit log collection
      // For now, return basic info from user document
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return [];
      }
      
      const userData = userDoc.data();
      const history = [];
      
      if (userData.passwordChangedAt) {
        history.push({
          action: 'password_changed',
          timestamp: userData.passwordChangedAt,
          type: 'user_initiated'
        });
      }
      
      if (userData.passwordResetForcedAt) {
        history.push({
          action: 'password_reset_forced',
          timestamp: userData.passwordResetForcedAt,
          forcedBy: userData.passwordResetForcedBy,
          type: 'admin_forced'
        });
      }
      
      if (userData.createdAt && userData.tempPasswordSet) {
        history.push({
          action: 'temp_password_set',
          timestamp: userData.createdAt,
          createdBy: userData.createdBy,
          type: 'admin_created'
        });
      }
      
      return history.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return bTime.getTime() - aTime.getTime();
      });
      
    } catch (error) {
      console.error('❌ Error getting password history:', error);
      return [];
    }
  }
}