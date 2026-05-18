import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { AnnouncementService, AnnouncementData } from '../../services/announcementService';
import EmojiReactions from './EmojiReactions';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';

interface AnnouncementsSidebarProps {
  /** Inline on dashboard: no outer card chrome, tighter typography */
  compact?: boolean;
}

const AnnouncementsSidebar: React.FC<AnnouncementsSidebarProps> = ({ compact = false }) => {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    const announcementsRef = collection(db, 'announcements');
    const q = query(announcementsRef, where('active', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AnnouncementData[];
        const ts = (a: AnnouncementData) =>
          a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp || 0;
        const sorted = list
          .sort((a, b) => {
            const orderA = a.order ?? 999999;
            const orderB = b.order ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return ts(b) - ts(a);
          })
          .slice(0, 3);
        setAnnouncements(sorted);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error in announcements listener:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  if (!user && !authLoading) {
    return null;
  }

  const shellClass = compact
    ? ''
    : 'bg-white rounded-3xl shadow-xl p-6 border border-gray-100';

  if (loading || authLoading) {
    return (
      <div className={shellClass}>
        {!compact && (
          <div className="flex items-center space-x-3 mb-4">
            <MessageSquare className="h-5 w-5 text-brand-dark" />
            <h3 className="text-lg font-semibold text-gray-900">From the Makers of AlmaLinks</h3>
          </div>
        )}
        <div className={compact ? 'py-2' : 'text-center py-4'}>
          <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading updates…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {!compact && (
        <div className="flex items-center space-x-3 mb-6">
          <MessageSquare className="h-5 w-5 text-brand-dark" />
          <h3 className="text-lg font-semibold text-gray-900">From the Makers of AlmaLinks</h3>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className={compact ? 'py-2' : 'text-center py-6'}>
          {!compact && (
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <p className="text-gray-500 text-xs sm:text-sm">No new updates from the AlmaLinks team.</p>
        </div>
      ) : (
        <div className={compact ? 'space-y-2 max-h-40 overflow-y-auto' : 'space-y-4'}>
          {announcements.map((announcement, index) => (
            <div
              key={announcement.id}
              className={`${compact ? 'p-2.5 rounded-lg' : 'p-4 rounded-2xl'} border transition-all duration-200 hover:shadow-sm ${
                index === 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <p
                className={`text-gray-900 leading-relaxed whitespace-pre-wrap ${
                  compact ? 'text-xs mb-1.5 line-clamp-3' : 'text-sm mb-3'
                }`}
              >
                {announcement.message}
              </p>
              <div
                className={`flex items-center space-x-2 text-gray-500 ${
                  compact ? 'text-[10px] mb-1' : 'text-xs mb-2'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Posted {AnnouncementService.formatTimestamp(announcement.timestamp)}</span>
              </div>
              <EmojiReactions announcement={announcement} />
            </div>
          ))}
        </div>
      )}

      {!compact && announcements.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Stay tuned for more updates from the AlmaLinks team!
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsSidebar;
