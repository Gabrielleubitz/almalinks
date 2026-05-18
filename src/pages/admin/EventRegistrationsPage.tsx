import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { auth } from '../../firebase/config';
import {
  Calendar,
  UserPlus,
  Download,
  Search,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { EventService } from '../../services/eventService';
import { listPendingRegistrations, listEventRegistrations, approve, reject } from '../../services/registrationService';
import type { EventRegistrationWithStatus, EventPrivateDetails } from '../../types/event';
import { useAuth } from '../../hooks/useAuth';
import { approvedEventPrimaryLocation, approvedEventVenueAddress } from '../../utils/eventPrivateLocation';
import { shortEventRegistrationLabel } from '../../utils/eventRegistrationDisplay';
import { buildRegistrationsCsv, downloadCsv } from '../../utils/exportRegistrationsCsv';

type RegistrationRow = EventRegistrationWithStatus & {
  eventId: string;
  eventName?: string;
  eventDate?: string;
  eventSlug?: string;
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

function formatDate(d: any): string {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleString();
}

const EventRegistrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string; date: string; slug?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [bulkActing, setBulkActing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ reg: RegistrationRow; reason: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  /** When filtering by one event, show public + approved-only venue info for admins. */
  const [eventVenueBanner, setEventVenueBanner] = useState<{
    publicLocation: string;
    privateDetails: EventPrivateDetails | null;
  } | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadRows();
  }, [statusFilter, eventFilter]);

  const loadEvents = async () => {
    try {
      const list = await EventService.getAllEvents();
      setEvents(list.map((e) => ({ id: e.id, name: e.name, date: e.date, slug: e.slug })));
    } catch (e) {
      console.error(e);
    }
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      if (eventFilter) {
        const [list, ev] = await Promise.all([
          listEventRegistrations(eventFilter, {
            status: statusFilter as 'pending' | 'approved' | 'rejected',
          }),
          EventService.getEventById(eventFilter, { skipAudienceVisibility: true }),
        ]);
        const priv = await EventService.getEventPrivateDetails(eventFilter);
        setEventVenueBanner({
          publicLocation: ev?.location ?? '',
          privateDetails: priv,
        });
        setRows(
          list.map((r) => ({
            ...r,
            eventId: eventFilter,
            eventName: ev?.name ?? '',
            eventDate: ev?.date ?? '',
            eventSlug: ev?.slug ?? '',
          }))
        );
      } else {
        setEventVenueBanner(null);
        const list = await listPendingRegistrations({
          status: statusFilter as 'pending' | 'approved' | 'rejected',
          limit: 300,
        });
        const eventMap = new Map(events.map((e) => [e.id, e]));
        setRows(
          list.map((r) => {
            const ev = eventMap.get(r.eventId);
            return {
              ...r,
              eventName: ev?.name,
              eventDate: ev?.date,
              eventSlug: ev?.slug,
            };
          })
        );
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to load registrations', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventFilter) loadRows();
    else if (events.length > 0) loadRows();
  }, [statusFilter, eventFilter, events.length]);

  const filteredRows = search.trim()
    ? rows.filter(
        (r) =>
          r.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.email?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      const nameCmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (nameCmp !== 0) return sortDir === 'asc' ? nameCmp : -nameCmp;
      const eventCmp = (a.eventName || a.eventId).localeCompare(b.eventName || b.eventId);
      return sortDir === 'asc' ? eventCmp : -eventCmp;
    });
    return list;
  }, [filteredRows, sortDir]);

  const memberGroups = useMemo(() => {
    const map = new Map<string, RegistrationRow[]>();
    for (const row of sortedRows) {
      const key = row.userId || row.email || row.name || 'unknown';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([memberKey, registrations]) => ({
      memberKey,
      memberName: registrations[0]?.name || 'Unknown',
      memberEmail: registrations[0]?.email || '',
      registrations,
    }));
  }, [sortedRows]);

  const handleExportCsv = () => {
    const csv = buildRegistrationsCsv(sortedRows, { includeEvent: !eventFilter });
    const slug =
      eventFilter && events.find((e) => e.id === eventFilter)?.name
        ? events.find((e) => e.id === eventFilter)!.name.replace(/[^\w-]+/g, '-').slice(0, 40)
        : 'all-events';
    downloadCsv(`registrations-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleApprove = async (reg: RegistrationRow) => {
    if (!user?.uid) return;
    setActing(reg.userId);
    try {
      await approve(reg.eventId, reg.userId, user.uid);
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch('/api/event-registration-approved-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: reg.eventId, userId: reg.userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setToast({ message: 'Approved & email sent', type: 'success' });
      } else {
        setToast({ message: data.error || 'Approved but email failed', type: 'error' });
      }
      await loadRows();
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(`${reg.eventId}_${reg.userId}`);
        return next;
      });
    } catch (e: any) {
      setToast({ message: e?.message || 'Approve failed', type: 'error' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (reg: RegistrationRow, reason: string) => {
    if (!user?.uid) return;
    setActing(reg.userId);
    try {
      await reject(reg.eventId, reg.userId, user.uid, reason || undefined);
      setToast({ message: 'Rejected', type: 'success' });
      setRejectModal(null);
      await loadRows();
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(`${reg.eventId}_${reg.userId}`);
        return next;
      });
    } catch (e: any) {
      setToast({ message: e?.message || 'Reject failed', type: 'error' });
    } finally {
      setActing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (!user?.uid || selectedIds.size === 0) return;
    setBulkActing(true);
    let sent = 0;
    let failed = 0;
    try {
      const token = await getIdToken(auth.currentUser!);
      for (const key of selectedIds) {
        const [eventId, userId] = key.split('_');
        const reg = rows.find((r) => r.eventId === eventId && r.userId === userId);
        if (!reg || reg.status !== 'pending') continue;
        try {
          await approve(eventId, userId, user.uid);
          const res = await fetch('/api/event-registration-approved-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ eventId, userId }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) sent++;
          else failed++;
        } catch {
          failed++;
        }
      }
      setToast({
        message: `Approved ${sent} registration(s)${failed ? `; ${failed} email(s) failed` : ''}.`,
        type: failed && sent === 0 ? 'error' : 'success',
      });
      setSelectedIds(new Set());
      await loadRows();
    } finally {
      setBulkActing(false);
    }
  };

  const toggleSelect = (eventId: string, userId: string) => {
    const key = `${eventId}_${userId}`;
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllPending = () => {
    const pending = sortedRows.filter((r) => r.status === 'pending');
    if (selectedIds.size === pending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map((r) => `${r.eventId}_${r.userId}`)));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <p className="text-sm text-gray-600 mb-4">
        Grouped by member, then event (event date only — not the full title). Use{' '}
        <strong>Download CSV</strong> to export the filtered list.
      </p>
      {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sort {sortDir === 'asc' ? 'A→Z' : 'Z→A'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sortedRows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>

        {eventVenueBanner && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/90 p-4 text-sm text-gray-800">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-blue-dark flex-shrink-0" />
              Location for this event (approved registrants receive full address in email and calendar)
            </div>
            <p>
              <span className="text-gray-500">Public listing: </span>
              {eventVenueBanner.publicLocation?.trim() || '—'}
            </p>
            {eventVenueBanner.privateDetails && (
              <>
                <p className="mt-2">
                  <span className="text-gray-500">Approved-only address: </span>
                  <span className="whitespace-pre-wrap font-medium">
                    {approvedEventVenueAddress(eventVenueBanner.privateDetails) || '—'}
                  </span>
                </p>
                <p className="mt-1">
                  <span className="text-gray-500">Private location line: </span>
                  {approvedEventPrimaryLocation(eventVenueBanner.publicLocation, eventVenueBanner.privateDetails) || '—'}
                </p>
              </>
            )}
          </div>
        )}

        {/* Bulk actions */}
        {statusFilter === 'pending' && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkApprove}
              disabled={bulkActing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {bulkActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve selected & send details
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-600">Loading registrations...</p>
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>No registrations match your filters.</p>
              {statusFilter === 'pending' && (
                <p className="mt-1 text-sm">Use &quot;Approved&quot; or &quot;All&quot; to see existing registrations.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {memberGroups.map((group) => (
                <div key={group.memberKey} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    {group.registrations[0]?.profileImage ? (
                      <img
                        src={group.registrations[0].profileImage}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{group.memberName}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {group.memberEmail}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${group.registrations[0]?.userId}`)}
                      className="ml-auto text-xs text-brand-blue hover:underline"
                    >
                      View profile
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {group.registrations.map((reg) => (
                      <li
                        key={`${reg.eventId}_${reg.userId}`}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-gray-900 min-w-[8rem]">
                          {shortEventRegistrationLabel(reg.eventName, reg.eventDate)}
                        </span>
                        {reg.eventSlug ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/events/${reg.eventSlug}`)}
                            className="text-xs text-brand-blue hover:underline flex items-center gap-1"
                          >
                            View event <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : null}
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            reg.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : reg.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {reg.status}
                        </span>
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(reg.registeredAt)}
                        </span>
                        {reg.status === 'pending' && (
                          <>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(`${reg.eventId}_${reg.userId}`)}
                              onChange={() => toggleSelect(reg.eventId, reg.userId)}
                              className="rounded border-gray-300"
                              aria-label={`Select ${reg.name}`}
                            />
                            <div className="ml-auto flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprove(reg)}
                                disabled={!!acting}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                              >
                                Approve & send details
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({ reg, reason: '' })}
                                disabled={!!acting}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject registration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reject {rejectModal.reg.name} for {rejectModal.reg.eventName}? Optional reason (shown to user):
            </p>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((m) => (m ? { ...m, reason: e.target.value } : null))}
              placeholder="Optional reason..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectModal.reg, rejectModal.reason)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRegistrationsPage;
