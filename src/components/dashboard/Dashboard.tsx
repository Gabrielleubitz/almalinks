import React, { useState } from 'react';
import { Calendar, MapPin, Users, LogOut, User, Mail, Phone, Shield, Briefcase, Linkedin, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRegistration } from '../../hooks/useRegistration';
import RegistrationForm from './RegistrationForm';
import RegistrationStatus from './RegistrationStatus';
import logoSvg from '../../assets/W&G Logo.svg';
import ProfileEditor from './ProfileEditor';
import ProfilePictureUploader from '../profile/ProfilePictureUploader';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { user, logout, isAdmin } = useAuth();
  const { registration, loading: registrationLoading } = useRegistration();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(user?.profileImage || null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Debug logging for dashboard
  React.useEffect(() => {
    console.log('🔍 Dashboard - User:', user);
    console.log('🔍 Dashboard - Is Admin:', isAdmin);
    console.log('🔍 Dashboard - User role:', user?.role);
    console.log('🔍 Dashboard - User status:', user?.status);
  }, [user, isAdmin]);

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const eventDetails = {
    name: "Wine & Grind 4.0",
    date: "June 28th, 2025",
    time: "18:30",
    location: "Deli Vino, Netanya",
    address: "Natan Yonatan St 10, Netanya",
    topic: "AI Agents in Business",
    description: "Exploring how AI tools are shaping the future of productivity, decision-making, and scale."
  };

  const isRegistered = !!registration;

  // Format LinkedIn username for display
  const formatLinkedinUrl = (username: string | undefined) => {
    if (!username) return '';
    
    // Remove any linkedin.com prefix if present
    const cleanUsername = username.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '');
    
    // Remove trailing slash if present
    return cleanUsername.replace(/\/$/, '');
  };

  // Handle profile picture upload success
  const handleProfilePictureSuccess = (imageUrl: string) => {
    setProfileImageUrl(imageUrl);
    setImageUploadError(null);
  };

  // Handle profile picture upload error
  const handleProfilePictureError = (errorMessage: string) => {
    setImageUploadError(errorMessage);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Link to="/" className="hover:opacity-80 transition-opacity duration-200">
                <img 
                  src={logoSvg}
                  alt="Wine & Grind Logo" 
                  className="h-10 w-auto"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* Admin Tools Button - Only show for admins */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-full hover:from-purple-700 hover:to-purple-800 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Tools</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome back, <span className="gradient-text">{user?.displayName || 'Wine & Grind Member'}</span>!
          </h1>
          <p className="text-xl text-gray-600">
            {user?.status === 'pending' ? 
              'Your account is pending approval. We will notify you once approved.' :
              'Your profile is complete and ready for event registration.'}
          </p>
          {isAdmin && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-purple-600" />
                <span className="text-purple-800 font-medium">Admin Access Enabled</span>
              </div>
              <p className="text-purple-700 text-sm mt-1">
                You have administrative privileges. Access admin tools from the header or sidebar.
              </p>
            </div>
          )}
          
          {user?.status === 'pending' && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">Account Pending Approval</span>
              </div>
              <p className="text-yellow-700 text-sm mt-1">
                Your account is currently under review. We will notify you via SMS once approved.
              </p>
            </div>
          )}
          
          {user?.status === 'rejected' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-red-600" />
                <span className="text-red-800 font-medium">Account Not Approved</span>
              </div>
              <p className="text-red-700 text-sm mt-1">
                Unfortunately, your account application was not approved. Please contact us for more information.
              </p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  to="/events"
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-blue-50 rounded-xl hover:shadow-md transition-all duration-300 group"
                >
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-6 w-6 text-red-700" />
                    <div>
                      <div className="font-semibold text-gray-900">Browse Events</div>
                      <div className="text-sm text-gray-600">View all upcoming events</div>
                    </div>
                  </div>
                  <div className="text-red-700 group-hover:translate-x-1 transition-transform duration-200">→</div>
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-3">
                      <Shield className="h-6 w-6 text-purple-700" />
                      <div>
                        <div className="font-semibold text-gray-900">Admin Tools</div>
                        <div className="text-sm text-gray-600">Manage events & check-ins</div>
                      </div>
                    </div>
                    <div className="text-purple-700 group-hover:translate-x-1 transition-transform duration-200">→</div>
                  </Link>
                )}
              </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2"
                    aria-label="Edit Profile"
                  >
                    <User className="h-4 w-4 edit-profile-icon" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <ProfileEditor 
                  user={user}
                  onCancel={() => setIsEditingProfile(false)}
                  onSuccess={() => setIsEditingProfile(false)}
                />
              ) : (
                <div className="flex flex-col md:flex-row md:items-start gap-8">
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center">
                    <ProfilePictureUploader
                      currentImageUrl={user?.profileImage || null}
                      onUploadSuccess={handleProfilePictureSuccess}
                      onUploadError={handleProfilePictureError}
                      size="lg"
                    />
                    
                    {imageUploadError && (
                      <p className="text-red-600 text-sm mt-2">{imageUploadError}</p>
                    )}
                  </div>
                  
                  {/* Profile Details */}
                  <div className="flex-1">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <User className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">Name</div>
                            <div className="font-medium">{user?.displayName || 'Not provided'}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">Email</div>
                            <div className="font-medium">{user?.email}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Linkedin className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">LinkedIn</div>
                            <div className="font-medium">
                              {user?.linkedinUsername ? (
                                <a 
                                  href={`https://linkedin.com/in/${formatLinkedinUrl(user.linkedinUsername)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {formatLinkedinUrl(user.linkedinUsername)}
                                </a>
                              ) : (
                                'Not provided'
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">Phone</div>
                            <div className="font-medium">{user?.phone || 'Not provided'}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Briefcase className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">Work</div>
                            <div className="font-medium">{user?.work || 'Not provided'}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">Position</div>
                            <div className="font-medium">{formatPosition(user?.position) || 'Not provided'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {user?.role && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-500">Role</div>
                      <div className="font-medium capitalize">{user.role}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Account Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Profile Complete</span>
                  <span className={`font-bold ${user?.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {user?.status === 'pending' ? '⏳ Pending' : '✓ Complete'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Approval Status</span>
                  <span className={`font-bold ${
                    user?.status === 'approved' ? 'text-green-600' : 
                    user?.status === 'pending' ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {user?.status === 'approved' ? 'Approved' : 
                     user?.status === 'pending' ? 'Pending' : 
                     'Not Approved'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Member Since</span>
                  <span className="font-bold">2025</span>
                </div>
              </div>
            </div>

            {/* Community Stats */}
            <div className="bg-gradient-to-br from-red-700 to-blue-600 rounded-3xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Community</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total Members</span>
                  <span className="font-bold">250+</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Events Hosted</span>
                  <span className="font-bold">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next Event</span>
                  <span className="font-bold">June 28</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format position for display
function formatPosition(position: string | undefined): string {
  if (!position) return '';
  
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
}

export default Dashboard;