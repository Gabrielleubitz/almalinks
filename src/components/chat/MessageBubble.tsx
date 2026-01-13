import React, { useState, useEffect, useRef } from 'react';
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
  openReactionPickerId?: string | null;
  onReactionPickerOpen?: (messageId: string | null) => void;
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
  currentUserId,
  openReactionPickerId,
  onReactionPickerOpen
}) => {
  const [hovered, setHovered] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  
  const showReactionPicker = openReactionPickerId === message.id;

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        bubbleRef.current &&
        !bubbleRef.current.contains(event.target as Node)
      ) {
        onReactionPickerOpen?.(null);
      }
    };

    if (showReactionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReactionPicker, onReactionPickerOpen]);

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

  // Calculate position for reaction picker
  const bubbleElementRef = useRef<HTMLDivElement>(null);
  
  const getReactionPickerPosition = () => {
    if (!bubbleElementRef.current) return {};
    const rect = bubbleElementRef.current.getBoundingClientRect();
    return {
      top: `${rect.top - 60}px`,
      left: isOwnMessage ? `${rect.right - 200}px` : `${rect.left}px`,
      right: isOwnMessage ? 'auto' : 'auto'
    };
  };

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} my-0.5 group`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        // Close reaction picker when leaving message area
        if (showReactionPicker) {
          setTimeout(() => {
            onReactionPickerOpen?.(null);
          }, 200);
        }
      }}
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
          <div className="relative" ref={(el) => {
            bubbleRef.current = el;
            bubbleElementRef.current = el;
          }}>
            <div
              className={`px-3 py-1.5 rounded-lg shadow-sm ${
                isOwnMessage
                  ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none'
                  : 'bg-white text-gray-900 shadow-sm rounded-tl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              
              {/* Message Footer */}
              <div className={`flex items-center gap-1.5 mt-0.5 ${
                isOwnMessage ? 'justify-end' : 'justify-start'
              }`}>
                <span className={`text-[10px] ${
                  isOwnMessage ? 'text-gray-600' : 'text-gray-500'
                }`}>
                  {formatMessageTime(message.createdAt)}
                </span>
                {message.editedAt && (
                  <span className={`text-[10px] italic ${
                    isOwnMessage ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    edited
                  </span>
                )}
                {getStatusIcon()}
              </div>
            </div>

            {/* Reactions - Below message */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                {Object.entries(reactionCounts).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction?.(message.id, emoji)}
                    className={`px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-0.5 ${
                      message.reactions?.some(r => r.emoji === emoji && r.userId === currentUserId)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-xs">{emoji}</span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons (shown on hover) */}
            {hovered && (
              <div className={`absolute ${isOwnMessage ? 'left-0' : 'right-0'} -top-9 flex items-center gap-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1 z-30`}>
                {onReaction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReactionPickerOpen?.(showReactionPicker ? null : message.id);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Add reaction"
                  >
                    <Smile className="h-4 w-4 text-gray-600" />
                  </button>
                )}
                {isOwnMessage && onEdit && (
                  <button
                    onClick={() => {
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

            {/* Reaction Picker - Positioned to stay on screen */}
            {showReactionPicker && (
              <div 
                ref={pickerRef}
                className={`absolute ${
                  isOwnMessage ? 'left-0' : 'right-0'
                } -top-14 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 flex gap-1 z-40`}
                style={{
                  // Ensure it doesn't go off screen
                  maxWidth: 'calc(100vw - 2rem)',
                  transform: isOwnMessage ? 'none' : 'translateX(0)'
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReaction?.(message.id, emoji);
                      onReactionPickerOpen?.(null);
                    }}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-lg hover:scale-125"
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

