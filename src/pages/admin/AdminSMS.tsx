import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Users, AlertCircle, CheckCircle, ArrowLeft, Calendar, ChevronDown, User, Search, X } from 'lucide-react';
import { EventService, EventData } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';

interface SMSLog {
  id: string;
  eventId: string;
  eventName: string;
  recipientGroup: string;
  message: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentAt: Date;
  sentBy: string;
}

const AdminSMS: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [recipientGroup, setRecipientGroup] = useState<'all' | 'registered' | 'pending' | 'speaker' | 'custom'>('all');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [sendingProgress, setSendingProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
  } | null>(null);
  
  // User selection states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSelection, setShowUserSelection] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadUsersForEvent();
      updateRecipientCount();
    }
  }, [selectedEventId, recipientGroup, selectedUsers]);

  const loadEvents = async () => {
    try {
      const eventsData = await EventService.getAllEvents();
      setEvents(eventsData);
      
      // Auto-select the first event
      if (eventsData.length > 0) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (error) {
      console.error('❌ Error loading events:', error);
      setError('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadUsersForEvent = async () => {
    if (!selectedEventId) {
      setAllUsers([]);
      return;
    }

    try {
      const registrations = await EventService.getEventRegistrations(selectedEventId);
      setAllUsers(registrations);
      
      // Reset user selection when changing events
      setSelectedUsers(new Set());
      setShowUserSelection(false);
    } catch (error) {
      console.error('❌ Error loading users:', error);
      setAllUsers([]);
    }
  };

  const updateRecipientCount = async () => {
    if (!selectedEventId) {
      setRecipientCount(0);
      return;
    }

    try {
      let filteredUsers = [];

      if (recipientGroup === 'custom') {
        // Use selected users
        filteredUsers = allUsers.filter(user => selectedUsers.has(user.userId || user.id));
      } else {
        // Get all registrations for the event
        const registrations = await EventService.getEventRegistrations(selectedEventId);
        
        // Get event details to access speakers array
        const eventDetails = await EventService.getEventById(selectedEventId);
        const eventSpeakers = eventDetails?.speakers || [];
        
        console.log('📊 Event speakers:', eventSpeakers);
        
        filteredUsers = registrations;

        switch (recipientGroup) {
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
            // Filter registrations to only include users who are in the event's speakers array
            filteredUsers = registrations.filter(reg => 
              eventSpeakers.some((speaker: any) => speaker.userId === reg.userId)
            );
            console.log('🎯 Filtered speaker registrations:', filteredUsers);
            break;
        }
      }

      // Filter out users without phone numbers
      const usersWithPhones = filteredUsers.filter(user => user.phone && user.phone.trim());
      setRecipientCount(usersWithPhones.length);
    } catch (error) {
      console.error('❌ Error counting recipients:', error);
      setRecipientCount(0);
    }
  };

  const validateForm = (): boolean => {
    if (!selectedEventId) {
      setError('Please select an event');
      return false;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return false;
    }

    if (message.length > 300) {
      setError('Message must be 300 characters or less');
      return false;
    }

    if (recipientCount === 0) {
      setError('No recipients found for the selected group');
      return false;
    }

    return true;
  };

  const sendSMS = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setSendingProgress({ total: recipientCount, sent: 0, failed: 0 });

    try {
      let filteredUsers = [];

      if (recipientGroup === 'custom') {
        // Use selected users
        filteredUsers = allUsers.filter(user => selectedUsers.has(user.userId || user.id));
      } else {
        // Get event details to access speakers array
        const eventDetails = await EventService.getEventById(selectedEventId);
        const eventSpeakers = eventDetails?.speakers || [];
        
        // Get registrations for the selected event
        const registrations = await EventService.getEventRegistrations(selectedEventId);
        filteredUsers = registrations;

        // Filter based on recipient group
        switch (recipientGroup) {
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
            // Filter to only include users who are in the event's speakers array
            filteredUsers = registrations.filter(reg => 
              eventSpeakers.some((speaker: any) => speaker.userId === reg.userId)
            );
            break;
        }
      }

      // Filter out users without phone numbers and deduplicate
      const usersWithPhones = filteredUsers.filter(user => user.phone && user.phone.trim());
      const uniquePhones = new Set<string>();
      const uniqueUsers = usersWithPhones.filter(user => {
        const normalizedPhone = normalizePhoneNumber(user.phone);
        if (uniquePhones.has(normalizedPhone)) {
          return false;
        }
        uniquePhones.add(normalizedPhone);
        return true;
      });

      console.log(`📱 Sending SMS to ${uniqueUsers.length} unique recipients`);

      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ phone: string; name: string; error: string }> = [];

      // Send SMS to each user via Netlify Function
      for (let i = 0; i < uniqueUsers.length; i++) {
        const user = uniqueUsers[i];
        
        try {
          await sendSMSViaNetlifyFunction(user.phone, message);
          successCount++;
          console.log(`✅ SMS sent to ${user.name} (${user.phone})`);
        } catch (error: any) {
          failureCount++;
          const errorMessage = error.message || 'Unknown error';
          failures.push({
            phone: user.phone,
            name: user.name,
            error: errorMessage
          });
          console.error(`❌ Failed to send SMS to ${user.name} (${user.phone}):`, errorMessage);
          
          // Enhanced logging for debugging
          console.error('Full error details:', {
            statusCode: error.statusCode,
            responseText: error.responseText,
            fullError: error
          });
          
          // Log failure to console (in production, you'd log to a database)
          logSMSFailure(selectedEventId, user, errorMessage);
        }

        // Update progress
        setSendingProgress({
          total: uniqueUsers.length,
          sent: successCount,
          failed: failureCount
        });

        // Small delay between messages to avoid overwhelming the function
        if (i < uniqueUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Show results
      if (successCount > 0 && failureCount === 0) {
        setSuccess(`✅ Successfully sent ${successCount} messages!`);
      } else if (successCount > 0 && failureCount > 0) {
        setSuccess(`⚠️ Sent ${successCount} messages successfully, ${failureCount} failed. Check console for details.`);
      } else {
        setError(`❌ All ${failureCount} messages failed to send. Check your Twilio configuration in Netlify.`);
      }

      // Log the SMS campaign
      logSMSCampaign(selectedEventId, recipientGroup, message, uniqueUsers.length, successCount, failureCount);

      // Clear form on success
      if (successCount > 0) {
        setMessage('');
      }

    } catch (error: any) {
      console.error('❌ SMS sending error:', error);
      setError(`Failed to send messages: ${error.message}`);
    } finally {
      setLoading(false);
      setSendingProgress(null);
    }
  };

  // FIXED: Use correct Netlify Function endpoint
  const sendSMSViaNetlifyFunction = async (to: string, body: string): Promise<void> => {
    try {
      // FIXED: Use correct Netlify function URL format
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          body
        })
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      // Get response text first for better error handling
      const responseText = await response.text();
      console.log(`📥 Response text:`, responseText);

      // Enhanced error handling for non-200 responses
      if (!response.ok) {
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          // If not JSON, create error object with status info
          console.error('❌ Response is not JSON:', responseText);
          const error = new Error(`SMS failed: HTTP ${response.status} - ${response.statusText}`);
          (error as any).statusCode = response.status;
          (error as any).responseText = responseText;
          throw error;
        }
        
        const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}`;
        const error = new Error(errorMessage);
        (error as any).statusCode = response.status;
        (error as any).responseText = responseText;
        throw error;
      }

      // Parse successful response with validation
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Success response is not JSON:', responseText);
        throw new Error('SMS failed: Invalid server response');
      }

      // Validate that we got a success response
      if (!result.success) {
        throw new Error(result.error || 'SMS sending failed');
      }

      console.log('✅ SMS sent successfully:', result);
      return result;
      
    } catch (error: any) {
      console.error('❌ SMS request failed:', error);
      
      // Enhanced error logging with full details
      console.error('Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        responseText: error.responseText,
        stack: error.stack
      });
      
      throw error;
    }
  };

  const normalizePhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it starts with 0 (Israeli format), replace with +972
    if (digits.startsWith('0')) {
      return `+972${digits.substring(1)}`;
    }
    
    // If it doesn't start with +, assume it needs +972
    if (!phone.startsWith('+')) {
      return `+972${digits}`;
    }
    
    return phone;
  };

  const logSMSFailure = (eventId: string, user: any, error: string) => {
    // In production, you would save this to a database
    console.log('📝 SMS Failure Log:', {
      eventId,
      userId: user.userId,
      name: user.name,
      phone: user.phone,
      error,
      timestamp: new Date().toISOString()
    });
  };

  const logSMSCampaign = (eventId: string, group: string, message: string, total: number, success: number, failed: number) => {
    // In production, you would save this to a database
    console.log('📝 SMS Campaign Log:', {
      eventId,
      recipientGroup: group,
      message,
      recipientCount: total,
      successCount: success,
      failureCount: failed,
      sentAt: new Date().toISOString(),
      sentBy: user?.uid
    });
  };

  const getGroupLabel = (group: string) => {
    const labels = {
      all: 'All Users',
      registered: 'Registered (Not Checked In)',
      pending: 'Pending Users',
      speaker: 'Speakers',
      custom: 'Custom Selection'
    };
    return labels[group as keyof typeof labels] || group;
  };

  // User selection helper functions
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsers = () => {
    const usersWithPhones = allUsers.filter(user => user.phone && user.phone.trim());
    const allUserIds = usersWithPhones.map(user => user.userId || user.id);
    setSelectedUsers(new Set(allUserIds));
  };

  const clearUserSelection = () => {
    setSelectedUsers(new Set());
  };

  const filteredUsers = allUsers.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loadingEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="SMS Panel" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
        title="SMS Panel" 
        subtitle="Send SMS messages to event registrants via Twilio Netlify Function"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full mb-4">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              SMS Panel
            </h1>
            <p className="text-gray-600">
              Send SMS messages to event registrants via Twilio Netlify Function
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          {/* Sending Progress */}
          {sendingProgress && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-800 font-medium">Sending Messages...</span>
                <span className="text-blue-600 text-sm">
                  {sendingProgress.sent + sendingProgress.failed} / {sendingProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((sendingProgress.sent + sendingProgress.failed) / sendingProgress.total) * 100}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-blue-600 mt-1">
                <span>✅ Sent: {sendingProgress.sent}</span>
                <span>❌ Failed: {sendingProgress.failed}</span>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); sendSMS(); }} className="space-y-6">
            {/* Event Selection */}
            <div>
              <label htmlFor="event" className="block text-sm font-medium text-gray-700 mb-2">
                Select Event *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  id="event"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
                  required
                >
                  <option value="">Select an event...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              {selectedEvent && (
                <div className="mt-2 text-sm text-gray-600">
                  📍 {selectedEvent.location} • Status: {selectedEvent.status}
                </div>
              )}
            </div>

            {/* Recipient Group Selection */}
            <div>
              <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Group *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  id="group"
                  value={recipientGroup}
                  onChange={(e) => setRecipientGroup(e.target.value as any)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
                  required
                >
                  <option value="all">All Users</option>
                  <option value="registered">Registered (Not Checked In)</option>
                  <option value="pending">Pending Users</option>
                  <option value="speaker">Speakers</option>
                  <option value="custom">Custom Selection</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                📊 {recipientCount} recipients will receive this message
              </div>
              
              {/* Custom Selection Button */}
              {recipientGroup === 'custom' && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowUserSelection(!showUserSelection)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors duration-200 flex items-center space-x-2"
                  >
                    <User className="h-4 w-4" />
                    <span>{showUserSelection ? 'Hide' : 'Show'} User Selection</span>
                    <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {selectedUsers.size} selected
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* User Selection Interface */}
            {recipientGroup === 'custom' && showUserSelection && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Recipients</h3>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={selectAllUsers}
                      className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors"
                    >
                      Select All ({allUsers.filter(u => u.phone?.trim()).length})
                    </button>
                    <button
                      type="button"
                      onClick={clearUserSelection}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Users List */}
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredUsers.map(user => {
                    const userId = user.userId || user.id;
                    const isSelected = selectedUsers.has(userId);
                    const hasPhone = user.phone && user.phone.trim();

                    return (
                      <div
                        key={userId}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-200' 
                            : hasPhone 
                              ? 'bg-white border-gray-200 hover:bg-gray-50' 
                              : 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => hasPhone && toggleUserSelection(userId)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => hasPhone && toggleUserSelection(userId)}
                          disabled={!hasPhone}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="text-sm text-gray-500">
                            {user.phone || '❌ No phone number'}
                          </div>
                        </div>
                        {!hasPhone && (
                          <div className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                            No SMS
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No users found matching your search.
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  {selectedUsers.size} users selected • {allUsers.filter(u => u.phone?.trim()).length} users have phone numbers
                </div>
              </div>
            )}

            {/* Message Input */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message * ({message.length}/300 characters)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={300}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Enter your message here..."
                required
              />
              <div className="mt-2 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  💡 Keep it concise and include event details if relevant
                </div>
                <div className={`text-sm ${message.length > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                  {300 - message.length} characters remaining
                </div>
              </div>
            </div>

            {/* Send Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={loading || recipientCount === 0}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Messages...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Send SMS to {recipientCount} Recipients</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Information Box */}
          <div className="mt-8 bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">📱 SMS Information:</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Endpoint:</strong> Uses Vercel API: <code>/api/send-sms</code></li>
              <li>• <strong>Response Validation:</strong> All responses are validated as JSON before processing</li>
              <li>• <strong>Error Handling:</strong> Enhanced error logging with statusCode, responseText, and full error details</li>
              <li>• <strong>Phone Formatting:</strong> Automatically formats Israeli numbers (+972)</li>
              <li>• <strong>Deduplication:</strong> Duplicate phone numbers are filtered out</li>
              <li>• <strong>Rate Limiting:</strong> 200ms delay between messages to avoid overwhelming the API</li>
              <li>• <strong>Twilio Integration:</strong> Configure TWILIO_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID in Netlify</li>
              <li>• <strong>Logging:</strong> All successes and failures are logged with detailed information</li>
              <li>• <strong>Speaker Filtering:</strong> When "Speakers" is selected, only speakers assigned to the current event are included</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSMS;