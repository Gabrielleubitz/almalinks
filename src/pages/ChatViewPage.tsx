import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  Trash2,
  BellOff,
  Bell
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { toggleChatMute, getChatMuteStatus } from '../hooks/useNotifications';
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
import MessageBubble from '../components/chat/MessageBubble';
import { formatMessageTime, shouldGroupMessages } from '../utils/dateUtils';

const ChatViewPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logChatMessage } = useActivityTracking();
  
  // Refs for deterministic scroll to bottom
  const containerRef = useRef<HTMLDivElement | null>(null); // Scrollable chat box element
  const bottomRef = useRef<HTMLDivElement | null>(null); // Sentinel at bottom of messages
  
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
  const [isMuted, setIsMuted] = useState(false);
  const [mutingChat, setMutingChat] = useState(false);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Real-time subscription
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (user?.uid && chatId) {
      // Clear messages immediately when chatId changes to ensure clean state
      // This ensures the scroll effect can properly detect the new chat
      setMessages([]);
      
      loadChat();
      loadPermissions();
      subscribeToMessages();
      loadUserChats();
      loadMuteStatus();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.uid, chatId]);

  // Prevent body scrolling when on chat page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Deterministic scroll to bottom function
  const scrollToBottom = () => {
    if (!containerRef.current || !chatId) return;

    const container = containerRef.current;
    const beforeScrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Prefer scrolling via bottom sentinel element
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end', behavior: 'auto' });
    } else if (container) {
      // Fallback: scroll container directly
      container.scrollTop = container.scrollHeight;
    }

    const afterScrollTop = container.scrollTop;

    // Dev-only debug logs
    if (import.meta.env.DEV) {
      console.log('[chat-scroll]', {
        chatId,
        messagesLength: messages.length,
        lastMessageId: messages.length > 0 ? messages[messages.length - 1]?.id : null,
        scrollHeight,
        clientHeight,
        beforeScrollTop,
        afterScrollTop,
        scrolled: afterScrollTop !== beforeScrollTop,
        containerClassName: container.className,
        containerId: container.id,
        hasBottomRef: !!bottomRef.current
      });
    }
  };

  // Deterministic scroll using useLayoutEffect (runs synchronously after render)
  // Scrolls the chat box to bottom when chatId changes or messages render
  useLayoutEffect(() => {
    if (!chatId || !containerRef.current) return;

    // Wait for two frames to ensure messages are fully rendered
    // Use a ref to track raf2 so cleanup can access it
    let raf2: number | null = null;
    
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollToBottom();
      });
    });

    // Cleanup both RAFs on unmount/chatId change
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) {
        cancelAnimationFrame(raf2);
      }
    };
  }, [chatId, messages.length]); // Run on EVERY chatId change AND when messages.length changes

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

  const loadMuteStatus = async () => {
    if (!user?.uid || !chatId) return;

    try {
      const muteStatus = await getChatMuteStatus(user.uid, chatId);
      setIsMuted(muteStatus);
      console.log(`🔇 Chat mute status loaded: ${muteStatus ? 'muted' : 'unmuted'}`);
    } catch (err) {
      console.error('❌ Error loading mute status:', err);
    }
  };

  const handleToggleMute = async () => {
    if (!user?.uid || !chatId) return;

    try {
      setMutingChat(true);
      const newMuteStatus = await toggleChatMute(user.uid, chatId, isMuted);
      setIsMuted(newMuteStatus);
      console.log(`🔔 Chat ${newMuteStatus ? 'muted' : 'unmuted'}`);
    } catch (err) {
      console.error('❌ Error toggling mute:', err);
      alert('Failed to toggle mute. Please try again.');
    } finally {
      setMutingChat(false);
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
      
      // If editing a message, update it instead of sending new one
      if (editingMessageId) {
        await ChatService.editMessage(chatId, editingMessageId, messageText.trim(), user.uid);
        setEditingMessageId(null);
        setMessageText('');
      } else {
      const form: SendMessageForm = {
        text: messageText.trim(),
        chatId
      };
      
      await ChatService.sendMessage(form, user.uid);
      setMessageText('');

      // Log chat message activity
      if (chat) {
        logChatMessage(chatId, chat.name);
        }
      }
      
    } catch (err: any) {
      console.error('❌ Error sending/editing message:', err);
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
    return member?.displayName || message.userDisplayName || 'Unknown User';
  };

  const getMessageSenderAvatar = (message: ChatMessage): string | undefined => {
    if (!message.userId || message.userId === user?.uid) return undefined;
    const member = chat?.members.find(m => m.userId === message.userId);
    return member?.profileImage || member?.avatarUrl || message.userProfileImage;
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user?.uid || !chatId) return;
    try {
      await ChatService.toggleReaction(chatId, messageId, user.uid, emoji);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.userId === user?.uid) {
      setMessageText(message.text);
      setEditingMessageId(messageId);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setMessageText('');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.uid || !chatId) return;
    const message = messages.find(m => m.id === messageId);
    if (message && message.userId === user.uid) {
      if (confirm('Are you sure you want to delete this message?')) {
        try {
          // TODO: Implement message deletion
          console.log('Delete message:', messageId);
        } catch (error) {
          console.error('Failed to delete message:', error);
        }
      }
    }
  };

  if (!user) {
    return (
      <div className="h-screen bg-[#E5DDD5] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600">Please sign in to access chats.</p>
          </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#E5DDD5] flex items-center justify-center">
        <LoadingSpinner size="lg" color="border-[#0B2B6B]" />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="h-screen bg-[#E5DDD5] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat Not Found</h2>
              <p className="text-gray-600 mb-8">{error || 'The chat you\'re looking for doesn\'t exist or you don\'t have access.'}</p>
              <button
                onClick={() => navigate('/chats')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0B2B6B] hover:bg-[#1E56B3]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chats
              </button>
            </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden pt-20" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Chat Layout */}
        <div className="flex-1 flex overflow-hidden h-full w-full">
        {/* Left Sidebar - Chats List (Premium WhatsApp Style) */}
        {showChatSidebar && (
          <div className="w-80 bg-white flex flex-col overflow-hidden border-r border-gray-300 shadow-sm">
            {/* Sidebar Header - Premium Design */}
            <div className="bg-[#F0F2F5] px-4 py-4 border-b border-gray-300 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Chats</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/chats')}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    title="New Chat"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowChatSidebar(false)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors md:hidden"
                    title="Close Sidebar"
                  >
                    <X className="h-5 w-5" />
                  </button>
            </div>
              </div>
            </div>
            
            {/* Chats List - Improved Design */}
            <div className="flex-1 overflow-y-auto">
              {userChats.map((chatItem) => (
                <button
                  key={chatItem.id}
                  onClick={() => navigate(`/chats/${chatItem.id}`)}
                  className={`w-full p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left group ${
                    chatItem.id === chatId ? 'bg-[#E5DDD5] border-l-4 border-l-[#0B2B6B]' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br from-[#0B2B6B] to-[#2E7FEF] rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0 shadow-sm ${
                      chatItem.id === chatId ? 'ring-2 ring-[#0B2B6B] ring-offset-1' : ''
                    }`}>
                      {chatItem.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className={`font-semibold truncate text-sm ${
                          chatItem.id === chatId ? 'text-[#0B2B6B]' : 'text-gray-900'
                        }`}>
                          {chatItem.name}
                        </h3>
                        {chatItem.lastActivity && (
                          <span className={`text-[10px] ml-2 flex-shrink-0 ${
                            chatItem.id === chatId ? 'text-gray-600' : 'text-gray-500'
                          }`}>
                            {formatLastActivity(chatItem.lastActivity)}
                          </span>
                        )}
                      </div>
                      {chatItem.lastMessagePreview && (
                        <p className={`text-xs truncate ${
                          chatItem.id === chatId ? 'text-gray-700' : 'text-gray-600'
                        }`}>
                          {chatItem.lastMessagePreview}
                        </p>
                      )}
                    </div>
                    {chatItem.unreadCount > 0 && (
                      <div className="bg-[#25D366] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center flex-shrink-0 font-semibold shadow-sm">
                        {chatItem.unreadCount > 99 ? '99+' : chatItem.unreadCount}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              {userChats.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm font-medium">No chats yet</p>
                  <p className="text-xs text-gray-400 mt-1">Start a conversation!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Panel - Single Continuous Chat Surface */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Chat Header - Part of the surface */}
          <div className="px-4 py-2.5 border-b border-gray-200 flex-shrink-0 bg-white">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                  <button
                    onClick={() => setShowChatSidebar(!showChatSidebar)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  title="Toggle Chats"
                >
                  <Menu className="h-4 w-4" />
                  </button>
                
                <button
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  className="flex items-center space-x-2.5 flex-1 min-w-0 hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {renderChatIcon('small')}
                    </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h1 className="text-sm font-semibold text-gray-900 truncate">{chat.name}</h1>
                    <p className="text-xs text-gray-500 truncate">{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</p>
                      </div>
                </button>
              </div>
              
              <div className="flex items-center space-x-0.5 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowMembersList(!showMembersList);
                    if (!showMembersList) {
                      setShowSettings(false);
                      setShowRequests(false);
                    }
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="View Members"
                >
                  <Users className="h-4 w-4" />
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
                    className="relative p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Join Requests"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-[#0B2B6B] text-white text-[9px] rounded-full flex items-center justify-center font-medium">
                      {pendingRequests.length > 9 ? '9+' : pendingRequests.length}
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
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Chat Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Messages Area - Same background, continuous surface */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
            {/* Subtle background pattern with Alma Links logo */}
            <div 
              className="absolute inset-0 opacity-[0.018] pointer-events-none"
              style={{
                backgroundImage: `url('/logo.svg'), url('/favicon-32x32.png')`,
                backgroundRepeat: 'repeat',
                backgroundSize: '400px auto, 120px 120px',
                backgroundPosition: '0 0, 200px 200px',
              }}
            />
            <div 
              ref={containerRef}
              className="flex-1 px-4 overflow-y-auto relative z-10" 
              id="messages-container"
              data-testid="chat-scroll-box"
            >
              <div className="max-w-3xl mx-auto">
                <div className="py-3 space-y-0.5">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
                    </div>
                  )}
                  
                  {messages.map((message, index) => {
                    const isOwnMessage = message.userId === user?.uid;
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const showAvatar = !prevMessage || !shouldGroupMessages(prevMessage, message, user?.uid || '');
                    const showName = !prevMessage || prevMessage.userId !== message.userId || prevMessage.type === 'system';
                    const senderName = getMessageSenderName(message);
                    const senderAvatar = getMessageSenderAvatar(message);

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwnMessage={isOwnMessage}
                        showAvatar={showAvatar}
                        showName={showName}
                        senderName={senderName}
                        senderAvatar={senderAvatar}
                        onReaction={handleReaction}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onProfileClick={(userId) => navigate(`/profile/${userId}`)}
                        currentUserId={user?.uid || ''}
                        openReactionPickerId={openReactionPickerId}
                        onReactionPickerOpen={setOpenReactionPickerId}
                      />
                    );
                  })}
                  <div ref={bottomRef} data-testid="chat-bottom" />
                </div>
              </div>
            </div>

            {/* Message Input - Anchored to bottom, part of the surface */}
            {permissions?.canSendMessages && (
              <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
                {editingMessageId && (
                  <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center justify-between max-w-3xl mx-auto">
                    <span>Editing message</span>
                    <button
                      onClick={handleCancelEdit}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-3xl mx-auto">
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex items-center border border-gray-200">
                    <textarea
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                      }}
                      placeholder={editingMessageId ? "Edit your message" : "Type a message"}
                      rows={1}
                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-sm text-gray-900 placeholder-gray-400 max-h-[100px] overflow-y-auto leading-relaxed"
                      disabled={sending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                        if (e.key === 'Escape' && editingMessageId) {
                          handleCancelEdit();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className="w-9 h-9 bg-[#0B2B6B] text-white rounded-lg hover:bg-[#1E56B3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Chat Info Panel - Part of continuous surface */}
          {showChatInfo && (
            <div className="border-b border-gray-200 bg-white">
              <div className="px-4 py-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div>
                      {renderChatIcon('medium')}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">{chat.name}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChatInfo(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                {chat.description && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-gray-700 mb-1">About</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{chat.description}</p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {chat.userRole === 'admin' && (
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowChatInfo(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-[#0B2B6B] bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      Add Member
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMembersList(!showMembersList);
                      setShowChatInfo(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    View Members
                  </button>
                  {chat.userRole === 'admin' && (
                    <button
                      onClick={() => {
                        openEditModal();
                        setShowChatInfo(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      Settings
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleLeaveChat();
                      setShowChatInfo(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                  >
                    Leave Chat
                  </button>
                </div>
                  </div>
                        </div>
          )}

          {/* Sidebar - Members List */}
          {showMembersList && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Members ({chat.memberCount})
                </h3>
                {chat.userRole === 'admin' && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="p-1 text-[#0B2B6B] hover:bg-gray-100 rounded transition-colors"
                    title="Add Member"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {chat.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2.5 group">
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
                    <div className="flex items-center space-x-1">
                      {member.role === 'admin' && (
                        <Shield className="h-3.5 w-3.5 text-[#0B2B6B]" />
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Join Requests ({pendingRequests.length})
              </h3>
              <div className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">No pending requests</p>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center space-x-2.5 mb-2">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
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
                        <p className="text-xs text-gray-600 mb-2">
                          "{request.message}"
                        </p>
                      )}
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="flex-1 px-2.5 py-1.5 bg-[#0B2B6B] text-white text-xs rounded hover:bg-[#1E56B3] transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="flex-1 px-2.5 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Chat Settings
              </h3>
              <div className="space-y-1">
                {chat.userRole === 'admin' && (
                  <>
                    <button
                      onClick={openEditModal}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      <span>Edit Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowSettings(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span>Add Member</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleToggleMute}
                  disabled={mutingChat}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center">
                    {isMuted ? (
                      <Bell className="h-4 w-4 mr-2" />
                    ) : (
                      <BellOff className="h-4 w-4 mr-2" />
                    )}
                    <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                  </div>
                  {mutingChat && (
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  )}
                </button>

                {chat.userRole === 'admin' && (
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Chat</span>
                  </button>
                )}
                <button
                  onClick={handleLeaveChat}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Leave Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      
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
                  className="h-4 w-4 text-brand-blue focus:ring-blue-500 border-gray-300 rounded"
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
                className="px-4 py-2 text-sm font-medium text-white bg-brand-dark rounded-md hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className="px-3 py-1 text-xs font-medium text-brand-blue bg-blue-50 rounded-md hover:bg-blue-200 transition-colors"
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
                <Shield className="h-6 w-6 text-brand-blue" />
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
                      className="text-brand-blue focus:ring-blue-500"
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
                className="px-4 py-2 text-sm font-medium text-white bg-brand-dark rounded-md hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
                  <button className="px-6 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors text-sm font-medium">
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