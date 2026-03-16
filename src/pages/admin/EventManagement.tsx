import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { Plus, Calendar, MapPin, Users, Edit, Eye, Trash2, AlertTriangle, X, Mail, Phone, Briefcase, Download, Linkedin, ChevronDown, ArrowLeft, UserCheck, CheckCircle, Clock, Search, List, LayoutGrid, UserPlus, RefreshCw } from 'lucide-react';
import { EventService, EventData } from '../../services/eventService';
import EventPositionChart from '../../components/analytics/EventPositionChart';
import { UserService } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';
import type { UserCard } from '../../types/user';

type EventFilter = 'all' | 'upcoming' | 'past';
type ViewMode = 'cards' | 'list';

const EventManagement: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    eventId: string;
    eventName: string;
    hubspotDealId?: string;
  } | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // State for registrations modal
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [checkingInUsers, setCheckingInUsers] = useState<Set<string>>(new Set());
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationsTab, setRegistrationsTab] = useState<'awaiting' | 'checked-in' | 'all'>('awaiting');

  // Admin: Register user to event
  const { user: authUser } = useAuth();
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserList, setAddUserList] = useState<UserCard[]>([]);
  const [addUserListLoading, setAddUserListLoading] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState('');
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<UserCard[]>([]);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [syncingToHubspot, setSyncingToHubspot] = useState(false);
  const [hubspotSyncResult, setHubspotSyncResult] = useState<string | null>(null);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [eventSyncStatus, setEventSyncStatus] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const eventsData = await EventService.getAllEvents();
      setEvents(eventsData);
    } catch (error) {
      console.error('❌ Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEventUpcoming = (dateString: string) => new Date(dateString) > new Date();

  const filteredAndSortedEvents = useMemo(() => {
    let list = [...events];
    if (eventFilter === 'upcoming') list = list.filter(e => isEventUpcoming(e.date));
    if (eventFilter === 'past') list = list.filter(e => !isEventUpcoming(e.date));
    list.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return eventFilter === 'past' ? db - da : da - db;
    });
    return list;
  }, [events, eventFilter]);

  const handleStatusUpdate = async (eventId: string, newStatus: EventData['status']) => {
    setUpdatingStatus(eventId);
    try {
      await EventService.updateEventStatus(eventId, newStatus);
      
      // Update local state
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { ...event, status: newStatus }
          : event
      ));
    } catch (error) {
      console.error('❌ Error updating event status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteClick = (event: EventData) => {
    setDeleteConfirmation({
      eventId: event.id,
      eventName: event.name,
      hubspotDealId: event.hubspotDealId,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    const { eventId, hubspotDealId } = deleteConfirmation;
    setDeletingEvent(eventId);

    try {
      // Delete linked HubSpot deal first (if any)
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        try {
          const idToken = await getIdToken(firebaseUser);
          const body = hubspotDealId ? { eventId, hubspotDealId } : { eventId };
          const res = await fetch('/api/delete-event-from-hubspot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(body),
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          if (data.deleted) {
            console.log('✅ HubSpot deal deleted');
          } else if (data.error) {
            console.warn('[EventManagement] HubSpot deal delete:', data.error);
          }
        } catch (hubErr) {
          console.warn('[EventManagement] HubSpot deal delete request failed (non-blocking):', hubErr);
        }
      }

      await EventService.deleteEvent(eventId);

      // Remove from local state
      setEvents(prev => prev.filter(event => event.id !== eventId));

      console.log('✅ Event deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting event:', error);
    } finally {
      setDeletingEvent(null);
      setDeleteConfirmation(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
  };

  const handleSyncAllToHubspot = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setSyncingToHubspot(true);
    setHubspotSyncResult(null);
    try {
      const idToken = await getIdToken(firebaseUser);
      const res = await fetch('/api/sync-all-events-to-hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setHubspotSyncResult(`Synced ${data.synced} event(s) to HubSpot. ${data.failed > 0 ? `${data.failed} failed.` : ''}`);
        if (data.synced > 0) loadEvents();
      } else {
        setHubspotSyncResult(`Failed: ${data.error || res.status}`);
      }
    } catch (err) {
      setHubspotSyncResult(`Failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setSyncingToHubspot(false);
    }
  };

  const handleForceHubspotSync = async (eventId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setSyncingEventId(eventId);
    setEventSyncStatus((prev) => ({ ...prev, [eventId]: { ok: false, message: '' } }));
    try {
      const idToken = await getIdToken(firebaseUser);
      const res = await fetch('/api/sync-event-to-hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ eventId }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      const synced = res.ok && data.synced;
      const message = synced ? 'Sync Complete' : (data.error || `HTTP ${res.status}`);
      setEventSyncStatus((prev) => ({ ...prev, [eventId]: { ok: synced, message } }));
      if (synced) loadEvents();
    } catch (err) {
      setEventSyncStatus((prev) => ({ ...prev, [eventId]: { ok: false, message: err instanceof Error ? err.message : 'Network error' } }));
    } finally {
      setSyncingEventId(null);
    }
  };

  // Function to handle showing registrations
  const handleShowRegistrations = async (event: EventData) => {
    setSelectedEvent(event);
    setShowRegistrations(true);
    setLoadingRegistrations(false);
    setRegistrationSearch('');
    setRegistrationsTab('awaiting');
    setLoadingRegistrations(true);
    
    try {
      const eventRegistrations = await EventService.getEventRegistrations(event.id);
      
      // For each registration, get the user document to get LinkedIn and position
      const registrationsWithUserData = await Promise.all(
        eventRegistrations.map(async (reg) => {
          try {
            // Get user document from Firestore
            const userDoc = await EventService.getUserById(reg.userId);
            return {
              ...reg,
              linkedinUsername: userDoc?.linkedinUsername || '',
              position: userDoc?.position || '',
              profileImage: userDoc?.profileImage || null
            };
          } catch (error) {
            console.error('❌ Error fetching user data for registration:', error);
            return reg;
          }
        })
      );
      
      setRegistrations(registrationsWithUserData);
    } catch (error) {
      console.error('❌ Error loading registrations:', error);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  // Function to close registrations modal
  const handleCloseRegistrations = () => {
    setShowRegistrations(false);
    setSelectedEvent(null);
    setRegistrations([]);
    setRegistrationSearch('');
    setRegistrationsTab('awaiting');
    setShowAddUserModal(false);
    setSelectedUsersToAdd([]);
    setAddUserError(null);
  };

  // Load users for "Register user" when modal opens
  useEffect(() => {
    if (!showAddUserModal || !selectedEvent || !authUser?.uid) return;
    setAddUserListLoading(true);
    setAddUserError(null);
    UserService.getAllMembersForDirectory(authUser.uid, authUser.role)
      .then((list) => {
        const registeredIds = new Set(registrations.map((r) => r.userId));
        setAddUserList(list.filter((u) => !registeredIds.has(u.uid)));
      })
      .catch((err) => {
        console.error('Failed to load users:', err);
        setAddUserError('Failed to load members.');
        setAddUserList([]);
      })
      .finally(() => setAddUserListLoading(false));
  }, [showAddUserModal, selectedEvent?.id, authUser?.uid, authUser?.role, registrations]);

  const addUserFiltered = useMemo(() => {
    if (!addUserSearch.trim()) return addUserList;
    const q = addUserSearch.trim().toLowerCase();
    return addUserList.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.company || '').toLowerCase().includes(q)
    );
  }, [addUserList, addUserSearch]);

  const handleRegisterUserToEvent = async () => {
    if (!selectedEvent || selectedUsersToAdd.length === 0) return;
    setAddingUser(true);
    setAddUserError(null);
    const isUpcoming = new Date(selectedEvent.date) > new Date();
    const eventDateFormatted = formatDate(selectedEvent.date);
    let registered = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < selectedUsersToAdd.length; i++) {
        const u = selectedUsersToAdd[i];
        try {
          const fullUser = await EventService.getUserById(u.uid);
          const name = fullUser?.name || fullUser?.displayName || u.displayName || u.email || 'Member';
          const email = fullUser?.email || u.email || '';
          const phone = (fullUser?.phone as string) || '';
          const work = (fullUser?.work as string) || (fullUser?.company as string) || (u.title as string) || '';
          await EventService.registerForEvent(
            selectedEvent.id,
            u.uid,
            {
              name,
              email,
              phone,
              work,
              registeredAt: new Date(),
              profileImage: fullUser?.profileImage ?? u.avatarUrl ?? null,
            },
            { byAdmin: true }
          );
          if (isUpcoming && email) {
            try {
              await fetch('/api/email-service', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'registration',
                  email,
                  name,
                  eventDetails: {
                    name: selectedEvent.name,
                    date: eventDateFormatted,
                    location: selectedEvent.location || 'TBD',
                  },
                }),
              });
            } catch (emailErr) {
              console.warn('Registration email failed:', emailErr);
            }
          }
          registered++;
        } catch (err: any) {
          errors.push(`${u.displayName || u.email || u.uid}: ${err.message || 'Failed'}`);
        }
      }
      setSelectedUsersToAdd([]);
      setShowAddUserModal(false);
      await handleShowRegistrations(selectedEvent);
      if (errors.length > 0) {
        const msg = `Registered ${registered} user${registered !== 1 ? 's' : ''}; ${errors.length} failed:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`;
        alert(msg);
      }
    } catch (err: any) {
      setAddUserError(err.message || 'Failed to register users.');
    } finally {
      setAddingUser(false);
    }
  };

  const toggleUserToAdd = (u: UserCard) => {
    setSelectedUsersToAdd((prev) =>
      prev.some((x) => x.uid === u.uid) ? prev.filter((x) => x.uid !== u.uid) : [...prev, u]
    );
  };

  const selectAllFiltered = () => {
    setSelectedUsersToAdd((prev) => {
      const prevIds = new Set(prev.map((x) => x.uid));
      const toAdd = addUserFiltered.filter((u) => !prevIds.has(u.uid));
      return prev.concat(toAdd);
    });
  };

  const clearSelection = () => setSelectedUsersToAdd([]);

  const awaitingCheckIn = useMemo(() => registrations.filter(r => !r.checkedIn), [registrations]);
  const checkedIn = useMemo(() => registrations.filter(r => r.checkedIn), [registrations]);
  const searchLower = registrationSearch.trim().toLowerCase();
  const filterBySearch = (list: typeof registrations) =>
    !searchLower ? list : list.filter(r =>
      (r.name || '').toLowerCase().includes(searchLower) ||
      (r.email || '').toLowerCase().includes(searchLower)
    );
  const awaitingFiltered = filterBySearch(awaitingCheckIn);
  const checkedInFiltered = filterBySearch(checkedIn);
  const allFiltered = filterBySearch(registrations);

  // Function to handle manual check-in
  const handleManualCheckIn = async (userId: string, userName: string) => {
    if (!selectedEvent || checkingInUsers.has(userId)) return;

    setCheckingInUsers(prev => new Set(prev).add(userId));

    try {
      console.log('🔄 Manually checking in user:', userId, 'for event:', selectedEvent.id);
      
      // Update check-in status in Firebase (this will trigger auto-connect)
      await EventService.updateCheckInStatus(selectedEvent.id, userId, true);
      
      // Update local state to reflect the change
      setRegistrations(prevRegistrations => 
        prevRegistrations.map(reg => 
          reg.userId === userId 
            ? { ...reg, checkedIn: true, checkedInAt: new Date() }
            : reg
        )
      );

      console.log('✅ User checked in successfully:', userName);
      
    } catch (error) {
      console.error('❌ Error checking in user:', error);
      alert('Failed to check in user. Please try again.');
    } finally {
      setCheckingInUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Function to export registrations to CSV
  const handleExportRegistrations = () => {
    if (!registrations.length || !selectedEvent) return;
    
    // Prepare data for export
    const exportData = registrations.map(reg => ({
      Name: reg.name,
      Email: reg.email,
      Phone: reg.phone || '',
      Work: reg.work || '',
      LinkedIn: reg.linkedinUsername || '',
      Position: formatPosition(reg.position) || '',
      'Check-In Status': reg.checkedIn ? 'Checked In' : 'Awaiting Check-in',
      'Registered At': formatDateForExport(reg.registeredAt),
      'Checked In At': reg.checkedInAt ? formatDateForExport(reg.checkedInAt) : ''
    }));

    // Convert to CSV format
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape commas and quotes in CSV
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date for export
  const formatDateForExport = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format position for display
  const formatPosition = (position: string | undefined): string => {
    if (!position) return '';
    
    const positionMap: Record<string, string> = {
      'investor': 'Investor',
      'c_level': 'C-Level Executive',
      'vp_level': 'VP Level',
      'director': 'Director',
      'senior_manager': 'Senior Manager',
      'manager': 'Manager',
      'senior_contributor': 'Senior Contributor',
      'individual_contributor': 'Individual Contributor',
      'junior_level': 'Junior Level',
      'founder': 'Founder',
      'consultant': 'Consultant',
      'student': 'Student',
      'other': 'Other'
    };
    
    return positionMap[position] || position;
  };

  // Format LinkedIn username for display
  const formatLinkedinUrl = (username: string | undefined) => {
    if (!username) return '';
    
    // Remove any linkedin.com prefix if present
    const cleanUsername = username.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '');
    
    // Remove trailing slash if present
    return cleanUsername.replace(/\/$/, '');
  };

  const getStatusBadge = (status: EventData['status']) => {
    const badges = {
      'active': 'bg-green-100 text-green-800',
      'non-active': 'bg-gray-100 text-gray-800',
      'sold-out': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-blue-50 text-blue-800'
    };
    
    const labels = {
      'active': 'Active',
      'non-active': 'Hidden',
      'sold-out': 'Sold Out',
      'completed': 'Completed'
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 overflow-x-hidden w-full max-w-full box-border">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 overflow-x-hidden w-full max-w-full box-border">
        {/* Back Button */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Link
            to="/admin"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium text-sm sm:text-base"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Back to Admin Tools</span>
          </Link>
        </div>

        {/* Header with Create Button and HubSpot Sync */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Event Management
          </h1>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSyncAllToHubspot}
              disabled={syncingToHubspot || events.length === 0}
              className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-all font-medium flex items-center justify-center space-x-2 text-sm min-h-[44px] sm:min-h-0 disabled:opacity-50"
            >
              {syncingToHubspot ? (
                <span className="animate-pulse">Syncing…</span>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Sync to HubSpot</span>
                </>
              )}
            </button>
            <Link
              to="/admin/events/create"
              className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2 text-sm sm:text-base min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
            >
              <Plus className="h-5 w-5" />
              <span>Create Event</span>
            </Link>
          </div>
        </div>
        {hubspotSyncResult && (
          <p className="mb-4 text-sm text-gray-600">{hubspotSyncResult}</p>
        )}

        {/* Filter, sort, view mode */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setEventFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize min-h-[36px] sm:min-h-0 ${
                  eventFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md ${viewMode === 'cards' ? 'bg-white shadow-sm' : ''}`}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm text-gray-500">
            {filteredAndSortedEvents.length} event{filteredAndSortedEvents.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Events List / Grid */}
        {filteredAndSortedEvents.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-12 border border-gray-100 text-center">
            <Calendar className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              {events.length === 0 ? 'No Events Yet' : `No ${eventFilter === 'all' ? '' : eventFilter} events`}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {events.length === 0
                ? 'Get started by creating your first Alma Links event.'
                : `Try switching to "${eventFilter === 'upcoming' ? 'Past' : eventFilter === 'past' ? 'Upcoming' : 'All'}" or create a new event.`}
            </p>
            {events.length === 0 && (
              <Link
                to="/admin/events/create"
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center justify-center space-x-2 text-sm sm:text-base min-h-[44px] sm:min-h-0"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Create First Event</span>
              </Link>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Date & location</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{event.name}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-600">
                      {formatDate(event.date)}
                      <span className="text-gray-400 mx-1">•</span>
                      <span className="truncate max-w-[180px] inline-block align-bottom" title={event.location}>{event.location}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(event.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => handleForceHubspotSync(event.id)}
                          disabled={syncingEventId === event.id}
                          className="text-orange-600 hover:text-orange-800 p-1.5 rounded disabled:opacity-50 flex items-center gap-1 min-w-[100px]"
                          title={eventSyncStatus[event.id]?.message || 'Force HubSpot Sync'}
                        >
                          {syncingEventId === event.id ? (
                            <span className="text-xs">Syncing...</span>
                          ) : eventSyncStatus[event.id]?.ok ? (
                            <span className="text-green-600 flex items-center gap-1 text-xs"><CheckCircle className="h-4 w-4 flex-shrink-0" /> Sync Complete</span>
                          ) : eventSyncStatus[event.id]?.message ? (
                            <span className="text-red-600 text-xs truncate max-w-[140px]" title={eventSyncStatus[event.id].message}>{eventSyncStatus[event.id].message}</span>
                          ) : (
                            <span className="text-xs">Force HubSpot Sync</span>
                          )}
                        </button>
                        <Link to={`/events/${event.slug}`} className="text-gray-500 hover:text-gray-700 p-1.5 rounded" title="View"><Eye className="h-4 w-4" /></Link>
                        <Link to={`/admin/events/${event.id}/edit`} className="text-gray-500 hover:text-gray-700 p-1.5 rounded" title="Edit"><Edit className="h-4 w-4" /></Link>
                        <button type="button" onClick={() => handleShowRegistrations(event)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded font-medium flex items-center gap-1" title="Registrations & check-in">
                          <Users className="h-4 w-4" /><span className="hidden sm:inline">Registrations</span>
                        </button>
                        <button type="button" onClick={() => handleDeleteClick(event)} disabled={deletingEvent === event.id} className="text-red-500 hover:text-red-700 p-1.5 rounded disabled:opacity-50" title="Delete">
                          {deletingEvent === event.id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {filteredAndSortedEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover-lift">
                {/* Event Image */}
                <div className="h-40 sm:h-48 bg-gray-200 relative">
                  <img
                    src={event.imageUrl}
                    alt={event.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTAwQzIwNS41MjMgMTAwIDIxMCA5NS41MjMgMjEwIDkwUzIwNS41MjMgODAgMjAwIDgwUzE5MCA4NC40NzcgMTkwIDkwUzE5NC40NzcgMTAwIDIwMCAxMDBaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==';
                    }}
                  />
                  <div className="absolute top-4 right-4">
                    {getStatusBadge(event.status)}
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">{event.name}</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm break-words">{event.location}</span>
                    </div>
                  </div>

                  <p className="text-gray-600 text-xs sm:text-sm mb-4 line-clamp-2">
                    {event.description}
                  </p>

                  {/* Status Update */}
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Update Status:
                    </label>
                    <select
                      value={event.status}
                      onChange={(e) => handleStatusUpdate(event.id, e.target.value as EventData['status'])}
                      disabled={updatingStatus === event.id}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                    >
                      <option value="active">Active - Show publicly, allow registration</option>
                      <option value="non-active">Non-Active - Hide from public view</option>
                      <option value="sold-out">Sold Out - Show publicly, disable registration</option>
                      <option value="completed">Completed - Show publicly, disable registration</option>
                    </select>
                    {updatingStatus === event.id && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-brand-light">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </div>
                    )}
                  </div>

                  {/* Force HubSpot Sync */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => handleForceHubspotSync(event.id)}
                      disabled={syncingEventId === event.id}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 text-sm font-medium"
                    >
                      {syncingEventId === event.id ? (
                        <>Syncing...</>
                      ) : eventSyncStatus[event.id]?.ok ? (
                        <><CheckCircle className="h-4 w-4 text-green-600" /> Sync Complete</>
                      ) : (
                        <>Force HubSpot Sync</>
                      )}
                    </button>
                    {eventSyncStatus[event.id]?.message && !eventSyncStatus[event.id]?.ok && (
                      <p className="mt-1 text-xs text-red-600" title={eventSyncStatus[event.id].message}>{eventSyncStatus[event.id].message}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 lg:flex lg:space-x-2 gap-2 lg:gap-0">
                    <Link
                      to={`/events/${event.slug}`} // Use slug instead of ID
                      className="bg-gray-100 text-gray-700 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-center flex items-center justify-center space-x-2 text-sm min-h-[44px] lg:min-h-0 lg:flex-1"
                    >
                      <Eye className="h-4 w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">View</span>
                    </Link>
                    {/* Edit Event Link - Route must match /admin/events/:eventId/edit defined in App.tsx */}
                    <Link
                      to={`/admin/events/${event.id}/edit`}
                      className="bg-green-100 text-green-700 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-green-200 transition-colors duration-200 font-medium text-center flex items-center justify-center space-x-2 text-sm min-h-[44px] lg:min-h-0 lg:flex-1"
                      onClick={() => {
                        console.log('🔧 Edit Event clicked - Navigating to:', `/admin/events/${event.id}/edit`);
                      }}
                    >
                      <Edit className="h-4 w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">Edit</span>
                    </Link>
                    <button 
                      className="bg-blue-50 text-blue-700 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-blue-200 transition-colors duration-200 font-medium flex items-center justify-center space-x-2 text-sm min-h-[44px] lg:min-h-0 lg:flex-1"
                      onClick={() => handleShowRegistrations(event)}
                    >
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">Registrations</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(event)}
                      disabled={deletingEvent === event.id}
                      className="bg-red-100 text-red-700 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-red-200 transition-colors duration-200 font-medium flex items-center justify-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] lg:min-h-0 lg:flex-1"
                    >
                      {deletingEvent === event.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <Trash2 className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="whitespace-nowrap">Delete</span>
                    </button>
                  </div>
                </div>
                
                {/* Event Analytics */}
                <div className="p-6 pt-0">
                  <EventPositionChart eventId={event.id} className="mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Delete Event?
              </h3>
              
              <p className="text-gray-600 mb-2">
                Are you sure you want to delete:
              </p>
              
              <p className="font-semibold text-gray-900 mb-6">
                "{deleteConfirmation.eventName}"
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ This action cannot be undone!
                </p>
                <p className="text-red-700 text-sm mt-1">
                  This will permanently delete the event and all associated registrations.
                </p>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleDeleteCancel}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingEvent === deleteConfirmation.eventId}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-colors duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {deletingEvent === deleteConfirmation.eventId ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5" />
                      <span>Delete Event</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registrations Modal */}
      {showRegistrations && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-6xl w-full max-w-[calc(100vw-24px)] sm:max-w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b border-gray-200 gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Registrations for {selectedEvent.name}</h2>
                <p className="text-sm sm:text-base text-gray-600 mt-1 break-words">
                  {formatDate(selectedEvent.date)} • {selectedEvent.location}
                </p>
              </div>
              <div className="flex items-center justify-end space-x-2 sm:space-x-3 flex-shrink-0">
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium flex items-center space-x-2 text-sm sm:text-base min-h-[44px] sm:min-h-0"
                >
                  <UserPlus className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Register user</span>
                </button>
                <button
                  onClick={handleExportRegistrations}
                  disabled={registrations.length === 0}
                  className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium flex items-center space-x-2 disabled:opacity-50 text-sm sm:text-base min-h-[44px] sm:min-h-0"
                >
                  <Download className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Export CSV</span>
                </button>
                <button
                  onClick={handleCloseRegistrations}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] sm:max-h-[calc(90vh-130px)] flex-1">
              {loadingRegistrations ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm sm:text-base text-gray-600">Loading registrations...</p>
                </div>
              ) : registrations.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Registrations Yet</h3>
                  <p className="text-sm sm:text-base text-gray-600 px-4">
                    No one has registered for this event yet.
                  </p>
                </div>
              ) : (
                <div className="p-3 sm:p-4 lg:p-6">
                  {/* Search + Tabs */}
                  <div className="mb-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={registrationSearch}
                        onChange={(e) => setRegistrationSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setRegistrationsTab('awaiting')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium min-h-[36px] ${
                          registrationsTab === 'awaiting' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        Awaiting check-in ({searchLower ? awaitingFiltered.length : awaitingCheckIn.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegistrationsTab('checked-in')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium min-h-[36px] ${
                          registrationsTab === 'checked-in' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        Checked in ({searchLower ? checkedInFiltered.length : checkedIn.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegistrationsTab('all')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium min-h-[36px] ${
                          registrationsTab === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        All ({registrations.length})
                      </button>
                    </div>
                  </div>

                  {/* Check-in focused: Awaiting tab — compact list */}
                  {registrationsTab === 'awaiting' && (
                    <div className="mb-6">
                      {awaitingFiltered.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">
                          {awaitingCheckIn.length === 0 ? 'Everyone is checked in.' : 'No matches for your search.'}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {awaitingFiltered.map((reg) => (
                            <li key={reg.userId} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-gray-900">{reg.name}</span>
                                {reg.email && <span className="text-gray-500 text-sm ml-2 truncate">({reg.email})</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleManualCheckIn(reg.userId, reg.name)}
                                disabled={checkingInUsers.has(reg.userId)}
                                className="flex-shrink-0 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                              >
                                {checkingInUsers.has(reg.userId) ? (
                                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking in...</>
                                ) : (
                                  <><UserCheck className="h-4 w-4" /> Check in</>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Checked-in tab: read-only list */}
                  {registrationsTab === 'checked-in' && (
                    <div className="mb-6">
                      {checkedInFiltered.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">
                          {checkedIn.length === 0 ? 'No one checked in yet.' : 'No matches for your search.'}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {checkedInFiltered.map((reg) => (
                            <li key={reg.userId} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-green-50">
                              <div>
                                <span className="font-medium text-gray-900">{reg.name}</span>
                                {reg.email && <span className="text-gray-500 text-sm ml-2">({reg.email})</span>}
                              </div>
                              <div className="flex items-center text-green-700 text-sm">
                                <CheckCircle className="h-4 w-4 mr-1" /> Checked in
                                {reg.checkedInAt && <span className="text-gray-500 ml-1">{formatDateForExport(reg.checkedInAt)}</span>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* All tab: full table + chart */}
                  {registrationsTab === 'all' && (
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-500">
                        <span>{registrations.length} total</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 rounded-full" /> {checkedIn.length} checked in</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" /> {awaitingCheckIn.length} awaiting</span>
                      </div>
                      <div className="mb-4 overflow-x-auto -mx-3 sm:mx-0">
                        <div className="min-w-[300px] px-3 sm:px-0">
                          <EventPositionChart eventId={selectedEvent.id} />
                        </div>
                      </div>
                      <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Work
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            LinkedIn
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Position
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registered
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allFiltered.map((registration) => (
                          <tr key={registration.userId} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden">
                                  {registration.profileImage ? (
                                    <img 
                                      src={registration.profileImage} 
                                      alt={registration.name} 
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                                      {registration.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 text-xs sm:text-sm truncate">{registration.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs sm:text-sm text-gray-900">
                                <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1.5 sm:mr-2 flex-shrink-0" />
                                <span className="truncate max-w-[120px] sm:max-w-none" title={registration.email}>{registration.email}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs sm:text-sm text-gray-900">
                                <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1.5 sm:mr-2 flex-shrink-0" />
                                <span className="truncate">{registration.phone || 'Not provided'}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs sm:text-sm text-gray-900">
                                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1.5 sm:mr-2 flex-shrink-0" />
                                <span className="truncate max-w-[100px] sm:max-w-[150px]" title={registration.work}>
                                  {registration.work || 'Not provided'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs sm:text-sm text-gray-900">
                                <Linkedin className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1.5 sm:mr-2 flex-shrink-0" />
                                {registration.linkedinUsername ? (
                                  <a 
                                    href={`https://linkedin.com/in/${formatLinkedinUrl(registration.linkedinUsername)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-light hover:text-brand-mid hover:underline truncate max-w-[80px] sm:max-w-none"
                                  >
                                    {formatLinkedinUrl(registration.linkedinUsername)}
                                  </a>
                                ) : (
                                  <span>Not provided</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs sm:text-sm text-gray-900">
                                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1.5 sm:mr-2 flex-shrink-0" />
                                <span className="truncate">{formatPosition(registration.position) || 'Not provided'}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                registration.checkedIn 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {registration.checkedIn ? 'Checked In' : 'Not Checked In'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                              {formatDateForExport(registration.registeredAt)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              {!registration.checkedIn ? (
                                <button
                                  onClick={() => handleManualCheckIn(registration.userId, registration.name)}
                                  disabled={checkingInUsers.has(registration.userId)}
                                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-2 sm:px-3 py-1.5 rounded-lg hover:shadow-lg transition-all duration-300 font-medium text-xs sm:text-sm flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] sm:min-h-0"
                                  title={`Check in ${registration.name}`}
                                >
                                  {checkingInUsers.has(registration.userId) ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                      <span className="whitespace-nowrap">Checking In...</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3 w-3 flex-shrink-0" />
                                      <span className="whitespace-nowrap">Check In</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="flex items-center space-x-1 sm:space-x-1.5 text-green-600">
                                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                  <span className="text-xs sm:text-sm font-medium">Checked In</span>
                                  {registration.checkedInAt && (
                                    <div className="text-[10px] sm:text-xs text-gray-500 ml-1 sm:ml-2 hidden sm:inline">
                                      {formatDateForExport(registration.checkedInAt)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
              <div className="text-xs sm:text-sm text-gray-600">
                {registrations.length > 0 && (
                  <span>Use the Export button to download all registration data as CSV</span>
                )}
              </div>
              <button
                onClick={handleCloseRegistrations}
                className="bg-gray-100 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-2 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register user to event modal */}
      {showAddUserModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Register users to this event</h3>
              <button
                type="button"
                onClick={() => { setShowAddUserModal(false); setSelectedUsersToAdd([]); setAddUserError(null); }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-3">
                Select one or more members to add to &quot;{selectedEvent.name}&quot;. They will see this event on their dashboard.
                {new Date(selectedEvent.date) <= new Date() && (
                  <span className="block mt-1 text-amber-700">This is a past event — no confirmation email will be sent.</span>
                )}
              </p>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={addUserSearch}
                onChange={(e) => setAddUserSearch(e.target.value)}
                className="w-full mb-3 pl-3 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {addUserFiltered.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Select all ({addUserFiltered.length})
                  </button>
                  {selectedUsersToAdd.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear selection
                    </button>
                  )}
                  {selectedUsersToAdd.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {selectedUsersToAdd.length} selected
                    </span>
                  )}
                </div>
              )}
              {addUserError && (
                <p className="text-sm text-red-600 mb-3">{addUserError}</p>
              )}
              {addUserListLoading ? (
                <div className="py-8 text-center text-gray-500">Loading members...</div>
              ) : addUserFiltered.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  {addUserList.length === 0 ? 'No other members to add, or they are already registered.' : 'No matches for your search.'}
                </p>
              ) : (
                <ul className="space-y-1 max-h-[280px] overflow-y-auto">
                  {addUserFiltered.map((u) => {
                    const isSelected = selectedUsersToAdd.some((x) => x.uid === u.uid);
                    return (
                      <li key={u.uid}>
                        <button
                          type="button"
                          onClick={() => toggleUserToAdd(u)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm flex items-center gap-3 ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50 text-purple-900'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-900'
                          }`}
                        >
                          <span className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center bg-white">
                            {isSelected && <span className="w-2 h-2 rounded-full bg-purple-600" />}
                          </span>
                          <span className="font-medium truncate">{u.displayName || u.email || u.uid}</span>
                          {u.email && <span className="text-gray-500 truncate text-xs">({u.email})</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowAddUserModal(false); setSelectedUsersToAdd([]); setAddUserError(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegisterUserToEvent}
                disabled={selectedUsersToAdd.length === 0 || addingUser}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Registering {selectedUsersToAdd.length} user{selectedUsersToAdd.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Register {selectedUsersToAdd.length > 0 ? `${selectedUsersToAdd.length} user${selectedUsersToAdd.length !== 1 ? 's' : ''}` : 'users'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagement;