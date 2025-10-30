import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  MessageCircle,
  UserCog, 
  Megaphone, 
  Mic,
  FileText,
  Wand2,
  Settings,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  ChevronDown,
  UserPlus,
  Zap,
  RefreshCw,
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
  
  // SMS state
  const [smsMessage, setSmsMessage] = useState('');
  const [smsRecipientGroup, setSmsRecipientGroup] = useState<'all' | 'registered' | 'pending' | 'speaker'>('all');
  const [smsRecipientCount, setSmsRecipientCount] = useState(0);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);

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
  }, [selectedEventId]);

  // Update SMS recipient count when event or group changes
  useEffect(() => {
    updateSmsRecipientCount();
  }, [selectedEventId, smsRecipientGroup, registrations]);

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

  // Get count of pending users
  const getPendingUsersCount = async (): Promise<number> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      
      return snapshot.size;
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

  // SMS helper functions
  const updateSmsRecipientCount = async () => {
    if (!selectedEventId || !registrations.length) {
      setSmsRecipientCount(0);
      return;
    }

    try {
      let filteredUsers = registrations;

      switch (smsRecipientGroup) {
        case 'all':
          filteredUsers = registrations;
          break;
        case 'registered':
          filteredUsers = registrations.filter(reg => !reg.checkedIn);
          break;
        case 'pending':
          filteredUsers = registrations.filter(reg => reg.status === 'pending');
          break;
        case 'speaker':
          const selectedEvent = events.find(e => e.id === selectedEventId);
          const eventSpeakers = selectedEvent?.speakers || [];
          filteredUsers = registrations.filter(reg => 
            eventSpeakers.some((speaker: any) => speaker.userId === reg.userId)
          );
          break;
      }

      // Filter out users without phone numbers
      const usersWithPhones = filteredUsers.filter(user => user.phone && user.phone.trim());
      setSmsRecipientCount(usersWithPhones.length);
    } catch (error) {
      console.error('❌ Error counting SMS recipients:', error);
      setSmsRecipientCount(0);
    }
  };

  const sendQuickSMS = async () => {
    if (!selectedEventId) {
      setSmsError('Please select an event');
      return;
    }

    if (!smsMessage.trim()) {
      setSmsError('Please enter a message');
      return;
    }

    if (smsMessage.length > 300) {
      setSmsError('Message must be 300 characters or less');
      return;
    }

    if (smsRecipientCount === 0) {
      setSmsError('No recipients found for the selected group');
      return;
    }

    setSmsLoading(true);
    setSmsError(null);
    setSmsSuccess(null);

    try {
      let filteredUsers = registrations;

      switch (smsRecipientGroup) {
        case 'all':
          filteredUsers = registrations;
          break;
        case 'registered':
          filteredUsers = registrations.filter(reg => !reg.checkedIn);
          break;
        case 'pending':
          filteredUsers = registrations.filter(reg => reg.status === 'pending');
          break;
        case 'speaker':
          const selectedEvent = events.find(e => e.id === selectedEventId);
          const eventSpeakers = selectedEvent?.speakers || [];
          filteredUsers = registrations.filter(reg => 
            eventSpeakers.some((speaker: any) => speaker.userId === reg.userId)
          );
          break;
      }

      // Filter out users without phone numbers and deduplicate
      const usersWithPhones = filteredUsers.filter(user => user.phone && user.phone.trim());
      const uniquePhones = new Set<string>();
      const uniqueUsers = usersWithPhones.filter(user => {
        const normalizedPhone = user.phone.replace(/\D/g, '');
        if (uniquePhones.has(normalizedPhone)) {
          return false;
        }
        uniquePhones.add(normalizedPhone);
        return true;
      });

      console.log(`📱 Sending SMS to ${uniqueUsers.length} unique recipients`);

      let successCount = 0;
      let failureCount = 0;

      // Send SMS to each user via API endpoint
      for (const user of uniqueUsers) {
        try {
          const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user.phone,
              body: smsMessage
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          console.error(`❌ Failed to send SMS to ${user.name}:`, error);
        }

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Show results
      if (successCount > 0 && failureCount === 0) {
        setSmsSuccess(`✅ Successfully sent ${successCount} messages!`);
        setSmsMessage(''); // Clear form on success
      } else if (successCount > 0 && failureCount > 0) {
        setSmsSuccess(`⚠️ Sent ${successCount} messages successfully, ${failureCount} failed.`);
      } else {
        setSmsError(`❌ All ${failureCount} messages failed to send.`);
      }

    } catch (error: any) {
      console.error('❌ SMS sending error:', error);
      setSmsError(`Failed to send messages: ${error.message}`);
    } finally {
      setSmsLoading(false);
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
                <UserCog className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Welcome back, <span className="text-purple-600">{user?.displayName?.split(' ')[0] || 'Admin'}</span>! 👋
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
                    <Calendar className="h-8 w-8 text-purple-600" />
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
                    <p className="text-gray-600 text-sm">Add a new Wine & Grind event</p>
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
                to="/admin/sms"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">SMS Messages</h4>
                    <p className="text-gray-600 text-sm">Send messages to members</p>
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

              <Link
                to="/admin/ad-generator"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Wand2 className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Ad Generator</h4>
                    <p className="text-gray-600 text-sm">AI-powered marketing ads</p>
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
                to="/admin/speakers"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Mic className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Speakers</h4>
                    <p className="text-gray-600 text-sm">Manage speaker files</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-blue-600" />
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

              <Link
                to="/admin/profile-sync"
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 hover-lift"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <RefreshCw className="h-8 w-8 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900">Profile Sync</h4>
                    <p className="text-gray-600 text-sm">Fix profile picture display</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Event Selection Dropdown */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Event Selection</h2>
            <Calendar className="h-6 w-6 text-gray-400" />
          </div>
          
          {loadingEvents ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No events found</p>
              <Link
                to="/admin/events/create"
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
              >
                <span>Create First Event</span>
              </Link>
            </div>
          ) : (
            <div>
              <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-3">
                Select Event to Manage:
              </label>
              <div className="relative">
                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => handleEventSelect(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white pr-10"
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
                <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-semibold text-purple-900">{selectedEvent.name}</div>
                      <div className="text-sm text-purple-700">
                        {selectedEvent.location} • {formatEventDate(selectedEvent.date)} • Status: {selectedEvent.status}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick SMS Section - Only show if event is selected */}
        {selectedEventId && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Quick SMS</h2>
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>

            {/* SMS Error Message */}
            {smsError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-600 text-sm">{smsError}</p>
              </div>
            )}

            {/* SMS Success Message */}
            {smsSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-green-600 text-sm">{smsSuccess}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recipient Group Selection */}
              <div>
                <label htmlFor="sms-group" className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Group
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    id="sms-group"
                    value={smsRecipientGroup}
                    onChange={(e) => setSmsRecipientGroup(e.target.value as any)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
                  >
                    <option value="all">All Users</option>
                    <option value="registered">Registered (Not Checked In)</option>
                    <option value="pending">Pending Users</option>
                    <option value="speaker">Speakers</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  📊 {smsRecipientCount} recipients
                </div>
              </div>

              {/* Message Input */}
              <div>
                <label htmlFor="sms-message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message ({smsMessage.length}/300)
                </label>
                <textarea
                  id="sms-message"
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                  maxLength={300}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Enter your message..."
                />
                <div className={`mt-2 text-sm ${smsMessage.length > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                  {300 - smsMessage.length} characters remaining
                </div>
              </div>
            </div>

            {/* Send Button */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
              <Link
                to="/admin/sms"
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Advanced SMS Panel</span>
              </Link>
              
              <button
                onClick={sendQuickSMS}
                disabled={smsLoading || smsRecipientCount === 0 || !smsMessage.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {smsLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send to {smsRecipientCount}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Registration Stats - Only show if event is selected */}
        {selectedEventId ? (
          <div className="mb-8">
            {loadingStats ? (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading registration statistics...</p>
                </div>
              </div>
            ) : (
              <StatsCards 
                stats={stats} 
                onStatClick={handleStatClick}
                onExportClick={handleExportExcel}
                selectedEventName={selectedEvent?.name}
              />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Select an Event</h3>
              <p className="text-gray-600">Choose an event from the dropdown above to view registration statistics and manage check-ins.</p>
            </div>
          </div>
        )}
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
    </div>
  );
};

export default AdminDashboard;