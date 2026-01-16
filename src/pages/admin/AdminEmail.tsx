import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import { sendAdminEmail } from '../../services/emailService';
import EmailRecipientAutocomplete, { EmailRecipient } from '../../components/admin/EmailRecipientAutocomplete';

const AdminEmail: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [recipients, setRecipients] = useState(''); // Comma-separated emails string
  const [recipientObjects, setRecipientObjects] = useState<EmailRecipient[]>([]); // Parsed recipient objects

  // DEV LOG: Track recipients state changes
  React.useEffect(() => {
    console.log('[AdminEmail] TO STATE NOW (recipients string):', recipients);
  }, [recipients]);

  React.useEffect(() => {
    console.log('[AdminEmail] TO STATE NOW (recipientObjects):', recipientObjects.map(r => r.email));
  }, [recipientObjects]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [fromName, setFromName] = useState('Alma Links Admin'); // Optional, can be placeholder
  const [replyTo, setReplyTo] = useState(''); // Optional
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (recipientObjects.length === 0 && !recipients.trim()) {
      setError('Please enter recipient email(s)');
      return false;
    }

    if (!subject.trim()) {
      setError('Please enter a subject');
      return false;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return false;
    }

    // Use recipient objects if available, otherwise parse string
    const emailList = recipientObjects.length > 0
      ? recipientObjects.map(r => r.email)
      : recipients.split(',').map(email => email.trim()).filter(email => email);

    if (emailList.length === 0) {
      setError('Please enter at least one valid email address');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      setError(`Invalid email format: ${invalidEmails.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleSendEmail = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use recipient objects if available, otherwise parse string
      const recipientList = recipientObjects.length > 0
        ? recipientObjects.map(r => r.email)
        : recipients.split(',').map(email => email.trim()).filter(email => email);

      const result = await sendAdminEmail({
        to: recipientList,
        subject: subject.trim(),
        message: message.trim(),
        fromName: fromName.trim() || undefined,
        replyTo: replyTo.trim() || undefined
      });

      if (result.success) {
        setSuccess('Email sent successfully! (Note: Currently stubbed - Mailchimp integration pending)');
        // Clear form on success
        setRecipients('');
        setRecipientObjects([]);
        setSubject('');
        setMessage('');
        setReplyTo('');
      } else {
        setError(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('❌ Email sending error:', error);
      setError(`Failed to send email: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Email Panel" 
        subtitle="Send emails to members (Mailchimp integration coming soon)"
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
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Email Panel
            </h1>
            <p className="text-gray-600">
              Send emails to members (Mailchimp integration coming soon)
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

          <form onSubmit={(e) => { e.preventDefault(); handleSendEmail(); }} className="space-y-6">
            {/* Recipients Input */}
            <div>
              <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-2">
                To (Email Addresses) *
              </label>
              <EmailRecipientAutocomplete
                id="recipients"
                value={recipients}
                onChange={(newValue) => {
                  console.log('[AdminEmail] onChange called with:', newValue);
                  setRecipients(newValue);
                }}
                onRecipientsChange={(recipientObjs) => {
                  console.log('[AdminEmail] onRecipientsChange called with:', recipientObjs.map(r => r.email));
                  setRecipientObjects(recipientObjs);
                }}
                placeholder="Start typing to search members or enter email addresses..."
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Type to search approved members, or enter email addresses (comma-separated). Select from suggestions or paste multiple emails.
              </p>
            </div>

            {/* Subject Input */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>

            {/* Message Body */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message Body *
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Enter your email message here..."
                required
              />
            </div>

            {/* Optional Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fromName" className="block text-sm font-medium text-gray-700 mb-2">
                  From Name (Optional)
                </label>
                <input
                  id="fromName"
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Alma Links Admin"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="replyTo" className="block text-sm font-medium text-gray-700 mb-2">
                  Reply-To (Optional)
                </label>
                <input
                  id="replyTo"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="noreply@almalinks.org"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Send Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={loading || (recipientObjects.length === 0 && !recipients.trim()) || !subject.trim() || !message.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Information Box */}
          <div className="mt-8 bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">📧 Email Information:</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Current Status:</strong> Email workflow is stubbed (Mailchimp integration pending)</li>
              <li>• <strong>Recipients:</strong> Supports single email or comma-separated list</li>
              <li>• <strong>Validation:</strong> Email format is validated before sending</li>
              <li>• <strong>Future Integration:</strong> Will connect to Mailchimp API when ready</li>
              <li>• <strong>From Name:</strong> Optional sender name (defaults to "Alma Links Admin")</li>
              <li>• <strong>Reply-To:</strong> Optional reply-to address for responses</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEmail;
