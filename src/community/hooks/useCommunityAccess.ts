import * as React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isCommunityEnabled } from '../config';
import { listCommunityMembershipsForUser } from '../services/communityMembershipService';
import type { CommunityMembership } from '../types';

export function useCommunityAccess() {
  const { user } = useAuth();
  const enabled = isCommunityEnabled();

  const [memberships, setMemberships] = React.useState<CommunityMembership[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled || !user?.uid) {
        setMemberships([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await listCommunityMembershipsForUser(user.uid);
        if (!cancelled) setMemberships(data);
      } catch (e: any) {
        if (!cancelled) setError(e instanceof Error ? e : new Error('Failed to load community memberships'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.uid]);

  const groupIds = React.useMemo(() => memberships.map((m) => m.groupId), [memberships]);
  const isManager = React.useMemo(() => memberships.some((m) => m.role === 'manager'), [memberships]);

  return {
    enabled,
    loading,
    error,
    memberships,
    groupIds,
    isManager,
    hasAnyMembership: memberships.length > 0,
  };
}

