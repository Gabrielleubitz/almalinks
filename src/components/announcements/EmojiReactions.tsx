import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { AnnouncementService, AnnouncementData, EmojiReaction } from '../../services/announcementService';
import { useAuth } from '../../hooks/useAuth';
import ReactionPill from './ReactionPill';
import type { ReactionUser } from './AvatarStack';

const EMOJI_ORDER: EmojiReaction[] = ['👍', '❤️', '🔥', '👑', '😊'];

interface EmojiReactionsProps {
  announcement: AnnouncementData;
}

const getReactionData = (announcement: AnnouncementData) => {
  const reactions = announcement.reactions || {
    '👍': { count: 0, userIds: [] },
    '❤️': { count: 0, userIds: [] },
    '🔥': { count: 0, userIds: [] },
    '👑': { count: 0, userIds: [] },
    '😊': { count: 0, userIds: [] },
  };
  return reactions;
};

const EmojiReactions: React.FC<EmojiReactionsProps> = ({ announcement }) => {
  const { user } = useAuth();
  const [isReacting, setIsReacting] = useState<EmojiReaction | null>(null);
  const [usersById, setUsersById] = useState<Record<string, ReactionUser>>({});
  const [optimisticReactions, setOptimisticReactions] = useState<AnnouncementData['reactions'] | null>(null);

  const reactions = optimisticReactions ?? getReactionData(announcement);

  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    const r = getReactionData(announcement);
    EMOJI_ORDER.forEach((emoji) => {
      (r[emoji]?.userIds ?? []).forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [announcement.id, announcement.reactions]);

  useEffect(() => {
    if (!user) return;
    setUsersById((prev) => ({
      ...prev,
      [user.uid]: {
        id: user.uid,
        name: user.displayName || (user as { name?: string }).name || user.email || 'You',
        avatarUrl: (user as { profileImage?: string | null }).profileImage ?? (user as { avatarUrl?: string | null }).avatarUrl ?? null,
      },
    }));
  }, [user?.uid, user?.displayName, user?.email]);

  useEffect(() => {
    if (allUserIds.length === 0) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const byId: Record<string, ReactionUser> = {};
      await Promise.all(
        allUserIds.map(async (uid) => {
          if (cancelled) return;
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (!snap.exists() || cancelled) return;
            const data = snap.data();
            const name = data?.displayName ?? data?.name ?? data?.firstName ?? 'Unknown';
            const avatarUrl = data?.profileImage ?? data?.avatarUrl ?? null;
            byId[uid] = { id: uid, name: String(name).trim() || 'Unknown', avatarUrl };
          } catch {
            byId[uid] = { id: uid, name: 'Unknown', avatarUrl: null };
          }
        })
      );
      if (!cancelled) setUsersById((prev) => ({ ...prev, ...byId }));
    };
    load();
    return () => { cancelled = true; };
  }, [allUserIds.join(',')]);

  const handleReaction = async (emoji: EmojiReaction) => {
    if (!user) return;
    if (isReacting) return;

    const prev = getReactionData(announcement);
    const prevUserIds = prev[emoji]?.userIds ?? [];
    const hadReacted = prevUserIds.includes(user.uid);

    const nextReactions = { ...prev };
    const nextUserIds = hadReacted
      ? prevUserIds.filter((id) => id !== user.uid)
      : [...prevUserIds, user.uid];
    nextReactions[emoji] = {
      count: nextUserIds.length,
      userIds: nextUserIds,
    };

    setOptimisticReactions(nextReactions);
    setIsReacting(emoji);

    try {
      await AnnouncementService.toggleReaction(announcement.id, emoji, user.uid);
    } catch (error) {
      console.error('❌ Error toggling reaction:', error);
      setOptimisticReactions(null);
    } finally {
      setIsReacting(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {EMOJI_ORDER.map((emoji) => {
        const data = reactions[emoji];
        const count = data?.count ?? 0;
        const userIds = data?.userIds ?? [];
        if (count === 0) return null;
        return (
          <ReactionPill
            key={emoji}
            emoji={emoji}
            userIds={userIds}
            currentUserId={user?.uid ?? null}
            usersById={usersById}
            onToggle={handleReaction}
            disabled={!user || isReacting !== null}
          />
        );
      })}
      {user && (
        <div className="flex flex-wrap gap-2 ml-1">
          {EMOJI_ORDER.filter((emoji) => (reactions[emoji]?.count ?? 0) === 0).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)}
              disabled={!!isReacting}
              aria-label={`React with ${emoji}`}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <span className="text-base">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmojiReactions;
