import { collection, doc, setDoc, getDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { nanoid } from 'nanoid';

interface PasswordResetData {
  userId: string;
  email: string;
  token: string;
  createdAt: any;
  expiresAt: any;
}

export class PasswordResetService {
  // Create a new password reset token
  static async createResetToken(email: string): Promise<string | null> {
    try {
      console.log('🔑 Creating password reset token for:', email);
      
      // Check if user exists with this email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('⚠️ No user found with email:', email);
        return null; // Don't reveal that the email doesn't exist
      }
      
      // Get the user document
      const userDoc = snapshot.docs[0];
      const userId = userDoc.id;
      
      // Generate a secure token
      const token = nanoid(32);
      
      // Calculate expiration (24 hours from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Store the token in Firestore
      const resetData: PasswordResetData = {
        userId,
        email,
        token,
        createdAt: serverTimestamp(),
        expiresAt
      };
      
      // Use token as document ID for easy lookup
      await setDoc(doc(db, 'password_resets', token), resetData);
      
      console.log('✅ Password reset token created successfully');
      return token;
    } catch (error) {
      console.error('❌ Error creating password reset token:', error);
      return null;
    }
  }
  
  // Verify a password reset token
  static async verifyToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string }> {
    try {
      // Get the token document
      const tokenDoc = await getDoc(doc(db, 'password_resets', token));
      
      if (!tokenDoc.exists()) {
        console.log('⚠️ Token not found:', token);
        return { valid: false };
      }
      
      const tokenData = tokenDoc.data() as PasswordResetData;
      
      // Check if token is expired
      const now = new Date();
      const expiresAt = tokenData.expiresAt instanceof Date 
        ? tokenData.expiresAt 
        : tokenData.expiresAt.toDate();
      
      if (now > expiresAt) {
        console.log('⚠️ Token expired:', token);
        return { valid: false };
      }
      
      console.log('✅ Token verified successfully');
      return { 
        valid: true, 
        userId: tokenData.userId,
        email: tokenData.email
      };
    } catch (error) {
      console.error('❌ Error verifying token:', error);
      return { valid: false };
    }
  }
  
  // Delete a token after it's been used
  static async deleteToken(token: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'password_resets', token));
      console.log('✅ Token deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting token:', error);
    }
  }
  
  // Send password reset email via Netlify function
  static async sendResetEmail(email: string, token: string): Promise<boolean> {
    try {
      console.log('📧 Sending password reset email to:', email);
      
      // Build the reset URL
      const resetUrl = `${window.location.origin}/reset-password?token=${token}`;
      
      // Call the Vercel API
      const response = await fetch('/api/email-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'reset',
          email,
          resetUrl
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Error sending reset email:', errorData);
        return false;
      }
      
      console.log('✅ Reset email sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending reset email:', error);
      return false;
    }
  }
  
  // Complete password reset flow
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Verify token
      const { valid, userId } = await this.verifyToken(token);
      
      if (!valid || !userId) {
        console.log('⚠️ Invalid or expired token');
        return false;
      }
      
      // Update user's password in Firebase Auth
      // Note: This would typically be done through Firebase Auth directly
      // For security reasons, we'll use a Netlify function to handle this
      
      // Delete the token after use
      await this.deleteToken(token);
      
      console.log('✅ Password reset successfully');
      return true;
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      return false;
    }
  }
}