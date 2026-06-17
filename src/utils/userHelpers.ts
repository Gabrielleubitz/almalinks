import { UserProfile } from '../types/user';
import { JoinRequestService } from '../services/joinRequestService';
import { isAppAdminDoc } from './adminAccess';

/**
 * Check if a user is approved (can access member features)
 * A user is approved if:
 * 1. They have a user document with status === 'approved', OR
 * 2. They have an approved join request (user doc will be created)
 */
export async function isApprovedUser(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  
  try {
    // First check if user document exists (approved users have user docs)
    const { doc, getDoc } = await import('firebase/firestore');
    const { db, retryOnNetworkFailure } = await import('../firebase/config');
    const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', uid)));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.status === 'approved';
    }
    
    // If no user doc, check join request status
    const joinRequest = await JoinRequestService.getJoinRequest(uid);
    return joinRequest?.status === 'approved' || false;
  } catch (error) {
    console.error('❌ Error checking if user is approved:', error);
    return false;
  }
}

/**
 * Check if a user is pending approval
 */
export async function isPendingUser(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  
  try {
    const joinRequest = await JoinRequestService.getJoinRequest(uid);
    return joinRequest?.status === 'pending' || false;
  } catch (error) {
    console.error('❌ Error checking if user is pending:', error);
    return false;
  }
}

/**
 * Check if a user is rejected
 */
export async function isRejectedUser(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  
  try {
    const joinRequest = await JoinRequestService.getJoinRequest(uid);
    return joinRequest?.status === 'rejected' || false;
  } catch (error) {
    console.error('❌ Error checking if user is rejected:', error);
    return false;
  }
}

/**
 * Get approval status for a user
 */
export async function getApprovalStatus(uid: string | null | undefined): Promise<'pending' | 'approved' | 'rejected' | 'none'> {
  if (!uid) return 'none';
  return await JoinRequestService.getApprovalStatus(uid);
}

/**
 * Check if a user can access member-only features
 * Only approved users (and admins) can access member features
 * This is a synchronous version that works with UserProfile objects
 */
export function canAccessMemberFeaturesSync(
  user: UserProfile | null | undefined
): boolean {
  if (!user) return false;
  // Admins can always access
  if (isAppAdminDoc(user)) return true;
  // Only approved members can access
  return user.status === 'approved';
}
