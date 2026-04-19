import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { Calendar, MapPin, Image, FileText, ArrowLeft, AlertCircle, ImagePlus, Save } from 'lucide-react';
import SaveButtonWithFeedback from '../../components/ui/SaveButtonWithFeedback';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';
import { EventService, generateSlug } from '../../services/eventService';
import { uploadImageToLibrary } from '../../services/imageUploadService';
import CropModal from '../../components/profile/CropModal';
import CropImage from '../../components/profile/CropImage';
import AudienceSelector, { RecipientMode, AudienceSelection } from '../../components/admin/AudienceSelector';
import EmailRecipientAutocomplete, { EmailRecipient } from '../../components/admin/EmailRecipientAutocomplete';
import RecipientPreview from '../../components/admin/RecipientPreview';

const AddEvent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    date: '',
    description: '',
    imageUrl: '',
    imageCrop: null as { scale: number; panX: number; panY: number } | null,
    status: 'active' as const,
    meetingUrl: '',
    resourceLinkUrl: '',
    resourceLinkLabel: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [announcementFailedReason, setAnnouncementFailedReason] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [showImageCropModal, setShowImageCropModal] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [audienceMode, setAudienceMode] = useState<RecipientMode>('all_users');
  const [audienceSelection, setAudienceSelection] = useState<AudienceSelection>({ mode: 'all_users' });
  const [audienceRecipientCount, setAudienceRecipientCount] = useState<number | null>(null);
  const [individualRecipients, setIndividualRecipients] = useState('');
  const [individualRecipientObjects, setIndividualRecipientObjects] = useState<EmailRecipient[]>([]);

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
    if (formData.status === 'active') {
      const hasAudienceSelection =
        audienceMode === 'all_users' ||
        (audienceMode === 'individuals' && individualRecipientObjects.some((r) => !!r.uid)) ||
        (audienceMode === 'event' && !!audienceSelection.eventId) ||
        (audienceMode === 'chat' && !!audienceSelection.chatId) ||
        (audienceMode === 'location' && !!audienceSelection.location);
      if (!hasAudienceSelection) {
        setError('For active events, choose who can see this event.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      setError('You must be logged in to create events');
      return;
    }

    if (user?.role !== 'admin') {
      setError('Admin access required. Your account does not have admin permissions. Contact an administrator to update your role in Firestore (users/{uid} must have role="admin").');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setAnnouncementFailedReason(null);

    let eventCreateSucceeded = false;
    let eventId: string | null = null;

    try {
      console.log('[AddEvent] Event creation started');
      eventId = await EventService.createEvent(
        {
          name: formData.name,
          location: formData.location,
          date: formData.date,
          description: formData.description,
          imageUrl: formData.imageUrl,
          imageCrop: formData.imageCrop,
          status: formData.status,
          eventAudience:
            formData.status === 'active'
              ? {
                  mode: audienceMode,
                  ...(audienceMode === 'individuals'
                    ? { ids: [...new Set(individualRecipientObjects.map((r) => r.uid).filter(Boolean) as string[])] }
                    : audienceSelection),
                }
              : null,
        },
        user.uid
      );
      eventCreateSucceeded = true;
      console.log('[AddEvent] Firestore event write succeeded', eventId);

      // Capture values before resetting form (post-create runs async and will see reset state)
      const capturedLocation = formData.location;
      const capturedMeetingUrl = formData.meetingUrl?.trim() || null;
      const capturedResourceLinkUrl = formData.resourceLinkUrl?.trim() || null;
      const capturedResourceLinkLabel = formData.resourceLinkLabel?.trim() || null;
      const eventName = formData.name;

      // Fire-and-forget: private details + notifications (non-blocking)
      EventService.setEventPrivateDetails(eventId, {
        locationText: capturedLocation,
        meetingUrl: capturedMeetingUrl,
        resourceLinkUrl: capturedResourceLinkUrl,
        resourceLinkLabel: capturedResourceLinkLabel,
      }).catch((e) => console.warn('[AddEvent] setEventPrivateDetails failed:', e));
      import('../../services/notificationService').then(({ notifyAllUsersOfNewEvent }) =>
        notifyAllUsersOfNewEvent(eventId, eventName)
      );

      // Await HubSpot sync and announcement so we can show their status in the success message
      let hubspotStatus = '';
      let announcementSent = false;
      let announcementError: string | null = null;
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        try {
          const idToken = await getIdToken(firebaseUser);
          const syncRes = await fetch('/api/sync-event-to-hubspot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ eventId }),
            credentials: 'include',
          });
          const syncData = await syncRes.json().catch(() => ({}));
          if (syncRes.ok && syncData.synced) {
            hubspotStatus = ' Synced to HubSpot Deals.';
          } else {
            const err = syncData.error || (syncRes.status === 503 ? 'HUBSPOT_ACCESS_TOKEN not set' : `HTTP ${syncRes.status}`);
            hubspotStatus = ` HubSpot sync failed: ${err}`;
            console.warn('[AddEvent] HubSpot deal sync failed:', err);
          }
        } catch (hubErr) {
          hubspotStatus = ` HubSpot sync failed: ${hubErr instanceof Error ? hubErr.message : 'Network error'}`;
          console.warn('[AddEvent] HubSpot deal sync request failed:', hubErr);
        }

        // Only active events should trigger a new-event announcement.
        if (formData.status === 'active') {
          try {
            const idToken = await getIdToken(firebaseUser);
            const res = await fetch('/api/send-event-announcement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ eventId }),
              credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            announcementSent = res.ok && data.ok && !data.skipped;
            if (!res.ok || data.error) {
              announcementError = data.error || `HTTP ${res.status}`;
              console.warn('[AddEvent] Announcement not sent:', announcementError);
            }
          } catch (announceErr: unknown) {
            announcementError = announceErr instanceof Error ? announceErr.message : String(announceErr);
            if (announcementError?.includes('fetch') || announcementError?.includes('Failed to fetch') || announcementError?.includes('NetworkError')) {
              announcementError = 'Could not reach API. Locally: run the API in another terminal (npm run dev:express). On production: check Vercel env vars.';
            }
            console.warn('[AddEvent] Announcement request failed:', announceErr);
          }
        }
      }

      if (announcementError) setAnnouncementFailedReason(announcementError);
      setSavedAt(Date.now());
      setSuccess(
        announcementSent
          ? `Event "${eventName}" created with slug: ${previewSlug}.${hubspotStatus} Announcement sent to Mailchimp.`
          : announcementError
            ? `Event "${eventName}" created with slug: ${previewSlug}.${hubspotStatus} Mailchimp failed: ${announcementError}`
            : `Event "${eventName}" created successfully with slug: ${previewSlug}.${hubspotStatus}`
      );
      setFormData({
        name: '',
        location: '',
        date: '',
        description: '',
        imageUrl: '',
        imageCrop: null,
        status: 'active',
        meetingUrl: '',
        resourceLinkUrl: '',
        resourceLinkLabel: '',
      });
      setAudienceMode('all_users');
      setAudienceSelection({ mode: 'all_users' });
      setAudienceRecipientCount(null);
      setIndividualRecipients('');
      setIndividualRecipientObjects([]);
      setPreviewSlug('');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/admin');
      }, 2000);

    } catch (err: any) {
      if (!eventCreateSucceeded) {
        console.error('❌ Error creating event:', err);
        const msg = err?.message || '';
        const isPermissionError = msg.includes('permission') || msg.includes('insufficient');
        setError(
          isPermissionError
            ? 'Event creation failed: Missing or insufficient permissions. Ensure your Firestore user document (users/' +
              (user?.uid || 'your-uid') +
              ') has role="admin". If you recently became an admin, try signing out and back in.'
            : msg || 'Failed to create event. Please try again.'
        );
      } else {
        console.warn('[AddEvent] Follow-up step failed (event was created successfully):', err);
        setSavedAt(Date.now());
        setSuccess(`Event "${formData.name}" created successfully.`);
        setFormData({ name: '', location: '', date: '', description: '', imageUrl: '', imageCrop: null, status: 'active', meetingUrl: '', resourceLinkUrl: '', resourceLinkLabel: '' });
        setPreviewSlug('');
        setTimeout(() => navigate('/admin'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: 'active', label: 'Active - Show publicly, allow registration' },
    { value: 'non-active', label: 'Non-Active - Hide from public view' },
    { value: 'sold-out', label: 'Sold Out - Show publicly, disable registration' },
    { value: 'completed', label: 'Completed - Show publicly, disable registration' }
  ];

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create New Event
            </h1>
            <p className="text-gray-600">
              Fill in the details below to create a new AlmaLinks event
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
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
                <Save className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-green-600 text-sm">{success}</p>
              </div>
              {announcementFailedReason && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Email announcement did not send</p>
                    <p className="mt-1">{announcementFailedReason}</p>
                    <p className="mt-2 text-amber-700">
                      Locally: run the API in another terminal (<code className="bg-amber-100 px-1 rounded">npm run dev:express</code>). Production: set Mailchimp env vars in Vercel and ensure you are admin.
                    </p>
                  </div>
                </div>
              )}
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
                </div>
              )}
            </div>

            {/* Location (public placeholder; real location in private details below) */}
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

            {/* Private details (only visible to approved registrants) */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
              <p className="text-sm font-medium text-gray-700">Approved-only details (location & link shared after approval)</p>
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
                  disabled={loading || imageUploading}
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
              <CropModal
                imageUrl={cropPreviewUrl}
                aspect={16 / 9}
                cropShape="rect"
                title="Crop event image"
                onConfirm={async (croppedFile, _normalizedCrop) => {
                  setImageUploading(true);
                  setError(null);
                  try {
                    const url = await uploadImageToLibrary('events', croppedFile);
                    setFormData(prev => ({ ...prev, imageUrl: url, imageCrop: null }));
                  } catch (err: any) {
                    setError(err.message || 'Image upload failed');
                  } finally {
                    setImageUploading(false);
                    URL.revokeObjectURL(cropPreviewUrl);
                    setCropPreviewUrl(null);
                    setShowImageCropModal(false);
                  }
                }}
                onCancel={() => {
                  if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
                  setCropPreviewUrl(null);
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

            {formData.status === 'active' && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
                <p className="text-sm font-medium text-blue-900">Who should see this active event?</p>
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
                  disabled={loading}
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
                      disabled={loading}
                    />
                    <p className="mt-2 text-xs text-gray-500">Only selected members can see this event.</p>
                  </div>
                )}
                {audienceMode !== 'individuals' && (
                  <RecipientPreview
                    mode={audienceMode}
                    selection={audienceSelection}
                    onRecipientsResolved={(count) => setAudienceRecipientCount(count)}
                  />
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-center pt-6">
              <SaveButtonWithFeedback
                type="submit"
                saving={loading}
                savedAt={savedAt}
                label="Create Event"
                savingLabel="Creating Event..."
                successLabel="Event created"
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

export default AddEvent;