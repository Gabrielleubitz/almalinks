export type CommunityMembershipRole = 'member' | 'manager';

export interface CommunityMembership {
  id: string;
  groupId: string;
  userId: string;
  role: CommunityMembershipRole;
  joinedAt?: any;
  approvedAt?: any;
  archivedAt?: any;
}

