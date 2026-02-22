import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, ArrowLeft, AlertCircle, CheckCircle, Inbox, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import { sendAdminEmail } from '../../services/emailService';
import EmailRecipientAutocomplete, { EmailRecipient } from '../../components/admin/EmailRecipientAutocomplete';
import AudienceSelector, { RecipientMode, AudienceSelection } from '../../components/admin/AudienceSelector';
import RecipientPreview from '../../components/admin/RecipientPreview';
import { auth } from '../../firebase/config';
import { apiRequest } from '../../utils/apiClient';

const EMAIL_TEMPLATES: { key: string; label: string }[] = [
  { key: 'test', label: 'Test email' },
  { key: 'welcome', label: 'Welcome (signup received)' },
  { key: 'welcome-approved', label: 'Welcome approved' },
  { key: 'event-announcement', label: 'Event announcement' },
  { key: 'registration-confirmation', label: 'Registration confirmation' },
  { key: 'event-reminder', label: 'Event reminder' },
  { key: 'password-reset', label: 'Password reset' },
  { key: 'user-credentials', label: 'User credentials' },
];

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  sentAt: string | null;
  provider: string;
  template: string | null;
}

const AdminEmail: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [emailLogItems, setEmailLogItems] = useState<EmailLogEntry[]>([]);
  const [emailLogTotalCount, setEmailLogTotalCount] = useState<number | null>(null);
  const [emailLogLoading, setEmailLogLoading] = useState(true);
  const [quickEmailRecipient, setQuickEmailRecipient] = useState('');
  const [runningTemplate, setRunningTemplate] = useState<string | null>(null);
  const [emailConfig, setEmailConfig] = useState<{ mailjet: boolean; mailchimp: boolean } | null>(null);
  
  // Recipient mode and selection
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('individuals');
  const [audienceSelection, setAudienceSelection] = useState<AudienceSelection>({ mode: 'individuals' });
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  // Safeguard: Reset to 'individuals' if 'group' mode is somehow selected (shouldn't happen with excludedModes)
  React.useEffect(() => {
    if (recipientMode === 'group') {
      setRecipientMode('individuals');
      setAudienceSelection({ mode: 'individuals' });
    }
  }, [recipientMode]);
  
  // Individual recipients (for "individuals" mode)
  const [recipients, setRecipients] = useState(''); // Comma-separated emails string
  const [recipientObjects, setRecipientObjects] = useState<EmailRecipient[]>([]); // Parsed recipient objects

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [fromName, setFromName] = useState('Alma Links Admin'); // Optional, can be placeholder
  const [replyTo, setReplyTo] = useState(''); // Optional
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importingMailchimp, setImportingMailchimp] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !quickEmailRecipient) setQuickEmailRecipient(user.email);
  }, [user?.email]);

  const fetchEmailLog = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setEmailLogLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/email-log?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setEmailLogItems(data.items);
        setEmailLogTotalCount(data.totalCount ?? null);
      }
    } catch {
      // ignore
    } finally {
      setEmailLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailLog();
  }, [fetchEmailLog]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/admin/test/email-config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.ok && !cancelled) setEmailConfig({ mailjet: !!data.mailjet, mailchimp: !!data.mailchimp });
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sendTemplateEmail = async (templateKey: string) => {
    const to = quickEmailRecipient.trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError('Please enter a valid recipient email for Quick email');
      return;
    }
    const label = EMAIL_TEMPLATES.find((t) => t.key === templateKey)?.label ?? templateKey;
    setRunningTemplate(templateKey);
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated');
        setRunningTemplate(null);
        return;
      }
      const response = await fetch('/api/admin/test/send-template-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, template: templateKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.ok) {
        setSuccess(`${label} sent to ${data.sentTo}`);
        fetchEmailLog();
      } else {
        setError(data.error || 'Send failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRunningTemplate(null);
    }
  };

  const validateForm = (): boolean => {
    if (!subject.trim()) {
      setError('Please enter a subject');
      return false;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return false;
    }

    // Validate based on mode
    if (recipientMode === 'individuals') {
      if (recipientObjects.length === 0 && !recipients.trim()) {
        setError('Please enter recipient email(s)');
        return false;
      }

      const emailList = recipientObjects.length > 0
        ? recipientObjects.map(r => r.email)
        : recipients.split(',').map(email => email.trim()).filter(email => email);

      if (emailList.length === 0) {
        setError('Please enter at least one valid email address');
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailList.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        setError(`Invalid email format: ${invalidEmails.join(', ')}`);
        return false;
      }
    } else {
      // For audience modes, check if selection is valid (all_users needs no sub-selection)
      const hasSelection = 
        recipientMode === 'all_users' ||
        (recipientMode === 'event' && audienceSelection.eventId) ||
        (recipientMode === 'chat' && audienceSelection.chatId) ||
        (recipientMode === 'location' && audienceSelection.location);

      if (!hasSelection) {
        setError(`Please select a ${recipientMode}`);
        return false;
      }

      if (recipientCount === null || recipientCount === 0) {
        setError('No recipients found for the selected audience');
        return false;
      }
    }

    return true;
  };

  const handleSendEmail = async (confirmed = false) => {
    if (!validateForm()) return;

    // Show confirmation for large sends
    if (!confirmed && recipientCount && recipientCount > 50) {
      setShowConfirmModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(false);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      const idToken = await currentUser.getIdToken();

      if (recipientMode === 'individuals') {
        // Use existing sendAdminEmail for individuals
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
          setSuccess(`Email sent successfully to ${recipientList.length} recipient(s)!`);
          fetchEmailLog();
          // Clear form on success
          setRecipients('');
          setRecipientObjects([]);
          setSubject('');
          setMessage('');
          setReplyTo('');
        } else {
          setError(result.error || 'Failed to send email');
        }
      } else {
        // Use bulk email API for audience modes
        const response = await fetch('/api/send-bulk-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            mode: recipientMode,
            ...(recipientMode !== 'all_users' ? audienceSelection : {}),
            subject: subject.trim(),
            text: message.trim(),
            fromName: fromName.trim() || undefined
          })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Failed to send bulk email');
        }

        setSuccess(`Email sent successfully! ${data.sent} sent, ${data.failed} failed out of ${data.total} recipients.`);
        fetchEmailLog();
        // Clear form on success
        setSubject('');
        setMessage('');
        setAudienceSelection({ mode: recipientMode });
        setRecipientCount(null);
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
        subtitle="Send emails to members and sync with Mailchimp audience"
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

        {/* Email log: sent count and recent list */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Inbox className="h-6 w-6 text-brand-light" />
              <h2 className="text-xl font-bold text-gray-900">Sent emails</h2>
            </div>
            <button
              type="button"
              onClick={fetchEmailLog}
              disabled={emailLogLoading}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${emailLogLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {emailLogTotalCount !== null && (
            <p className="text-sm text-gray-600 mb-4">
              <strong>{emailLogTotalCount}</strong> email{emailLogTotalCount !== 1 ? 's' : ''} sent
            </p>
          )}
          {emailLogLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : emailLogItems.length === 0 ? (
            <p className="text-sm text-gray-500">No sent emails recorded yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-700">To</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Subject</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Sent</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Provider</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogItems.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-800">{row.to}</td>
                      <td className="py-2 px-2 text-gray-800 max-w-[200px] truncate" title={row.subject}>{row.subject}</td>
                      <td className="py-2 px-2 text-gray-600">
                        {row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{row.provider}</td>
                      <td className="py-2 px-2 text-gray-600">{row.template || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick email: send by template */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Send className="h-6 w-6 text-brand-light" />
            <h2 className="text-xl font-bold text-gray-900">Quick email</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Send a test or template email to one recipient. Uses the same AlmaLinks templates as transactional emails.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="quick-email-recipient" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient email
              </label>
              <input
                id="quick-email-recipient"
                type="email"
                value={quickEmailRecipient}
                onChange={(e) => setQuickEmailRecipient(e.target.value)}
                placeholder="email@example.com"
                className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EMAIL_TEMPLATES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => sendTemplateEmail(key)}
                  disabled={!quickEmailRecipient.trim() || runningTemplate !== null || (emailConfig !== null && !emailConfig.mailjet && !emailConfig.mailchimp)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                  title={!quickEmailRecipient.trim() ? 'Enter recipient' : `Send ${label}`}
                >
                  {runningTemplate === key ? (
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <Send className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full mb-4">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Email Panel
            </h1>
            <p className="text-gray-600 mb-2">
              Send emails to members. New signups and approved users are added to your Mailchimp audience when configured.
            </p>
          </div>

          {/* Import users to Mailchimp */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Mailchimp audience</p>
            <p className="text-xs text-gray-600 mb-3">
              Import all approved AlmaLinks members into your Mailchimp audience (list). Set MAILCHIMP_AUDIENCE_ID and a Marketing API key in your environment.
            </p>
            <button
              type="button"
              disabled={importingMailchimp}
              onClick={async () => {
                setImportingMailchimp(true);
                setImportResult(null);
                setError(null);
                try {
                  const res = await apiRequest('/api/mailchimp-import-users', { method: 'POST' });
                  let data: { ok?: boolean; error?: string; added?: number; updated?: number; failed?: number; total?: number; audienceIdHint?: string } = {};
                  try {
                    data = await res.json();
                  } catch {
                    setError(res.ok ? 'Import failed' : `Error ${res.status}: ${res.statusText}`);
                    return;
                  }
                  if (res.ok && data.ok) {
                    const hint = data.audienceIdHint ? ` Synced to audience ${data.audienceIdHint}.` : '';
                    setImportResult(`Imported: ${data.added ?? 0} added, ${data.updated ?? 0} updated, ${data.failed ?? 0} failed (${data.total ?? 0} total).${hint}`);
                  } else {
                    setError(data.error || `Import failed (${res.status})`);
                  }
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Import failed');
                } finally {
                  setImportingMailchimp(false);
                }
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importingMailchimp ? 'Importing…' : 'Import users to Mailchimp'}
            </button>
            {importResult && (
              <>
                <p className="mt-2 text-sm text-green-700">{importResult}</p>
                <p className="mt-1 text-xs text-gray-500">
                  If you don&apos;t see contacts in Mailchimp, check that MAILCHIMP_AUDIENCE_ID in Vercel matches your audience ID (Mailchimp → Audience → Settings → Audience ID).
                </p>
              </>
            )}
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
            {/* Audience Selector */}
            <AudienceSelector
              mode={recipientMode}
              selection={audienceSelection}
              onModeChange={(newMode) => {
                setRecipientMode(newMode);
                setAudienceSelection({ mode: newMode });
                setRecipientCount(null);
                // Clear individual recipients when switching modes
                if (newMode !== 'individuals') {
                  setRecipients('');
                  setRecipientObjects([]);
                }
              }}
              onSelectionChange={(newSelection) => {
                setAudienceSelection(newSelection);
              }}
              disabled={loading}
              excludedModes={['group']}
            />

            {/* Individual Recipients Input (only for individuals mode) */}
            {recipientMode === 'individuals' && (
              <div>
                <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-2">
                  To (Email Addresses) *
                </label>
                <EmailRecipientAutocomplete
                  id="recipients"
                  value={recipients}
                  onChange={(newValue) => {
                    setRecipients(newValue);
                  }}
                  onRecipientsChange={(recipientObjs) => {
                    setRecipientObjects(recipientObjs);
                    setRecipientCount(recipientObjs.length);
                  }}
                  placeholder="Start typing to search members or enter email addresses..."
                  disabled={loading}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Type to search approved members, or enter email addresses (comma-separated). Select from suggestions or paste multiple emails.
                </p>
              </div>
            )}

            {/* Recipient Preview (for audience modes) */}
            {recipientMode !== 'individuals' && (
              <RecipientPreview
                mode={recipientMode}
                selection={audienceSelection}
                onRecipientsResolved={(count, recipients) => {
                  setRecipientCount(count);
                }}
              />
            )}

            {/* Recipient Count for individuals mode */}
            {recipientMode === 'individuals' && recipientCount !== null && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  Recipients: {recipientCount}
                </p>
              </div>
            )}

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
                disabled={
                  loading || 
                  !subject.trim() || 
                  !message.trim() ||
                  (recipientMode === 'individuals' && recipientObjects.length === 0 && !recipients.trim()) ||
                  (recipientMode !== 'individuals' && (!recipientCount || recipientCount === 0))
                }
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

          {/* Confirmation Modal for Large Sends */}
          {showConfirmModal && recipientCount && recipientCount > 50 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Confirm Bulk Email Send
                  </h3>
                  <p className="text-gray-600 mb-6">
                    You are about to send an email to <strong>{recipientCount} recipients</strong>.
                    This action cannot be undone.
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendEmail(true)}
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                    >
                      Confirm Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
