import React from 'react';
import { MessageCircle } from 'lucide-react';
import { CHATS_REDESIGN_PAUSED_MESSAGE } from '../../config/chatsFeature';

type Variant = 'banner' | 'page';

interface ChatsRedesignPausedNoticeProps {
  variant?: Variant;
  className?: string;
}

const ChatsRedesignPausedNotice: React.FC<ChatsRedesignPausedNoticeProps> = ({
  variant = 'banner',
  className = '',
}) => {
  if (variant === 'page') {
    return (
      <div className={`max-w-lg mx-auto text-center px-4 ${className}`.trim()}>
        <MessageCircle className="h-12 w-12 text-brand-dark/40 mx-auto mb-4" aria-hidden />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Chats — redesign in progress</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{CHATS_REDESIGN_PAUSED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 text-xs text-amber-950 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2.5 leading-snug ${className}`.trim()}
      role="status"
    >
      <MessageCircle className="h-4 w-4 flex-shrink-0 text-amber-700 mt-0.5" aria-hidden />
      <p>{CHATS_REDESIGN_PAUSED_MESSAGE}</p>
    </div>
  );
};

export default ChatsRedesignPausedNotice;
