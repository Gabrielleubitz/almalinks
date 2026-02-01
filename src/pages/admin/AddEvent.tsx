import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { Calendar, MapPin, Image, FileText, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';
import { EventService, generateSlug } from '../../services/eventService';
import AdminHeader from '../../components/admin/AdminHeader';

const AddEvent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    date: '',
    description: '',
    imageUrl: '',
    status: 'active' as const
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [announcementFailedReason, setAnnouncementFailedReason] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState('');

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
      setError('Event image URL is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      setError('You must be logged in to create events');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setAnnouncementFailedReason(null);

    try {
      const eventId = await EventService.createEvent(formData, user.uid);

      // Send Mailchimp Marketing campaign to entire audience (server-side, non-blocking for UX)
      let announcementSent = false;
      let announcementError: string | null = null;
      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          announcementError = 'Not authenticated (Firebase user not available)';
        } else {
          const idToken = await getIdToken(firebaseUser);
          const res = await fetch('/api/send-event-announcement', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ eventId }),
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          announcementSent = res.ok && data.ok;
          if (!announcementSent) {
            announcementError = data.error || `HTTP ${res.status}`;
            console.warn('[AddEvent] Announcement not sent:', announcementError);
          }
        }
      } catch (announceErr: unknown) {
        announcementError = announceErr instanceof Error ? announceErr.message : String(announceErr);
        if (announcementError.includes('fetch') || announcementError.includes('Failed to fetch') || announcementError.includes('NetworkError')) {
          announcementError = 'Could not reach API. Locally: run the API in another terminal (npm run dev:express). On production: check Vercel env vars.';
        }
        console.warn('[AddEvent] Announcement request failed:', announceErr);
      }

      if (announcementError) setAnnouncementFailedReason(announcementError);
      setSuccess(
        announcementSent
          ? `Event "${formData.name}" created. Announcement sent to Mailchimp audience. (Only contacts in that audience receive the email—add yourself or run Import users to Mailchimp.)`
          : announcementError
            ? `Event "${formData.name}" created. Mailchimp announcement failed: ${announcementError}`
            : `Event "${formData.name}" created successfully with slug: ${previewSlug}`
      );

      // Clear form
      setFormData({
        name: '',
        location: '',
        date: '',
        description: '',
        imageUrl: '',
        status: 'active'
      });
      setPreviewSlug('');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/admin');
      }, 2000);

    } catch (err: any) {
      console.error('❌ Error creating event:', err);
      setError(err.message || 'Failed to create event. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Create New Event" 
        subtitle="Add a new Alma Links event to the system"
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-4">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create New Event
            </h1>
            <p className="text-gray-600">
              Fill in the details below to create a new Alma Links event
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
                  placeholder="e.g., Alma Links 5.0"
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

            {/* Event Image URL */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Event Image URL *
              </label>
              <div className="relative">
                <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  required
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="https://example.com/event-image.jpg"
                />
              </div>
              {formData.imageUrl && (
                <div className="mt-3">
                  <img
                    src={formData.imageUrl}
                    alt="Event preview"
                    className="w-full h-48 object-cover rounded-xl border border-gray-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

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

            {/* Submit Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Event...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>Create Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEvent;