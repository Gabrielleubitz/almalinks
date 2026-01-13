import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, Clock, Search, Compass, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { ChatListItem } from '../types/chat';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.uid) {
      loadChats();
    }
  }, [user?.uid]);

  const loadChats = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);
      const userChats = await ChatService.getUserChats(user.uid);
      setChats(userChats);
    } catch (err) {
      console.error('❌ Error loading chats:', err);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getRoleColor = (role?: 'member' | 'admin') => {
    switch (role) {
      case 'admin': return 'text-brand-dark bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleText = (role?: 'member' | 'admin') => {
    switch (role) {
      case 'admin': return 'Admin';
      default: return 'Member';
    }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-sm text-gray-500">Please sign in to access chats.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {chats.length === 0 
                ? "No chats yet" 
                : `${chats.length} chat${chats.length === 1 ? '' : 's'}`
              }
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/discover-chats')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#0B2B6B] bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <Compass className="h-4 w-4" />
              <span>Discover</span>
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/chats/create')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-[#0B2B6B] hover:bg-[#1E56B3] rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {chats.length > 0 && (
          <div className="max-w-5xl mx-auto mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0B2B6B] focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" color="border-[#0B2B6B]" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <h3 className="text-sm font-medium text-red-900">Error loading chats</h3>
                    <p className="text-xs text-red-700 mt-0.5">{error}</p>
                  </div>
                </div>
                <button
                  onClick={loadChats}
                  className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && chats.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No chats yet</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                You haven't joined any chats yet. Discover public chats or ask an admin to add you.
              </p>
              <button
                onClick={() => navigate('/discover-chats')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B2B6B] hover:bg-[#1E56B3] rounded-lg transition-colors"
              >
                <Compass className="h-4 w-4" />
                <span>Discover Chats</span>
              </button>
            </div>
          )}

          {/* Chats List */}
          {!loading && !error && filteredChats.length > 0 && (
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {chat.imageUrl ? (
                      <img
                        src={chat.imageUrl}
                        alt={chat.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-[#0B2B6B] to-[#2E7FEF] rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="w-12 h-12 bg-gradient-to-br from-[#0B2B6B] to-[#2E7FEF] rounded-full flex items-center justify-center text-white font-semibold text-sm hidden">
                      {chat.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#0B2B6B] transition-colors">
                          {chat.name}
                        </h3>
                        {chat.unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold text-white bg-[#0B2B6B] rounded-full flex-shrink-0">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>{chat.memberCount}</span>
                        </div>
                        {chat.lastActivity && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatLastActivity(chat.lastActivity)}</span>
                          </div>
                        )}
                        <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          chat.userRole === 'admin' 
                            ? 'text-[#0B2B6B] bg-blue-50' 
                            : 'text-gray-600 bg-gray-100'
                        }`}>
                          {getRoleText(chat.userRole)}
                        </div>
                      </div>

                      {chat.lastMessagePreview && (
                        <p className="text-xs text-gray-500 truncate">
                          {chat.lastMessagePreview}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Search Results */}
          {!loading && !error && searchQuery && filteredChats.length === 0 && chats.length > 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No chats found</h3>
              <p className="text-xs text-gray-500">
                No chats match "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatsPage;