import React from 'react';
import { profileAvatarPlaceholderClassName } from '../../utils/profileAvatarPlaceholder';

export interface ReactionUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface AvatarStackProps {
  userIds: string[];
  usersById: Record<string, ReactionUser>;
  maxVisible?: number;
  size?: number;
}

const DEFAULT_SIZE = 18;
const OVERLAP = 6;

const getInitials = (name: string): string => {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
};

const AvatarStack: React.FC<AvatarStackProps> = ({
  userIds,
  usersById,
  maxVisible = 3,
  size = DEFAULT_SIZE,
}) => {
  const visible = userIds.slice(0, maxVisible);
  const remaining = userIds.length - maxVisible;

  if (userIds.length === 0) return null;

  return (
    <div className="flex items-center" style={{ height: size }}>
      {visible.map((uid, i) => {
        const u = usersById[uid];
        const name = u?.name ?? 'Unknown';
        const avatarUrl = u?.avatarUrl;
        return (
          <div
            key={uid}
            className={`rounded-full flex-shrink-0 overflow-hidden border-2 border-white ${profileAvatarPlaceholderClassName('font-medium')}`}
            style={{
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -OVERLAP,
              fontSize: Math.max(8, size * 0.45),
            }}
            title={name}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(name)
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={`rounded-full flex-shrink-0 border-2 border-white ${profileAvatarPlaceholderClassName('font-medium')}`}
          style={{
            width: size,
            height: size,
            marginLeft: -OVERLAP,
            fontSize: Math.max(8, size * 0.45),
          }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default AvatarStack;
