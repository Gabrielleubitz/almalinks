import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Users, UserPlus, Clock, Shield } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import JoinRequestModal from '../components/chat/JoinRequestModal';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CropImage from '../components/profile/CropImage';

interface DiscoverableChatGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  memberCount: number;
  allowRequests: boolean;
  canRequest: boolean;
  isAlreadyMember: boolean;
  hasPendingRequest: boolean;
  createdAt: any;
  lastActivity?: any;
}

const DiscoverChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [chats, setChats] = useState<DiscoverableChatGroup[]>([]);
  const [filteredChats, setFilteredChats] = useState<DiscoverableChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Join request modal state
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<DiscoverableChatGroup | null>(null);

  useEffect(() => {
    if (user?.uid) {
      loadDiscoverableChats();
    }
  }, [user?.uid]);

  useEffect(() => {
    filterChats();
  }, [searchQuery, chats]);

  const loadDiscoverableChats = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      const discoverableChats = await ChatService.getDiscoverableChats(user.uid);
      setChats(discoverableChats);
      
    } catch (err) {
      console.error('❌ Error loading discoverable chats:', err);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const filterChats = () => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = chats.filter(chat =>
      chat.name.toLowerCase().includes(query) ||
      chat.description?.toLowerCase().includes(query)
    );

    setFilteredChats(filtered);
  };

  const handleJoinRequest = (chat: DiscoverableChatGroup) => {
    setSelectedChat(chat);
    setJoinModalOpen(true);
  };

  const handleJoinSuccess = () => {
    if (selectedChat) {
      // Update the chat to show pending request
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === selectedChat.id
            ? { ...chat, hasPendingRequest: true, canRequest: false }
            : chat
        )
      );
    }
  };

  const formatMemberCount = (count: number): string => {
    if (count === 1) return '1 member';
    return `${count} members`;
  };

  /** Only show description if it looks like real content (not placeholder/junk). */
  const hasMeaningfulDescription = (desc: string | undefined): boolean => {
    if (!desc || typeof desc !== 'string') return false;
    const t = desc.trim();
    if (t.length < 12) return false;
    if (/^[\d\s]+$/.test(t)) return false;
    if (/^(.)\1+$/.test(t)) return false;
    return true;
  };

  const formatLastActivity = (timestamp: any): string => {
    if (!timestamp) return 'Created recently';
    
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
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    if (diffDays < 7) return `Active ${diffDays}d ago`;
    
    return `Active ${date.toLocaleDateString()}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600">Please sign in to discover and join chats.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full flex flex-col">
      <Header />
      
      <main className="flex-1 pt-[var(--content-offset-top)] pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <div className="mb-4">
            <BackButton
              fallbackTo="/chats"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm min-h-[44px] sm:min-h-0 touch-manipulation"
              iconClassName="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
            />
          </div>
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-10 h-10 bg-brand-dark rounded-full flex items-center justify-center text-white flex-shrink-0">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Discover Chats</h1>
                <p className="text-sm sm:text-base text-gray-600">Find and join public chat groups</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-base sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Content - scrolls with page */}
          <div className="space-y-4 pb-8">
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
                  onClick={loadDiscoverableChats}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredChats.length === 0 && (
            <div className="text-center py-16">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No chats found' : 'No public chats available'}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? `No chats match your search for "${searchQuery}"`
                  : 'There are no public chats available for you to join right now.'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-brand-blue hover:text-brand-blue-hover font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Chats Grid */}
          {!loading && !error && filteredChats.length > 0 && (
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 pb-4">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200 touch-manipulation"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {chat.imageUrl ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden relative">
                          <CropImage
                            src={chat.imageUrl}
                            crop={chat.imageCrop ?? null}
                            alt={chat.name}
                            mode="block"
                            className="w-full h-full rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const wrapper = target.closest('.relative');
                              if (wrapper) {
                                (wrapper as HTMLElement).style.display = 'none';
                                (wrapper.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-brand-dark rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {chat.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="w-10 h-10 bg-brand-dark rounded-full flex items-center justify-center text-white font-semibold text-sm hidden">
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {chat.name}
                        </h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{formatMemberCount(chat.memberCount)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Shield className="h-4 w-4" />
                            <span>Public</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {hasMeaningfulDescription(chat.description) && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {chat.description!.trim()}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatLastActivity(chat.lastActivity || chat.createdAt)}
                    </div>

                    {chat.isAlreadyMember ? (
                      <button
                        onClick={() => navigate(`/chats/${chat.id}`)}
                        className="px-4 py-2.5 min-h-[44px] bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors touch-manipulation flex items-center"
                      >
                        Open Chat
                      </button>
                    ) : chat.hasPendingRequest ? (
                      <div className="px-4 py-2.5 min-h-[44px] bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium flex items-center">
                        Request Pending
                      </div>
                    ) : chat.canRequest ? (
                      <button
                        onClick={() => handleJoinRequest(chat)}
                        className="px-4 py-2.5 min-h-[44px] bg-brand-dark text-white rounded-lg text-sm font-medium hover:bg-brand-mid transition-colors flex items-center space-x-1 touch-manipulation"
                      >
                        <UserPlus className="h-4 w-4 flex-shrink-0" />
                        <span>Request to Join</span>
                      </button>
                    ) : !chat.allowRequests ? (
                      <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium flex items-center space-x-1">
                        <Shield className="h-4 w-4" />
                        <span>Exclusive</span>
                      </div>
                    ) : (
                      <div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </main>

      {/* Join Request Modal */}
      <JoinRequestModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        chatId={selectedChat?.id || ''}
        chatName={selectedChat?.name || ''}
        userId={user?.uid || ''}
        onSuccess={handleJoinSuccess}
      />

      <Footer compact />
    </div>
  );
};

export default DiscoverChatsPage;