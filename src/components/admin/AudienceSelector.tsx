import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';

export type RecipientMode = 'individuals' | 'group' | 'event' | 'chat' | 'location';

export interface AudienceSelection {
  mode: RecipientMode;
  ids?: string[];
  groupId?: string;
  eventId?: string;
  chatId?: string;
  location?: string;
}

interface AudienceSelectorProps {
  mode: RecipientMode;
  selection: AudienceSelection;
  onModeChange: (mode: RecipientMode) => void;
  onSelectionChange: (selection: AudienceSelection) => void;
  disabled?: boolean;
  excludedModes?: RecipientMode[]; // Modes to exclude from dropdown
}

interface EventOption {
  id: string;
  name: string;
  location: string;
  date: string;
}

interface ChatOption {
  id: string;
  name: string;
  memberCount: number;
}

const AudienceSelector: React.FC<AudienceSelectorProps> = ({
  mode,
  selection,
  onModeChange,
  onSelectionChange,
  disabled = false,
  excludedModes = []
}) => {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [chats, setChats] = useState<ChatOption[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Load events
  useEffect(() => {
    if (mode === 'event') {
      loadEvents();
    }
  }, [mode]);

  // Load chats
  useEffect(() => {
    if (mode === 'chat') {
      loadChats();
    }
  }, [mode]);

  // Load locations
  useEffect(() => {
    if (mode === 'location') {
      loadLocations();
    }
  }, [mode]);

  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      const eventsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EventOption));
      
      setEvents(eventsList);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadChats = async () => {
    try {
      setLoadingChats(true);
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, orderBy('lastActivity', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      // Get member counts for each chat
      const chatsWithCounts = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const chatData = doc.data();
          const membersRef = collection(db, 'chat_members');
          const membersQuery = query(membersRef, where('chatId', '==', doc.id));
          const membersSnapshot = await getDocs(membersQuery);
          
          return {
            id: doc.id,
            name: chatData.name || 'Unnamed Chat',
            memberCount: membersSnapshot.size
          };
        })
      );
      
      setChats(chatsWithCounts);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(query(usersRef, where('status', '==', 'approved')));
      
      const locationSet = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.city) locationSet.add(data.city);
        if (data.country) locationSet.add(data.country);
      });
      
      setLocations(Array.from(locationSet).sort());
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send To
        </label>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as RecipientMode)}
          disabled={disabled}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {!excludedModes.includes('individuals') && <option value="individuals">Individuals</option>}
          {!excludedModes.includes('group') && <option value="group">Group</option>}
          {!excludedModes.includes('event') && <option value="event">Event</option>}
          {!excludedModes.includes('chat') && <option value="chat">Chat</option>}
          {!excludedModes.includes('location') && <option value="location">Location</option>}
        </select>
      </div>

      {/* Conditional Pickers */}
      {mode === 'event' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          {loadingEvents ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading events...</span>
            </div>
          ) : (
            <select
              value={selection.eventId || ''}
              onChange={(e) => onSelectionChange({ ...selection, eventId: e.target.value || undefined })}
              disabled={disabled}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select an event --</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} ({event.location}) - {new Date(event.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'chat' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Chat
          </label>
          {loadingChats ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading chats...</span>
            </div>
          ) : (
            <select
              value={selection.chatId || ''}
              onChange={(e) => onSelectionChange({ ...selection, chatId: e.target.value || undefined })}
              disabled={disabled}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select a chat --</option>
              {chats.map(chat => (
                <option key={chat.id} value={chat.id}>
                  {chat.name} ({chat.memberCount} members)
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'location' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Location
          </label>
          {loadingLocations ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading locations...</span>
            </div>
          ) : (
            <select
              value={selection.location || ''}
              onChange={(e) => onSelectionChange({ ...selection, location: e.target.value || undefined })}
              disabled={disabled}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select a location --</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
};

export default AudienceSelector;
