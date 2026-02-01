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
  Check
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import Toast from '../../components/ui/Toast';

interface UserData {
  uid: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  work: string;
  linkedinUsername: string;
  position: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  profileImage?: string | null;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
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

          // Convert join requests to UserData format for compatibility
          const usersData: UserData[] = pendingRequests.map((request: any) => ({
            uid: request.uid,
            email: request.email || '',
            name: request.name || request.displayName || '',
            displayName: request.displayName || request.name || '',
            phone: request.phone || '',
            company: request.company || '',
            work: request.work || '',
            linkedinUsername: request.linkedinUsername || '',
            position: request.position || '',
            status: 'pending' as const,
            createdAt: request.createdAt,
            profileImage: null // Join requests don't have profile images yet
          }));

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
      
      const usersData: UserData[] = pendingRequests.map(request => ({
        uid: request.uid,
        email: request.email || '',
        name: request.name || request.displayName || '',
        displayName: request.displayName || request.name || '',
        phone: request.phone || '',
        company: request.company || '',
        work: request.work || '',
        linkedinUsername: request.linkedinUsername || '',
        position: request.position || '',
        status: 'pending' as const,
        createdAt: request.createdAt,
        profileImage: null
      }));

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
      
      // Convert join requests to UserData format for compatibility
      const usersData: UserData[] = pendingRequests.map(request => ({
        uid: request.uid,
        email: request.email,
        name: request.name || request.displayName || '',
        displayName: request.displayName || request.name || '',
        phone: request.phone || '',
        company: request.company || '',
        work: request.work || '',
        linkedinUsername: request.linkedinUsername || '',
        position: request.position || '',
        status: 'pending' as const
      }));

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
    
    setProcessingUser(userId);
    
    try {
      console.log('❌ Rejecting join request for user:', userId);
      
      const { JoinRequestService } = await import('../../services/joinRequestService');
      await JoinRequestService.rejectRequest(userId, user.uid);
      
      console.log('✅ Join request rejected successfully');
      
      // Update local state - remove from pending list immediately
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      setFilteredUsers(prev => prev.filter(u => u.uid !== userId));
      
      // Show success message
      showToast('User rejected. They can log in again to submit a new request.', 'success');
    } catch (error: any) {
      console.error('❌ Error rejecting user:', error);
      
      const errorMessage = error.message || 'Failed to reject user. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setProcessingUser(null);
      setConfirmReject(null);
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
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Pending Registrations" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pending registrations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Pending Registrations" 
        subtitle="Review and approve new user registrations"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toast.visible && (
          <Toast 
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(prev => ({ ...prev, visible: false }))}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700 ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pending Registrations Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Pending Registrations</h2>
            <div className="text-sm text-gray-500">
              {filteredUsers.length} of {pendingUsers.length} pending users
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or work..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No pending registrations</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchTerm ? `No results for "${searchTerm}"` : 'All registrations have been processed'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredUsers.map((userData) => (
                  <div 
                    key={userData.uid}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        {/* User Info */}
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden">
                              {userData.profileImage ? (
                                <img 
                                  src={userData.profileImage} 
                                  alt={userData.name || 'User'} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                                  {userData.name?.charAt(0) || userData.email?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">{userData.name || 'No Name'}</h3>
                              <p className="text-gray-600">{formatPosition(userData.position)}</p>
                              <p className="text-sm text-gray-500">
                                Registered: {formatDate(userData.createdAt)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-3">
                              <Mail className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Email</div>
                                <div className="font-medium text-gray-900">{userData.email || 'Not provided'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Phone className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Phone</div>
                                <div className="font-medium text-gray-900">{userData.phone || 'Not provided'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Briefcase className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Company</div>
                                <div className="font-medium text-gray-900">{userData.company || 'Not provided'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <User className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Job Description</div>
                                <div className="font-medium text-gray-900">{userData.work || 'Not provided'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Linkedin className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">LinkedIn</div>
                                <div className="font-medium text-gray-900">
                                  {userData.linkedinUsername ? (
                                    <a 
                                      href={`https://linkedin.com/in/${userData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand-light hover:text-brand-mid hover:underline"
                                    >
                                      View Profile
                                    </a>
                                  ) : (
                                    'Not provided'
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-3 min-w-[180px]">
                          {confirmReject === userData.uid ? (
                            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                              <p className="text-sm text-red-700 mb-2">Are you sure?</p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleRejectUser(userData.uid)}
                                  disabled={processingUser === userData.uid}
                                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  {processingUser === userData.uid ? (
                                    <div className="flex items-center justify-center">
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                  ) : (
                                    'Confirm'
                                  )}
                                </button>
                                <button
                                  onClick={() => setConfirmReject(null)}
                                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApproveUser(userData.uid)}
                                disabled={processingUser === userData.uid}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                              >
                                {processingUser === userData.uid ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <>
                                    <Check className="h-5 w-5" />
                                    <span>Approve</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmReject(userData.uid)}
                                disabled={processingUser === userData.uid}
                                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                              >
                                <X className="h-5 w-5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Information Box */}
          <div className="mt-8 bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">👥 Registration Approval Process:</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Approve:</strong> Grants access to the platform and sends an email notification</li>
              <li>• <strong>Reject:</strong> Marks the request as rejected. The user can log in again to submit a new request</li>
              <li>• <strong>LinkedIn:</strong> Review the user's LinkedIn profile before approving</li>
              <li>• <strong>Email Notification:</strong> Approved users receive an email notification automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingRegistrations;