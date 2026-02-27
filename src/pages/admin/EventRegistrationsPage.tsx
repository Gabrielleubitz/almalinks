import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { auth } from '../../firebase/config';
import {
  Calendar,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { EventService } from '../../services/eventService';
import { listPendingRegistrations, listEventRegistrations, approve, reject } from '../../services/registrationService';
import type { EventRegistrationWithStatus } from '../../types/event';
import { useAuth } from '../../hooks/useAuth';
import AdminLayout from '../../components/admin/AdminLayout';

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
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [bulkActing, setBulkActing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ reg: RegistrationRow; reason: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
          EventService.getEventById(eventFilter),
        ]);
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
    const pending = filteredRows.filter((r) => r.status === 'pending');
    if (selectedIds.size === pending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map((r) => `${r.eventId}_${r.userId}`)));
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Event Registrations</h1>
        </div>

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
        </div>

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
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>No registrations match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {statusFilter === 'pending' && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={filteredRows.filter((r) => r.status === 'pending').length > 0 && selectedIds.size === filteredRows.filter((r) => r.status === 'pending').length}
                          onChange={selectAllPending}
                          className="rounded border-gray-300"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Registrant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Registered at</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((reg) => (
                    <tr key={`${reg.eventId}_${reg.userId}`} className="hover:bg-gray-50">
                      {statusFilter === 'pending' && (
                        <td className="px-4 py-3">
                          {reg.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(`${reg.eventId}_${reg.userId}`)}
                              onChange={() => toggleSelect(reg.eventId, reg.userId)}
                              className="rounded border-gray-300"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{reg.eventName || reg.eventId}</div>
                        <div className="text-xs text-gray-500">{reg.eventDate ? formatDate(reg.eventDate) : '—'}</div>
                        {reg.eventSlug && (
                          <button
                            type="button"
                            onClick={() => navigate(`/events/${reg.eventSlug}`)}
                            className="text-xs text-brand-blue hover:underline flex items-center gap-1 mt-1"
                          >
                            View event <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {reg.profileImage ? (
                            <img
                              src={reg.profileImage}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{reg.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {reg.email}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${reg.userId}`)}
                          className="text-xs text-brand-blue hover:underline flex items-center gap-1 mt-1"
                        >
                          View profile <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            reg.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : reg.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {reg.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(reg.registeredAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {reg.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(reg)}
                              disabled={!!acting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                            >
                              {acting === reg.userId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              Approve & send details
                            </button>
                            <button
                              onClick={() => setRejectModal({ reg, reason: '' })}
                              disabled={!!acting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
    </AdminLayout>
  );
};

export default EventRegistrationsPage;
