import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MessageCircle, 
  Users, 
  Settings,
  Plus,
  X,
  Search,
  Shield,
  Save,
  AlertCircle,
  ImagePlus
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ChatService } from '../../services/chatService';
import { UserService } from '../../services/userService';
import { uploadImageToLibrary } from '../../services/imageUploadService';
import { CreateChatGroupForm } from '../../types/chat';
import { UserCard } from '../../types/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { auth } from '../../firebase/config';
import CoverPhotoCropModal, { type CoverCrop } from '../../components/profile/CoverPhotoCropModal';
import CropImage from '../../components/profile/CropImage';

const CreateChatGroup: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  const [formData, setFormData] = useState<CreateChatGroupForm>({
    name: '',
    description: '',
    imageUrl: '',
    imageCrop: null,
    allowRequests: false,
    isPublic: false,
    initialAdmins: [],
    seedMembers: []
  });
  
  const [users, setUsers] = useState<UserCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showImageCropModal, setShowImageCropModal] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Wait for auth to finish loading before checking admin status
    if (authLoading) return;
    
    console.log('🔍 CreateChatGroup - Auth state:', { 
      user: user?.uid, 
      isAdmin, 
      role: user?.role, 
      authLoading 
    });
    
    if (!isAdmin) {
      console.log('❌ User is not admin, redirecting to unauthorized');
      navigate('/unauthorized');
      return;
    }
    
    console.log('✅ User is admin, proceeding with chat creation setup');
    
    // Add current user as initial admin
    if (user?.uid) {
      setFormData(prev => ({
        ...prev,
        initialAdmins: [user.uid]
      }));
    }
    
    loadUsers();
  }, [isAdmin, user?.uid, navigate, authLoading]);

  const loadUsers = async () => {
    if (!user?.uid) {
      console.warn('⚠️ Cannot load users: user not authenticated');
      setUsersLoading(false);
      return;
    }

    try {
      setUsersLoading(true);
      setError(null); // Clear previous errors
      console.log('📥 Loading users for Create Chat Group...');
      console.log('👤 Current user:', { uid: user.uid, role: user.role, isAdmin });
      
      // Get all approved users for the admin to choose from
      const allUsers = await UserService.getAllMembersForDirectory(user.uid, user.role);
      
      console.log(`✅ Loaded ${allUsers.length} users for selection`);
      
      if (allUsers.length === 0) {
        console.warn('⚠️ No users found. Possible reasons:');
        console.warn('   - No users have status === "approved"');
        console.warn('   - Firestore query returned empty');
        console.warn('   - Permission issue (check Firestore rules)');
      }
      
      setUsers(allUsers);
    } catch (err: any) {
      console.error('❌ Error loading users:', err);
      console.error('❌ Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to load users';
      
      if (err.message?.includes('Permission denied') || err.code === 'permission-denied') {
        errorMessage = 'Permission denied: Unable to load users. Please ensure you are logged in as an admin and Firestore rules allow reading users.';
      } else if (err.message?.includes('index') || err.code === 'failed-precondition') {
        errorMessage = 'Missing Firestore index. The query requires a composite index. Check the browser console for a link to create it.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleUserSelection = (userId: string, role: 'admin' | 'member') => {
    setFormData(prev => {
      const currentAdmins = prev.initialAdmins;
      const currentMembers = prev.seedMembers;
      
      if (role === 'admin') {
        if (currentAdmins.includes(userId)) {
          // Remove from admins
          return {
            ...prev,
            initialAdmins: currentAdmins.filter(id => id !== userId)
          };
        } else {
          // Add to admins and remove from members if present
          return {
            ...prev,
            initialAdmins: [...currentAdmins, userId],
            seedMembers: currentMembers.filter(id => id !== userId)
          };
        }
      } else {
        if (currentMembers.includes(userId)) {
          // Remove from members
          return {
            ...prev,
            seedMembers: currentMembers.filter(id => id !== userId)
          };
        } else {
          // Add to members and remove from admins if present (except current user)
          const newAdmins = userId === user?.uid 
            ? currentAdmins 
            : currentAdmins.filter(id => id !== userId);
          
          return {
            ...prev,
            initialAdmins: newAdmins,
            seedMembers: [...currentMembers, userId]
          };
        }
      }
    });
  };

  const getUserRole = (userId: string): 'admin' | 'member' | 'none' => {
    if (formData.initialAdmins.includes(userId)) return 'admin';
    if (formData.seedMembers.includes(userId)) return 'member';
    return 'none';
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery.trim()) {
      return true; // Show all users when search is empty
    }
    
    const query = searchQuery.toLowerCase();
    const displayName = (user.displayName || '').toLowerCase();
    const firstName = (user.firstName || '').toLowerCase();
    const lastName = (user.lastName || '').toLowerCase();
    const title = (user.title || '').toLowerCase();
    const company = (user.company || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    
    return (
      displayName.includes(query) ||
      firstName.includes(query) ||
      lastName.includes(query) ||
      title.includes(query) ||
      company.includes(query) ||
      email.includes(query)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || loading) return;

    // Clear previous messages
    setError(null);
    setSuccess(null);
    setDebugInfo(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Chat name is required');
      return;
    }

    if (formData.name.length > 100) {
      setError('Chat name must be 100 characters or less');
      return;
    }

    if (formData.description.length > 500) {
      setError('Description must be 500 characters or less');
      return;
    }

    if (formData.initialAdmins.length === 0) {
      setError('At least one admin is required');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        ...formData,
        createdBy: user.uid
      };

      console.log('🚀 Creating chat group:', requestData);
      console.log('👤 Current user:', { uid: user.uid, role: user.role, isAdmin });

      // Get the current user's ID token for authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated. Please try logging out and back in.');
      }

      console.log('🔐 Getting fresh ID token...');
      const idToken = await currentUser.getIdToken(true); // Force refresh token
      console.log('✅ Retrieved fresh ID token for authentication');

      // Create the chat group via API
      const apiUrl = '/api/admin/chats';
      console.log(`📡 Sending POST request to ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 API Response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error Response:', errorData);
        
        // Show detailed error information
        const errorMessage = errorData.message || errorData.error || `Failed to create chat group (${response.status})`;
        const errorDetails = errorData.details ? ` | Details: ${errorData.details}` : '';
        
        setDebugInfo(`Status: ${response.status} | User: ${user.uid} | Role: ${user.role}${errorDetails}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Chat group created:', result);
      
      setSuccess('✅ Chat group created successfully! Redirecting...');
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate(`/chats/${result.chatId}`);
      }, 1500);

    } catch (err: any) {
      console.error('❌ Error creating chat group:', err);
      setError(err.message || 'Failed to create chat group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" color="border-blue-600" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect to unauthorized
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 overflow-x-hidden w-full max-w-full box-border">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Chat Group</h1>
                <p className="text-sm sm:text-base text-gray-600">Set up a new group chat for your community</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Chat Settings Form */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Chat Settings</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Chat Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Chat Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base min-h-[44px] sm:min-h-0"
                    placeholder="Enter chat name"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.name.length}/100 characters
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    maxLength={500}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base min-h-[80px] sm:min-h-0"
                    placeholder="What's this chat about?"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.description.length}/500 characters
                  </p>
                </div>

                {/* Group Image: URL or upload */}
                <div>
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    Group Image
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !file.type.startsWith('image/')) return;
                      setError(null);
                      setPendingImageFile(file);
                      setCropPreviewUrl(URL.createObjectURL(file));
                      setShowImageCropModal(true);
                      e.target.value = '';
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }}
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      id="imageUrl"
                      name="imageUrl"
                      type="url"
                      value={formData.imageUrl}
                      onChange={handleInputChange}
                      className="flex-1 min-w-[200px] px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base min-h-[44px] sm:min-h-0"
                      placeholder="https://example.com/group-image.jpg or upload below"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={loading || imageUploading}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                    >
                      {imageUploading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5" />
                          Upload to Cloudinary
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: paste a URL or upload an image to the image library (Cloudinary)
                  </p>
                  {formData.imageUrl && (
                    <div className="mt-2 w-12 h-12 rounded-full overflow-hidden border border-gray-200 relative">
                      <CropImage
                        src={formData.imageUrl}
                        crop={formData.imageCrop ?? null}
                        alt="Group preview"
                        mode="block"
                        className="w-full h-full rounded-full"
                      />
                    </div>
                  )}
                </div>

                {showImageCropModal && cropPreviewUrl && (
                  <CoverPhotoCropModal
                    imageUrl={cropPreviewUrl}
                    aspectRatio="1/1"
                    title="Position group image"
                    onConfirm={async (_url, crop: CoverCrop) => {
                      if (!pendingImageFile) return;
                      setImageUploading(true);
                      setError(null);
                      try {
                        const url = await uploadImageToLibrary('chat-groups', pendingImageFile);
                        setFormData(prev => ({ ...prev, imageUrl: url, imageCrop: crop }));
                      } catch (err: any) {
                        setError(err.message || 'Image upload failed');
                      } finally {
                        setImageUploading(false);
                        URL.revokeObjectURL(cropPreviewUrl);
                        setCropPreviewUrl(null);
                        setPendingImageFile(null);
                        setShowImageCropModal(false);
                      }
                    }}
                    onCancel={() => {
                      if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
                      setCropPreviewUrl(null);
                      setPendingImageFile(null);
                      setShowImageCropModal(false);
                    }}
                  />
                )}

                {/* Settings Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="allowRequests" className="text-sm font-medium text-gray-700">
                        Allow Join Requests
                      </label>
                      <p className="text-xs text-gray-500">
                        Let users request to join this chat
                      </p>
                    </div>
                    <input
                      id="allowRequests"
                      name="allowRequests"
                      type="checkbox"
                      checked={formData.allowRequests}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-brand-light focus:ring-blue-500 border-gray-300 rounded"
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                        Public Chat
                      </label>
                      <p className="text-xs text-gray-500">
                        Make this chat discoverable
                      </p>
                    </div>
                    <input
                      id="isPublic"
                      name="isPublic"
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-brand-light focus:ring-blue-500 border-gray-300 rounded"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Summary</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><span className="font-medium">Admins:</span> {formData.initialAdmins.length}</p>
                    <p><span className="font-medium">Initial Members:</span> {formData.seedMembers.length}</p>
                    <p><span className="font-medium">Total Members:</span> {formData.initialAdmins.length + formData.seedMembers.length}</p>
                  </div>
                </div>

                {/* Debug Info */}
                {debugInfo && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-800 text-sm font-medium mb-1">Debug Information:</p>
                        <p className="text-yellow-700 text-xs font-mono">{debugInfo}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-600 text-sm">{success}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !formData.name.trim() || formData.initialAdmins.length === 0}
                  className="w-full flex items-center justify-center px-4 sm:px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] sm:min-h-0 text-sm sm:text-base font-medium"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Chat Group
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* User Selection */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Select Members</h2>
                <div className="text-xs sm:text-sm text-gray-600">
                  {formData.initialAdmins.length + formData.seedMembers.length} selected
                  {users.length > 0 && ` of ${users.length} available`}
                </div>
              </div>

              {/* Search */}
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-800 text-sm font-medium mb-1">Error loading users</p>
                      <p className="text-red-700 text-xs">{error}</p>
                      <p className="text-red-600 text-xs mt-2">Check the browser console for details.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Users List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {usersLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <LoadingSpinner size="md" color="border-blue-600" />
                    <p className="text-sm text-gray-500 mt-4">Loading users...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">Unable to load users</p>
                    <p className="text-sm text-gray-500">{error}</p>
                    <button
                      onClick={loadUsers}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium mb-1">No users found matching your search</p>
                        <p className="text-sm text-gray-500">Try a different search term</p>
                      </>
                    ) : users.length === 0 ? (
                      <>
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium mb-1">No users available</p>
                        <p className="text-sm text-gray-500">
                          No approved users found. Users must have status === 'approved' to appear here.
                        </p>
                        <button
                          onClick={loadUsers}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Refresh
                        </button>
                      </>
                    ) : (
                      <>
                        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium mb-1">No users match your search</p>
                        <p className="text-sm text-gray-500">Try a different search term</p>
                      </>
                    )}
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const role = getUserRole(u.uid);
                    const isCurrentUser = u.uid === user?.uid;
                    
                    return (
                      <div key={u.uid} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg gap-3 sm:gap-0">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium text-gray-600 flex-shrink-0">
                            {(u.displayName || u.firstName || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {u.displayName || u.firstName || u.email || 'Unknown User'}
                              {isCurrentUser && ' (You)'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {u.title && u.company ? `${u.title} at ${u.company}` : u.title || u.company || 'Member'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 sm:space-x-2 flex-shrink-0">
                          {/* Role Badge - Show on desktop only (when buttons are small) */}
                          <div className="hidden sm:flex">
                            {role === 'admin' && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Shield className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="whitespace-nowrap">Admin</span>
                              </div>
                            )}
                            
                            {role === 'member' && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                                <span className="whitespace-nowrap">Member</span>
                              </div>
                            )}
                          </div>

                          {/* Role Buttons - 2-column grid on mobile, flex row on desktop */}
                          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:space-x-1 w-full sm:w-auto">
                            <button
                              onClick={() => handleUserSelection(u.uid, 'admin')}
                              disabled={isCurrentUser && formData.initialAdmins.length === 1}
                              className={`px-2 sm:px-3 py-2 sm:py-1 text-xs rounded-lg transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 font-medium ${
                                role === 'admin' 
                                  ? 'bg-brand-dark text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                              } ${isCurrentUser && formData.initialAdmins.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={isCurrentUser && formData.initialAdmins.length === 1 ? 'At least one admin is required' : 'Make Admin'}
                            >
                              Admin
                            </button>
                            
                            <button
                              onClick={() => handleUserSelection(u.uid, 'member')}
                              className={`px-2 sm:px-3 py-2 sm:py-1 text-xs rounded-lg transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0 font-medium ${
                                role === 'member'
                                  ? 'bg-brand-dark text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-blue-50'
                              }`}
                            >
                              Member
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChatGroup;