import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowLeft, UserPlus, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ConnectionService } from '../services/connectionService';
import { ConnectionRequestService } from '../services/connectionRequestService';
import { getDailyRequestCount, isOverDailyLimit, DAILY_LIMIT_MESSAGE } from '../services/connectionRequestLimitService';
import { EventService } from '../services/eventService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import logoSvg from '../assets/alma-links-logo.svg';

const ConnectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isPending } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  
  // Parse the target user ID from the URL
  const searchParams = new URLSearchParams(location.search);
  const targetUserId = searchParams.get('to');
  const eventId = searchParams.get('event'); // Event is now required for proper connections
  
  // Effect to handle connection logic
  useEffect(() => {
    const handleConnection = async () => {
      // Reset state
      setLoading(true);
      setRequesting(false);
      setPending(false);
      setSuccess(false);
      setError(null);
      setTargetUser(null);
      setRequestId(null);
      setConnectionId(null);
      
      try {
        // Validate target user ID and event ID
        if (!targetUserId) {
          setError('Invalid connection link. No user specified.');
          setLoading(false);
          return;
        }
        
        if (!eventId) {
          setError('Invalid connection link. No event specified.');
          setLoading(false);
          return;
        }
        
        // Check if user is logged in
        if (!user) {
          console.log('User not logged in, waiting for auth...');
          return; // Wait for auth to complete
        }
        
        // Check if user is pending approval
        if (isPending) {
          setError('Your account is pending approval. You cannot make connections yet.');
          setLoading(false);
          return;
        }
        
        // Check if trying to connect with self
        if (user.uid === targetUserId) {
          setError('You cannot connect with yourself.');
          setLoading(false);
          return;
        }
        
        // Get target user data
        const targetUserData = await EventService.getUserById(targetUserId);
        if (!targetUserData) {
          setError('User not found. The link may be invalid or expired.');
          setLoading(false);
          return;
        }
        
        console.log('🎯 Target user data:', targetUserData);
        console.log('🖼️ Target user profile image:', targetUserData.profileImage);
        
        // Set target user data
        setTargetUser({
          uid: targetUserId,
          name: targetUserData.displayName || targetUserData.name || 'Unknown User',
          work: targetUserData.work || 'Not specified',
          position: targetUserData.position || '',
          linkedinUsername: targetUserData.linkedinUsername || '',
          profileImage: targetUserData.profileImage || null
        });
        
        // Check if connection already exists
        const existingConnection = await ConnectionService.checkExistingConnection(
          user.uid,
          targetUserId,
          eventId
        );
        
        if (existingConnection) {
          setConnectionId(existingConnection.id);
          setSuccess(true);
          setLoading(false);
          return;
        }
        
        // Check if pending request already exists (sent by this user)
        const sentRequests = await ConnectionRequestService.getSentRequests(user.uid);
        const existingRequest = sentRequests.find(
          req => (req.toUid === targetUserId || req.targetId === targetUserId) && req.status === 'pending'
        );
        
        if (existingRequest) {
          setRequestId(existingRequest.id);
          setPending(true);
          setLoading(false);
          return;
        }
        
        // Check daily connection limit (manual requests only; auto event connections bypass this)
        const dailyCount = await getDailyRequestCount(user.uid);
        if (isOverDailyLimit(dailyCount)) {
          setError(DAILY_LIMIT_MESSAGE);
          setLoading(false);
          return;
        }
        
        // Create connection request (not immediate connection)
        setRequesting(true);
        const newRequestId = await ConnectionRequestService.sendConnectionRequest(
          user.uid,
          targetUserId,
          { eventId }
        );
        
        setRequestId(newRequestId);
        setPending(true);
        
      } catch (err: any) {
        console.error('❌ Connection error:', err);
        setError(err.message || 'Failed to create connection. Please try again.');
      } finally {
        setLoading(false);
        setRequesting(false);
      }
    };
    
    // Only run connection logic if auth is complete
    if (!authLoading) {
      handleConnection();
    }
  }, [targetUserId, eventId, user, authLoading, isPending]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user && targetUserId) {
      // Store connection info in localStorage for after login
      localStorage.setItem('pendingConnection', JSON.stringify({
        targetUserId,
        eventId
      }));
      
      // Redirect to login
      navigate('/login', { state: { from: location } });
    }
  }, [user, authLoading, targetUserId, eventId, navigate, location]);
  
  // Format position for display
  const formatPosition = (position: string | undefined): string => {
    return ConnectionService.formatPosition(position);
  };
  
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Processing connection...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <section className="pt-[var(--content-offset-top)] sm:pt-32 pb-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/events')}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Events</span>
            </button>
          </div>
          
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            {error ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Connection Error</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => navigate('/events')}
                  className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : success && targetUser ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Connection Successful!
                </h2>
                <p className="text-xl text-gray-600 mb-6">
                  🎉 You've connected with <span className="font-semibold">{targetUser.name}</span> from {targetUser.work}
                </p>
                
                {/* User Card */}
                <div className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl p-6 mb-8 max-w-md mx-auto">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden">
                      {targetUser.profileImage ? (
                        <img 
                          src={targetUser.profileImage} 
                          alt={targetUser.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('❌ Image load error in ConnectPage:', targetUser.name, targetUser.profileImage);
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                          {targetUser.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-bold text-gray-900">{targetUser.name}</h3>
                      <p className="text-gray-600">{targetUser.work}</p>
                      {targetUser.position && (
                        <p className="text-gray-500 text-sm">{formatPosition(targetUser.position)}</p>
                      )}
                    </div>
                  </div>
                  
                  {targetUser.linkedinUsername && (
                    <a
                      href={`https://linkedin.com/in/${ConnectionService.formatLinkedinUrl(targetUser.linkedinUsername)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-brand-mid transition-colors duration-200 font-medium text-center mb-3"
                    >
                      View LinkedIn Profile
                    </a>
                  )}
                  
                  <p className="text-sm text-gray-500 text-center">
                    You can view all your connections in your dashboard.
                  </p>
                </div>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => navigate('/events')}
                    className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            ) : pending && targetUser ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-6">
                  <UserPlus className="h-8 w-8 text-yellow-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Connection Request Sent</h2>
                <p className="text-xl text-gray-600 mb-6">
                  ⏳ Your connection request to <span className="font-semibold">{targetUser.name}</span> is pending approval
                </p>
                <p className="text-gray-500 mb-6">
                  {targetUser.name} will be notified and can accept or reject your request. You'll be notified once they respond.
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => navigate('/events')}
                    className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            ) : requesting ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-6">
                  <Loader className="h-8 w-8 text-brand-light animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Sending Request</h2>
                <p className="text-gray-600">Please wait while we send your connection request...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-6">
                  <UserPlus className="h-8 w-8 text-brand-light" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Processing Connection</h2>
                <p className="text-gray-600">Please wait while we process your connection request...</p>
              </div>
            )}
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default ConnectPage;