import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Decode HTML entities in message text (migration fix for legacy encoded messages)
 * Only needed for messages that were previously stored with HTML entity encoding
 * New messages are stored as plain UTF-8 text and don't need decoding
 */
function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // Check if text contains HTML entities (legacy data)
  if (!text.includes('&')) return text;
  
  // Use DOMParser to safely decode HTML entities
  // This handles: &#x27;, &#39;, &apos;, &quot;, &amp;, &lt;, &gt;, etc.
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.documentElement.textContent || text;
}

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
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  
  const showReactionPicker = openReactionPickerId === message.id;

  // Calculate picker position when it opens
  useEffect(() => {
    if (showReactionPicker && bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pickerWidth = 280; // Approximate width of picker
      const pickerHeight = 60; // Approximate height of picker
      const gap = 12; // Gap between message and picker
      const margin = 16; // Minimum margin from viewport edges
      
      let left: number;
      let top: number;
      
      // Try positioning to the right side of the message bubble first
      const rightSideLeft = rect.right + gap;
      const spaceOnRight = viewportWidth - rect.right;
      
      // Check if there's enough space on the right (picker width + gap + margin)
      const enoughSpaceOnRight = spaceOnRight >= pickerWidth + gap + margin;
      
      if (enoughSpaceOnRight) {
        // Position to the right of the message bubble (preferred)
        left = rightSideLeft;
        // Ensure it doesn't go off right edge
        if (left + pickerWidth > viewportWidth - margin) {
          left = viewportWidth - pickerWidth - margin;
        }
      } else {
        // Not enough space on right, position to the left instead
        left = rect.left - pickerWidth - gap;
        // Ensure it doesn't go off left edge
        if (left < margin) {
          left = margin;
        }
        // If even left positioning would be cut off, fall back to right with constraint
        if (left < margin && rect.right + gap + margin < viewportWidth) {
          left = rect.right + gap;
          if (left + pickerWidth > viewportWidth - margin) {
            left = viewportWidth - pickerWidth - margin;
          }
        }
      }
      
      // Vertically align to the top of the message bubble
      top = rect.top;
      
      // If it would go off top, adjust to stay within viewport
      if (top < margin) {
        top = margin;
      }
      
      // If it would go off bottom, adjust to stay within viewport
      if (top + pickerHeight > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - pickerHeight - margin);
      }
      
      setPickerPosition({ top, left });
    } else {
      setPickerPosition(null);
    }
  }, [showReactionPicker, isOwnMessage]);

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
          {decodeHtmlEntities(message.text)}
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
        return <Clock className="h-2.5 w-2.5 text-white/60" />;
      case 'sent':
        return <Check className="h-2.5 w-2.5 text-white/60" />;
      case 'delivered':
        return <CheckCheck className="h-2.5 w-2.5 text-white/60" />;
      case 'read':
        return <CheckCheck className="h-2.5 w-2.5 text-white/80" />;
      default:
        return <Check className="h-2.5 w-2.5 text-white/60" />;
    }
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
              className="text-xs text-gray-500 mb-0.5 px-1 hover:text-[#0B2B6B] transition-colors font-medium"
            >
              {senderName || 'Unknown User'}
            </button>
          )}

          {/* Message Bubble */}
          <div className="relative" ref={bubbleRef}>
            <div
              className={`px-2.5 py-1.5 rounded ${
                isOwnMessage
                  ? 'bg-[#0B2B6B] text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {decodeHtmlEntities(message.text)}
              </p>
              
              {/* Message Footer */}
              <div className={`flex items-center gap-1.5 mt-1 ${
                isOwnMessage ? 'justify-end' : 'justify-start'
              }`}>
                <span className={`text-[10px] ${
                  isOwnMessage ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {formatMessageTime(message.createdAt)}
                </span>
                {message.editedAt && (
                  <span className={`text-[10px] italic ${
                    isOwnMessage ? 'text-white/60' : 'text-gray-400'
                  }`}>
                    edited
                  </span>
                )}
                {getStatusIcon()}
              </div>
            </div>

            {/* Reactions - Below message */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                {Object.entries(reactionCounts).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction?.(message.id, emoji)}
                    className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${
                      message.reactions?.some(r => r.emoji === emoji && r.userId === currentUserId)
                        ? 'bg-[#0B2B6B] bg-opacity-10 text-[#0B2B6B] border border-[#0B2B6B] border-opacity-20'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
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
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white rounded border border-gray-200 shadow-lg p-0.5 z-30 whitespace-nowrap" style={{ left: '100%', marginLeft: '8px' }}>
                {onReaction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReactionPickerOpen?.(showReactionPicker ? null : message.id);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Add reaction"
                  >
                    <Smile className="h-3.5 w-3.5 text-gray-600" />
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
                    <Edit2 className="h-3.5 w-3.5 text-gray-600" />
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
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                )}
              </div>
            )}

            {/* Reaction Picker - Portal to body to avoid overflow issues */}
            {showReactionPicker && pickerPosition && createPortal(
              <div 
                ref={pickerRef}
                className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 flex gap-1 z-50"
                style={{
                  top: `${pickerPosition.top}px`,
                  left: `${pickerPosition.left}px`,
                  width: '280px'
                }}
                onMouseEnter={() => {
                  // Keep open when hovering
                }}
                onMouseLeave={() => {
                  // Close when mouse leaves
                  setTimeout(() => {
                    onReactionPickerOpen?.(null);
                  }, 200);
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>,
              document.body
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

