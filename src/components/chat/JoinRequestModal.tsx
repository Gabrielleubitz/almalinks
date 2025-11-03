import React, { useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { ChatService } from '../../services/chatService';
import { JoinRequestForm } from '../../types/chat';

interface JoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
  userId: string;
  onSuccess?: () => void;
}

const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  isOpen,
  onClose,
  chatId,
  chatName,
  userId,
  onSuccess
}) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const form: JoinRequestForm = {
        chatId,
        message: message.trim()
      };

      await ChatService.createJoinRequest(form, userId);
      
      setSuccess(true);
      onSuccess?.();
      
      // Close modal after delay
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setMessage('');
      }, 2000);

    } catch (err: any) {
      console.error('❌ Error creating join request:', err);
      setError(err.message || 'Failed to send join request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    setError(null);
    setSuccess(false);
    setMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Join Chat</h2>
              <p className="text-sm text-gray-600">{chatName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Request Sent!</h3>
              <p className="text-gray-600">
                Your join request has been sent to the chat admins. You'll be notified when they respond.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-gray-700 mb-4">
                  Send a request to join "{chatName}". You can include an optional message to introduce yourself.
                </p>
                
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! I'd like to join this chat because..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {message.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinRequestModal;