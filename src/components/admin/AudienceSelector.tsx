import React, { useState, useEffect } from 'react';
import { Loader, X } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  effectiveChatAudienceIds,
  effectiveEventAudienceIds,
  effectiveLocationAudienceLabels,
} from '../../utils/eventAudienceUtils';
import { ALMA_CHAPTER_SELECT_VALUES } from '../../utils/eventChapterTimezones';

export type RecipientMode = 'individuals' | 'group' | 'event' | 'chat' | 'location' | 'chapter' | 'all_users';

export interface AudienceSelection {
  mode: RecipientMode;
  ids?: string[];
  groupId?: string;
  /** @deprecated use eventIds */
  eventId?: string;
  eventIds?: string[];
  /** @deprecated use chatIds */
  chatId?: string;
  chatIds?: string[];
  /** @deprecated use locations */
  location?: string;
  locations?: string[];
  /** Chapter targeting — members whose chapter field matches one of these values */
  chapters?: string[];
}

interface AudienceSelectorProps {
  mode: RecipientMode;
  selection: AudienceSelection;
  onModeChange: (mode: RecipientMode) => void;
  onSelectionChange: (selection: AudienceSelection) => void;
  disabled?: boolean;
  excludedModes?: RecipientMode[]; // Modes to exclude from dropdown
  modeLabel?: string;
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
  excludedModes = [],
  modeLabel = 'Send To',
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

  const selectedEventIds = effectiveEventAudienceIds(selection);
  const selectedChatIds = effectiveChatAudienceIds(selection);
  const selectedLocations = effectiveLocationAudienceLabels(selection);
  const selectedChapters: string[] = Array.isArray(selection?.chapters) ? selection.chapters.filter(Boolean) : [];

  const toggleChapter = (ch: string) => {
    const next = new Set(selectedChapters);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    onSelectionChange({ ...selection, chapters: Array.from(next) });
  };

  const toggleEventId = (id: string) => {
    const next = new Set(selectedEventIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange({
      ...selection,
      eventIds: Array.from(next),
      eventId: undefined,
    });
  };

  const toggleChatId = (id: string) => {
    const next = new Set(selectedChatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange({
      ...selection,
      chatIds: Array.from(next),
      chatId: undefined,
    });
  };

  const toggleLocation = (loc: string) => {
    const next = new Set(selectedLocations);
    if (next.has(loc)) next.delete(loc);
    else next.add(loc);
    onSelectionChange({
      ...selection,
      locations: Array.from(next),
      location: undefined,
    });
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
          {modeLabel}
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
          {!excludedModes.includes('chapter') && <option value="chapter">Chapter</option>}
          {!excludedModes.includes('all_users') && <option value="all_users">All users</option>}
        </select>
      </div>

      {/* Conditional Pickers */}
      {mode === 'event' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select events (one or more)
          </label>
          {selectedEventIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedEventIds.map((id) => {
                const ev = events.find((e) => e.id === id);
                const label = ev ? `${ev.name} (${new Date(ev.date).toLocaleDateString()})` : id;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs max-w-full"
                  >
                    <span className="truncate max-w-[200px]">{label}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleEventId(id)}
                      className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-50"
                      aria-label={`Remove ${label}`}
                    >
                      <X className="h-3 w-3 shrink-0" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {loadingEvents ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading events...</span>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
              {events.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 py-1">No events found.</p>
              ) : (
                events.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300"
                      checked={selectedEventIds.includes(event.id)}
                      disabled={disabled}
                      onChange={() => toggleEventId(event.id)}
                    />
                    <span className="text-gray-800">
                      <span className="font-medium">{event.name}</span>
                      <span className="text-gray-500"> — {event.location} · {new Date(event.date).toLocaleDateString()}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'chat' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select chats (one or more)
          </label>
          {selectedChatIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedChatIds.map((id) => {
                const ch = chats.find((c) => c.id === id);
                const label = ch ? `${ch.name} (${ch.memberCount} members)` : id;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs max-w-full"
                  >
                    <span className="truncate max-w-[200px]">{label}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleChatId(id)}
                      className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-50"
                      aria-label={`Remove ${label}`}
                    >
                      <X className="h-3 w-3 shrink-0" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {loadingChats ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading chats...</span>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
              {chats.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 py-1">No chats found.</p>
              ) : (
                chats.map((chat) => (
                  <label
                    key={chat.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300"
                      checked={selectedChatIds.includes(chat.id)}
                      disabled={disabled}
                      onChange={() => toggleChatId(chat.id)}
                    />
                    <span className="text-gray-800">
                      <span className="font-medium">{chat.name}</span>
                      <span className="text-gray-500"> — {chat.memberCount} members</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'location' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select locations (one or more)
          </label>
          {selectedLocations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedLocations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs"
                >
                  {loc}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleLocation(loc)}
                    className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-50"
                    aria-label={`Remove ${loc}`}
                  >
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {loadingLocations ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading locations...</span>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
              {locations.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 py-1">No locations from member profiles.</p>
              ) : (
                locations.map((loc) => (
                  <label
                    key={loc}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedLocations.includes(loc)}
                      disabled={disabled}
                      onChange={() => toggleLocation(loc)}
                    />
                    <span className="text-gray-800">{loc}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'chapter' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select chapters (one or more)
          </label>
          {selectedChapters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedChapters.map((ch) => (
                <span
                  key={ch}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs"
                >
                  {ch}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleChapter(ch)}
                    className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-50"
                    aria-label={`Remove ${ch}`}
                  >
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
            {ALMA_CHAPTER_SELECT_VALUES.filter(Boolean).map((ch) => (
              <label
                key={ch}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedChapters.includes(ch)}
                  disabled={disabled}
                  onChange={() => toggleChapter(ch)}
                />
                <span className="text-gray-800">{ch}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudienceSelector;
