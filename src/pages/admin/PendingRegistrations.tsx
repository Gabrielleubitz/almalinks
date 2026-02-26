import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle, 
  X, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Linkedin,
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  MapPin,
  Globe,
  Trash2
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../../components/ui/Toast';

interface UserData {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  phone: string;
  company: string;
  work: string;
  linkedinUsername: string;
  position: string;
  chapter?: string;
  bioTitle?: string;
  bio?: string;
  city?: string;
  country?: string;
  timezone?: string;
  website?: string;
  twitter?: string;
  skills?: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  profileImage?: string | null;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

function mapRequestToUserData(request: any): UserData {
  return {
    uid: request.uid,
    email: request.email || '',
    name: request.name || request.displayName || '',
    displayName: request.displayName || request.name || '',
    phone: request.phone || '',
    company: request.company || '',
    work: request.work || '',
    linkedinUsername: request.linkedinUsername || '',
    position: request.position || '',
    chapter: request.chapter || '',
    bioTitle: request.bioTitle || '',
    bio: request.bio || '',
    city: request.city || '',
    country: request.country || '',
    timezone: request.timezone || '',
    website: request.website || '',
    twitter: request.twitter || '',
    skills: Array.isArray(request.skills) ? request.skills : [],
    status: 'pending',
    createdAt: request.createdAt,
    profileImage: request.profileImage ?? null
  };
}

const PendingRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success'
  });
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Use realtime listener for immediate updates when new signups occur
    const unsubscribe = subscribeToPendingRequests();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, pendingUsers]);

  // Realtime listener for pending join requests
  const subscribeToPendingRequests = () => {
    try {
      setLoading(true);
      
      // Log Firebase project info for debugging
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      console.log('🔍 DEBUG: Firebase Project ID:', projectId);
      console.log('🔍 DEBUG: Current user UID:', auth.currentUser?.uid);
      console.log('🔍 DEBUG: Current user email:', auth.currentUser?.email);
      
      console.log('👂 Setting up realtime listener for pending join requests');
      console.log('📋 Query: collection="joinRequests", where status == "pending", orderBy createdAt desc');
      
      const requestsRef = collection(db, 'joinRequests');
      const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      console.log('✅ Query created, setting up onSnapshot listener...');
      console.log('🔍 DEBUG: Query details:', {
        collection: 'joinRequests',
        filters: [{ field: 'status', operator: '==', value: 'pending' }],
        orderBy: { field: 'createdAt', direction: 'desc' }
      });

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log('📥 Received update from joinRequests listener:', snapshot.size, 'pending requests');
          console.log('🔍 DEBUG: Snapshot metadata:', {
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites
          });
          
          if (snapshot.empty) {
            console.warn('⚠️ WARNING: Query returned empty results. Possible causes:');
            console.warn('   1. No pending requests exist in joinRequests collection');
            console.warn('   2. Security rules blocking read access');
            console.warn('   3. Query filters not matching any documents');
            console.warn('   4. Wrong Firebase project/environment');
          }
          
          const pendingRequests = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`🔍 DEBUG: Document ${doc.id}:`, {
              status: data.status,
              email: data.email,
              name: data.name,
              createdAt: data.createdAt ? 'present' : 'missing',
              createdAtType: data.createdAt ? typeof data.createdAt : 'none'
            });
            return {
              uid: doc.id,
              ...data
            };
          });

          // Convert join requests to UserData format (include all signup fields)
          const usersData: UserData[] = pendingRequests.map((request: any) => mapRequestToUserData(request));

          console.log(`✅ Updated pending requests list: ${usersData.length} requests`);
          
          // Log each request for debugging
          usersData.forEach(user => {
            console.log(`📊 Join Request ${user.uid}:`, {
              name: user.name,
              email: user.email,
              phone: user.phone,
              company: user.company,
              work: user.work,
              linkedinUsername: user.linkedinUsername,
              position: user.position
            });
          });

          setPendingUsers(usersData);
          setFilteredUsers(usersData);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('❌ Error in joinRequests listener:', error);
          console.error('❌ Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
          });
          
          // Check for permission errors
          if (error.code === 'permission-denied') {
            const errorMsg = 'Permission denied: Admin cannot read joinRequests. Check Firestore security rules.';
            setError(errorMsg);
            console.error('🚫 PERMISSION DENIED ERROR:');
            console.error('   The admin user does not have permission to read joinRequests collection.');
            console.error('   Expected rule: allow read on joinRequests/{requestId} if isAdmin()');
            console.error('   Current user UID:', auth.currentUser?.uid);
            console.error('   Check if user has admin role in users/{uid} document');
            return;
          }
          
          // Check if it's an index error
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            const errorMessage = error.message || '';
            const indexLinkMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
            
            setError(
              `Firestore index required. ${indexLinkMatch ? 'Click the link in console to create it automatically, or' : 'Please'} create an index for joinRequests: status (Ascending), createdAt (Descending).`
            );
            console.error('📋 Index required. Create index in Firebase Console for:');
            console.error('   Collection: joinRequests');
            console.error('   Fields: status (Ascending), createdAt (Descending)');
            if (indexLinkMatch) {
              console.error('🔗 Index creation link:', indexLinkMatch[0]);
            }
            
            // Fallback: Try loading once without orderBy if index is missing
            console.log('🔄 Attempting fallback: loading without orderBy...');
            loadPendingUsersFallback();
          } else {
            setError('Unable to load pending requests. Please refresh the page or contact support if the issue persists.');
            // Fallback: Try loading once
            console.log('🔄 Attempting fallback: loading once...');
            loadPendingUsersFallback();
          }
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Error setting up pending requests listener:', error);
      setError('Unable to load pending requests. Please refresh the page.');
      setLoading(false);
      return null;
    }
  };

  // Fallback function if realtime listener fails (e.g., missing index)
  const loadPendingUsersFallback = async () => {
    try {
      console.log('🔄 Fallback: Loading pending requests without realtime listener...');
      const { JoinRequestService } = await import('../../services/joinRequestService');
      const pendingRequests = await JoinRequestService.getPendingRequests();
      
      const usersData: UserData[] = pendingRequests.map((request: any) => mapRequestToUserData(request));

      setPendingUsers(usersData);
      setFilteredUsers(usersData);
      setLoading(false);
      console.log(`✅ Fallback loaded ${usersData.length} pending requests`);
    } catch (error: any) {
      console.error('❌ Fallback load also failed:', error);
      setError('Unable to load pending requests. Please refresh the page or contact support if the issue persists.');
      setLoading(false);
    }
  };

  // Legacy function kept for compatibility (not used with realtime listener)
  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      // Load from joinRequests collection instead of users
      const { JoinRequestService } = await import('../../services/joinRequestService');
      const pendingRequests = await JoinRequestService.getPendingRequests();
      
      const usersData: UserData[] = pendingRequests.map((request: any) => mapRequestToUserData(request));

      setPendingUsers(usersData);
      setFilteredUsers(usersData);
      console.log(`✅ Loaded ${usersData.length} pending join requests`);

      // Log each user's data to debug field visibility
      usersData.forEach(user => {
        console.log(`📊 User ${user.uid} data:`, {
          name: user.name,
          email: user.email,
          phone: user.phone,
          company: user.company,
          work: user.work,
          linkedinUsername: user.linkedinUsername,
          position: user.position,
          status: user.status
        });
      });
    } catch (error: any) {
      console.error('❌ Error loading pending users:', error);
      setError('Unable to load pending users. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(pendingUsers);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = pendingUsers.filter(user => 
      (user.name?.toLowerCase().includes(term) || false) || 
      (user.email?.toLowerCase().includes(term) || false) ||
      (user.work?.toLowerCase().includes(term) || false)
    );
    
    setFilteredUsers(filtered);
  };

  const handleApproveUser = async (userId: string) => {
    if (!user?.uid) return;
    const userToApprove = pendingUsers.find((u) => u.uid === userId);
    setProcessingUser(userId);

    try {
      // Use JoinRequestService to approve and create user document
      const { JoinRequestService } = await import('../../services/joinRequestService');
      await JoinRequestService.approveRequest(userId, user.uid);

      // SMS notifications disabled (approval uses email only)
      console.log('SMS notifications disabled');

      // Send email notification
      await sendApprovalEmail(userId);

      // Add approved user to Mailchimp audience (if configured)
      if (userToApprove?.email) {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (idToken) {
            const nameParts = (userToApprove.name || '').trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            const res = await fetch('/api/mailchimp-sync-contact', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                email: userToApprove.email,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
              }),
            });
            if (!res.ok) {
              console.warn('Mailchimp sync failed (non-blocking):', await res.text());
            }
          }
        } catch (mcErr) {
          console.warn('Mailchimp sync error (non-blocking):', mcErr);
        }
      }

      // Update local state
      setPendingUsers((prev) => prev.filter((u) => u.uid !== userId));

      showToast(`User approved successfully and notifications sent`, 'success');
    } catch (error: any) {
      console.error('❌ Error approving user:', error);
      showToast('Failed to approve user. Please try again.', 'error');
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!user?.uid) return;

    const userToReject = pendingUsers.find(u => u.uid === userId);
    setProcessingUser(userId);

    try {
      console.log('❌ Rejecting join request for user:', userId);

      const { JoinRequestService } = await import('../../services/joinRequestService');
      await JoinRequestService.rejectRequest(userId, user.uid);

      console.log('✅ Join request rejected successfully');

      // Send rejection email (instructions + re-request link + Alma Links contact)
      if (userToReject?.email) {
        try {
          const res = await fetch('/api/email-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'rejection',
              email: userToReject.email,
              name: userToReject.name || userToReject.displayName || 'there',
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('Rejection email failed (non-blocking):', err?.error || res.status);
          }
        } catch (e) {
          console.warn('Rejection email error (non-blocking):', e);
        }
      }

      // Update local state - remove from pending list immediately
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      setFilteredUsers(prev => prev.filter(u => u.uid !== userId));

      showToast('User rejected. Rejection email sent with re-request instructions.', 'success');
    } catch (error: any) {
      console.error('❌ Error rejecting user:', error);
      const errorMessage = error.message || 'Failed to reject user. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setProcessingUser(null);
      setConfirmReject(null);
    }
  };

  const handleRejectAndDeleteUser = async (userId: string) => {
    if (!user?.uid) return;
    setProcessingUser(userId);

    try {
      console.log('🗑️ Rejecting and fully deleting user (no email):', userId);
      const { JoinRequestService } = await import('../../services/joinRequestService');
      await JoinRequestService.rejectAndDeleteUser(userId, user.uid);

      // Remove from local state
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      setFilteredUsers(prev => prev.filter(u => u.uid !== userId));

      showToast('User rejected and fully deleted. No email was sent.', 'success');
    } catch (error: any) {
      console.error('❌ Error rejecting and deleting user:', error);
      const errorMessage = error.message || 'Failed to reject and delete user. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setProcessingUser(null);
      setConfirmDelete(null);
    }
  };


  const sendApprovalEmail = async (userId: string) => {
    try {
      const userToApprove = pendingUsers.find(u => u.uid === userId);
      if (!userToApprove || !userToApprove.email) {
        console.error('❌ User not found or no email address');
        return;
      }
      
      // Send email via Vercel Function
      const response = await fetch('/api/email-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'acceptance',
          email: userToApprove.email,
          name: userToApprove.name
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Email sending failed:', errorData);
        throw new Error('Failed to send approval email');
      }
      
      console.log('✅ Approval email sent successfully');
    } catch (error) {
      console.error('❌ Error sending approval email:', error);
      // Don't throw error here, we still want to mark the user as approved
      // even if email fails
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({
      visible: true,
      message,
      type
    });
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const formatDate = (timestamp: any): string => {
    if (timestamp === undefined || timestamp === null) return 'N/A';
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPosition = (position: string): string => {
    const positionMap: Record<string, string> = {
      'investor': 'Investor',
      'c_level': 'C-Level Executive',
      'vp_level': 'VP Level',
      'director': 'Director',
      'senior_manager': 'Senior Manager',
      'manager': 'Manager',
      'senior_contributor': 'Senior Contributor',
      'individual_contributor': 'Individual Contributor',
      'junior_level': 'Junior Level',
      'founder': 'Founder',
      'consultant': 'Consultant',
      'student': 'Student',
      'other': 'Other'
    };
    
    return positionMap[position] || position;
  };

  const hasExtraDetails = (u: UserData) =>
    !!(u.bioTitle || u.bio || u.chapter || u.city || u.country || u.website || u.twitter || (u.skills && u.skills.length > 0));

  if (loading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-blue-dark/20 border-t-brand-blue-dark rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading pending registrations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </button>
        </div>

        {toast.visible && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(prev => ({ ...prev, visible: false }))}
          />
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700 ml-auto" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] border border-gray-200/80 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Pending Registrations</h2>
              <span className="text-sm text-gray-500">
                {filteredUsers.length} of {pendingUsers.length} pending
              </span>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or work..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue-dark/20 focus:border-brand-blue-dark transition-all"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No pending registrations</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchTerm ? `No results for "${searchTerm}"` : 'All registrations have been processed'}
                </p>
              </div>
            ) : (
              filteredUsers.map((userData) => {
                const expanded = expandedId === userData.uid;
                const hasExtra = hasExtraDetails(userData);
                return (
                  <div
                    key={userData.uid}
                    className="bg-white hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light">
                              {userData.profileImage ? (
                                <img
                                  src={userData.profileImage}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                                  {userData.name?.charAt(0) || userData.email?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-gray-900 truncate">{userData.name || 'No Name'}</h3>
                              <p className="text-gray-600 text-sm">{formatPosition(userData.position)}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Registered on {formatDate(userData.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:flex-shrink-0">
                            {confirmReject === userData.uid ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                <span className="text-sm text-red-700">
                                  Reject this request and send a polite rejection email?
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRejectUser(userData.uid)}
                                    disabled={processingUser === userData.uid}
                                    className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {processingUser === userData.uid ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      'Reject & email'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setConfirmReject(null)}
                                    className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : confirmDelete === userData.uid ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                <span className="text-sm text-red-700">
                                  Permanently delete this signup and account? No email will be sent.
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRejectAndDeleteUser(userData.uid)}
                                    disabled={processingUser === userData.uid}
                                    className="bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
                                  >
                                    {processingUser === userData.uid ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      'Delete user'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setConfirmReject(null);
                                    setConfirmDelete(null);
                                    handleApproveUser(userData.uid);
                                  }}
                                  disabled={processingUser === userData.uid}
                                  className="inline-flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm"
                                >
                                  {processingUser === userData.uid ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-5 w-5" />
                                      Approve
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmDelete(null);
                                    setConfirmReject(userData.uid);
                                  }}
                                  disabled={processingUser === userData.uid}
                                  className="inline-flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2.5 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50 text-sm"
                                >
                                  <X className="h-5 w-5" />
                                  Reject
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmReject(null);
                                    setConfirmDelete(userData.uid);
                                  }}
                                  disabled={processingUser === userData.uid}
                                  className="inline-flex items-center justify-center gap-2 bg-red-100 text-red-800 px-4 py-2.5 rounded-xl font-medium hover:bg-red-200 disabled:opacity-50 text-sm"
                                >
                                  <Trash2 className="h-5 w-5" />
                                  Reject & delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                          <div className="flex items-start gap-3">
                            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="text-gray-500">Email</div>
                              <div className="font-medium text-gray-900 break-all">{userData.email || '—'}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-gray-500">Phone</div>
                              <div className="font-medium text-gray-900">{userData.phone || '—'}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Briefcase className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-gray-500">Company</div>
                              <div className="font-medium text-gray-900">{userData.company || '—'}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <User className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-gray-500">Work</div>
                              <div className="font-medium text-gray-900">{userData.work || '—'}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 sm:col-span-2">
                            <Linkedin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-gray-500">LinkedIn</div>
                              {userData.linkedinUsername ? (
                                <a
                                  href={`https://linkedin.com/in/${userData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-blue-light hover:underline font-medium"
                                >
                                  View profile
                                </a>
                              ) : (
                                <span className="font-medium text-gray-500">—</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {hasExtra && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : userData.uid)}
                              className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue-dark hover:text-brand-blue-light transition-colors"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {expanded ? 'Hide full details' : 'View full details'}
                            </button>

                            {expanded && (
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:p-5 space-y-4 text-sm">
                                {userData.bioTitle && (
                                  <div>
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                      <FileText className="h-4 w-4" />
                                      Short bio
                                    </div>
                                    <p className="text-gray-900 font-medium">{userData.bioTitle}</p>
                                  </div>
                                )}
                                {userData.bio && (
                                  <div>
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                      <FileText className="h-4 w-4" />
                                      Bio
                                    </div>
                                    {userData.bio.includes('<') ? (
                                      <div
                                        className="text-gray-700 prose prose-sm max-w-none prose-p:my-1"
                                        dangerouslySetInnerHTML={{ __html: userData.bio }}
                                      />
                                    ) : (
                                      <p className="text-gray-700 whitespace-pre-wrap">{userData.bio}</p>
                                    )}
                                  </div>
                                )}
                                {userData.chapter && (
                                  <div>
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                      <MapPin className="h-4 w-4" />
                                      Chapter
                                    </div>
                                    <p className="text-gray-900">{userData.chapter}</p>
                                  </div>
                                )}
                                {(userData.city || userData.country) && (
                                  <div>
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                      <MapPin className="h-4 w-4" />
                                      Location
                                    </div>
                                    <p className="text-gray-900">{[userData.city, userData.country].filter(Boolean).join(', ')}</p>
                                  </div>
                                )}
                                {userData.timezone && (
                                  <div>
                                    <div className="text-gray-500 mb-1">Timezone</div>
                                    <p className="text-gray-900">{userData.timezone}</p>
                                  </div>
                                )}
                                {(userData.website || userData.twitter) && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Globe className="h-4 w-4 text-gray-400" />
                                    {userData.website && (
                                      <a href={userData.website.startsWith('http') ? userData.website : `https://${userData.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue-light hover:underline">
                                        Website
                                      </a>
                                    )}
                                    {userData.twitter && (
                                      <a href={userData.twitter.startsWith('http') ? userData.twitter : `https://${userData.twitter}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue-light hover:underline">
                                        Twitter
                                      </a>
                                    )}
                                  </div>
                                )}
                                {userData.skills && userData.skills.length > 0 && (
                                  <div>
                                    <div className="text-gray-500 mb-2">Skills</div>
                                    <div className="flex flex-wrap gap-2">
                                      {userData.skills.map((s, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-blue-dark/10 text-brand-blue-dark text-xs font-medium">
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-6 sm:p-8 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Registration approval</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><strong>Approve</strong> — Grants access and sends an email notification. All signup data (including bio, chapter, skills) is copied to the user&apos;s profile.</li>
              <li><strong>Reject</strong> — Marks the request as rejected. The user can sign in again to submit a new request.</li>
              <li>Use <strong>View full details</strong> to see short bio, bio, chapter, location, and skills before deciding.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingRegistrations;