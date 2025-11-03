import React, { useState } from 'react';
import { AnnouncementService, AnnouncementData, EmojiReaction } from '../../services/announcementService';
import { useAuth } from '../../hooks/useAuth';

interface EmojiReactionsProps {
  announcement: AnnouncementData;
}

const EmojiReactions: React.FC<EmojiReactionsProps> = ({ announcement }) => {
  const { user } = useAuth();
  const [isReacting, setIsReacting] = useState<EmojiReaction | null>(null);
  
  // Define available emojis
  const emojis: EmojiReaction[] = ["👍", "❤️", "🔥", "👑", "🍷"];
  
  // Initialize reactions if not present
  const reactions = announcement.reactions || {
    "👍": { count: 0, userIds: [] },
    "❤️": { count: 0, userIds: [] },
    "🔥": { count: 0, userIds: [] },
    "👑": { count: 0, userIds: [] },
    "🍷": { count: 0, userIds: [] }
  };

  // Get the user's current reaction (if any)
  const userReaction = user ? AnnouncementService.getUserReaction(announcement, user.uid) : null;

  const handleReaction = async (emoji: EmojiReaction) => {
    if (!user) {
      // User must be logged in to react
      return;
    }
    
    if (isReacting) {
      // Prevent multiple reactions at once
      return;
    }
    
    setIsReacting(emoji);
    
    try {
      await AnnouncementService.toggleReaction(announcement.id, emoji, user.uid);
    } catch (error) {
      console.error('❌ Error toggling reaction:', error);
    } finally {
      setIsReacting(null);
    }
  };

  const hasUserReacted = (emoji: EmojiReaction): boolean => {
    if (!user) return false;
    return AnnouncementService.hasUserReacted(announcement, emoji, user.uid);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          disabled={!user || isReacting !== null}
          className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-all duration-200 ${
            hasUserReacted(emoji)
              ? 'bg-blue-50 text-blue-800 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${!user ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          title={user ? `React with ${emoji}` : 'Login to react'}
        >
          <span className="text-base">{emoji}</span>
          {reactions[emoji]?.count > 0 && (
            <span className={`font-medium ${isReacting === emoji ? 'animate-pulse' : ''}`}>
              {reactions[emoji].count}
            </span>
          )}
        </button>
      ))}
      
      {userReaction && (
        <div className="text-xs text-gray-500 ml-1 flex items-center">
          <span>You reacted with {userReaction}</span>
        </div>
      )}
    </div>
  );
};

export default EmojiReactions;