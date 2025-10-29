import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, Users, Edit, Eye, Trash2, AlertTriangle, X, Mail, Phone, Briefcase, Download, Linkedin, ChevronDown, ArrowLeft, UserCheck, CheckCircle, Clock } from 'lucide-react';
import { EventService, EventData } from '../../services/eventService';
import AdminHeader from '../../components/admin/AdminHeader';
import EventPositionChart from '../../components/analytics/EventPositionChart';

const EventManagement: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    eventId: string;
    eventName: string;
  } | null>(null);
  
  // State for registrations modal
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [checkingInUsers, setCheckingInUsers] = useState<Set<string>>(new Set());

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
      eventName: event.name
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    const { eventId } = deleteConfirmation;
    setDeletingEvent(eventId);

    try {
      await EventService.deleteEvent(eventId);
      
      // Remove from local state
      setEvents(prev => prev.filter(event => event.id !== eventId));
      
      console.log('✅ Event deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      // You might want to show an error message to the user here
    } finally {
      setDeletingEvent(null);
      setDeleteConfirmation(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation(null);
  };

  // Function to handle showing registrations
  const handleShowRegistrations = async (event: EventData) => {
    setSelectedEvent(event);
    setShowRegistrations(true);
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
  };

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
      'completed': 'bg-blue-100 text-blue-800'
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Event Management" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Event Management" 
        subtitle="Create, manage, and monitor all Wine & Grind events"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <Link
            to="/admin"
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </Link>
        </div>

        {/* Header with Create Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            All Events ({events.length})
          </h1>
          <Link
            to="/admin/events/create"
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Create Event</span>
          </Link>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first Wine & Grind event.
            </p>
            <Link
              to="/admin/events/create"
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Create First Event</span>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover-lift">
                {/* Event Image */}
                <div className="h-48 bg-gray-200 relative">
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
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{event.location}</span>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {event.description}
                  </p>

                  {/* Status Update */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Status:
                    </label>
                    <select
                      value={event.status}
                      onChange={(e) => handleStatusUpdate(event.id, e.target.value as EventData['status'])}
                      disabled={updatingStatus === event.id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    >
                      <option value="active">Active - Show publicly, allow registration</option>
                      <option value="non-active">Non-Active - Hide from public view</option>
                      <option value="sold-out">Sold Out - Show publicly, disable registration</option>
                      <option value="completed">Completed - Show publicly, disable registration</option>
                    </select>
                    {updatingStatus === event.id && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Link
                      to={`/events/${event.slug}`} // Use slug instead of ID
                      className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-center flex items-center justify-center space-x-2 text-sm"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </Link>
                    <Link
                      to={`/admin/${event.id}/edit`}
                      className="flex-1 bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors duration-200 font-medium text-center flex items-center justify-center space-x-2 text-sm"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </Link>
                    <button 
                      className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors duration-200 font-medium flex items-center justify-center space-x-2 text-sm"
                      onClick={() => handleShowRegistrations(event)}
                    >
                      <Users className="h-4 w-4" />
                      <span>Registrations</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(event)}
                      disabled={deletingEvent === event.id}
                      className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors duration-200 font-medium flex items-center justify-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingEvent === event.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span>Delete</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Registrations for {selectedEvent.name}</h2>
                <p className="text-gray-600 mt-1">
                  {formatDate(selectedEvent.date)} • {selectedEvent.location}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportRegistrations}
                  disabled={registrations.length === 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium flex items-center space-x-2 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleCloseRegistrations}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-130px)]">
              {loadingRegistrations ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading registrations...</p>
                </div>
              ) : registrations.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Registrations Yet</h3>
                  <p className="text-gray-600">
                    No one has registered for this event yet.
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {registrations.length} {registrations.length === 1 ? 'registration' : 'registrations'}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700">
                          {registrations.filter(reg => reg.checkedIn).length} Checked In
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-gray-700">
                          {registrations.filter(reg => !reg.checkedIn).length} Not Checked In
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Position Chart */}
                  <div className="mb-6">
                    <EventPositionChart eventId={selectedEvent.id} />
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Work
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            LinkedIn
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Position
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registered
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {registrations.map((registration) => (
                          <tr key={registration.userId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden">
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
                                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                                      {registration.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{registration.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                <span>{registration.email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                <span>{registration.phone || 'Not provided'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Briefcase className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="truncate max-w-[150px]" title={registration.work}>
                                  {registration.work || 'Not provided'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Linkedin className="h-4 w-4 text-gray-400 mr-2" />
                                {registration.linkedinUsername ? (
                                  <a 
                                    href={`https://linkedin.com/in/${formatLinkedinUrl(registration.linkedinUsername)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {formatLinkedinUrl(registration.linkedinUsername)}
                                  </a>
                                ) : (
                                  <span>Not provided</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                                <span>{formatPosition(registration.position) || 'Not provided'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                registration.checkedIn 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {registration.checkedIn ? 'Checked In' : 'Not Checked In'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDateForExport(registration.registeredAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!registration.checkedIn ? (
                                <button
                                  onClick={() => handleManualCheckIn(registration.userId, registration.name)}
                                  disabled={checkingInUsers.has(registration.userId)}
                                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-3 py-1.5 rounded-lg hover:shadow-lg transition-all duration-300 font-medium text-sm flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={`Check in ${registration.name}`}
                                >
                                  {checkingInUsers.has(registration.userId) ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Checking In...</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3 w-3" />
                                      <span>Check In</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="flex items-center space-x-1.5 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Checked In</span>
                                  {registration.checkedInAt && (
                                    <div className="text-xs text-gray-500 ml-2">
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
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {registrations.length > 0 && (
                  <span>Use the Export button to download all registration data as CSV</span>
                )}
              </div>
              <button
                onClick={handleCloseRegistrations}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagement;