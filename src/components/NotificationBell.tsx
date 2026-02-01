import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, UserPlus, MessageCircle, Calendar, Trash2, CheckCheck } from 'lucide-react';
import { useNotificationItems } from '../hooks/useNotificationItems';
import type { AppNotification } from '../types/notification';

function formatNotificationTime(createdAt: unknown): string {
  if (!createdAt) return '';
  let ms = 0;
  const t = createdAt as { toMillis?: () => number; toDate?: () => Date };
  if (typeof t.toMillis === 'function') ms = t.toMillis();
  else if (typeof t.toDate === 'function') ms = t.toDate().getTime();
  else if (createdAt instanceof Date) ms = createdAt.getTime();
  else if (typeof createdAt === 'number') ms = createdAt;
  else if (typeof createdAt === 'string') ms = new Date(createdAt).getTime();
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  switch (type) {
    case 'connection_request':
      return <UserPlus className="h-4 w-4 text-[#0B2B6B] flex-shrink-0" />;
    case 'chat_message':
      return <MessageCircle className="h-4 w-4 text-[#0B2B6B] flex-shrink-0" />;
    case 'event_created':
      return <Calendar className="h-4 w-4 text-[#0B2B6B] flex-shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500 flex-shrink-0" />;
  }
}

interface NotificationBellProps {
  userId: string | undefined;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notifications, unread, unreadCount, loading, markAllRead, deleteAll, markOneRead } =
    useNotificationItems(userId);
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('.notification-bell-container')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) markOneRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  if (!userId) return null;

  const dropdownEl = open && (
    <div
      className="fixed w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
      style={{
        top: dropdownPosition.top,
        right: dropdownPosition.right,
        zIndex: 99999
      }}
    >
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#0B2B6B] hover:bg-blue-50 rounded transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => deleteAll()}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete all
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications</div>
            ) : (
              <>
                {unread.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                      Unread
                    </div>
                    {unread.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <NotificationIcon type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatNotificationTime(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                    All
                  </div>
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatNotificationTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
  );

  return (
    <div className="relative notification-bell-container">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
};

export default NotificationBell;
