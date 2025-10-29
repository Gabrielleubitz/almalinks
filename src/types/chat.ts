export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: any; // Firestore timestamp
  createdBy: string; // User ID
  allowRequests: boolean; // Whether users can request to join
  isPublic: boolean; // Whether chat is public (default false)
  lastMessage?: ChatMessage;
  lastActivity?: any; // Firestore timestamp
}

export interface ChatMember {
  id?: string; // Document ID
  chatId: string;
  userId: string;
  role: 'member' | 'admin';
  joinedAt: any; // Firestore timestamp
  displayName?: string; // Cached for display
  avatarUrl?: string; // Cached for display
  email?: string; // User's email
  profileImage?: string; // User's profile image
}

export interface ChatRequest {
  id: string;
  chatId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: any; // Firestore timestamp
  resolvedAt?: any; // Firestore timestamp
  resolvedBy?: string; // Admin user ID who resolved
  message?: string; // Optional message from requester
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId?: string | null; // null for system messages
  type: 'user' | 'system';
  text: string;
  meta?: ChatMessageMeta; // Additional data for system messages
  createdAt: any; // Firestore timestamp
  editedAt?: any; // Firestore timestamp
  deleted?: boolean;
}

export interface ChatMessageMeta {
  action?: 'join' | 'leave' | 'add' | 'remove' | 'promote' | 'demote';
  actorId?: string; // User who performed the action
  byAdminId?: string; // Admin who performed the action
  targetId?: string; // User who was affected
  previousRole?: string; // For role changes
  newRole?: string; // For role changes
}

// UI-specific interfaces
export interface ChatListItem extends ChatGroup {
  memberCount: number;
  unreadCount: number;
  userRole?: 'member' | 'admin';
  lastMessagePreview?: string;
}

export interface ChatWithMembers extends ChatGroup {
  members: ChatMember[];
  userRole?: 'member' | 'admin';
  memberCount: number;
}

export interface ChatJoinRequestWithUser extends ChatRequest {
  userDisplayName: string;
  userAvatarUrl?: string;
}

// Form interfaces
export interface CreateChatGroupForm {
  name: string;
  description: string;
  imageUrl?: string;
  allowRequests: boolean;
  isPublic: boolean;
  initialAdmins: string[]; // User IDs
  seedMembers: string[]; // User IDs
}

export interface SendMessageForm {
  text: string;
  chatId: string;
}

export interface JoinRequestForm {
  chatId: string;
  message?: string;
}

// Rate limiting
export interface ChatRateLimit {
  userId: string;
  joinRequestsToday: number;
  lastJoinRequest: any; // Firestore timestamp
  messagesThisMinute: number;
  lastMessageMinute: number;
}

// Validation rules
export const CHAT_LIMITS = {
  MAX_JOIN_REQUESTS_PER_DAY: 5,
  MAX_MESSAGES_PER_MINUTE: 10,
  REQUEST_EXPIRY_DAYS: 14,
  MAX_CHAT_NAME_LENGTH: 100,
  MAX_CHAT_DESCRIPTION_LENGTH: 500,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_REQUEST_MESSAGE_LENGTH: 500,
} as const;

// Permission helpers
export type ChatPermission = 
  | 'read_messages'
  | 'send_messages'
  | 'manage_members'
  | 'manage_requests'
  | 'change_roles'
  | 'delete_chat';

export interface ChatPermissions {
  canReadMessages: boolean;
  canSendMessages: boolean;
  canManageMembers: boolean;
  canManageRequests: boolean;
  canChangeRoles: boolean;
  canDeleteChat: boolean;
  canLeave: boolean;
}