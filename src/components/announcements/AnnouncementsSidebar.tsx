import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { AnnouncementService, AnnouncementData } from '../../services/announcementService';
import EmojiReactions from './EmojiReactions';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';

const AnnouncementsSidebar: React.FC = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Wait for authentication to complete
    if (authLoading) return;
    
    // Only set up listener if user is authenticated
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Set up real-time listener for announcements (order matches admin panel)
    const announcementsRef = collection(db, 'announcements');
    const q = query(announcementsRef, where('active', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AnnouncementData[];
        const ts = (a: AnnouncementData) => a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp || 0);
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
    
    // Clean up listener on unmount
    return () => unsubscribe();
  }, [user, authLoading]);

  // Don't render if user is not authenticated
  if (!user && !authLoading) {
    return null;
  }

  if (loading || authLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="flex items-center space-x-3 mb-4">
          <MessageSquare className="h-5 w-5 text-brand-dark" />
          <h3 className="text-lg font-semibold text-gray-900">From the Makers of Alma Links</h3>
        </div>
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center space-x-3 mb-6">
        <MessageSquare className="h-5 w-5 text-brand-dark" />
        <h3 className="text-lg font-semibold text-gray-900">From the Makers of Alma Links</h3>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No new updates from the Alma Links team.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement, index) => (
            <div
              key={announcement.id}
              className={`p-4 rounded-2xl border transition-all duration-200 hover:shadow-sm ${
                index === 0 
                  ? 'bg-purple-50 border-purple-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <p className="text-gray-900 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                {announcement.message}
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                <Clock className="h-3 w-3" />
                <span>Posted {AnnouncementService.formatTimestamp(announcement.timestamp)}</span>
              </div>
              
              {/* Emoji Reactions */}
              <EmojiReactions announcement={announcement} />
            </div>
          ))}
        </div>
      )}

      {announcements.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Stay tuned for more updates from the Alma Links team!
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsSidebar;