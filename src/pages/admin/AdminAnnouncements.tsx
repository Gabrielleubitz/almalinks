import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Edit, Trash2, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle, X } from 'lucide-react';
import { AnnouncementService, AnnouncementData } from '../../services/announcementService';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import EmojiReactions from '../../components/announcements/EmojiReactions';

const AdminAnnouncements: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const announcementsData = await AnnouncementService.getAllAnnouncements();
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('❌ Error loading announcements:', error);
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!user?.uid || !message.trim()) return;

    if (message.length > 300) {
      setError('Message must be 300 characters or less');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await AnnouncementService.createAnnouncement(message, user.uid);
      setMessage('');
      setSuccess('Announcement published successfully!');
      await loadAnnouncements();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Error publishing announcement:', err);
      setError('Failed to publish announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (announcement: AnnouncementData) => {
    setEditingId(announcement.id);
    setEditMessage(announcement.message);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editMessage.trim()) return;

    if (editMessage.length > 300) {
      setError('Message must be 300 characters or less');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await AnnouncementService.updateAnnouncement(editingId, editMessage);
      setEditingId(null);
      setEditMessage('');
      setSuccess('Announcement updated successfully!');
      await loadAnnouncements();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Error updating announcement:', err);
      setError('Failed to update announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditMessage('');
    setError(null);
  };

  const handleToggleStatus = async (announcementId: string, currentStatus: boolean) => {
    try {
      await AnnouncementService.toggleAnnouncementStatus(announcementId, !currentStatus);
      setSuccess(`Announcement ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      await loadAnnouncements();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Error toggling announcement status:', err);
      setError('Failed to update announcement status. Please try again.');
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      await AnnouncementService.deleteAnnouncement(announcementId);
      setSuccess('Announcement deleted successfully!');
      await loadAnnouncements();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Error deleting announcement:', err);
      setError('Failed to delete announcement. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Announcements" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading announcements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Announcements" 
        subtitle="Publish announcements to all Wine & Grind members"
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

        {/* Create New Announcement */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full mb-4">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create Announcement
            </h1>
            <p className="text-gray-600">
              Share important updates with all Wine & Grind members
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-700 ml-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-600 text-sm">{success}</p>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-600 hover:text-green-700 ml-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* Message Input */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Announcement Message ({message.length}/300 characters)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={300}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Enter your announcement message here..."
                disabled={submitting}
              />
              <div className="mt-2 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  💡 Keep it concise and informative for maximum impact
                </div>
                <div className={`text-sm ${message.length > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                  {300 - message.length} characters remaining
                </div>
              </div>
            </div>

            {/* Publish Button */}
            <div className="flex justify-center">
              <button
                onClick={handlePublish}
                disabled={submitting || !message.trim() || message.length > 300}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Publish Announcement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Announcements</h2>
          
          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No announcements yet</h3>
              <p className="text-gray-600">Create your first announcement to share updates with members.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-6 rounded-2xl border transition-all duration-200 ${
                    announcement.active 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {editingId === announcement.id ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        rows={3}
                        maxLength={300}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                        disabled={submitting}
                      />
                      <div className="text-sm text-gray-500 mb-4">
                        {editMessage.length}/300 characters
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleSaveEdit}
                          disabled={submitting || !editMessage.trim() || editMessage.length > 300}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium disabled:opacity-50"
                        >
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={submitting}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {announcement.message}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            announcement.active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {announcement.active ? (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4 mr-1" />
                                Hidden
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Emoji Reactions */}
                      <div className="mb-4">
                        <EmojiReactions announcement={announcement} />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Posted {AnnouncementService.formatTimestamp(announcement.timestamp)}
                          {announcement.updatedAt && (
                            <span> • Edited {AnnouncementService.formatTimestamp(announcement.updatedAt)}</span>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(announcement)}
                            className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                            title="Edit announcement"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(announcement.id, announcement.active)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${
                              announcement.active
                                ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            }`}
                            title={announcement.active ? 'Hide announcement' : 'Show announcement'}
                          >
                            {announcement.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
                            title="Delete announcement"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Information Box */}
        <div className="mt-8 bg-gray-50 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">📢 Announcement Guidelines:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• <strong>Keep it concise:</strong> Maximum 300 characters for better readability</li>
            <li>• <strong>Active announcements:</strong> Visible to all members in their dashboard</li>
            <li>• <strong>Hidden announcements:</strong> Not visible to members but saved for future use</li>
            <li>• <strong>Member view:</strong> Only the 3 most recent active announcements are shown</li>
            <li>• <strong>Edit anytime:</strong> You can edit or hide announcements after publishing</li>
            <li>• <strong>Emoji reactions:</strong> Members can react with 👍, ❤️, 🔥, 👑, and 🍷 emojis</li>
            <li>• <strong>Best practices:</strong> Use for important updates, events, or community news</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncements;