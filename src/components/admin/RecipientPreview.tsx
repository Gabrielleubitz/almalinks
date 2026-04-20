import React, { useState, useEffect } from 'react';
import { Users, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { AudienceSelection, RecipientMode } from './AudienceSelector';
import { RecipientResolutionService } from '../../services/recipientResolutionService';
import {
  effectiveChatAudienceIds,
  effectiveEventAudienceIds,
  effectiveLocationAudienceLabels,
} from '../../utils/eventAudienceUtils';

interface RecipientPreviewProps {
  mode: RecipientMode;
  selection: AudienceSelection;
  onRecipientsResolved?: (count: number, recipients: Array<{ email: string; name?: string }>) => void;
}

const RecipientPreview: React.FC<RecipientPreviewProps> = ({
  mode,
  selection,
  onRecipientsResolved
}) => {
  const [count, setCount] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<Array<{ email: string; name?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only resolve if we have a valid selection
    const hasSelection =
      (mode === 'individuals' && selection.ids && selection.ids.length > 0) ||
      (mode === 'group' && selection.groupId) ||
      (mode === 'event' && effectiveEventAudienceIds(selection).length > 0) ||
      (mode === 'chat' && effectiveChatAudienceIds(selection).length > 0) ||
      (mode === 'location' && effectiveLocationAudienceLabels(selection).length > 0) ||
      mode === 'all_users';

    if (hasSelection) {
      resolveRecipients();
    } else {
      setCount(null);
      setRecipients([]);
      setError(null);
    }
  }, [mode, selection]);

  const resolveRecipients = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use client-side Firestore resolution instead of API call
      const result = await RecipientResolutionService.resolveRecipients({
        mode,
        ids: selection.ids,
        groupId: selection.groupId,
        eventId: selection.eventId,
        eventIds: selection.eventIds,
        chatId: selection.chatId,
        chatIds: selection.chatIds,
        location: selection.location,
        locations: selection.locations,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to resolve recipients');
      }

      setCount(result.count);
      setRecipients(result.recipients || []);
      
      if (onRecipientsResolved) {
        onRecipientsResolved(result.count, result.recipients || []);
      }

    } catch (err: any) {
      console.error('Error resolving recipients:', err);
      setError(err.message || 'Failed to load recipients');
      setCount(null);
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  if (!selection) return null;
  if (mode === 'individuals' && (!selection.ids || selection.ids.length === 0)) return null;
  if (mode === 'group' && !selection.groupId) return null;
  if (mode === 'event' && effectiveEventAudienceIds(selection).length === 0) return null;
  if (mode === 'chat' && effectiveChatAudienceIds(selection).length === 0) return null;
  if (mode === 'location' && effectiveLocationAudienceLabels(selection).length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center space-x-2 mb-2">
        <Users className="h-5 w-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Recipients</span>
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Loader className="h-4 w-4 animate-spin" />
          <span>Loading recipient count...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && count !== null && (
        <>
          <div className="flex items-center space-x-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">
              {count} recipient{count !== 1 ? 's' : ''}
            </span>
          </div>

          {recipients.length > 0 && recipients.length <= 10 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 mb-2">Preview:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recipients.map((recipient, index) => (
                  <div key={index} className="text-xs text-gray-700 flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>
                      {recipient.name || 'Unknown'} &lt;{recipient.email}&gt;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recipients.length > 10 && (
            <p className="text-xs text-gray-500 mt-2">
              Showing first 10 of {count} recipients
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default RecipientPreview;
