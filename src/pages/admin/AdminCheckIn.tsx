import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../../components/ui/BackButton';
import {
  CheckCircle,
  Clock,
  Search,
  UserPlus,
  Users,
  Calendar,
  ChevronDown,
  RefreshCw,
  Download,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { EventService } from '../../services/eventService';

type EventItem = { id: string; name: string; date: string; status?: string };
type RegItem = {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  work?: string;
  checkedIn?: boolean;
  checkedInAt?: any;
  registeredAt?: any;
};

const todayStart = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isEventPast = (dateStr: string): boolean => {
  return new Date(dateStr) < todayStart();
};

const formatEventDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (timestamp: any): string => {
  if (!timestamp) return '—';
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const AdminCheckIn: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [registrations, setRegistrations] = useState<RegItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [search, setSearch] = useState('');
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set());

  const currentAndFutureEvents = useMemo(() => {
    return events.filter((e) => !isEventPast(e.date)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEvents(true);
      try {
        const data = await EventService.getAllEvents();
        if (!cancelled) setEvents(data);
      } catch (e) {
        console.error('Error loading events:', e);
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setRegistrations([]);
      return;
    }
    let cancelled = false;
    setLoadingRegs(true);
    EventService.getEventRegistrations(selectedEventId)
      .then((regs) => {
        if (!cancelled) setRegistrations(regs);
      })
      .catch((e) => console.error('Error loading registrations:', e))
      .finally(() => {
        if (!cancelled) setLoadingRegs(false);
      });
    return () => { cancelled = true; };
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => currentAndFutureEvents.find((e) => e.id === selectedEventId),
    [currentAndFutureEvents, selectedEventId]
  );

  const searchLower = search.trim().toLowerCase();
  const filterRegs = (list: RegItem[]) =>
    !searchLower
      ? list
      : list.filter(
          (r) =>
            (r.name || '').toLowerCase().includes(searchLower) ||
            (r.email || '').toLowerCase().includes(searchLower)
        );

  const awaiting = useMemo(() => registrations.filter((r) => !r.checkedIn), [registrations]);
  const checkedIn = useMemo(() => registrations.filter((r) => r.checkedIn), [registrations]);
  const awaitingFiltered = filterRegs(awaiting);
  const checkedInFiltered = filterRegs(checkedIn);

  const handleCheckIn = async (userId: string) => {
    if (!selectedEventId || checkingIn.has(userId)) return;
    setCheckingIn((prev) => new Set(prev).add(userId));
    try {
      await EventService.updateCheckInStatus(
        selectedEventId,
        userId,
        true,
        user?.displayName || user?.email || undefined
      );
      setRegistrations((prev) =>
        prev.map((r) =>
          r.userId === userId ? { ...r, checkedIn: true, checkedInAt: new Date() } : r
        )
      );
    } catch (e) {
      console.error('Check-in failed:', e);
      alert('Check-in failed. Please try again.');
    } finally {
      setCheckingIn((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleExport = () => {
    if (!selectedEvent || registrations.length === 0) return;
    const formatTs = (ts: any) => {
      if (!ts) return '';
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };
    const headers = ['Name', 'Email', 'Phone', 'Work', 'Check-In Status', 'Registered At', 'Checked In At'];
    const rows = registrations.map((r) => [
      r.name,
      r.email,
      r.phone || '',
      r.work || '',
      r.checkedIn ? 'Checked In' : 'Awaiting',
      formatTs(r.registeredAt),
      r.checkedInAt ? formatTs(r.checkedInAt) : '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}_checkin.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <div className="mb-6"><BackButton fallbackTo="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors" iconClassName="h-4 w-4" /></div>

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Event <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Check-in</span>
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Only current and upcoming events are shown. Select an event below to see registrations and check in attendees.
          </p>
        </div>

        {/* Event picker */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Select event</h2>
                <p className="text-sm text-gray-500">Choose a current or upcoming event</p>
              </div>
            </div>
            <div className="relative min-w-0 sm:min-w-[280px]">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={loadingEvents}
                className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none disabled:opacity-60"
              >
                <option value="">Choose event...</option>
                {currentAndFutureEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {formatEventDate(ev.date)} — {ev.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {loadingEvents && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading events...
            </div>
          )}
          {!loadingEvents && currentAndFutureEvents.length === 0 && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              No current or upcoming events. Past events cannot be used for check-in.
            </p>
          )}
        </div>

        {selectedEventId && (
          <>
            {/* Search & export */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={registrations.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-5 w-5" />
                Export CSV
              </button>
            </div>

            {loadingRegs ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin" />
                Loading registrations...
              </div>
            ) : (
              <div className="grid gap-8">
                {/* Awaiting check-in */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-gray-900">Awaiting check-in</h3>
                      <span className="text-sm text-gray-500">({search ? awaitingFiltered.length : awaiting.length})</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                    {awaitingFiltered.length === 0 ? (
                      <div className="py-12 text-center text-gray-500 text-sm">
                        {awaiting.length === 0 ? 'Everyone is checked in.' : 'No matches for your search.'}
                      </div>
                    ) : (
                      awaitingFiltered.map((reg) => (
                        <div
                          key={reg.userId}
                          className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{reg.name}</p>
                            <p className="text-sm text-gray-500 truncate">{reg.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCheckIn(reg.userId)}
                            disabled={checkingIn.has(reg.userId)}
                            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          >
                            {checkingIn.has(reg.userId) ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            {checkingIn.has(reg.userId) ? 'Checking in...' : 'Check in'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Checked in */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900">Checked in</h3>
                      <span className="text-sm text-gray-500">({search ? checkedInFiltered.length : checkedIn.length})</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                    {checkedInFiltered.length === 0 ? (
                      <div className="py-12 text-center text-gray-500 text-sm">
                        {checkedIn.length === 0 ? 'No one checked in yet.' : 'No matches for your search.'}
                      </div>
                    ) : (
                      checkedInFiltered.map((reg) => (
                        <div key={reg.userId} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{reg.name}</p>
                            <p className="text-sm text-gray-500 truncate">{reg.email}</p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <Clock className="h-4 w-4 shrink-0" />
                            {formatTime(reg.checkedInAt)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!selectedEventId && !loadingEvents && currentAndFutureEvents.length > 0 && (
          <p className="text-center text-gray-500 text-sm">Select an event above to manage check-ins.</p>
        )}
      </div>

    </div>
  );
};

export default AdminCheckIn;
