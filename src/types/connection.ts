export type DiscoverabilityLevel = 'public' | 'event_only' | 'hidden';

export type ConnectionType = 'auto' | 'manual' | 'scan';

export type ConnectionRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface UserDiscoverabilitySettings {
  discoverability: DiscoverabilityLevel;
  discoverabilityConsented: boolean;
  discoverabilityConsentedAt?: Date;
}

export interface ConnectionRequest {
  id: string;
  fromUid: string;
  toUid: string;
  eventId?: string;
  message?: string;
  status: ConnectionRequestStatus;
  createdAt: Date;
  respondedAt?: Date;
  
  // Enriched user data at time of request
  fromName: string;
  fromWork: string;
  fromPosition?: string;
  fromProfileImage?: string;
}

export interface UserDirectoryEntry {
  uid: string;
  name: string;
  work: string;
  position?: string;
  profileImage?: string;
  discoverability: DiscoverabilityLevel;
  lastActive: Date;
  eventIds: string[];
  searchTokens: string[];
  updatedAt: Date;
}

export interface UserRateLimits {
  dailyConnectRequests: number;
  lastRequestDate: string; // YYYY-MM-DD format
}

export interface EnhancedUser extends UserDiscoverabilitySettings, UserRateLimits {
  uid: string;
  email: string;
  displayName?: string;
  name: string;
  work: string;
  position?: string;
  linkedinUsername?: string;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnhancedConnection {
  id: string;
  fromUid: string;
  toUid: string;
  eventId?: string; // Now optional for global directory connections
  connectionType: ConnectionType;
  timestamp: Date;
  
  // Enriched user data
  fromName?: string;
  toName?: string;
  fromWork?: string;
  toWork?: string;
  fromPosition?: string;
  toPosition?: string;
  fromLinkedin?: string;
  toLinkedin?: string;
  fromEmail?: string;
  toEmail?: string;
  fromProfileImage?: string;
  toProfileImage?: string;
}

export interface EnhancedEvent {
  id: string;
  name: string;
  slug: string;
  location: string;
  date: string;
  description: string;
  imageUrl: string;
  status: 'active' | 'non-active' | 'sold-out' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  
  // NEW: Auto-connect control
  autoConnectEnabled: boolean;
}