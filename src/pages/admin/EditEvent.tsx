import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { Calendar, MapPin, Image, FileText, AlertCircle, CheckCircle, Loader2, ImagePlus } from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import SaveButtonWithFeedback from '../../components/ui/SaveButtonWithFeedback';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';
import { EventService, EventData, generateSlug } from '../../services/eventService';
import { uploadImageToLibrary } from '../../services/imageUploadService';
import CropImage from '../../components/profile/CropImage';
import CoverPhotoCropModal, { type CoverCrop } from '../../components/profile/CoverPhotoCropModal';
import AudienceSelector, { RecipientMode, AudienceSelection } from '../../components/admin/AudienceSelector';
import { hasAudiencePickForMode } from '../../utils/eventAudienceUtils';
import EmailRecipientAutocomplete, { EmailRecipient } from '../../components/admin/EmailRecipientAutocomplete';
import RecipientPreview from '../../components/admin/RecipientPreview';
import { EventDatetimeLocalDualPreview } from '../../components/EventDualTimezoneDisplay';
import { ALMA_CHAPTER_SELECT_VALUES } from '../../utils/eventChapterTimezones';
import { triggerEventCompletedThankYouEmail } from '../../utils/triggerEventCompletedThankYouEmail';
import HubSpotEventSyncPanel from '../../components/admin/HubSpotEventSyncPanel';
import { syncEventToHubSpot } from '../../utils/hubspotEventSync';

