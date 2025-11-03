import React, { useState } from 'react';
import { User, X, Save } from 'lucide-react';
import { SpeakerService, EventSpeaker } from '../../services/speakerService';
import { useAuth } from '../../hooks/useAuth';

interface SpeakerFormData {
  name: string;
  title: string;
  bio: string;
  email: string;
  company: string;
  imageUrl: string;
  linkedIn: string;
  twitter: string;
  website: string;
}

interface SpeakerAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  selectedEventName?: string;
  onSpeakerCreated: () => void; // Callback to refresh the speakers list
}

const SpeakerAssignModal: React.FC<SpeakerAssignModalProps> = ({
  isOpen,
  onClose,
  eventId,
  selectedEventName,
  onSpeakerCreated
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<SpeakerFormData>({
    name: '',
    title: '',
    bio: '',
    email: '',
    company: '',
    imageUrl: '',
    linkedIn: '',
    twitter: '',
    website: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Speaker name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!user?.uid) {
        setError('You must be logged in to create a speaker');
        return;
      }

      if (user.role !== 'admin') {
        setError('Only administrators can create speakers');
        return;
      }
      
      await SpeakerService.createSpeaker(eventId, {
        name: formData.name.trim(),
        title: formData.title.trim() || undefined,
        bio: formData.bio.trim() || undefined,
        email: formData.email.trim() || undefined,
        company: formData.company.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        linkedIn: formData.linkedIn.trim() || undefined,
        twitter: formData.twitter.trim() || undefined,
        website: formData.website.trim() || undefined,
        createdBy: user.uid
      }, user.uid);

      // Reset form and close modal
      setFormData({
        name: '',
        title: '',
        bio: '',
        email: '',
        company: '',
        imageUrl: '',
        linkedIn: '',
        twitter: '',
        website: ''
      });
      
      onSpeakerCreated(); // Refresh the speakers list
      onClose();
      
    } catch (err: any) {
      console.error('❌ Error creating speaker:', err);
      setError(err.message || 'Failed to create speaker');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Add New Speaker
              </h3>
              <p className="text-gray-600 mt-1">
                Create a speaker profile for {selectedEventName}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Speaker Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Speaker Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter speaker's full name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              required
            />
          </div>

          {/* Speaker Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title/Position
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Senior Developer, CTO, Founder"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Company */}
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
              placeholder="Company or organization"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="speaker@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Profile Image URL
            </label>
            <input
              type="url"
              id="imageUrl"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/speaker-photo.jpg"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
              Biography
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Brief biography or description of the speaker..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
            />
          </div>

          {/* LinkedIn */}
          <div>
            <label htmlFor="linkedIn" className="block text-sm font-medium text-gray-700 mb-2">
              LinkedIn Profile
            </label>
            <input
              type="url"
              id="linkedIn"
              name="linkedIn"
              value={formData.linkedIn}
              onChange={handleInputChange}
              placeholder="https://linkedin.com/in/username or just username"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Twitter */}
          <div>
            <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 mb-2">
              Twitter/X Handle
            </label>
            <input
              type="text"
              id="twitter"
              name="twitter"
              value={formData.twitter}
              onChange={handleInputChange}
              placeholder="@username or https://twitter.com/username"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
              Personal Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-6 py-3 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Create Speaker</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpeakerAssignModal;