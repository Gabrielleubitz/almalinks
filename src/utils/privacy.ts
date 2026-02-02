import { UserProfile, ProfileViewerRelationship, ProfileVisibility } from '../types/user';

export interface FilteredProfile extends Omit<UserProfile, 'email' | 'phone'> {
  email?: string; // Only included if viewer has permission
  phone?: string; // Only included if viewer has permission and user opted in
  canViewContact: boolean;
  canViewPhone: boolean;
  canConnect: boolean;
  canMessage: boolean;
}

/**
 * Determine viewer's relationship to the profile owner
 */
export const getViewerRelationship = async (
  viewerUid: string | null,
  profileUid: string,
  viewerRole?: string,
  explicitConnections?: string[],
  sharedEvents?: string[]
): Promise<ProfileViewerRelationship> => {
  const isAdmin = viewerRole === 'admin';
  const isOwner = viewerUid === profileUid;
  const isExplicitConnection = explicitConnections?.includes(profileUid) || false;
  const sharesEvent = (sharedEvents?.length || 0) > 0;
  
  return {
    isAdmin,
    isOwner,
    isExplicitConnection,
    sharesEvent,
    eventIds: sharedEvents || []
  };
};

/**
 * Filter profile data based on viewer relationship and privacy settings
 */
export const filterProfileForViewer = (
  profile: UserProfile,
  relationship: ProfileViewerRelationship
): FilteredProfile => {
  const { isAdmin, isOwner, isExplicitConnection, sharesEvent } = relationship;
  const { profileVisibility, showPhone = false } = profile;
  
  // Base profile that's always visible (to some degree)
  const baseProfile: FilteredProfile = {
    uid: profile.uid,
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    title: profile.title,
    company: profile.company,
    bioTitle: profile.bioTitle,
    bio: profile.bio,
    skills: profile.skills,
    city: profile.city,
    country: profile.country,
    timezone: profile.timezone,
    avatarUrl: profile.avatarUrl,
    profileImage: profile.profileImage,
    profileImageCrop: profile.profileImageCrop,
    coverPhotoUrl: profile.coverPhotoUrl,
    coverCrop: profile.coverCrop,
    profileVisibility: profile.profileVisibility,
    role: profile.role,
    status: profile.status,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    joinedAt: profile.joinedAt,
    profileImageUpdatedAt: profile.profileImageUpdatedAt,
    profileCompletionPercentage: profile.profileCompletionPercentage,
    lastProfileUpdate: profile.lastProfileUpdate,
    canViewContact: false,
    canViewPhone: false,
    canConnect: false,
    canMessage: false,
    // Include legacy fields for backward compatibility
    ...(profile as any)
  };
  
  // All users can view all profile information for better networking
  let canViewContact = true; // Everyone can see contact info
  let canViewPhone = showPhone; // Respect user's phone sharing preference
  let canConnect = true; // Everyone can connect
  let canMessage = true; // Everyone can message
  
  // Only restrict for hidden profiles and non-connections
  if (!isOwner && !isAdmin && profileVisibility === 'hidden' && !isExplicitConnection) {
    canViewContact = false;
    canViewPhone = false;
    canConnect = false;
    canMessage = false;
  }
  
  // Add contact info if permitted
  if (canViewContact) {
    baseProfile.email = profile.email;
  }
  
  if (canViewPhone) {
    baseProfile.phone = profile.phone;
  }
  
  // Social links follow the same visibility as contact info
  if (canViewContact) {
    baseProfile.linkedin = profile.linkedin;
    baseProfile.website = profile.website;
    baseProfile.twitter = profile.twitter;
  }
  
  // Set permission flags
  baseProfile.canViewContact = canViewContact;
  baseProfile.canViewPhone = canViewPhone;
  baseProfile.canConnect = canConnect;
  baseProfile.canMessage = canMessage;
  
  return baseProfile;
};

/**
 * Check if a profile should be visible in directory listings
 */
export const isProfileVisibleInDirectory = (
  profile: UserProfile,
  relationship: ProfileViewerRelationship
): boolean => {
  const { isAdmin, isOwner, isExplicitConnection, sharesEvent } = relationship;
  const { profileVisibility } = profile;
  
  if (isOwner || isAdmin) {
    return true; // Owners and admins can always see profiles
  }
  
  switch (profileVisibility) {
    case 'public':
      return true; // Public profiles are always visible in directory
      
    case 'event_only':
      return isExplicitConnection || sharesEvent; // Only visible to connected users
      
    case 'hidden':
      return isExplicitConnection; // Only visible to explicit connections
      
    default:
      return false;
  }
};

/**
 * Get visibility description for UI
 */
export const getVisibilityDescription = (visibility: ProfileVisibility): string => {
  switch (visibility) {
    case 'public':
      return 'Visible to everyone on the platform. Your profile appears in the directory and can be found by anyone.';
      
    case 'event_only':
      return 'Visible to people you share events with and your connections. Your profile will not appear in public searches.';
      
    case 'hidden':
      return 'Only visible to your direct connections and admins. Your profile will not appear in any public listings.';
      
    default:
      return '';
  }
};

/**
 * Get contact permission explanation
 */
export const getContactPermissionExplanation = (
  canViewContact: boolean,
  canViewPhone: boolean,
  profileVisibility: ProfileVisibility,
  relationship: ProfileViewerRelationship
): string => {
  const { isOwner, isAdmin, isExplicitConnection, sharesEvent } = relationship;
  
  if (isOwner) {
    return "This is your profile";
  }
  
  if (isAdmin) {
    return "Visible to you as an admin";
  }
  
  if (!canViewContact) {
    switch (profileVisibility) {
      case 'event_only':
        return sharesEvent 
          ? "Contact info visible because you share an event"
          : isExplicitConnection
          ? "Contact info visible because you're connected"
          : "Contact info hidden. Connect or share an event to view.";
          
      case 'hidden':
        return isExplicitConnection
          ? "Contact info visible because you're connected"
          : "Contact info hidden. User has a private profile.";
          
      default:
        return "Contact info not available";
    }
  }
  
  let explanation = "Contact info is visible";
  
  if (!canViewPhone && profileVisibility === 'public') {
    explanation += " (phone number hidden by user preference)";
  }
  
  return explanation;
};

/**
 * Sanitize user input to prevent XSS and other security issues
 */
export const sanitizeUserInput = (input: string): string => {
  if (!input) return '';
  
  // Basic HTML entity encoding
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

/**
 * Generate profile completion suggestions
 */
export const getProfileCompletionSuggestions = (profile: UserProfile): string[] => {
  const suggestions: string[] = [];
  
  if (!profile.avatarUrl && !profile.profileImage) {
    suggestions.push("Add a profile picture to help others recognize you");
  }
  
  if (!profile.bioTitle) {
    suggestions.push("Add a short bio title to introduce yourself");
  }
  
  if (!profile.bio) {
    suggestions.push("Write a bio to tell others about yourself");
  }
  
  if (!profile.title) {
    suggestions.push("Add your job title or role");
  }
  
  if (!profile.company) {
    suggestions.push("Add your company or organization");
  }
  
  if (!profile.skills || profile.skills.length === 0) {
    suggestions.push("Add skills to help others find you");
  }
  
  if (!profile.city || !profile.country) {
    suggestions.push("Add your location to connect with nearby people");
  }
  
  if (!profile.linkedin && !profile.website) {
    suggestions.push("Add professional links to expand your network");
  }
  
  return suggestions;
};