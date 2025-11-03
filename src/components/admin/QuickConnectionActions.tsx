import React, { useState } from 'react';
import { UserPlus, Link2, Users } from 'lucide-react';
import { AdminConnectionService } from '../../services/adminConnectionService';
import { useAuth } from '../../hooks/useAuth';

interface QuickConnectionActionsProps {
  eventId?: string;
  className?: string;
}

const QuickConnectionActions: React.FC<QuickConnectionActionsProps> = ({ 
  eventId, 
  className = '' 
}) => {
  const { user } = useAuth();
  const [bulkConnecting, setBulkConnecting] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);

  const handleQuickBulkConnect = async () => {
    if (!eventId || !user?.uid) return;

    if (!confirm('This will create connections between ALL users registered for this event. Continue?')) {
      return;
    }

    try {
      setBulkConnecting(true);
      const results = await AdminConnectionService.bulkConnectEventUsers(
        eventId,
        user.uid,
        {
          connectAll: true,
          reason: 'Admin quick bulk connection'
        }
      );
      
      setBulkResults(results);

    } catch (error) {
      console.error('❌ Error in bulk connect:', error);
      alert('Failed to bulk connect users. Please try again.');
    } finally {
      setBulkConnecting(false);
    }
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-3">
        <Users className="h-5 w-5 text-brand-light" />
        <h4 className="font-semibold text-blue-900">Connection Actions</h4>
      </div>

      <div className="space-y-3">
        {eventId ? (
          <div className="space-y-2">
            <p className="text-sm text-blue-700">
              Quickly connect all users registered for this event:
            </p>
            <button
              onClick={handleQuickBulkConnect}
              disabled={bulkConnecting}
              className="w-full py-2 px-4 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
            >
              {bulkConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  <span>Bulk Connect All</span>
                </>
              )}
            </button>

            {bulkResults && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-900 mb-1">Results:</p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-green-600">✅ Created:</span>
                    <span>{bulkResults.created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">⏭️ Skipped:</span>
                    <span>{bulkResults.skipped}</span>
                  </div>
                  {bulkResults.errors.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-600">❌ Errors:</span>
                      <span>{bulkResults.errors.length}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-blue-700">
            For event-specific actions, view an individual event page.
          </p>
        )}

        <div className="pt-2 border-t border-blue-200">
          <a
            href="/admin/connections"
            className="text-sm text-brand-light hover:text-blue-700 font-medium"
          >
            Go to full Connection Management →
          </a>
        </div>
      </div>
    </div>
  );
};

export default QuickConnectionActions;