import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Mail,
  MessageCircle,
  UserCog, 
  Megaphone, 
  FileText,
  Settings,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  ChevronDown,
  UserPlus,
  Zap,
  Send,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { EventService } from '../../services/eventService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import AdminHeader from '../../components/admin/AdminHeader';
import StatsCards from '../../components/admin/StatsCards';
import UserListModal from '../../components/admin/UserListModal';
import IganiWatermark from '../../components/IganiWatermark';
import { sendAdminEmail } from '../../services/emailService';
import EmailRecipientAutocomplete, { EmailRecipient } from '../../components/admin/EmailRecipientAutocomplete';
import AudienceSelector, { RecipientMode, AudienceSelection } from '../../components/admin/AudienceSelector';
import RecipientPreview from '../../components/admin/RecipientPreview';
import { auth } from '../../firebase/config';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    registered: 0,
    attended: 0
  });
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loadingPendingCount, setLoadingPendingCount] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUsers, setModalUsers] = useState<any[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  
  // Email state
  const [emailRecipientMode, setEmailRecipientMode] = useState<RecipientMode>('individuals');
  const [emailAudienceSelection, setEmailAudienceSelection] = useState<AudienceSelection>({ mode: 'individuals' });
  const [emailRecipientCount, setEmailRecipientCount] = useState<number | null>(null);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailRecipientObjects, setEmailRecipientObjects] = useState<EmailRecipient[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);

  // Load events on component mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const eventsData = await EventService.getAllEvents();
        setEvents(eventsData);
        
        // Auto-select the first active event if none selected
        if (!selectedEventId && eventsData.length > 0) {
          const activeEvent = eventsData.find(e => e.status === 'active') || eventsData[0];
          setSelectedEventId(activeEvent.id);
        }
      } catch (error) {
        console.error('❌ Error loading events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
    loadPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount


  // Load stats and registrations for selected event
  useEffect(() => {
    const loadEventData = async () => {
      if (selectedEventId) {
        setLoadingStats(true);
        try {
          console.log('📊 Loading data for event:', selectedEventId);
          
          // Get all registrations for the event
          const eventRegistrations = await EventService.getEventRegistrations(selectedEventId);
          setRegistrations(eventRegistrations);
          
          const total = eventRegistrations.length;
          const checkedIn = eventRegistrations.filter(reg => reg.checkedIn === true).length;
          const awaitingCheckIn = total - checkedIn;
          
          setStats({
            total: total,
            registered: awaitingCheckIn,
            attended: checkedIn
          });
          
          console.log('✅ Data loaded:', { total, awaitingCheckIn, checkedIn });
        } catch (error) {
          console.error('❌ Error loading event data:', error);
          setStats({ total: 0, registered: 0, attended: 0 });
          setRegistrations([]);
        } finally {
          setLoadingStats(false);
        }
      }
    };

    loadEventData();
  }, [selectedEventId]);

  // Load pending registrations count
  const loadPendingCount = async () => {
    try {
      setLoadingPendingCount(true);
      
      // Get count of users with pending status
      const pendingUsers = await getPendingUsersCount();
      setPendingCount(pendingUsers);
      
    } catch (error) {
      console.error('❌ Error loading pending count:', error);
      setPendingCount(0);
    } finally {
      setLoadingPendingCount(false);
    }
  };

  // Get count of pending users (from joinRequests collection)
  const getPendingUsersCount = async (): Promise<number> => {
    try {
      const { JoinRequestService } = await import('../../services/joinRequestService');
      const pendingRequests = await JoinRequestService.getPendingRequests();
      return pendingRequests.length;
    } catch (error) {
      console.error('❌ Error getting pending users count:', error);
      return 0;
    }
  };

  // Handle event selection
  const handleEventSelect = (eventId: string) => {
    console.log('📅 Event selected:', eventId);
    setSelectedEventId(eventId);
  };

  // Email helper functions
  const sendQuickEmail = async (confirmed = false) => {
    // Validation
    if (emailRecipientMode === 'individuals') {
      if (emailRecipientObjects.length === 0 && !emailRecipients.trim()) {
        setEmailError('Please enter recipient email(s)');
        return;
      }
    } else {
      const hasSelection = 
        (emailRecipientMode === 'group' && emailAudienceSelection.groupId) ||
        (emailRecipientMode === 'event' && emailAudienceSelection.eventId) ||
        (emailRecipientMode === 'chat' && emailAudienceSelection.chatId) ||
        (emailRecipientMode === 'location' && emailAudienceSelection.location);

      if (!hasSelection || !emailRecipientCount || emailRecipientCount === 0) {
        setEmailError(`Please select a ${emailRecipientMode} with recipients`);
        return;
      }
    }

    if (!emailMessage.trim()) {
      setEmailError('Please enter a message');
      return;
    }

    // Show confirmation for large sends
    if (!confirmed && emailRecipientCount && emailRecipientCount > 50) {
      setShowEmailConfirmModal(true);
      return;
    }

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(null);
    setShowEmailConfirmModal(false);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      const idToken = await currentUser.getIdToken();

      if (emailRecipientMode === 'individuals') {
        // Use existing sendAdminEmail for individuals
        const recipientList = emailRecipientObjects.length > 0
          ? emailRecipientObjects.map(r => r.email)
          : emailRecipients.split(',').map(email => email.trim()).filter(email => email);

        if (recipientList.length === 0) {
          setEmailError('Please enter at least one valid email address');
          setEmailLoading(false);
          return;
        }

        const result = await sendAdminEmail({
          to: recipientList,
          subject: emailSubject.trim() || (selectedEventId ? `Update for ${selectedEvent?.name || 'event'}` : ''),
          message: emailMessage.trim(),
          eventId: selectedEventId || undefined
        });

        if (result.success) {
          setEmailSuccess(`Email sent successfully to ${recipientList.length} recipient(s)!`);
          setEmailRecipients('');
          setEmailRecipientObjects([]);
          setEmailSubject('');
          setEmailMessage('');
        } else {
          setEmailError(result.error || 'Failed to send email');
        }
      } else {
        // Use bulk email API for audience modes
        const response = await fetch('/api/send-bulk-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            mode: emailRecipientMode,
            ...emailAudienceSelection,
            subject: emailSubject.trim() || (selectedEventId ? `Update for ${selectedEvent?.name || 'event'}` : ''),
            text: emailMessage.trim()
          })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Failed to send bulk email');
        }

        setEmailSuccess(`Email sent! ${data.sent} sent, ${data.failed} failed out of ${data.total} recipients.`);
        setEmailSubject('');
        setEmailMessage('');
        setEmailAudienceSelection({ mode: emailRecipientMode });
        setEmailRecipientCount(null);
      }
    } catch (error: any) {
      console.error('❌ Email sending error:', error);
      setEmailError(`Failed to send email: ${error.message || 'Unknown error'}`);
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle stat card clicks
  const handleStatClick = (type: 'total' | 'registered' | 'attended') => {
    let filteredUsers: any[] = [];
    let title = '';

    switch (type) {
      case 'total':
        filteredUsers = registrations;
        title = 'All Registered Users';
        break;
      case 'registered':
        filteredUsers = registrations.filter(reg => !reg.checkedIn);
        title = 'Users Awaiting Check-in';
        break;
      case 'attended':
        filteredUsers = registrations.filter(reg => reg.checkedIn === true);
        title = 'Checked In Users';
        break;
    }

    setModalUsers(filteredUsers);
    setModalTitle(title);
    setModalOpen(true);
  };

  // Handle user update from modal (when manually checked in)
  const handleUserUpdate = (userId: string, updatedUser: any) => {
    // Update the registrations state
    setRegistrations(prev => 
      prev.map(reg => 
        reg.userId === userId ? updatedUser : reg
      )
    );

    // Update stats
    setStats(prev => ({
      ...prev,
      registered: prev.registered - 1,
      attended: prev.attended + 1
    }));

    // Update modal users if modal is open
    setModalUsers(prev => 
      prev.map(user => 
        user.userId === userId ? updatedUser : user
      )
    );
  };

  // Handle Excel export
  const handleExportExcel = () => {
    if (!selectedEventId || registrations.length === 0) {
      alert('No data to export');
      return;
    }

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const eventName = selectedEvent?.name || 'Event';

    // Prepare data for export
    const exportData = registrations.map(reg => ({
      Name: reg.name,
      Email: reg.email,
      Phone: reg.phone || '',
      Work: reg.work || '',
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
    link.setAttribute('download', `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.csv`);
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

  // Format date for display
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Admin Dashboard" 
        subtitle={`Welcome back, ${user?.displayName || user?.name || 'Admin'}`}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Welcome Section */}
        <div className="text-center mb-8 sm:mb-12 px-2">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 sm:p-8 mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-purple-100 p-3 rounded-full mr-4">
                <UserCog className="h-6 w-6 text-brand-dark" />
              </div>
              <div className="text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Welcome back, <span className="text-brand-dark">{user?.displayName?.split(' ')[0] || 'Admin'}</span>! 👋
                </h2>
                <p className="text-gray-600 mt-1">Manage events, track registrations, and oversee check-ins</p>
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            Admin <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Select an event below to view registration statistics and manage check-ins
          </p>
        </div>

        {/* Core Admin Functions */}
        <div className="space-y-8">
          
          {/* Event & User Management */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Event & User Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link
                to="/admin/events"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Calendar className="h-8 w-8 text-brand-dark" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Manage Events</h4>
                    <p className="text-gray-600 text-sm">View and edit existing events</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/events/create"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Create Event</h4>
                    <p className="text-gray-600 text-sm">Add a new Alma Links event</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <UserCog className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Users</h4>
                    <p className="text-gray-600 text-sm">Manage user roles</p>
                  </div>
                </div>
              </Link>
              <Link
                to="/admin/activity"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Activity className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Activity</h4>
                    <p className="text-gray-600 text-sm">Monitor user activities</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/pending-registrations"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift relative"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <UserPlus className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Registrations</h4>
                    <p className="text-gray-600 text-sm">Approve new signups</p>
                  </div>
                </div>
                
                {!loadingPendingCount && pendingCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    {pendingCount}
                  </div>
                )}
              </Link>
            </div>
          </div>

          {/* Communication Tools */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📢 Communication</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link
                to="/admin/email"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Mail className="h-8 w-8 text-brand-light" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Email Messages</h4>
                    <p className="text-gray-600 text-sm">Send emails to members</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/announcements"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Megaphone className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Announcements</h4>
                    <p className="text-gray-600 text-sm">Publish updates</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/chats/create"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <MessageCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Create Chat Group</h4>
                    <p className="text-gray-600 text-sm">Create new group chats</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Event Tools */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Event Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <Link
                to="/admin/connections"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-brand-light" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Connections</h4>
                    <p className="text-gray-600 text-sm">Manage user connections</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/system-test"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Zap className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">System Test</h4>
                    <p className="text-gray-600 text-sm">Test integrations</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Event Selection & Registration Statistics - Combined Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 mb-8">
          {/* Event Selection Header & Dropdown */}
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Event Management</h2>
                <p className="text-sm text-gray-600 mt-1">Select an event to view statistics and manage registrations</p>
              </div>
              <Calendar className="h-6 w-6 text-brand-blue" />
            </div>

            {loadingEvents ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-brand-blue rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No events found</p>
                <Link
                  to="/admin/events/create"
                  className="bg-gradient-to-r from-brand-dark to-brand-blue text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
                >
                  <span>Create First Event</span>
                </Link>
              </div>
            ) : (
              <div>
                <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-3">
                  Select Event:
                </label>
                <div className="relative">
                  <select
                    id="event-select"
                    value={selectedEventId}
                    onChange={(e) => handleEventSelect(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all duration-200 appearance-none bg-white pr-10 font-medium"
                  >
                    <option value="">Select an event...</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {event.location} - {formatEventDate(event.date)} ({event.status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>

                {selectedEvent && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-brand-light to-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white p-2 rounded-lg">
                        <Calendar className="h-5 w-5 text-brand-blue" />
                      </div>
                      <div>
                        <div className="font-semibold text-brand-dark">{selectedEvent.name}</div>
                        <div className="text-sm text-gray-700">
                          {selectedEvent.location} • {formatEventDate(selectedEvent.date)} • Status: {selectedEvent.status}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Registration Statistics - Directly Connected Below */}
          {selectedEventId ? (
            <div className="p-8">
              {loadingStats ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-brand-blue rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading registration statistics...</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center space-x-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-brand-blue" />
                    <h3 className="text-lg font-semibold text-gray-900">Registration Statistics</h3>
                  </div>
                  <StatsCards
                    stats={stats}
                    onStatClick={handleStatClick}
                    onExportClick={handleExportExcel}
                    selectedEventName={selectedEvent?.name}
                  />
                </div>
              )}
            </div>
          ) : events.length > 0 && (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Event Above</h3>
              <p className="text-gray-600">Choose an event to view registration statistics and manage check-ins</p>
            </div>
          )}
        </div>

        {/* Quick Email Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Quick Email</h2>
            <Mail className="h-6 w-6 text-brand-light" />
          </div>

          {/* Email Error Message */}
          {emailError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{emailError}</p>
            </div>
          )}

          {/* Email Success Message */}
          {emailSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-600 text-sm">{emailSuccess}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Audience Selector */}
            <AudienceSelector
              mode={emailRecipientMode}
              selection={emailAudienceSelection}
              onModeChange={(newMode) => {
                setEmailRecipientMode(newMode);
                setEmailAudienceSelection({ mode: newMode });
                setEmailRecipientCount(null);
                if (newMode !== 'individuals') {
                  setEmailRecipients('');
                  setEmailRecipientObjects([]);
                }
              }}
              onSelectionChange={(newSelection) => {
                setEmailAudienceSelection(newSelection);
              }}
              disabled={emailLoading}
            />

            {/* Individual Recipients (only for individuals mode) */}
            {emailRecipientMode === 'individuals' && (
              <div>
                <label htmlFor="email-recipients" className="block text-sm font-medium text-gray-700 mb-2">
                  To (Email Addresses) *
                </label>
                <EmailRecipientAutocomplete
                  id="email-recipients"
                  value={emailRecipients}
                  onChange={(newValue) => {
                    setEmailRecipients(newValue);
                  }}
                  onRecipientsChange={(recipientObjs) => {
                    setEmailRecipientObjects(recipientObjs);
                    setEmailRecipientCount(recipientObjs.length);
                  }}
                  placeholder="Start typing to search members or enter email addresses..."
                  disabled={emailLoading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Type to search approved members, or enter email addresses (comma-separated).
                </p>
              </div>
            )}

            {/* Recipient Preview (for audience modes) */}
            {emailRecipientMode !== 'individuals' && (
              <RecipientPreview
                mode={emailRecipientMode}
                selection={emailAudienceSelection}
                onRecipientsResolved={(count) => {
                  setEmailRecipientCount(count);
                }}
              />
            )}

            {/* Recipient Count for individuals mode */}
            {emailRecipientMode === 'individuals' && emailRecipientCount !== null && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  Recipients: {emailRecipientCount}
                </p>
              </div>
            )}

            {/* Subject */}
            <div>
              <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject {selectedEventId ? '(Optional)' : '*'}
              </label>
              <input
                id="email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={selectedEventId ? `Update for ${selectedEvent?.name || 'event'}` : 'Enter email subject'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required={!selectedEventId}
              />
            </div>

            {/* Message Body */}
            <div>
              <label htmlFor="email-message" className="block text-sm font-medium text-gray-700 mb-2">
                Message Body *
              </label>
              <textarea
                id="email-message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Enter your email message here..."
                required
              />
            </div>
          </div>

          {/* Send Button */}
          <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
            <Link
              to="/admin/email"
              className="text-brand-light hover:text-blue-700 font-medium flex items-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>Advanced Email Panel</span>
            </Link>
            
            <button
              onClick={() => sendQuickEmail()}
              disabled={
                emailLoading || 
                !emailMessage.trim() ||
                (emailRecipientMode === 'individuals' && emailRecipientObjects.length === 0 && !emailRecipients.trim()) ||
                (emailRecipientMode !== 'individuals' && (!emailRecipientCount || emailRecipientCount === 0)) ||
                (!emailSubject.trim() && !selectedEventId)
              }
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {emailLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* User List Modal */}
      <UserListModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        users={modalUsers}
        title={modalTitle}
        eventName={selectedEvent?.name || 'Event'}
        eventId={selectedEventId}
        onUserUpdate={handleUserUpdate}
      />

      {/* Igani Watermark */}
      <IganiWatermark position="bottom-right" size="sm" opacity={0.3} />

      {/* Confirmation Modal for Large Email Sends */}
      {showEmailConfirmModal && emailRecipientCount && emailRecipientCount > 50 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Confirm Bulk Email Send
              </h3>
              <p className="text-gray-600 mb-6">
                You are about to send an email to <strong>{emailRecipientCount} recipients</strong>.
                This action cannot be undone.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowEmailConfirmModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendQuickEmail(true)}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                >
                  Confirm Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;