const EditEvent: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  
  const [originalEvent, setOriginalEvent] = useState<EventData | null>(null);
  const [originalPrivateDetails, setOriginalPrivateDetails] = useState<{
    meetingUrl?: string;
    venueAddress?: string;
    resourceLinkUrl?: string;
    resourceLinkLabel?: string;
    zoomRecordingUrl?: string;
    zoomPassword?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    date: '',
    description: '',
    imageUrl: '',
    imageCrop: null as CoverCrop | null,
    status: 'active' as const,
    meetingUrl: '',
    venueAddress: '',
    resourceLinkUrl: '',
    resourceLinkLabel: '',
    chapter: '',
    eventFormat: 'in_person' as 'in_person' | 'virtual' | 'hybrid',
    costNote: '',
    speakerName: '',
    speakerImageUrl: '',
    zoomRecordingUrl: '',
    zoomPassword: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [showImageCropModal, setShowImageCropModal] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [audienceMode, setAudienceMode] = useState<RecipientMode>('all_users');
  const [audienceSelection, setAudienceSelection] = useState<AudienceSelection>({ mode: 'all_users' });
  const [audienceRecipientCount, setAudienceRecipientCount] = useState<number | null>(null);
  const [individualRecipients, setIndividualRecipients] = useState('');
  const [individualRecipientObjects, setIndividualRecipientObjects] = useState<EmailRecipient[]>([]);

  // Load event data on component mount
  useEffect(() => {
    console.log('🔧 EditEvent - Component mounted with eventId:', eventId);
    if (eventId) {
      loadEvent();
    } else {
      console.error('❌ EditEvent - No eventId provided in route params');
      setError('Event ID is missing from the URL');
      setLoading(false);
    }
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) {
      console.error('❌ EditEvent - loadEvent called without eventId');
      setError('Event ID is required');
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 EditEvent - Loading event with ID:', eventId);
      setLoading(true);
      setError(null);
      const event = await EventService.getEventById(eventId, { skipAudienceVisibility: true });
      
      if (!event) {
        console.error('❌ EditEvent - Event not found for ID:', eventId);
        setError(`Event not found. The event with ID "${eventId}" does not exist.`);
        setLoading(false);
        return;
      }

      console.log('✅ EditEvent - Event loaded successfully:', event.name);

      setOriginalEvent(event);
      
      // Convert date to datetime-local format
      const dateForInput = new Date(event.date).toISOString().slice(0, 16);
      
      const privateDetails = await EventService.getEventPrivateDetails(eventId);
      setOriginalPrivateDetails({
        meetingUrl: privateDetails?.meetingUrl ?? '',
        venueAddress: privateDetails?.venueAddress ?? '',
        resourceLinkUrl: privateDetails?.resourceLinkUrl ?? '',
        resourceLinkLabel: privateDetails?.resourceLinkLabel ?? '',
        zoomRecordingUrl: privateDetails?.zoomRecordingUrl ?? privateDetails?.zoom_recording_url ?? '',
        zoomPassword: privateDetails?.zoomPassword ?? privateDetails?.zoom_password ?? '',
      });
      setFormData({
        name: event.name,
        location: event.location,
        date: dateForInput,
        description: event.description,
        imageUrl: event.imageUrl,
        imageCrop: event.imageCrop ?? null,
        status: event.status,
        meetingUrl: privateDetails?.meetingUrl ?? '',
        venueAddress: privateDetails?.venueAddress ?? '',
        resourceLinkUrl: privateDetails?.resourceLinkUrl ?? '',
        resourceLinkLabel: privateDetails?.resourceLinkLabel ?? '',
        chapter: (event as { chapter?: string }).chapter ?? '',
        eventFormat: (event as EventData).eventFormat ?? 'in_person',
        costNote: (event as EventData).costNote ?? '',
        speakerName: (event as EventData).speakerName ?? '',
        speakerImageUrl: (event as EventData).speakerImageUrl ?? '',
        zoomRecordingUrl: privateDetails?.zoomRecordingUrl ?? privateDetails?.zoom_recording_url ?? '',
        zoomPassword: privateDetails?.zoomPassword ?? privateDetails?.zoom_password ?? '',
      });
      const rawAudience = (event as EventData & { eventAudience?: AudienceSelection | null }).eventAudience || {
        mode: 'all_users' as RecipientMode,
      };
      const savedAudience: AudienceSelection = { ...rawAudience };
      if (savedAudience.mode === 'event' && savedAudience.eventId && !savedAudience.eventIds?.length) {
        savedAudience.eventIds = [savedAudience.eventId];
      }
      if (savedAudience.mode === 'chat' && savedAudience.chatId && !savedAudience.chatIds?.length) {
        savedAudience.chatIds = [savedAudience.chatId];
      }
      if (savedAudience.mode === 'location' && savedAudience.location && !savedAudience.locations?.length) {
        savedAudience.locations = [savedAudience.location];
      }
      setAudienceMode(savedAudience.mode || 'all_users');
      setAudienceSelection(savedAudience);
      if (savedAudience.mode === 'individuals' && Array.isArray(savedAudience.ids) && savedAudience.ids.length) {
        const hydrated = await Promise.all(
          savedAudience.ids.map(async (uid) => {
            const u = await EventService.getUserById(uid);
            const email = (u?.email || '').trim();
            const name = (u?.name || u?.displayName || '') as string;
            return { uid, email, name: name || undefined };
          })
        );
        const withEmail = hydrated.filter((r) => r.email);
        setIndividualRecipientObjects(withEmail);
        setIndividualRecipients(withEmail.map((r) => r.email).join(', '));
      } else {
        setIndividualRecipientObjects([]);
        setIndividualRecipients('');
      }
      
      setPreviewSlug(event.slug);
      
    } catch (err: any) {
      console.error('❌ Error loading event:', err);
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Generate preview slug when name changes
    if (name === 'name') {
      const slug = generateSlug(value);
      setPreviewSlug(slug);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Event name is required');
      return false;
    }
    if (!formData.location.trim()) {
      setError('Location is required');
      return false;
    }
    if (!formData.date) {
      setError('Date and time are required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (!formData.imageUrl.trim()) {
      setError('Event image is required (paste a URL or upload a photo)');
      return false;
    }
    if (formData.eventFormat === 'in_person' && !formData.chapter?.trim()) {
      setError('Chapter is required for in-person events (sets local time for members).');
      return false;
    }
    if (formData.status === 'active') {
      const uidCount = individualRecipientObjects.filter((r) => !!r.uid).length;
      if (!hasAudiencePickForMode(audienceMode, { ...audienceSelection, mode: audienceMode }, uidCount)) {
        setError('For active events, choose who can see this event.');
        return false;
      }
    }
    return true;
  };

  const hasChanges = (): boolean => {
    if (!originalEvent) return true;

    const originalDateForInput = new Date(originalEvent.date).toISOString().slice(0, 16);
    const orig = originalPrivateDetails || {};

    // Normalize strings for comparison (trim, treat null/undefined as '')
    const s = (v: string | undefined) => (v ?? '').toString().trim();

    const nextAudience =
      formData.status === 'active'
        ? {
            mode: audienceMode,
            ...(audienceMode === 'individuals'
              ? { ids: [...new Set(individualRecipientObjects.map((r) => r.uid).filter(Boolean) as string[])].sort() }
              : audienceSelection),
          }
        : null;
    const prevAudience = (originalEvent as EventData & { eventAudience?: AudienceSelection | null }).eventAudience;
    const audienceChanged = JSON.stringify(nextAudience) !== JSON.stringify(prevAudience ?? null);

    return (
      formData.name !== originalEvent.name ||
      formData.location !== originalEvent.location ||
      formData.date !== originalDateForInput ||
      formData.description !== originalEvent.description ||
      formData.imageUrl !== originalEvent.imageUrl ||
      JSON.stringify(formData.imageCrop) !== JSON.stringify(originalEvent.imageCrop) ||
      formData.status !== originalEvent.status ||
      s(formData.chapter) !== s((originalEvent as { chapter?: string }).chapter) ||
      formData.eventFormat !== ((originalEvent as EventData).eventFormat ?? 'in_person') ||
      s(formData.costNote) !== s((originalEvent as EventData).costNote) ||
      s(formData.speakerName) !== s((originalEvent as EventData).speakerName) ||
      s(formData.speakerImageUrl) !== s((originalEvent as EventData).speakerImageUrl) ||
      s(formData.meetingUrl) !== s(orig.meetingUrl) ||
      s(formData.venueAddress) !== s(orig.venueAddress) ||
      s(formData.resourceLinkUrl) !== s(orig.resourceLinkUrl) ||
      s(formData.resourceLinkLabel) !== s(orig.resourceLinkLabel) ||
      s(formData.zoomRecordingUrl) !== s(orig.zoomRecordingUrl) ||
      s(formData.zoomPassword) !== s(orig.zoomPassword) ||
      audienceChanged
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      setError('You must be logged in to edit events');
      return;
    }

    if (!eventId) {
      setError('Event ID is required');
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!hasChanges()) {
      setError('No changes detected');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await EventService.updateEvent(eventId, {
        name: formData.name,
        location: formData.location,
        date: formData.date,
        description: formData.description,
        imageUrl: formData.imageUrl,
        imageCrop: formData.imageCrop ?? null,
        status: formData.status,
        chapter: formData.chapter?.trim() || null,
        eventFormat: formData.eventFormat,
        costNote: formData.costNote?.trim() || null,
        speakerName: formData.speakerName?.trim() || null,
        speakerImageUrl: formData.speakerImageUrl?.trim() || null,
        eventAudience:
          formData.status === 'active'
            ? {
                mode: audienceMode,
                ...(audienceMode === 'individuals'
                  ? { ids: [...new Set(individualRecipientObjects.map((r) => r.uid).filter(Boolean) as string[])] }
                  : audienceSelection),
              }
            : null,
      });

      const becameCompleted =
        originalEvent?.status !== 'completed' && formData.status === 'completed';
      if (becameCompleted) {
        triggerEventCompletedThankYouEmail(eventId).then((r) => {
          if (!r.ok) console.warn('[EditEvent] Thank-you emails:', r.error);
        });
      }

      // Private details + HubSpot sync: use server APIs (bypasses client Firestore rules)
      let hubspotStatus = '';
      let hubspotSyncAttempted = false;
      let hubspotSynced = false;
      let announcementStatus = '';
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        const idToken = await getIdToken(firebaseUser);
        try {
          const privRes = await fetch('/api/update-event-private-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              eventId,
              locationText: formData.location,
              venueAddress: formData.venueAddress?.trim() || null,
              meetingUrl: formData.meetingUrl?.trim() || null,
              resourceLinkUrl: formData.resourceLinkUrl?.trim() || null,
              resourceLinkLabel: formData.resourceLinkLabel?.trim() || null,
              zoomRecordingUrl: formData.zoomRecordingUrl?.trim() || null,
              zoomPassword: formData.zoomPassword?.trim() || null,
            }),
            credentials: 'include',
          });
          if (!privRes.ok) {
            console.warn('[EditEvent] update-event-private-details failed:', privRes.status);
          }
        } catch (privErr) {
          console.warn('[EditEvent] update-event-private-details request failed:', (privErr as Error)?.message || privErr);
        }
        hubspotSyncAttempted = true;
        const syncResult = await syncEventToHubSpot(eventId);
        hubspotSynced = syncResult.synced;
        if (syncResult.synced) {
          hubspotStatus = ' Synced to HubSpot.';
          if (syncResult.hubspotDealId) {
            setOriginalEvent((prev) =>
              prev ? { ...prev, hubspotDealId: syncResult.hubspotDealId } : prev
            );
          }
        } else {
          console.warn('[EditEvent] HubSpot deal sync failed:', syncResult.error);
        }

        // Send announcement only when event transitions into active.
        const becameActive = originalEvent?.status !== 'active' && formData.status === 'active';
        if (becameActive) {
          try {
            const res = await fetch('/api/send-event-announcement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ eventId }),
              credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok && !data.skipped) {
              announcementStatus = ' Announcement sent.';
            } else if (!res.ok || data.error) {
              announcementStatus = ` Announcement failed: ${data.error || res.status}`;
              console.warn('[EditEvent] Announcement failed:', data.error || res.status);
            }
          } catch (announceErr) {
            announcementStatus = ` Announcement failed: ${announceErr instanceof Error ? announceErr.message : 'Network error'}`;
            console.warn('[EditEvent] Announcement request failed:', announceErr);
          }
        }
      }

      const savedEventAudience =
        formData.status === 'active'
          ? {
              mode: audienceMode,
              ...(audienceMode === 'individuals'
                ? { ids: [...new Set(individualRecipientObjects.map((r) => r.uid).filter(Boolean) as string[])] }
                : audienceSelection),
            }
          : null;
      setOriginalEvent((prev) =>
        prev
          ? {
              ...prev,
              name: formData.name,
              location: formData.location,
              date: formData.date,
              description: formData.description,
              imageUrl: formData.imageUrl,
              imageCrop: formData.imageCrop ?? null,
              status: formData.status,
              chapter: formData.chapter?.trim() || null,
              eventFormat: formData.eventFormat,
              costNote: formData.costNote?.trim() || null,
              speakerName: formData.speakerName?.trim() || null,
              speakerImageUrl: formData.speakerImageUrl?.trim() || null,
              eventAudience: savedEventAudience as EventData['eventAudience'],
            }
          : null
      );

      setOriginalPrivateDetails({
        meetingUrl: formData.meetingUrl,
        venueAddress: formData.venueAddress,
        resourceLinkUrl: formData.resourceLinkUrl,
        resourceLinkLabel: formData.resourceLinkLabel,
        zoomRecordingUrl: formData.zoomRecordingUrl,
        zoomPassword: formData.zoomPassword,
      });

      const syncFailed = hubspotSyncAttempted && !hubspotSynced;
      if (syncFailed) {
        setSuccess(
          `Event "${formData.name}" saved.${announcementStatus} Use HubSpot sync below to retry — the event is not linked to a Deal yet.`
        );
      } else {
        setSuccess(`Event "${formData.name}" updated successfully!${hubspotStatus}${announcementStatus}`);
      }
      setSavedAt(Date.now());

      if (!syncFailed) {
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      }

    } catch (err: any) {
      console.error('❌ Error updating event:', err);
      setError(err.message || 'Failed to update event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'active', label: 'Active - Show publicly, allow registration' },
    { value: 'non-active', label: 'Non-Active - Hide from public view' },
    { value: 'sold-out', label: 'Sold Out - Show publicly, disable registration' },
    { value: 'completed', label: 'Completed - Show publicly, disable registration' }
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <Loader2 className="h-8 w-8 text-brand-dark animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading Event</h1>
            <p className="text-gray-600">Please wait while we load the event details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !originalEvent) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Event</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <BackButton
              fallbackTo="/admin/events"
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Back Button */}
        <div className="mb-8">
          <BackButton fallbackTo="/admin/events" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Edit Event
            </h1>
            <p className="text-gray-600">
              Update the details of your AlmaLinks event
            </p>
            {!hasChanges() && (
              <p className="text-sm text-gray-500 mt-2">
                Make changes to update the event
              </p>
            )}
          </div>

          {eventId && originalEvent ? (
            <HubSpotEventSyncPanel
              className="mb-6"
              eventId={eventId}
              eventName={originalEvent.name}
              hubspotDealId={originalEvent.hubspotDealId}
              onHubspotDealIdChange={(dealId) =>
                setOriginalEvent((prev) => (prev ? { ...prev, hubspotDealId: dealId } : prev))
              }
            />
          ) : null}

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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Event Name *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., AlmaLinks 5.0"
                />
              </div>
              {/* URL Preview */}
              {previewSlug && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>Event URL Preview:</strong>
                  </div>
                  <div className="text-sm text-blue-900 font-mono">
                    almalinks.com/events/{previewSlug}
                  </div>
                  {originalEvent?.slug !== previewSlug && (
                    <div className="text-xs text-blue-700 mt-1">
                      URL will change from: /events/{originalEvent?.slug}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="location"
                  name="location"
                  type="text"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., Deli Vino, Netanya"
                />
              </div>
            </div>

            <div>
              <label htmlFor="eventFormat" className="block text-sm font-medium text-gray-700 mb-2">
                Event format *
              </label>
              <select
                id="eventFormat"
                name="eventFormat"
                value={formData.eventFormat}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="in_person">In person</option>
                <option value="virtual">Zoom / online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label htmlFor="chapter" className="block text-sm font-medium text-gray-700 mb-2">
                Chapter {formData.eventFormat === 'in_person' ? '*' : '(optional)'}
                {formData.eventFormat === 'in_person' ? (
                  <span className="font-normal text-gray-500"> — local time for this city</span>
                ) : null}
              </label>
              <select
                id="chapter"
                name="chapter"
                value={formData.chapter}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {ALMA_CHAPTER_SELECT_VALUES.map(v => (
                  <option key={v || 'none'} value={v}>
                    {v || 'Select chapter…'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="costNote" className="block text-sm font-medium text-gray-700 mb-2">
                Cost / pricing note (optional)
              </label>
              <textarea
                id="costNote"
                name="costNote"
                rows={2}
                value={formData.costNote}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="Shown on the public event page"
              />
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/80 space-y-4">
              <p className="text-sm font-medium text-gray-800">Speaker (optional)</p>
              <p className="text-xs text-gray-500 -mt-2">Small circular photo on the event detail page.</p>
              <div>
                <label htmlFor="speakerName" className="block text-sm text-gray-600 mb-1">Speaker name</label>
                <input
                  id="speakerName"
                  name="speakerName"
                  type="text"
                  value={formData.speakerName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Jane Cohen"
                />
              </div>
              <div>
                <label htmlFor="speakerImageUrl" className="block text-sm text-gray-600 mb-1">Speaker photo URL</label>
                <input
                  id="speakerImageUrl"
                  name="speakerImageUrl"
                  type="url"
                  value={formData.speakerImageUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://… (headshot; square works best)"
                />
                {formData.speakerImageUrl ? (
                  <img
                    src={formData.speakerImageUrl}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-full object-cover border border-gray-200"
                  />
                ) : null}
              </div>
            </div>

            {/* Private details (approved registrants only) */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
              <p className="text-sm font-medium text-gray-700">Approved-only details</p>
              <div>
                <label htmlFor="venueAddress" className="block text-sm text-gray-600 mb-1">Full venue address (optional)</label>
                <textarea
                  id="venueAddress"
                  name="venueAddress"
                  rows={3}
                  value={formData.venueAddress}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
                  placeholder="Street, building, floor — only approved registrants see this; included in Google Calendar and the approval email."
                />
                <p className="text-xs text-gray-500 mt-1">Keep the public Location field short; put the full address here.</p>
              </div>
              <div>
                <label htmlFor="meetingUrl" className="block text-sm text-gray-600 mb-1">Meeting URL (optional)</label>
                <input
                  id="meetingUrl"
                  name="meetingUrl"
                  type="url"
                  value={formData.meetingUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://zoom.us/j/… or Google Meet link"
                />
              </div>
              <div>
                <label htmlFor="resourceLinkUrl" className="block text-sm text-gray-600 mb-1">Additional link (optional)</label>
                <input
                  id="resourceLinkUrl"
                  name="resourceLinkUrl"
                  type="url"
                  value={formData.resourceLinkUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://… (agenda, doc, meeting room)"
                />
                <p className="text-xs text-gray-500 mt-1">Only visible to approved registrants; included in approval email.</p>
              </div>
              <div>
                <label htmlFor="resourceLinkLabel" className="block text-sm text-gray-600 mb-1">Link label (optional)</label>
                <input
                  id="resourceLinkLabel"
                  name="resourceLinkLabel"
                  type="text"
                  value={formData.resourceLinkLabel}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Agenda, Slides"
                />
              </div>
              <div>
                <label htmlFor="zoomRecordingUrl" className="block text-sm text-gray-600 mb-1">Zoom Recording Link (optional)</label>
                <input
                  id="zoomRecordingUrl"
                  name="zoomRecordingUrl"
                  type="url"
                  value={formData.zoomRecordingUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://zoom.us/rec/…"
                />
              </div>
              <div>
                <label htmlFor="zoomPassword" className="block text-sm text-gray-600 mb-1">Zoom Password (optional)</label>
                <input
                  id="zoomPassword"
                  name="zoomPassword"
                  type="text"
                  value={formData.zoomPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Meeting password"
                />
              </div>
              <p className="text-xs text-gray-500">Pictures link in HubSpot uses the event image above.</p>
            </div>

            {/* Date & Time */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="date"
                  name="date"
                  type="datetime-local"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <EventDatetimeLocalDualPreview value={formData.date} />
            </div>

            {/* Event Image: URL or upload */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Event Image *
              </label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || !file.type.startsWith('image/')) return;
                  setError(null);
                  setPendingImageFile(file);
                  setCropPreviewUrl(URL.createObjectURL(file));
                  setShowImageCropModal(true);
                  e.target.value = '';
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    placeholder="https://example.com/event-image.jpg or upload below"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={saving || imageUploading}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium"
                >
                  {imageUploading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" />
                      Upload photo
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paste a URL or upload an image to the image library (Cloudinary)
              </p>
              {formData.imageUrl && (
                <div className="mt-3 w-full h-48 rounded-xl border border-gray-200 overflow-hidden relative">
                  <CropImage
                    src={formData.imageUrl}
                    crop={formData.imageCrop}
                    alt="Event preview"
                    mode="block"
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            {showImageCropModal && cropPreviewUrl && (
              <CoverPhotoCropModal
                imageUrl={cropPreviewUrl}
                aspectRatio="16/9"
                title="Position event image"
                onConfirm={async (_url, crop) => {
                  if (!pendingImageFile) return;
                  setImageUploading(true);
                  setError(null);
                  try {
                    const url = await uploadImageToLibrary('events', pendingImageFile);
                    setFormData(prev => ({ ...prev, imageUrl: url, imageCrop: crop }));
                  } catch (err: any) {
                    setError(err.message || 'Image upload failed');
                  } finally {
                    setImageUploading(false);
                    URL.revokeObjectURL(cropPreviewUrl);
                    setCropPreviewUrl(null);
                    setPendingImageFile(null);
                    setShowImageCropModal(false);
                  }
                }}
                onCancel={() => {
                  if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
                  setCropPreviewUrl(null);
                  setPendingImageFile(null);
                  setShowImageCropModal(false);
                }}
              />
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Describe the event, topics, speakers, and what attendees can expect..."
              />
            </div>

            {/* Event Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Event Status *
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
                <p className="text-sm font-medium text-blue-900">Who should see this event?</p>
                {formData.status !== 'active' && (
                  <p className="text-xs text-blue-800">
                    Visibility settings are stored on the event and apply when status is Active.
                  </p>
                )}
                <AudienceSelector
                  mode={audienceMode}
                  selection={audienceSelection}
                  modeLabel="Show to"
                  onModeChange={(newMode) => {
                    setAudienceMode(newMode);
                    setAudienceSelection({ mode: newMode });
                    setAudienceRecipientCount(null);
                    if (newMode !== 'individuals') {
                      setIndividualRecipients('');
                      setIndividualRecipientObjects([]);
                    }
                  }}
                  onSelectionChange={setAudienceSelection}
                  disabled={saving}
                  excludedModes={['group']}
                />
                {audienceMode === 'individuals' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Individuals
                    </label>
                    <EmailRecipientAutocomplete
                      value={individualRecipients}
                      onChange={setIndividualRecipients}
                      recipientIcon="event"
                      onRecipientsChange={(items) => {
                        setIndividualRecipientObjects(items);
                        setAudienceRecipientCount(items.filter((r) => !!r.uid).length);
                      }}
                      placeholder="Search approved members..."
                      disabled={saving}
                    />
                  </div>
                )}
                {audienceMode !== 'individuals' && (
                  <RecipientPreview
                    mode={audienceMode}
                    selection={audienceSelection}
                    onRecipientsResolved={(count) => setAudienceRecipientCount(count)}
                  />
                )}
                {audienceRecipientCount !== null && (
                  <p className="text-xs text-blue-800">Estimated audience: {audienceRecipientCount}</p>
                )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-center space-x-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-semibold"
              >
                Cancel
              </button>
              <SaveButtonWithFeedback
                type="submit"
                saving={saving}
                savedAt={savedAt}
                disabled={!hasChanges()}
                label="Save Changes"
                successLabel="Changes saved"
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                successClassName="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center space-x-2"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditEvent;