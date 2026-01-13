import React, { useState } from 'react';
import { Clock, Check, CheckCheck, Smile, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { ChatMessage, MessageReaction } from '../../types/chat';
import { formatMessageTime } from '../../utils/dateUtils';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showName: boolean;
  senderName?: string;
  senderAvatar?: string;
  onReaction?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onProfileClick?: (userId: string) => void;
  currentUserId: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showAvatar,
  showName,
  senderName,
  senderAvatar,
  onReaction,
  onEdit,
  onDelete,
  onProfileClick,
  currentUserId
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full max-w-md text-center">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.deleted) {
    return (
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} my-1`}>
        <div className={`flex items-start gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {showAvatar && !isOwnMessage && (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {senderAvatar ? (
                <img src={senderAvatar} alt={senderName || ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-500">{(senderName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
          )}
          <div className={`px-4 py-2 rounded-2xl ${
            isOwnMessage 
              ? 'bg-gray-100 text-gray-500' 
              : 'bg-gray-50 text-gray-400'
          }`}>
            <p className="text-sm italic">This message was deleted</p>
          </div>
        </div>
      </div>
    );
  }

  const userReaction = message.reactions?.find(r => r.userId === currentUserId);
  const reactionCounts = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const getStatusIcon = () => {
    if (!isOwnMessage) return null;
    
    switch (message.status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Check className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} my-1 group`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`flex items-end gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        {showAvatar && !isOwnMessage && (
          <button
            onClick={() => message.userId && onProfileClick?.(message.userId)}
            className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity cursor-pointer"
          >
            {senderAvatar ? (
              <img src={senderAvatar} alt={senderName || ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-500 font-medium">{(senderName || 'U').charAt(0).toUpperCase()}</span>
            )}
          </button>
        )}

        {/* Message Content */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Sender Name */}
          {showName && !isOwnMessage && (
            <button
              onClick={() => message.userId && onProfileClick?.(message.userId)}
              className="text-xs text-gray-500 mb-1 px-1 hover:text-brand-blue transition-colors font-medium"
            >
              {senderName || 'Unknown User'}
            </button>
          )}

          {/* Message Bubble */}
          <div className="relative">
            <div
              className={`px-4 py-2 rounded-2xl shadow-sm ${
                isOwnMessage
                  ? 'bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-tr-sm'
                  : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              
              {/* Message Footer */}
              <div className={`flex items-center gap-1.5 mt-1 ${
                isOwnMessage ? 'justify-end' : 'justify-start'
              }`}>
                <span className={`text-xs ${
                  isOwnMessage ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {formatMessageTime(message.createdAt)}
                </span>
                {message.editedAt && (
                  <span className={`text-xs italic ${
                    isOwnMessage ? 'text-white/60' : 'text-gray-400'
                  }`}>
                    edited
                  </span>
                )}
                {getStatusIcon()}
              </div>
            </div>

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                {Object.entries(reactionCounts).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction?.(message.id, emoji)}
                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                      message.reactions?.some(r => r.emoji === emoji && r.userId === currentUserId)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons (shown on hover) */}
            {hovered && (
              <div className={`absolute ${isOwnMessage ? 'left-0' : 'right-0'} -top-8 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-10`}>
                {onReaction && (
                  <button
                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Add reaction"
                  >
                    <Smile className="h-4 w-4 text-gray-600" />
                  </button>
                )}
                {isOwnMessage && onEdit && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(message.id);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Edit message"
                  >
                    <Edit2 className="h-4 w-4 text-gray-600" />
                  </button>
                )}
                {isOwnMessage && onDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(message.id);
                    }}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors"
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                )}
              </div>
            )}

            {/* Reaction Picker */}
            {showReactionPicker && (
              <div className={`absolute ${isOwnMessage ? 'left-0' : 'right-0'} -top-12 bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex gap-1 z-20`}>
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReaction?.(message.id, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Spacer for own messages */}
        {isOwnMessage && showAvatar && <div className="w-8" />}
      </div>
    </div>
  );
};

export default MessageBubble;

