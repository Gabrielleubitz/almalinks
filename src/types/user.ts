export type ProfileVisibility = 'public' | 'event_only' | 'hidden';

export interface UserProfile {
  // Core identification
  uid: string;
  
  // Identity (required fields)
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  
  // Contact
  phone?: string;
  showPhone?: boolean; // opt-in to display phone
  
  // Social links
  linkedin?: string;
  website?: string;
  twitter?: string;
  
  // Role & Organization
  title?: string;
  company?: string;
  /** Chapter (e.g. one of 9 global chapters); synced to HubSpot */
  chapter?: string | null;
  
  // Bio
  bioTitle?: string; // short description, max 60 chars
  bio?: string; // long description (plain or HTML), max 2000 chars
  skills?: string[]; // up to 12 tags, each 2-20 chars
  
  // Location
  city?: string;
  country?: string;
  timezone?: string; // IANA timezone
  
  // Avatar
  avatarUrl?: string | null;
  profileImage?: string | null; // legacy field for backward compatibility
  profileImagePublicId?: string | null; // Cloudinary public_id for delete
  /** Profile picture crop: legacy { scale, panX, panY } or normalized { x, y, width, height } 0..1 */
  profileImageCrop?: import('./crop').CropValue | null;
  /** Cover/background image for profile header (LinkedIn-style banner) */
  coverPhotoUrl?: string | null;
  /** Cover crop: legacy or normalized (same as profileImageCrop) */
  coverCrop?: import('./crop').CropValue | null;

  // Privacy & Visibility
  profileVisibility: ProfileVisibility;
  
  // System fields
  role: 'member' | 'admin';
  status: 'approved' | 'pending' | 'rejected' | 'active' | 'suspended'; // 'approved' is the canonical approved status
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
  joinedAt?: any; // Firestore timestamp
  profileImageUpdatedAt?: string;
  /** HubSpot contact id after sync */
  hubspotContactId?: string | null;
  hubspotLastSyncedAt?: any; // Firestore timestamp
  hubspotSyncStatus?: 'ok' | 'error' | 'pending';
  hubspotSyncError?: string;

  // Profile completion
  profileCompletionPercentage?: number;
  lastProfileUpdate?: any; // Firestore timestamp
}

export interface UserProfileForm {
  // Step 1: Profile Basics
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  
  // Step 2: About You  
  title: string;
  company: string;
  chapter: string;
  bioTitle: string;
  bio: string;
  skills: string[];
  
  // Step 3: Contact & Location
  phone: string;
  linkedin: string;
  website: string;
  twitter: string;
  city: string;
  country: string;
  timezone: string;
  showPhone: boolean;
  
  // Step 4: Privacy
  profileVisibility: ProfileVisibility;
}

export interface UserProfileUpdate extends Partial<UserProfile> {
  uid: string; // Always required for updates
}

export interface ProfileViewerRelationship {
  isAdmin: boolean;
  isOwner: boolean;
  isExplicitConnection: boolean;
  sharesEvent: boolean;
  eventIds: string[];
}

export interface UserDirectoryFilters {
  skills?: string[];
  country?: string;
  city?: string;
  company?: string;
  title?: string;
  search?: string;
  visibility?: ProfileVisibility[];
}

export interface UserCard {
  uid: string;
  id?: string; // For compatibility with some components
  avatarUrl?: string | null;
  profileImageCrop?: { scale: number; panX: number; panY: number } | null;
  displayName: string;
  name?: string; // For compatibility with some components
  firstName?: string;
  lastName?: string;
  email?: string; // May be included for admin searches
  title?: string;
  company?: string;
  city?: string;
  country?: string;
  bioTitle?: string;
  bio?: string;
  linkedin?: string;
  skills: string[];
  profileVisibility: ProfileVisibility;
  canContact: boolean;
  canConnect: boolean;
}

// Validation schemas
export interface ValidationRules {
  firstName: { required: true; minLength: 1; maxLength: 50 };
  lastName: { required: true; minLength: 1; maxLength: 50 };
  displayName: { required: true; minLength: 1; maxLength: 100 };
  email: { required: true; format: 'email' };
  phone: { format: 'e164' | 'local' };
  linkedin: { format: 'linkedin-url' };
  website: { format: 'url' };
  twitter: { format: 'url' };
  bioTitle: { maxLength: 60 };
  bio: { maxLength: 2000 };
  skills: { maxItems: 12; itemMinLength: 2; itemMaxLength: 20 };
  city: { maxLength: 100 };
  country: { maxLength: 100 };
  timezone: { format: 'iana-timezone' };
}

// Utility types
export type RequiredUserFields = 'firstName' | 'lastName' | 'displayName' | 'email';
export type OptionalUserFields = Exclude<keyof UserProfile, RequiredUserFields | 'uid' | 'role' | 'status' | 'createdAt' | 'updatedAt'>;

// Legacy compatibility
export interface LegacyUserData {
  name?: string;
  work?: string;
  position?: string;
  linkedinUsername?: string;
  profileImage?: string;
  // ... other legacy fields that need migration
}