import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  Users, 
  Settings, 
  UserPlus, 
  Shield,
  MoreHorizontal,
  Clock,
  Edit3,
  LogOut,
  UserMinus,
  ChevronDown,
  Search,
  Menu,
  MessageCircle,
  X,
  Info,
  Phone,
  Mail,
  Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { UserService } from '../services/userService';
import { 
  ChatWithMembers, 
  ChatMessage, 
  ChatPermissions,
  ChatJoinRequestWithUser,
  SendMessageForm,
  ChatListItem,
  ChatMember
} from '../types/chat';
import { UserCard } from '../types/user';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ChatViewPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [chat, setChat] = useState<ChatWithMembers | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [permissions, setPermissions] = useState<ChatPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ChatJoinRequestWithUser[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingChat, setEditingChat] = useState({
    name: '',
    description: '',
    allowRequests: false
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(true);
  const [userChats, setUserChats] = useState<ChatListItem[]>([]);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showGroupPhotoModal, setShowGroupPhotoModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAdminAppointmentModal, setShowAdminAppointmentModal] = useState(false);
  const [nonAdminMembers, setNonAdminMembers] = useState<ChatMember[]>([]);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string>('');
  const [appointingAdmin, setAppointingAdmin] = useState(false);

  // Real-time subscription
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (user?.uid && chatId) {
      loadChat();
      loadPermissions();
      subscribeToMessages();
      loadUserChats();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.uid, chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChat = async () => {
    if (!user?.uid || !chatId) return;

    try {
      setLoading(true);
      setError(null);
      
      const chatData = await ChatService.getChat(chatId, user.uid);
      if (!chatData) {
        setError('Chat not found or you do not have access');
        return;
      }
      
      setChat(chatData);
      
      // Load pending requests if user is admin
      if (chatData.userRole === 'admin') {
        loadPendingRequests();
      }
      
    } catch (err) {
      console.error('❌ Error loading chat:', err);
      setError('Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    if (!user?.uid || !chatId) return;

    try {
      const userPermissions = await ChatService.getUserPermissions(chatId, user.uid);
      setPermissions(userPermissions);
    } catch (err) {
      console.error('❌ Error loading permissions:', err);
    }
  };

  const subscribeToMessages = () => {
    if (!user?.uid || !chatId) return;

    unsubscribeRef.current = ChatService.subscribeToMessages(
      chatId,
      user.uid,
      (newMessages) => {
        setMessages(newMessages);
      },
      (error) => {
        console.error('❌ Messages subscription error:', error);
      }
    );
  };

  const loadPendingRequests = async () => {
    if (!user?.uid || !chatId) return;

    try {
      const requests = await ChatService.getPendingRequests(chatId, user.uid);
      setPendingRequests(requests);
    } catch (err) {
      console.error('❌ Error loading requests:', err);
    }
  };

  const loadUserChats = async () => {
    if (!user?.uid) return;

    try {
      const chats = await ChatService.getUserChats(user.uid);
      setUserChats(chats);
    } catch (err) {
      console.error('❌ Error loading user chats:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !user?.uid || !chatId || sending) return;

    try {
      setSending(true);
      const form: SendMessageForm = {
        text: messageText.trim(),
        chatId
      };
      
      await ChatService.sendMessage(form, user.uid);
      setMessageText('');
      
    } catch (err: any) {
      console.error('❌ Error sending message:', err);
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!user?.uid) return;

    try {
      await ChatService.approveJoinRequest(requestId, user.uid);
      loadPendingRequests(); // Reload requests
      loadChat(); // Reload chat to update member count
    } catch (err: any) {
      console.error('❌ Error approving request:', err);
      alert(err.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.uid) return;

    try {
      await ChatService.rejectJoinRequest(requestId, user.uid);
      loadPendingRequests(); // Reload requests
    } catch (err: any) {
      console.error('❌ Error rejecting request:', err);
      alert(err.message || 'Failed to reject request');
    }
  };

  const handleLeaveChat = async () => {
    if (!user?.uid || !chatId || !chat) return;

    // If user is admin, check special conditions
    if (chat.userRole === 'admin') {
      const adminCount = await ChatService.getAdminCount(chatId);
      const totalMembers = chat.memberCount;

      // If this admin is the last admin and there are other members
      if (adminCount === 1 && totalMembers > 1) {
        // Get non-admin members for promotion
        const nonAdmins = await ChatService.getNonAdminMembers(chatId);
        if (nonAdmins.length > 0) {
          setNonAdminMembers(nonAdmins);
          setShowAdminAppointmentModal(true);
          return;
        }
      }

      // If this admin is the only member left, delete the chat
      if (totalMembers === 1) {
        const confirmDelete = confirm('You are the only member left in this chat. Leaving will delete the entire chat. Are you sure?');
        if (confirmDelete) {
          try {
            await ChatService.deleteChat(chatId, user.uid);
            navigate('/chats');
            return;
          } catch (err: any) {
            console.error('❌ Error deleting chat:', err);
            alert(err.message || 'Failed to delete chat');
            return;
          }
        } else {
          return;
        }
      }
    }

    // Regular leave confirmation
    const confirmMessage = chat.userRole === 'admin' 
      ? 'Are you sure you want to leave this chat? There are other admins to manage it.'
      : 'Are you sure you want to leave this chat?';

    if (!confirm(confirmMessage)) return;

    try {
      await ChatService.removeMember(chatId, user.uid, user.uid);
      navigate('/chats');
    } catch (err: any) {
      console.error('❌ Error leaving chat:', err);
      alert(err.message || 'Failed to leave chat');
    }
  };

  const handleAppointAdminAndLeave = async () => {
    if (!user?.uid || !chatId || !selectedNewAdmin) return;

    try {
      setAppointingAdmin(true);
      
      // First promote the selected member to admin
      await ChatService.promoteMemberToAdmin(chatId, selectedNewAdmin, user.uid);
      
      // Then leave the chat
      await ChatService.removeMember(chatId, user.uid, user.uid);
      
      navigate('/chats');
    } catch (err: any) {
      console.error('❌ Error appointing admin and leaving:', err);
      alert(err.message || 'Failed to appoint new admin');
    } finally {
      setAppointingAdmin(false);
      setShowAdminAppointmentModal(false);
      setSelectedNewAdmin('');
    }
  };

  const handlePromoteMember = async (memberId: string) => {
    if (!user?.uid || !chatId) return;

    try {
      await ChatService.promoteMemberToAdmin(chatId, memberId, user.uid);
      // Refresh the chat data to show updated roles
      loadChat();
    } catch (err: any) {
      console.error('❌ Error promoting member:', err);
      alert(err.message || 'Failed to promote member to admin');
    }
  };

  const handleDeleteChat = async () => {
    if (!user?.uid || !chatId || !chat) return;

    try {
      setDeleting(true);
      await ChatService.deleteChat(chatId, user.uid);
      navigate('/chats');
    } catch (err: any) {
      console.error('❌ Error deleting chat:', err);
      alert(err.message || 'Failed to delete chat');
    } finally {
      setDeleting(false);
      setShowDeleteConfirmation(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!user?.uid || !chatId) return;

    const member = chat?.members.find(m => m.userId === targetUserId);
    if (!member) return;

    if (!confirm(`Remove ${member.displayName || 'this member'} from the chat?`)) return;

    try {
      await ChatService.removeMember(chatId, targetUserId, user.uid);
      loadChat(); // Reload chat data
    } catch (err: any) {
      console.error('❌ Error removing member:', err);
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleEditChat = async () => {
    if (!user?.uid || !chatId) return;

    try {
      await ChatService.updateChat(chatId, editingChat, user.uid);
      setShowEditModal(false);
      loadChat(); // Reload chat data
    } catch (err: any) {
      console.error('❌ Error updating chat:', err);
      alert(err.message || 'Failed to update chat');
    }
  };

  const openEditModal = () => {
    if (chat) {
      setEditingChat({
        name: chat.name,
        description: chat.description || '',
        allowRequests: chat.allowRequests
      });
      setShowEditModal(true);
      setShowSettings(false);
    }
  };

  const handleUserSearch = async (searchTerm: string) => {
    setUserSearchQuery(searchTerm);
    
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      
      // Use admin search if user is admin, otherwise use regular search
      const results = chat?.userRole === 'admin' 
        ? await UserService.searchUsersForAdmin(searchTerm, 10)
        : await UserService.searchUsers(searchTerm, user?.uid || null, user?.role, 10);
      
      // Filter out users who are already members
      const currentMemberIds = chat?.members.map(m => m.userId) || [];
      const filteredResults = results.filter(result => !currentMemberIds.includes(result.uid || result.id));
      
      setSearchResults(filteredResults);
    } catch (err) {
      console.error('❌ Error searching users:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    if (!user?.uid || !chatId) return;

    const selectedUser = searchResults.find(u => u.id === targetUserId);
    if (!selectedUser) return;

    if (!confirm(`Add ${selectedUser.displayName || selectedUser.name || 'this user'} to the chat?`)) return;

    try {
      await ChatService.addMember(chatId, targetUserId, user.uid);
      setShowAddMemberModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
      loadChat(); // Reload chat data
    } catch (err: any) {
      console.error('❌ Error adding member:', err);
      alert(err.message || 'Failed to add member');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderChatIcon = (size: 'small' | 'medium' | 'large' | 'extra-large' = 'medium') => {
    const sizeClasses = {
      small: 'w-8 h-8 text-xs',
      medium: 'w-10 h-10 text-sm',
      large: 'w-16 h-16 text-xl',
      'extra-large': 'w-48 h-48 text-6xl'
    };

    if (chat?.imageUrl) {
      return (
        <img
          src={chat.imageUrl}
          alt={chat.name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={(e) => {
            // Fallback to letter avatar if image fails
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }

    return (
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold`}>
        {chat?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const formatMessageTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatLastActivity = (timestamp: any): string => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getMessageSenderName = (message: ChatMessage): string => {
    if (message.type === 'system') return 'System';
    if (!message.userId) return 'Unknown';
    if (message.userId === user?.uid) return 'You';
    
    const member = chat?.members.find(m => m.userId === message.userId);
    return member?.displayName || 'Unknown User';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600">Please sign in to access chats.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16 flex items-center justify-center">
          <LoadingSpinner size="lg" color="border-blue-600" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat Not Found</h2>
              <p className="text-gray-600 mb-8">{error || 'The chat you\'re looking for doesn\'t exist or you don\'t have access.'}</p>
              <button
                onClick={() => navigate('/chats')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chats
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex-1 flex overflow-hidden pt-20">
        {/* Left Sidebar - Chats List */}
        {showChatSidebar && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Chats</h2>
              <p className="text-sm text-gray-500">{userChats.length} chat{userChats.length === 1 ? '' : 's'}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userChats.map((chatItem) => (
                <button
                  key={chatItem.id}
                  onClick={() => navigate(`/chats/${chatItem.id}`)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                    chatItem.id === chatId ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {chatItem.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900 truncate text-sm">
                          {chatItem.name}
                        </h3>
                        {chatItem.lastActivity && (
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {formatLastActivity(chatItem.lastActivity)}
                          </span>
                        )}
                      </div>
                      {chatItem.lastMessagePreview && (
                        <p className="text-xs text-gray-500 truncate">
                          {chatItem.lastMessagePreview}
                        </p>
                      )}
                    </div>
                    {chatItem.unreadCount > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {chatItem.unreadCount}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              {userChats.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No chats yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 flex-shrink-0">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowChatSidebar(!showChatSidebar)}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                    title="Toggle Chats Sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  
                  <button
                    onClick={() => navigate('/chats')}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                
                <button
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  className="hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  {renderChatIcon('medium')}
                </button>
                
                <div>
                  <button
                    onClick={() => setShowChatInfo(!showChatInfo)}
                    className="text-left hover:text-blue-600 transition-colors"
                  >
                    <h1 className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">{chat.name}</h1>
                  </button>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</span>
                    </div>
                    {chat.userRole && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        chat.userRole === 'admin' ? 'text-purple-600 bg-purple-100' : 'text-gray-600 bg-gray-100'
                      }`}>
                        {chat.userRole === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {chat.userRole === 'admin' ? 'Admin' : 'Member'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setShowMembersList(!showMembersList);
                    if (!showMembersList) {
                      setShowSettings(false);
                      setShowRequests(false);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View Members"
                >
                  <Users className="h-5 w-5" />
                </button>
                
                {chat.userRole === 'admin' && pendingRequests.length > 0 && (
                  <button
                    onClick={() => {
                      setShowRequests(!showRequests);
                      if (!showRequests) {
                        setShowMembersList(false);
                        setShowSettings(false);
                      }
                    }}
                    className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Join Requests"
                  >
                    <UserPlus className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingRequests.length}
                    </span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowSettings(!showSettings);
                    if (!showSettings) {
                      setShowMembersList(false);
                      setShowRequests(false);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Chat Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Chat Info Panel */}
          {showChatInfo && (
            <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 lg:px-8">
              <div className="max-w-6xl mx-auto py-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setShowGroupPhotoModal(true)}
                      className="hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
                    >
                      {renderChatIcon('large')}
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{chat.name}</h2>
                      <p className="text-gray-600 mt-1">{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChatInfo(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Chat Description */}
                {chat.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">About</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{chat.description}</p>
                  </div>
                )}
                
                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {chat.userRole === 'admin' && (
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowChatInfo(false);
                      }}
                      className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <UserPlus className="h-5 w-5 text-blue-600 mb-1" />
                      <span className="text-xs text-gray-700">Add Member</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowMembersList(!showMembersList);
                      setShowChatInfo(false);
                    }}
                    className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <Users className="h-5 w-5 text-green-600 mb-1" />
                    <span className="text-xs text-gray-700">Members</span>
                  </button>
                  
                  {chat.userRole === 'admin' && (
                    <button
                      onClick={() => {
                        openEditModal();
                        setShowChatInfo(false);
                      }}
                      className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-5 w-5 text-gray-600 mb-1" />
                      <span className="text-xs text-gray-700">Settings</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      handleLeaveChat();
                      setShowChatInfo(false);
                    }}
                    className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-5 w-5 text-red-600 mb-1" />
                    <span className="text-xs text-gray-700">Leave</span>
                  </button>
                </div>
                
                {/* Members Preview */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Members ({chat.memberCount})</h3>
                    <button
                      onClick={() => {
                        setShowMembersList(!showMembersList);
                        setShowChatInfo(false);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {chat.members.slice(0, 4).map((member) => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          {(member.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/profile/${member.userId}`)}
                            className="text-left w-full"
                          >
                            <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors cursor-pointer truncate">
                              {member.displayName || 'Unknown User'}
                              {member.userId === user?.uid && ' (You)'}
                            </p>
                          </button>
                          <div className="flex items-center space-x-2">
                            {member.role === 'admin' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-600">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </span>
                            ) : (
                              chat.userRole === 'admin' && (
                                <button
                                  onClick={() => handlePromoteMember(member.userId)}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                  title="Promote to Admin"
                                >
                                  <Shield className="h-3 w-3 mr-1" />
                                  Make Admin
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {chat.memberCount > 4 && (
                      <div className="text-xs text-gray-500 pt-2">
                        +{chat.memberCount - 4} more member{chat.memberCount - 4 === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Messages and Sidebars Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 px-4 sm:px-6 lg:px-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {/* Messages List */}
                <div className="py-6 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No messages yet. Start the conversation!</p>
                    </div>
                  )}
                  
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'system' ? 'justify-center' : 'justify-start'}`}
                    >
                      {message.type === 'system' ? (
                        <div className="bg-gray-100 text-gray-600 text-sm px-4 py-2 rounded-full max-w-md text-center">
                          {message.text}
                        </div>
                      ) : (
                        <div className={`max-w-md ${message.userId === user.uid ? 'ml-auto' : ''}`}>
                          <div className={`rounded-2xl px-4 py-3 ${
                            message.userId === user.uid 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white border border-gray-200 text-gray-900'
                          }`}>
                            {message.userId !== user.uid ? (
                              <button
                                onClick={() => navigate(`/profile/${message.userId}`)}
                                className="text-xs text-gray-500 mb-1 font-medium hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                {getMessageSenderName(message)}
                              </button>
                            ) : (
                              <button
                                onClick={() => navigate(`/profile/${message.userId}`)}
                                className="text-xs text-gray-300 mb-1 font-medium hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                You
                              </button>
                            )}
                            <p className="text-sm leading-relaxed">{message.text}</p>
                          </div>
                          <div className={`mt-1 text-xs text-gray-500 ${
                            message.userId === user.uid ? 'text-right' : 'text-left'
                          }`}>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Message Composer */}
            {permissions?.canSendMessages && (
              <div className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                  <form onSubmit={handleSendMessage} className="flex space-x-4">
                    <div className="flex-1">
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        rows={1}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        disabled={sending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!messageText.trim() || sending}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Members List */}
          {showMembersList && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Members ({chat.memberCount})
                </h3>
                {chat.userRole === 'admin' && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                    title="Add Member"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {chat.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 group">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      {(member.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.displayName || 'Unknown User'}
                        {member.userId === user.uid && ' (You)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {member.role === 'admin' ? 'Admin' : 'Member'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {member.role === 'admin' && (
                        <Shield className="h-4 w-4 text-purple-600" />
                      )}
                      {chat.userRole === 'admin' && member.userId !== user.uid && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove Member"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sidebar - Join Requests */}
          {showRequests && chat.userRole === 'admin' && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Join Requests ({pendingRequests.length})
              </h3>
              <div className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">No pending requests</p>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          {request.userDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {request.userDisplayName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatMessageTime(request.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      {request.message && (
                        <p className="text-sm text-gray-600 mb-3">
                          "{request.message}"
                        </p>
                      )}
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Sidebar - Settings */}
          {showSettings && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Chat Settings
              </h3>
              <div className="space-y-2">
                {chat.userRole === 'admin' && (
                  <>
                    <button
                      onClick={openEditModal}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="h-5 w-5 mr-3" />
                      <span>Edit Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowSettings(false);
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <UserPlus className="h-5 w-5 mr-3" />
                      <span>Add Member</span>
                    </button>
                  </>
                )}
                {chat.userRole === 'admin' && (
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5 mr-3" />
                    <span>Delete Chat</span>
                  </button>
                )}
                <button
                  onClick={handleLeaveChat}
                  className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  <span>Leave Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
        {/* End Messages and Sidebars Container */}
      </div>
      {/* End Main Chat Area */}
    </div>
    {/* End flex container with sidebar */}

      {/* Footer outside main scrolling area - optional, can be removed for full screen chat */}
      {/* <Footer /> */}
      
      {/* Edit Chat Modal */}
      {showEditModal && chat && chat.userRole === 'admin' && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Chat</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chat Name
                </label>
                <input
                  type="text"
                  value={editingChat.name}
                  onChange={(e) => setEditingChat({...editingChat, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingChat.description}
                  onChange={(e) => setEditingChat({...editingChat, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="allowRequests"
                  type="checkbox"
                  checked={editingChat.allowRequests}
                  onChange={(e) => setEditingChat({...editingChat, allowRequests: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allowRequests" className="ml-2 text-sm text-gray-700">
                  Allow join requests
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditChat}
                disabled={!editingChat.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Member Modal */}
      {showAddMemberModal && chat && chat.userRole === 'admin' && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-96 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Member</h3>
            
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Search Results */}
            <div className="flex-1 overflow-y-auto mb-4">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.uid || result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          {(result.displayName || result.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {result.displayName || result.name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {result.title || result.email || 'No title'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(result.uid || result.id)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : userSearchQuery.trim() ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No users found matching "{userSearchQuery}"</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Start typing to search for users to add</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setUserSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Chat Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Chat</h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to permanently delete "{chat.name}"? This action cannot be undone and will:
              </p>
              <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Delete all messages in this chat</li>
                <li>Remove all members from the chat</li>
                <li>Cancel any pending join requests</li>
                <li>Permanently delete the chat from the system</li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Appointment Modal */}
      {showAdminAppointmentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Appoint New Admin</h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-4">
                You are the only admin in this chat. Before leaving, you must appoint another member as admin to manage the chat.
              </p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select new admin:
              </label>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {nonAdminMembers.map((member) => (
                  <label key={member.userId} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="newAdmin"
                      value={member.userId}
                      checked={selectedNewAdmin === member.userId}
                      onChange={(e) => setSelectedNewAdmin(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      {(member.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {member.displayName || 'Unknown User'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAdminAppointmentModal(false);
                  setSelectedNewAdmin('');
                }}
                disabled={appointingAdmin}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAppointAdminAndLeave}
                disabled={!selectedNewAdmin || appointingAdmin}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {appointingAdmin ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Appointing...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    <span>Appoint & Leave</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Photo Modal */}
      {showGroupPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setShowGroupPhotoModal(false)}>
          <div className="relative max-w-lg mx-4">
            <button
              onClick={() => setShowGroupPhotoModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="mx-auto mb-6 shadow-2xl">
                {renderChatIcon('extra-large')}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{chat.name}</h3>
              <p className="text-gray-600">{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</p>
              {chat.userRole === 'admin' && (
                <div className="mt-6">
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                    Change Group Photo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatViewPage;