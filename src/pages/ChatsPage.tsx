import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, Clock, ChevronRight, Plus, Search, Compass } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { ChatListItem } from '../types/chat';
import Header from '../components/Header';
import Footer from '../components/Footer';
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
      case 'admin': return 'text-purple-600 bg-purple-100';
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600">Please sign in to access chats.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Chats</h1>
                <p className="text-gray-600">
                  {chats.length === 0 
                    ? "You're not in any chats yet" 
                    : `You're in ${chats.length} chat${chats.length === 1 ? '' : 's'}`
                  }
                </p>
              </div>
              
              <button
                onClick={() => navigate('/discover-chats')}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Compass className="h-4 w-4" />
                <span>Discover Chats</span>
              </button>
            </div>

            {/* Search Bar */}
            {chats.length > 0 && (
              <div className="mt-6">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" color="border-blue-600" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading chats</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={loadChats}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && chats.length === 0 && (
            <div className="text-center py-16">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No chats yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You haven't joined any chats yet. Discover public chats you can request to join or ask an admin to add you to a chat.
              </p>
              <button
                onClick={() => navigate('/discover-chats')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Compass className="h-5 w-5" />
                <span>Discover Chats</span>
              </button>
            </div>
          )}

          {/* Chats List */}
          {!loading && !error && filteredChats.length > 0 && (
            <div className="space-y-4">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-3">
                        {chat.imageUrl ? (
                          <img
                            src={chat.imageUrl}
                            alt={chat.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {chat.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm hidden">
                          {chat.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                            {chat.name}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{chat.memberCount} member{chat.memberCount === 1 ? '' : 's'}</span>
                            </div>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(chat.userRole)}`}>
                              {getRoleText(chat.userRole)}
                            </div>
                            {chat.lastActivity && (
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatLastActivity(chat.lastActivity)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {chat.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {chat.description}
                        </p>
                      )}

                      {chat.lastMessagePreview && (
                        <p className="text-gray-500 text-sm line-clamp-1">
                          <span className="font-medium">Last message:</span> {chat.lastMessagePreview}
                        </p>
                      )}

                      {chat.unreadCount > 0 && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                          {chat.unreadCount} unread
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Search Results */}
          {!loading && !error && searchQuery && filteredChats.length === 0 && chats.length > 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No chats found</h3>
              <p className="text-gray-600">
                No chats match your search for "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ChatsPage;