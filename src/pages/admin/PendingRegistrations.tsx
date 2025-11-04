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
  Check,
  Trash2
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
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
    loadPendingUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, pendingUsers]);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserData[];
      
      setPendingUsers(usersData);
      setFilteredUsers(usersData);
      console.log(`✅ Loaded ${usersData.length} pending users`);
    } catch (error: any) {
      console.error('❌ Error loading pending users:', error);
      setError(error.message || 'Failed to load pending users');
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
    
    setProcessingUser(userId);
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid
      });
      
      // Send SMS notification
      await sendApprovalSMS(userId);
      
      // Send email notification
      await sendApprovalEmail(userId);
      
      // Update local state
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      
      showToast(`User approved successfully and notifications sent`, 'success');
    } catch (error: any) {
      console.error('❌ Error approving user:', error);
      showToast(error.message || 'Failed to approve user', 'error');
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!user?.uid) return;
    
    setProcessingUser(userId);
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid
      });
      
      // Update local state
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
      
      showToast('User rejected successfully', 'success');
    } catch (error: any) {
      console.error('❌ Error rejecting user:', error);
      showToast(error.message || 'Failed to reject user', 'error');
    } finally {
      setProcessingUser(null);
      setConfirmReject(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!user?.uid) return;

    setProcessingUser(userId);

    try {
      // Delete user from both Firebase Auth and Firestore using the API
      const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIdToDelete: userId,
          adminId: user.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      console.log('✅ User deleted from both Auth and Firestore');

      // Update local state
      setPendingUsers(prev => prev.filter(u => u.uid !== userId));

      showToast('User deleted successfully from Auth and Firestore', 'success');
    } catch (error: any) {
      console.error('❌ Error deleting user:', error);
      showToast(error.message || 'Failed to delete user', 'error');
    } finally {
      setProcessingUser(null);
      setConfirmReject(null);
    }
  };

  const sendApprovalSMS = async (userId: string) => {
    try {
      const userToApprove = pendingUsers.find(u => u.uid === userId);
      if (!userToApprove || !userToApprove.phone) {
        console.error('❌ User not found or no phone number');
        return;
      }
      
      // Send SMS via Netlify Function
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userToApprove.phone,
          body: `You're officially approved, welcome to the Alma Links community!🍷💼\n\nYour account is ready — check out upcoming events!\nhttps://almalinks.com\n\nJoin our exclusive Telegram to never miss an event!\nhttps://t.me/almalinks\n\nCheers!\nThe Alma Links Team ✨`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ SMS sending failed:', errorData);
        throw new Error('Failed to send approval notification');
      }
      
      console.log('✅ Approval SMS sent successfully');
    } catch (error) {
      console.error('❌ Error sending approval SMS:', error);
      // Don't throw error here, we still want to mark the user as approved
      // even if SMS fails
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
                              <button
                                onClick={() => handleDeleteUser(userData.uid)}
                                disabled={processingUser === userData.uid}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                              >
                                <Trash2 className="h-5 w-5" />
                                <span>Delete</span>
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
              <li>• <strong>Approve:</strong> Grants access to the platform and sends an SMS notification</li>
              <li>• <strong>Reject:</strong> Marks the user as rejected but keeps their data for reference</li>
              <li>• <strong>Delete:</strong> Completely removes the user from the database</li>
              <li>• <strong>LinkedIn:</strong> Review the user's LinkedIn profile before approving</li>
              <li>• <strong>SMS Notification:</strong> Approved users receive an SMS notification automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingRegistrations;