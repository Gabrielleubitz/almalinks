import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/ui/BackButton';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Trash2,
  Users,
  Briefcase,
  CalendarCheck,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Zap,
  Download,
  X,
} from 'lucide-react';
import { apiRequest } from '../../utils/apiClient';
import HubspotLogo from '../../assets/hubspot-logo.svg';
import { DirectoryService } from '../../services/directoryService';

type ResultType = 'sync' | 'deals' | 'events' | 'remove' | 'delete';
interface LastResult {
  type: ResultType;
  ok: boolean;
  data: Record<string, unknown>;
  error?: string;
}

/** Response from POST /api/sync-hubspot-contacts (extended summary) */
interface HubspotContactsSyncSummary {
  ok?: boolean;
  totalUpserted?: number;
  totalHubspotContacts?: number;
  deletedUsers?: number;
  contactsWithoutEmail?: number;
  newAuthUsers?: number;
  reusedAuthUsers?: number;
  authErrors?: number;
  firestoreProfilesCreated?: number;
  firestoreProfilesUpdated?: number;
  propertiesRequested?: number;
  error?: string;
}

function buildContactsSyncModalLines(s: HubspotContactsSyncSummary): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const total =
    typeof s.totalHubspotContacts === 'number'
      ? s.totalHubspotContacts
      : typeof s.totalUpserted === 'number'
        ? s.totalUpserted
        : '—';
  lines.push({ label: 'HubSpot contacts processed', value: String(total) });
  if (typeof s.contactsWithoutEmail === 'number') {
    lines.push({ label: 'Contacts without email (Firestore only, no login)', value: String(s.contactsWithoutEmail) });
  }
  if (typeof s.newAuthUsers === 'number') {
    lines.push({ label: 'New Firebase accounts created', value: String(s.newAuthUsers) });
  }
  if (typeof s.reusedAuthUsers === 'number') {
    lines.push({ label: 'Existing logins matched by email', value: String(s.reusedAuthUsers) });
  }
  if (typeof s.authErrors === 'number' && s.authErrors > 0) {
    lines.push({ label: 'Auth errors (check server logs)', value: String(s.authErrors) });
  }
  if (typeof s.firestoreProfilesCreated === 'number') {
    lines.push({ label: 'New member profiles in Firestore', value: String(s.firestoreProfilesCreated) });
  }
  if (typeof s.firestoreProfilesUpdated === 'number') {
    lines.push({ label: 'Existing profiles updated / merged', value: String(s.firestoreProfilesUpdated) });
  }
  if (typeof s.deletedUsers === 'number' && s.deletedUsers > 0) {
    lines.push({ label: 'Duplicate HubSpot users removed (dedupe)', value: String(s.deletedUsers) });
  }
  if (typeof s.propertiesRequested === 'number') {
    lines.push({
      label: 'HubSpot fields requested per contact',
      value: String(s.propertiesRequested),
    });
  }
  return lines;
}

interface HubSpotContact {
  id: string;
  hubspotId?: string;
  email?: string | null;
  chapter?: string | null;
  properties?: Record<string, unknown>;
  syncedAt?: unknown;
}

interface HubSpotDeal {
  id: string;
  hubspotDealId?: string;
  properties?: Record<string, unknown>;
  syncedAt?: unknown;
}

interface ActionCard {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primaryLabel: string;
  loading: boolean;
  onPrimary: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  deleteLabel: string;
  deleteHelper?: string;
  color: string;
  bgIcon: string;
}

const HubSpotImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok?: boolean; totalUpserted?: number; error?: string } | null>(null);
  const [rebuildingDirectory, setRebuildingDirectory] = useState(false);
  const [directoryRebuildResult, setDirectoryRebuildResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncingDeals, setSyncingDeals] = useState(false);
  const [dealsResult, setDealsResult] = useState<Record<string, unknown> | null>(null);
  const [creatingFromDeals, setCreatingFromDeals] = useState(false);
  const [createFromDealsResult, setCreateFromDealsResult] = useState<Record<string, unknown> | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<Record<string, unknown> | null>(null);
  const [pullingAll, setPullingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingDeals, setDeletingDeals] = useState(false);
  const [deletingEventDeals, setDeletingEventDeals] = useState(false);
  const [deletingUsersOnly, setDeletingUsersOnly] = useState(false);
  const [deleteResult, setDeleteResult] = useState<Record<string, unknown> | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [showResultJson, setShowResultJson] = useState(false);
  /** Success modal after contact sync or full pull */
  const [syncSuccessModal, setSyncSuccessModal] = useState<{
    title: string;
    sections: { heading?: string; lines: { label: string; value: string }[] }[];
    footnote?: string;
  } | null>(null);

  const [contacts, setContacts] = useState<HubSpotContact[]>([]);
  const [deals, setDeals] = useState<HubSpotDeal[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    setListError(null);
    try {
      const res = await apiRequest('/api/hubspot-contacts', { method: 'GET' });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; contacts?: HubSpotContact[] };
      if (data.ok && Array.isArray(data.contacts)) setContacts(data.contacts);
      else setContacts([]);
    } catch {
      setListError('Failed to load contacts');
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    setLoadingDeals(true);
    setListError(null);
    try {
      const res = await apiRequest('/api/hubspot-deals', { method: 'GET' });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; deals?: HubSpotDeal[] };
      if (data.ok && Array.isArray(data.deals)) setDeals(data.deals);
      else setDeals([]);
    } catch {
      setListError('Failed to load deals');
      setDeals([]);
    } finally {
      setLoadingDeals(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchDeals();
  }, [fetchContacts, fetchDeals]);

  const deleteContact = async (id: string) => {
    setDeletingContactId(id);
    setListError(null);
    try {
      const res = await apiRequest(`/api/hubspot-contacts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (data.ok) setContacts((prev) => prev.filter((c) => c.id !== id));
      else {
        const msg = res.status === 403 ? (data.error || 'This record cannot be deleted here. Only HubSpot-imported records can be removed.') : (data.error || 'Delete failed');
        setListError(msg);
      }
    } catch {
      setListError('Delete request failed');
    } finally {
      setDeletingContactId(null);
    }
  };

  const exportContactsToCsv = () => {
    if (contacts.length === 0) return;
    const headers = ['id', 'email', 'firstname', 'lastname', 'chapter'];
    const rows = contacts.map((c) => {
      const rawEmail = c.email ?? (c.properties?.email as { value?: string } | string) ?? '';
      const email = typeof rawEmail === 'string' ? rawEmail : (rawEmail?.value ?? '') || c.id;
      const first = (c.properties?.firstname as { value?: string } | string) ?? '';
      const last = (c.properties?.lastname as { value?: string } | string) ?? '';
      const firstStr = typeof first === 'string' ? first : first?.value ?? '';
      const lastStr = typeof last === 'string' ? last : last?.value ?? '';
      const chapter = c.chapter ?? (c.properties?.chapter as { value?: string } | string);
      const chapterStr = typeof chapter === 'string' ? chapter : (chapter as { value?: string })?.value ?? '';
      return [c.id, email, firstStr, lastStr, chapterStr].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hubspot-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDealsToCsv = () => {
    if (deals.length === 0) return;
    const headers = ['id', 'dealname', 'hubspotDealId', 'syncedAt'];
    const rows = deals.map((d) => {
      const raw = d.properties?.dealname as { value?: string } | string | undefined;
      const name = (typeof raw === 'string' ? raw : raw?.value) ?? d.id;
      const synced = d.syncedAt ? (typeof d.syncedAt === 'object' && d.syncedAt !== null && 'toDate' in d.syncedAt ? (d.syncedAt as { toDate: () => Date }).toDate().toISOString() : String(d.syncedAt)) : '';
      return [d.id, name, d.hubspotDealId ?? '', synced].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hubspot-deals-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteDeal = async (id: string) => {
    setDeletingDealId(id);
    setListError(null);
    try {
      const res = await apiRequest(`/api/hubspot-deals/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (data.ok) setDeals((prev) => prev.filter((d) => d.id !== id));
      else {
        const msg = res.status === 403 ? (data.error || 'This record cannot be deleted here. Only HubSpot-imported records can be removed.') : (data.error || 'Delete failed');
        setListError(msg);
      }
    } catch {
      setListError('Delete request failed');
    } finally {
      setDeletingDealId(null);
    }
  };

  const setResult = (type: ResultType, ok: boolean, data: Record<string, unknown>, error?: string) => {
    setLastResult({ type, ok, data, error });
  };

  const rebuildMemberDirectory = async () => {
    setRebuildingDirectory(true);
    setDirectoryRebuildResult(null);
    try {
      await DirectoryService.bulkUpdateDirectory(30);
      setDirectoryRebuildResult({ ok: true, message: 'Member directory rebuilt — all profile pictures and fields updated.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rebuild failed';
      setDirectoryRebuildResult({ ok: false, message: msg });
    } finally {
      setRebuildingDirectory(false);
    }
  };

  const syncHubspotContacts = async () => {
    setSyncing(true);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
    setRemoveResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/sync-hubspot-contacts', {
        method: 'POST',
        body: JSON.stringify({ dedupeByEmail: true, fullResync: false }),
      });
      const data = await res.json().catch(() => ({})) as HubspotContactsSyncSummary & Record<string, unknown>;
      setSyncResult(data);
      const dataOk = data.ok !== false && !data.error;
      setResult('sync', res.ok && dataOk, data as Record<string, unknown>, data.error);
      if (res.ok && dataOk) {
        fetchContacts();
        setSyncSuccessModal({
          title: 'Contacts sync complete',
          sections: [{ lines: buildContactsSyncModalLines(data) }],
          footnote:
            'Profile fields synced from HubSpot include photo URL, short bio (bio title), long bio, chapter, city, state, country, timezone, LinkedIn, and other properties stored on each user (see hubspotContactProperties).',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setSyncResult({ ok: false, error: msg });
      setResult('sync', false, {}, msg);
    } finally {
      setSyncing(false);
    }
  };

  const syncHubspotDeals = async () => {
    setSyncingDeals(true);
    setDealsResult(null);
    setSyncResult(null);
    setCreateFromDealsResult(null);
    setRemoveResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/sync-hubspot-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setDealsResult(data);
      setResult('deals', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
      if (res.ok) fetchDeals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setDealsResult({ ok: false, error: msg });
      setResult('deals', false, {}, msg);
    } finally {
      setSyncingDeals(false);
    }
  };

  const removeHubspotUsers = async () => {
    if (!window.confirm('This will remove HubSpot-imported data from Firebase only. HubSpot data will NOT be affected.\n\nRemove only users imported from HubSpot (and clear their contact/deal/event records in Firebase). Your account and other admins will never be removed. Continue?')) return;
    setRemoving(true);
    setRemoveResult(null);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/remove-hubspot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeContacts: true }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setRemoveResult(data);
      setResult('remove', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
      if (res.ok) {
        fetchContacts();
        fetchDeals();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setRemoveResult({ ok: false, error: msg });
      setResult('remove', false, {}, msg);
    } finally {
      setRemoving(false);
    }
  };

  const createEventsFromDeals = async () => {
    setCreatingFromDeals(true);
    setCreateFromDealsResult(null);
    setSyncResult(null);
    setDealsResult(null);
    setRemoveResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/create-events-from-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setCreateFromDealsResult(data);
      setResult('events', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setCreateFromDealsResult({ ok: false, error: msg });
      setResult('events', false, {}, msg);
    } finally {
      setCreatingFromDeals(false);
    }
  };

  const pullAll = async () => {
    setPullingAll(true);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
    setRemoveResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const syncRes = await apiRequest('/api/sync-hubspot-contacts', {
        method: 'POST',
        body: JSON.stringify({ dedupeByEmail: true, fullResync: false }),
      });
      const syncData = await syncRes.json().catch(() => ({})) as HubspotContactsSyncSummary & Record<string, unknown>;
      setSyncResult(syncData);
      const dealsRes = await apiRequest('/api/sync-hubspot-deals', { method: 'POST' });
      const dealsData = await dealsRes.json().catch(() => ({})) as Record<string, unknown>;
      setDealsResult(dealsData);
      const eventsRes = await apiRequest('/api/create-events-from-deals', { method: 'POST' });
      const eventsData = await eventsRes.json().catch(() => ({})) as Record<string, unknown>;
      setCreateFromDealsResult(eventsData);
      const syncOk = syncRes.ok && syncData.ok !== false && !syncData.error;
      const dealsOk = dealsRes.ok && (dealsData as { ok?: boolean }).ok !== false;
      const eventsOk = eventsRes.ok && (eventsData as { ok?: boolean }).ok !== false;
      setLastResult({
        type: 'events',
        ok: syncOk && dealsOk && eventsOk,
        data: { sync: syncData, deals: dealsData, events: eventsData },
      });
      if (syncOk && dealsOk && eventsOk) {
        fetchContacts();
        fetchDeals();
        const dealCount =
          typeof dealsData.totalUpserted === 'number' ? String(dealsData.totalUpserted) : '—';
        const ev = eventsData as { created?: number; skipped?: number; totalDeals?: number };
        setSyncSuccessModal({
          title: 'Pull all complete',
          sections: [
            { heading: 'Contacts', lines: buildContactsSyncModalLines(syncData) },
            {
              heading: 'Deals',
              lines: [{ label: 'Deals imported to Firestore', value: dealCount }],
            },
            {
              heading: 'Past events from deals',
              lines: [
                { label: 'Events created', value: typeof ev.created === 'number' ? String(ev.created) : '—' },
                { label: 'Skipped (already had event)', value: typeof ev.skipped === 'number' ? String(ev.skipped) : '—' },
                {
                  label: 'Deals considered',
                  value: typeof ev.totalDeals === 'number' ? String(ev.totalDeals) : '—',
                },
              ],
            },
          ],
          footnote:
            'Contacts: photo, bios, chapter, location, and other HubSpot fields are merged into member profiles. Check warnings in the expanded result if event counts look off.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setSyncResult({ ok: false, error: msg });
      setLastResult({ type: 'sync', ok: false, data: {}, error: msg });
    } finally {
      setPullingAll(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('This will delete only users imported from HubSpot.\n\nRemoves HubSpot-imported users and their contact/deal/event data from Firebase only. HubSpot data will NOT be affected. Your account and other admins are never deleted. This cannot be undone. Continue?')) return;
    setDeletingAll(true);
    setRemoveResult(null);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const removeRes = await apiRequest('/api/remove-hubspot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeContacts: true }),
      });
      const removeData = await removeRes.json().catch(() => ({})) as Record<string, unknown>;
      setRemoveResult(removeData);
      const eventsRes = await apiRequest('/api/remove-events-from-deals', { method: 'POST' });
      const eventsData = await eventsRes.json().catch(() => ({})) as Record<string, unknown>;
      setDeleteResult(eventsData);
      setLastResult({
        type: 'remove',
        ok: removeRes.ok && !(removeData as { error?: string }).error,
        data: { remove: removeData, eventsDeleted: eventsData },
      });
      if (removeRes.ok) {
        fetchContacts();
        fetchDeals();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setRemoveResult({ ok: false, error: msg });
      setLastResult({ type: 'remove', ok: false, data: {}, error: msg });
    } finally {
      setDeletingAll(false);
    }
  };

  const clearDealsOnly = async () => {
    if (!window.confirm('This will remove HubSpot-imported data from Firebase only. HubSpot data will NOT be affected.\n\nClear only imported deals (HubSpot-originated records). Continue?')) return;
    setDeletingDeals(true);
    setDealsResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/clear-hubspot-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setDeleteResult(data);
      setResult('delete', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
      if (res.ok) fetchDeals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setDeleteResult({ ok: false, error: msg });
      setResult('delete', false, {}, msg);
    } finally {
      setDeletingDeals(false);
    }
  };

  const removeEventsFromDealsOnly = async () => {
    if (!window.confirm('This will remove HubSpot-imported data from Firebase only. HubSpot data will NOT be affected.\n\nRemove only past events that were created from HubSpot deals. Continue?')) return;
    setDeletingEventDeals(true);
    setCreateFromDealsResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/remove-events-from-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setDeleteResult(data);
      setResult('delete', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setDeleteResult({ ok: false, error: msg });
      setResult('delete', false, {}, msg);
    } finally {
      setDeletingEventDeals(false);
    }
  };

  const removeUsersOnly = async () => {
    if (!window.confirm('This will remove HubSpot-imported data from Firebase only. HubSpot data will NOT be affected.\n\nRemove only users imported from HubSpot. Your account and admins are never removed. Deals and past events will stay. Continue?')) return;
    setDeletingUsersOnly(true);
    setSyncResult(null);
    setRemoveResult(null);
    setDeleteResult(null);
    setLastResult(null);
    try {
      const res = await apiRequest('/api/remove-hubspot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeContacts: false }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      setRemoveResult(data);
      setResult('remove', res.ok && !(data as { error?: string }).error, data, (data as { error?: string }).error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setRemoveResult({ ok: false, error: msg });
      setResult('remove', false, {}, msg);
    } finally {
      setDeletingUsersOnly(false);
    }
  };

  const busy = syncing || syncingDeals || creatingFromDeals || removing || pullingAll || deletingAll || deletingDeals || deletingEventDeals || deletingUsersOnly;

  const actionCards: ActionCard[] = [
    {
      id: 'sync',
      icon: Users,
      title: 'Sync contacts',
      description: 'Import all HubSpot CRM contacts as AlmaLinks users with logins.',
      primaryLabel: 'Sync HubSpot → AlmaLinks',
      loading: syncing,
      onPrimary: syncHubspotContacts,
      onDelete: removeUsersOnly,
      deleteLabel: 'Remove imported HubSpot users (Firebase only)',
      deleteHelper: 'Only users with importedFrom=hubspot are removed. Native users and admins are never touched.',
      color: 'text-brand-dark',
      bgIcon: 'bg-brand-light',
    },
    {
      id: 'deals',
      icon: Briefcase,
      title: 'Import deals',
      description: 'Copy pipeline deals from HubSpot into AlmaLinks.',
      primaryLabel: 'Import HubSpot Deals',
      loading: syncingDeals,
      onPrimary: syncHubspotDeals,
      onDelete: clearDealsOnly,
      deleteLabel: 'Clear imported HubSpot deals (Firebase only)',
      deleteHelper: 'Only HubSpot-imported deal records in Firebase. HubSpot is not affected.',
      color: 'text-blue-600',
      bgIcon: 'bg-blue-50',
    },
    {
      id: 'events',
      icon: CalendarCheck,
      title: 'Past events from deals',
      description: 'Turn each deal into a completed past event on the Events page.',
      primaryLabel: 'Create past events',
      loading: creatingFromDeals,
      onPrimary: createEventsFromDeals,
      onDelete: removeEventsFromDealsOnly,
      deleteLabel: 'Remove imported HubSpot events (Firebase only)',
      deleteHelper: 'Only events created from HubSpot deals. Native events are never touched.',
      color: 'text-emerald-600',
      bgIcon: 'bg-emerald-50',
    },
    {
      id: 'remove',
      icon: UserMinus,
      title: 'Remove HubSpot users',
      description: 'Remove only users explicitly marked as imported from HubSpot (importedFrom=hubspot). Your account and other admins are never removed.',
      primaryLabel: 'Remove users & data',
      loading: removing,
      onPrimary: removeHubspotUsers,
      onDelete: deleteAll,
      deleteLabel: 'Delete all HubSpot users (Firebase only)',
      deleteHelper: 'Deletes only HubSpot-imported users and their contact/deal/event data in Firebase. HubSpot is not affected.',
      color: 'text-red-600',
      bgIcon: 'bg-red-50',
    },
  ];

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-8">
          <BackButton fallbackTo="/admin" />
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-r from-brand-light to-blue-50 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm border border-gray-100">
              <img src={HubspotLogo} alt="HubSpot" className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Import from <span className="text-brand-dark">HubSpot</span>
              </h1>
              <p className="text-gray-600 text-sm sm:text-base mt-1 max-w-xl">
                Bring contacts and deals from HubSpot into AlmaLinks. Sync people as users, then turn deals into past events.
              </p>
            </div>
          </div>
        </div>

        {/* How it works — compact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">How it works</h2>
          <ol className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-sm font-semibold">1</span>
              <div>
                <span className="font-medium text-gray-900">Sync contacts</span>
                <p className="text-sm text-gray-600 mt-0.5">
                  Everyone in HubSpot gets a login. They sign in with HubSpot email and the default password <span className="font-medium text-gray-900">123456789</span>.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-sm font-semibold">2</span>
              <div>
                <span className="font-medium text-gray-900">Import deals</span>
                <p className="text-sm text-gray-600 mt-0.5">Deals are copied into AlmaLinks. Use &quot;Create past events&quot; to show them on the Events page.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-sm font-semibold">3</span>
              <div>
                <span className="font-medium text-gray-900">Past events</span>
                <p className="text-sm text-gray-600 mt-0.5">Each deal becomes a completed event. Re-running skips deals that already have an event.</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Primary actions: Pull all / Delete all */}
        <div className="flex flex-wrap gap-3 mb-2">
          <button
            onClick={pullAll}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-xl font-medium shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {pullingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Pull all (contacts + deals + events)
          </button>
          <button
            onClick={deleteAll}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-3 border-2 border-red-200 text-red-700 bg-red-50/50 rounded-xl font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {deletingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete all HubSpot users (Firebase only)
          </button>
        </div>
        <p className="text-gray-500 text-xs mb-6">
          Destructive buttons remove only HubSpot-imported data from Firebase. HubSpot CRM is never modified.
        </p>

        {syncSuccessModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hubspot-sync-success-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSyncSuccessModal(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" aria-hidden />
                  <h2 id="hubspot-sync-success-title" className="text-lg font-semibold text-gray-900">
                    {syncSuccessModal.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncSuccessModal(null)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-6">
                {syncSuccessModal.sections.map((section, idx) => (
                  <div key={idx}>
                    {section.heading && (
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">{section.heading}</h3>
                    )}
                    <ul className="space-y-2">
                      {section.lines.map((line, j) => (
                        <li key={j} className="flex justify-between gap-4 text-sm">
                          <span className="text-gray-600">{line.label}</span>
                          <span className="font-medium text-gray-900 text-right tabular-nums">{line.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {syncSuccessModal.footnote && (
                  <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
                    {syncSuccessModal.footnote}
                  </p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setSyncSuccessModal(null)}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action cards grid */}
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
          <strong className="font-semibold">Large directories:</strong> syncing 500+ contacts can take several minutes. Keep this tab open until the{' '}
          <strong>success summary</strong> appears — that confirms the run finished.
        </p>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Step-by-step</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="group bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-all duration-200 flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${card.bgIcon} ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{card.title}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm mt-0.5">{card.description}</p>
                  </div>
                </div>
                <div className="mt-auto space-y-2">
                  <button
                    onClick={card.onPrimary}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {card.loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      card.primaryLabel
                    )}
                  </button>
                  <div className="space-y-1">
                    <button
                      onClick={card.onDelete}
                      disabled={busy}
                      title={card.deleteLabel}
                      className="w-full opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-100 text-xs font-medium transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {card.deleteLabel}
                    </button>
                    {card.deleteHelper && (
                      <p className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {card.deleteHelper}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rebuild member directory */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Rebuild member directory</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Re-indexes all members so the directory shows the latest profile pictures, names, and fields from Firestore (including pictures pulled from HubSpot). Run this after syncing contacts.
              </p>
            </div>
          </div>
          {directoryRebuildResult && (
            <div className={`mb-3 p-3 rounded-lg text-sm ${directoryRebuildResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {directoryRebuildResult.message}
            </div>
          )}
          <button
            type="button"
            onClick={rebuildMemberDirectory}
            disabled={rebuildingDirectory}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {rebuildingDirectory ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Rebuilding…</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Rebuild member directory</span>
              </>
            )}
          </button>
        </div>

        {listError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {listError}
          </div>
        )}

        {/* Imported contacts list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">Imported contacts</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportContactsToCsv}
                disabled={contacts.length === 0}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-gray-100"
                title="Export contacts to CSV"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={fetchContacts}
                disabled={loadingContacts}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                {loadingContacts ? <RefreshCw className="h-4 w-4 animate-spin inline" /> : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loadingContacts && contacts.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">No contacts imported yet. Use &quot;Sync HubSpot → AlmaLinks&quot; above.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const rawEmail = c.email ?? (c.properties?.email as { value?: string } | string) ?? '';
                  const email = typeof rawEmail === 'string' ? rawEmail : (rawEmail?.value ?? '') || c.id;
                  const first = (c.properties?.firstname as { value?: string } | string) ?? '';
                  const last = (c.properties?.lastname as { value?: string } | string) ?? '';
                  const firstStr = typeof first === 'string' ? first : first?.value ?? '';
                  const lastStr = typeof last === 'string' ? last : last?.value ?? '';
                  const name = [firstStr, lastStr].filter(Boolean).join(' ') || null;
                  const chapter = c.chapter ?? (c.properties?.chapter as { value?: string } | string);
                  const chapterStr = typeof chapter === 'string' ? chapter : (chapter as { value?: string })?.value ?? '';
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate block">{name || email}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {name && <span className="text-sm text-gray-500 truncate">{email}</span>}
                          {chapterStr && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand-dark font-medium" title="Chapter">
                              {chapterStr}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteContact(c.id)}
                        disabled={deletingContactId !== null}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Remove imported HubSpot record (Firebase only)"
                      >
                        {deletingContactId === c.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Imported deals list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">Imported deals</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportDealsToCsv}
                disabled={deals.length === 0}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-gray-100"
                title="Export deals to CSV"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={fetchDeals}
                disabled={loadingDeals}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                {loadingDeals ? <RefreshCw className="h-4 w-4 animate-spin inline" /> : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loadingDeals && deals.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">Loading…</div>
            ) : deals.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">No deals imported yet. Use &quot;Import HubSpot Deals&quot; above.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {deals.map((d) => {
                  const raw = d.properties?.dealname as { value?: string } | string | undefined;
                  const name = (typeof raw === 'string' ? raw : raw?.value) ?? d.id;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate block">{name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteDeal(d.id)}
                        disabled={deletingDealId !== null}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Remove imported HubSpot record (Firebase only)"
                      >
                        {deletingDealId === d.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Single results area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowResultJson(!showResultJson)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {lastResult ? (
                lastResult.ok ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                )
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
              )}
              <div className="text-left">
                <span className="font-medium text-gray-900">
                  {lastResult ? (lastResult.ok ? 'Last action completed' : 'Last action had an error') : 'No action run yet'}
                </span>
                {lastResult?.error && (
                  <p className="text-sm text-red-600 mt-0.5">{lastResult.error}</p>
                )}
                {lastResult?.ok && (
                  <p className="text-sm text-gray-600 mt-0.5">See details below (expand for full response).</p>
                )}
              </div>
            </div>
            {lastResult && (
              <span className="text-gray-400">
                {showResultJson ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </span>
            )}
          </button>
          {lastResult && showResultJson && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
              <pre className="text-xs overflow-auto max-h-48 p-3 bg-white rounded-lg border border-gray-100">
                {JSON.stringify(lastResult.data, null, 2)}
              </pre>
            </div>
          )}
          {!lastResult && (
            <div className="px-5 py-6 text-center text-gray-500 text-sm border-t border-gray-100">
              Run an action above to see the result here.
            </div>
          )}
        </div>

        <p className="mt-4 text-gray-500 text-xs">
          If sync fails, check that HubSpot is connected in your project settings (e.g. HUBSPOT_ACCESS_TOKEN).
        </p>
      </div>
    </div>
  );
};

export default HubSpotImportPage;
