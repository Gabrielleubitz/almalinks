import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowLeft,
  AlertCircle,
  X,
  Check,
  FileText,
  Send,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import Toast from '../../components/ui/Toast';
import { linkedInProfileHref } from '../../utils/linkedInUrl';

interface UserData {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
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
  address?: string;
  industry?: string;
  expertiseAreas?: string;
  lookingToGain?: string;
  offerToMembers?: string;
  heardAboutAlma?: string;
  applicationFollowUpSentAt?: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  rejectedAt?: any;
  rejectedBy?: string;
  rejectionReason?: string;
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
    firstName: request.firstName || '',
    lastName: request.lastName || '',
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
    address: request.address || '',
    industry: request.industry || '',
    expertiseAreas: request.expertiseAreas || '',
    lookingToGain: request.lookingToGain || '',
    offerToMembers: request.offerToMembers || '',
    heardAboutAlma: request.heardAboutAlma || '',
    applicationFollowUpSentAt: request.applicationFollowUpSentAt,
    status: (request.status as UserData['status']) || 'pending',
    createdAt: request.createdAt,
    rejectedAt: request.rejectedAt,
    rejectedBy: request.rejectedBy || '',
    rejectionReason: request.rejectionReason || '',
    profileImage: request.profileImage ?? null
  };
}

function applicationText(v?: string | null): string {
  const t = (v ?? '').trim();
  return t ? t : '—';
}

function ApplicationField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm text-gray-900 break-words">{children}</div>
    </div>
  );
}

const PendingRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logAdminAction } = useActivityTracking();
  
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
  const [rejectModal, setRejectModal] = useState<{ uid: string; reason: string } | null>(null);
  const [followUpSendingId, setFollowUpSendingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'rejected'>('pending');
  const [rejectedUsers, setRejectedUsers] = useState<UserData[]>([]);
  const [rejectedLoading, setRejectedLoading] = useState(false);
  const [rejectedError, setRejectedError] = useState<string | null>(null);

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
      (user.firstName?.toLowerCase().includes(term) || false) ||
      (user.lastName?.toLowerCase().includes(term) || false) ||
      (user.email?.toLowerCase().includes(term) || false) ||
      (user.work?.toLowerCase().includes(term) || false) ||
      (user.company?.toLowerCase().includes(term) || false) ||
      (user.bioTitle?.toLowerCase().includes(term) || false) ||
      (user.industry?.toLowerCase().includes(term) || false) ||
      (user.address?.toLowerCase().includes(term) || false) ||
      (user.heardAboutAlma?.toLowerCase().includes(term) || false)
    );
    
    setFilteredUsers(filtered);
  };

  const sendApplicationIntroEmail = async (joinRequestId: string) => {
    if (!auth.currentUser) {
      showToast('You must be signed in to send email.', 'error');
      return;
    }
    setFollowUpSendingId(joinRequestId);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/application-follow-up-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ joinRequestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Failed to send intro email';
        const detail = typeof data.detail === 'string' ? ` (${data.detail})` : '';
        throw new Error(`${msg}${detail}`);
      }
      showToast('Intro email sent to the applicant (CC per server config).', 'success');
      logAdminAction('Sent application intro follow-up email', {
        targetUserId: joinRequestId,
      });
    } catch (e: any) {
      console.error('Intro email error:', e);
      showToast(e?.message || 'Failed to send intro email', 'error');
    } finally {
      setFollowUpSendingId(null);
    }
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

      // Log admin approval activity
      logAdminAction('Approved join request', {
        targetUserId: userId,
        targetEmail: userToApprove?.email,
        targetName: userToApprove?.name || userToApprove?.displayName
      });
    } catch (error: any) {
      console.error('❌ Error approving user:', error);
      showToast('Failed to approve user. Please try again.', 'error');
    } finally {
      setProcessingUser(null);
    }
  };

  const loadRejectedUsers = async () => {
    setRejectedLoading(true);
    setRejectedError(null);
    try {
      const { JoinRequestService } = await import('../../services/joinRequestService');
      const requests = await JoinRequestService.getRejectedRequests();
      setRejectedUsers(requests.map((request: any) => mapRequestToUserData(request)));
    } catch (err: any) {
      console.error('❌ Failed to load rejected requests', err);
      setRejectedError(err?.message || 'Unable to load rejected applicants.');
      setRejectedUsers([]);
    } finally {
      setRejectedLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'rejected') {
      loadRejectedUsers();
    }
  }, [tab]);

  const sendRejectionLogToComms = async (
    applicant: UserData,
    reason: string,
  ) => {
    const subject = `Membership applicant rejected: ${applicant.name || applicant.email || applicant.uid}`;
    const safeName = applicant.name || applicant.displayName || '—';
    const safeEmail = applicant.email || '—';
    const safePhone = applicant.phone || '—';
    const safeLinkedIn = applicant.linkedinUsername
      ? (linkedInProfileHref(applicant.linkedinUsername) || applicant.linkedinUsername)
      : '—';
    const rejectedByAdmin = user?.displayName || user?.email || user?.uid || 'Admin';
    const when = new Date().toISOString();
    const reasonOut = reason && reason.trim() ? reason.trim() : '(no reason provided)';
    try {
      const response = await fetch('/api/email-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin-notification',
          subject,
          email: 'communications@almalinks.org',
          name: 'AlmaLinks Communications',
          applicantName: safeName,
          applicantEmail: safeEmail,
          applicantPhone: safePhone,
          applicantLinkedIn: safeLinkedIn,
          applicantUid: applicant.uid,
          rejectedBy: rejectedByAdmin,
          rejectedAt: when,
          rejectionReason: reasonOut,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.warn('Rejection log email (comms) failed (non-blocking):', errData?.error || response.status);
      }
    } catch (logErr) {
      console.warn('Rejection log email (comms) error (non-blocking):', logErr);
    }
  };

  const handleRejectUser = async (userId: string, reason: string) => {
    if (!user?.uid) return;

    const userToReject = pendingUsers.find(u => u.uid === userId);
    const trimmedReason = (reason || '').trim();
    setProcessingUser(userId);

    try {
      const { JoinRequestService } = await import('../../services/joinRequestService');
      await JoinRequestService.rejectRequest(userId, user.uid, trimmedReason);

      // Send rejection email (applicant)
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

      if (userToReject) {
        await sendRejectionLogToComms(userToReject, trimmedReason);
      }

      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      setFilteredUsers(prev => prev.filter(u => u.uid !== userId));

      showToast(
        trimmedReason
          ? 'Applicant rejected. Reason logged and emails sent.'
          : 'Applicant rejected and emails sent.',
        'success',
      );

      logAdminAction('Rejected membership applicant', {
        targetUserId: userId,
        targetEmail: userToReject?.email,
        targetName: userToReject?.name || userToReject?.displayName,
        reasonProvided: Boolean(trimmedReason),
      });

      setRejectModal(null);

      if (tab === 'rejected') {
        await loadRejectedUsers();
      }
    } catch (error: any) {
      console.error('❌ Error rejecting user:', error);
      const errorMessage = error.message || 'Failed to reject applicant. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setProcessingUser(null);
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

  if (loading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-blue-dark/20 border-t-brand-blue-dark rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading membership applicants...</p>
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
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Membership Applicants</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  People who applied through the website and have not been vetted yet. (Event registrations live under Event Registrations.)
                </p>
              </div>
              <span className="text-sm text-gray-500">
                {tab === 'pending'
                  ? `${filteredUsers.length} of ${pendingUsers.length} pending`
                  : `${rejectedUsers.length} rejected`}
              </span>
            </div>

            <div className="mt-4 inline-flex rounded-xl bg-gray-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setTab('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  tab === 'pending' ? 'bg-white text-brand-blue-dark shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setTab('rejected')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  tab === 'rejected' ? 'bg-white text-brand-blue-dark shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Rejected
              </button>
            </div>

            {tab === 'pending' ? (
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, industry, address…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue-dark/20 focus:border-brand-blue-dark transition-all"
                />
              </div>
            ) : null}
          </div>

          {tab === 'pending' ? (
          <div className="divide-y divide-gray-100">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No pending applicants</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchTerm ? `No results for "${searchTerm}"` : 'All applications have been processed'}
                </p>
              </div>
            ) : (
              filteredUsers.map((userData) => {
                const nameParts = (userData.name || '').trim().split(/\s+/).filter(Boolean);
                const displayFirst =
                  userData.firstName?.trim() || nameParts[0] || '—';
                const displayLast =
                  userData.lastName?.trim() ||
                  (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '') ||
                  '—';

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
                              <p className="text-gray-600 text-sm">{userData.bioTitle || formatPosition(userData.position)}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Registered on {formatDate(userData.createdAt)}</p>
                              {userData.applicationFollowUpSentAt && (
                                <p className="text-xs text-green-700 mt-1">
                                  Intro email sent {formatDate(userData.applicationFollowUpSentAt)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => void sendApplicationIntroEmail(userData.uid)}
                              disabled={
                                !userData.email ||
                                followUpSendingId === userData.uid ||
                                processingUser === userData.uid
                              }
                              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-brand-blue-dark text-brand-blue-dark px-4 py-2.5 rounded-xl font-medium hover:bg-blue-50 disabled:opacity-50 text-sm"
                              title="Sends the AlmaLinks intro email; CC list comes from APPLICATION_FOLLOW_UP_CC."
                            >
                              {followUpSendingId === userData.uid ? (
                                <div className="w-5 h-5 border-2 border-brand-blue-dark border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Send className="h-5 w-5" />
                                  Send intro email
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleApproveUser(userData.uid)}
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
                              onClick={() => setRejectModal({ uid: userData.uid, reason: '' })}
                              disabled={processingUser === userData.uid}
                              className="inline-flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2.5 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50 text-sm"
                            >
                              <X className="h-5 w-5" />
                              Reject
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4 text-brand-blue-dark flex-shrink-0" />
                            <h4 className="text-sm font-semibold text-gray-900">Application (full submission)</h4>
                          </div>
                          <div className="sm:columns-2 sm:gap-x-8 [column-fill:_balance]">
                            <div className="break-inside-avoid">
                              <ApplicationField label="First name">{displayFirst}</ApplicationField>
                              <ApplicationField label="Last name">{displayLast}</ApplicationField>
                              <ApplicationField label="Email address">
                                <span className="break-all">{applicationText(userData.email)}</span>
                              </ApplicationField>
                              <ApplicationField label="Mobile">{applicationText(userData.phone)}</ApplicationField>
                              <ApplicationField label="Address">
                                <span className="whitespace-pre-wrap">{applicationText(userData.address)}</span>
                              </ApplicationField>
                              <ApplicationField label="Industry">{applicationText(userData.industry)}</ApplicationField>
                              <ApplicationField label="LinkedIn profile">
                                {userData.linkedinUsername && linkedInProfileHref(userData.linkedinUsername) ? (
                                  <a
                                    href={linkedInProfileHref(userData.linkedinUsername)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-blue-light hover:underline font-medium break-all"
                                  >
                                    {linkedInProfileHref(userData.linkedinUsername)}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </ApplicationField>
                              <ApplicationField label="Current role and company (bio short)">
                                {applicationText(userData.bioTitle || userData.company)}
                              </ApplicationField>
                            </div>
                            <div className="break-inside-avoid">
                              <ApplicationField label="Key areas of expertise">
                                <span className="whitespace-pre-wrap">{applicationText(userData.expertiseAreas)}</span>
                              </ApplicationField>
                              <ApplicationField label="What are you looking to gain from AlmaLinks?">
                                <span className="whitespace-pre-wrap">{applicationText(userData.lookingToGain)}</span>
                              </ApplicationField>
                              <ApplicationField label="What can you offer to other members (locally and globally)?">
                                <span className="whitespace-pre-wrap">{applicationText(userData.offerToMembers)}</span>
                              </ApplicationField>
                              <ApplicationField label="Entrepreneurial / business background (bio long)">
                                {userData.bio?.trim() ? (
                                  userData.bio.includes('<') ? (
                                    <div
                                      className="text-gray-900 prose prose-sm max-w-none prose-p:my-1"
                                      dangerouslySetInnerHTML={{ __html: userData.bio }}
                                    />
                                  ) : (
                                    <span className="whitespace-pre-wrap">{userData.bio}</span>
                                  )
                                ) : (
                                  '—'
                                )}
                              </ApplicationField>
                              <ApplicationField label="How did you hear about AlmaLinks? (referral details)">
                                <span className="whitespace-pre-wrap">{applicationText(userData.heardAboutAlma)}</span>
                              </ApplicationField>
                            </div>
                          </div>

                          <div className="mt-5 pt-4 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other signup fields (directory / legacy)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-800">
                              <div><span className="text-gray-500">Position: </span>{applicationText(formatPosition(userData.position))}</div>
                              <div><span className="text-gray-500">Chapter: </span>{applicationText(userData.chapter)}</div>
                              <div><span className="text-gray-500">Work: </span>{applicationText(userData.work)}</div>
                              <div><span className="text-gray-500">Company (stored): </span>{applicationText(userData.company)}</div>
                              <div><span className="text-gray-500">City: </span>{applicationText(userData.city)}</div>
                              <div><span className="text-gray-500">Country: </span>{applicationText(userData.country)}</div>
                              <div className="sm:col-span-2"><span className="text-gray-500">Timezone: </span>{applicationText(userData.timezone)}</div>
                              <div className="sm:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-gray-500">Website: </span>
                                {userData.website?.trim() ? (
                                  <a href={userData.website.startsWith('http') ? userData.website : `https://${userData.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue-light hover:underline break-all">
                                    {userData.website}
                                  </a>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                              <div className="sm:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-gray-500">Twitter: </span>
                                {userData.twitter?.trim() ? (
                                  <a href={userData.twitter.startsWith('http') ? userData.twitter : `https://${userData.twitter}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue-light hover:underline break-all">
                                    {userData.twitter}
                                  </a>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-gray-500">Skills: </span>
                                {userData.skills && userData.skills.length > 0 ? (
                                  <span>{userData.skills.join(', ')}</span>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rejectedError && (
                <div className="p-6 bg-red-50/60 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p>{rejectedError}</p>
                </div>
              )}
              {rejectedLoading ? (
                <div className="text-center py-16 px-4">
                  <div className="w-10 h-10 border-4 border-brand-blue-dark/20 border-t-brand-blue-dark rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">Loading rejected applicants…</p>
                </div>
              ) : rejectedUsers.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No rejected applicants</p>
                  <p className="text-gray-500 text-sm mt-1">Rejection history will appear here.</p>
                </div>
              ) : (
                rejectedUsers.map((userData) => (
                  <div key={userData.uid} className="p-6 sm:p-8">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{userData.name || userData.email || '—'}</h3>
                          <p className="text-sm text-gray-600">{userData.email || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Applied {formatDate(userData.createdAt)} · Rejected {formatDate(userData.rejectedAt)}
                            {userData.rejectedBy ? ` · By ${userData.rejectedBy}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Internal rejection reason</p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {(userData.rejectionReason || '').trim() || '(no reason provided)'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="p-6 sm:p-8 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">How approvals work</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><strong>Send intro email</strong> — Optional. Sends the introductory message from AlmaLinks; the server CC list is configured in <code>APPLICATION_FOLLOW_UP_CC</code>.</li>
              <li><strong>Approve</strong> — Creates the member account and sends the welcome email from <code>communications@almalinks.org</code>. HubSpot contact is upserted at this point (and not earlier).</li>
              <li><strong>Reject</strong> — Marks the application as rejected with your internal reason note. The applicant receives a polite rejection email; a copy of the reason is logged to <code>communications@almalinks.org</code>. Rejected applications show up under the Rejected tab.</li>
            </ul>
          </div>
        </div>

        {rejectModal ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close reject dialog"
              onClick={() => (processingUser ? undefined : setRejectModal(null))}
            />
            <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="reject-modal-title" className="text-lg font-bold text-gray-900">Reject application</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Internal note logged with the rejection and sent to communications@almalinks.org. The applicant is not shown your reason.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (processingUser ? undefined : setRejectModal(null))}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                Rejection reason (internal)
              </label>
              <textarea
                id="rejection-reason"
                rows={5}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                placeholder="e.g. Not a fit for our membership criteria right now — not enough leadership experience yet."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-blue-dark/20 focus:border-brand-blue-dark text-sm"
                disabled={Boolean(processingUser)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Required. Saved to the join request and emailed internally for record-keeping.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  disabled={Boolean(processingUser)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectModal.reason.trim()) {
                      showToast('Please add a rejection reason for the internal log.', 'error');
                      return;
                    }
                    void handleRejectUser(rejectModal.uid, rejectModal.reason);
                  }}
                  disabled={Boolean(processingUser)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {processingUser === rejectModal.uid ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Reject and email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PendingRegistrations;