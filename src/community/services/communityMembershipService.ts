import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../../firebase/config';
import type { CommunityMembership, CommunityMembershipRole } from '../types';

const COLLECTION = 'communityMemberships';

function mapMembership(docId: string, data: any): CommunityMembership {
  return {
    id: docId,
    groupId: String(data.groupId),
    userId: String(data.userId),
    role: (data.role as CommunityMembershipRole) || 'member',
    joinedAt: data.joinedAt,
    approvedAt: data.approvedAt,
    archivedAt: data.archivedAt,
  };
}

export async function listCommunityMembershipsForUser(userId: string): Promise<CommunityMembership[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('archivedAt', '==', null)
  );

  const snap = await retryOnNetworkFailure(() => getDocs(q));
  return snap.docs.map((d) => mapMembership(d.id, d.data()));
}

