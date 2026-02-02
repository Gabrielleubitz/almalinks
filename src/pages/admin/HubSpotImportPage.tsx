import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  X,
  Download,
  AlertCircle,
  CheckCircle,
  Key,
  Lock,
  FileText,
  Info,
} from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import { apiRequest } from '../../utils/apiClient';

const HubSpotImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok?: boolean; totalUpserted?: number; error?: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<{ ok?: boolean; deletedUsers?: number; deletedContacts?: number; error?: string } | null>(null);

  const syncHubspotContacts = async () => {
    setSyncing(true);
    setSyncResult(null);
    setRemoveResult(null);
    try {
      const res = await apiRequest('/api/sync-hubspot-contacts', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setSyncResult(data);
    } catch (err: any) {
      setSyncResult({ ok: false, error: err?.message || 'Request failed' });
    } finally {
      setSyncing(false);
    }
  };

  const removeHubspotUsers = async () => {
    if (!window.confirm('Remove all HubSpot-synced users from Firestore and clear hubspotContacts? This cannot be undone.')) return;
    setRemoving(true);
    setRemoveResult(null);
    setSyncResult(null);
    try {
      const res = await apiRequest('/api/remove-hubspot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeContacts: true }),
      });
      const data = await res.json().catch(() => ({}));
      setRemoveResult(data);
    } catch (err: any) {
      setRemoveResult({ ok: false, error: err?.message || 'Request failed' });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Import from HubSpot" subtitle="Sync HubSpot CRM contacts to Alma Links" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/admin')}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Admin</span>
        </button>

        {/* What it does */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-blue-600" />
            What this does
          </h2>
          <ul className="space-y-2 text-gray-700 text-sm list-disc list-inside">
            <li>Imports <strong>all contacts</strong> from your HubSpot CRM into Firestore.</li>
            <li>Creates a <strong>hubspotContacts</strong> collection (keyed by HubSpot ID).</li>
            <li>Creates <strong>Firebase Auth accounts</strong> for each contact (email + a default password you set) so they can sign in.</li>
            <li>Creates <strong>users</strong> documents with <code className="bg-gray-100 px-1 rounded">source: 'hubspot'</code> and <code className="bg-gray-100 px-1 rounded">registrationComplete: false</code> so they can complete onboarding.</li>
            <li>Uses <strong>server-side token only</strong> — your HubSpot token is never sent to the browser.</li>
          </ul>
        </div>

        {/* Setup & env vars */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-amber-600" />
            Setup (environment variables)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure these in your project&apos;s environment (e.g. Vercel → Project → Settings → Environment Variables, or <code className="bg-gray-100 px-1 rounded">.env</code> locally). Then redeploy if needed.
          </p>
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="font-medium text-gray-900 mb-1">HUBSPOT_ACCESS_TOKEN <span className="text-amber-700">(required)</span></div>
              <p className="text-gray-700 mb-2">
                HubSpot Private App access token or OAuth token. Used only on the server; never exposed to the frontend.
              </p>
              <p className="text-gray-600 text-xs">
                How to get it: HubSpot → Settings → Integrations → Private Apps → Create app → Scopes: <code>crm.objects.contacts.read</code>. Copy the access token (starts with <code>pat-</code>).
              </p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                HUBSPOT_IMPORT_DEFAULT_PASSWORD <span className="text-gray-500">(optional)</span>
              </div>
              <p className="text-gray-700">
                Default password for every imported contact. They sign in with <strong>email + this password</strong>, then complete profile onboarding. If not set, defaults to <code>123456789</code>. Change this in production.
              </p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="font-medium text-gray-900 mb-1">SYNC_SECRET <span className="text-gray-500">(optional)</span></div>
              <p className="text-gray-700">
                If set, the sync API can be called with header <code>x-sync-secret: &lt;value&gt;</code> instead of Firebase Auth. If unset, only logged-in admins (with Firebase ID token) can run sync.
              </p>
            </div>
          </div>
        </div>

        {/* How to use */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-600" />
            How to use
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
            <li>Set <code className="bg-gray-100 px-1 rounded">HUBSPOT_ACCESS_TOKEN</code> (and optionally default password and sync secret) in your environment.</li>
            <li>Click <strong>Sync HubSpot → Firebase</strong> below. The server will fetch all HubSpot contacts and upsert them into Firestore and create Firebase Auth users.</li>
            <li>Imported contacts can sign in with their <strong>email</strong> and the <strong>default password</strong> you set (or 123456789). They will be prompted to complete their profile.</li>
            <li>To undo: use <strong>Remove HubSpot users from Firebase</strong> to delete all HubSpot-synced users and the hubspotContacts collection. This cannot be undone.</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={syncHubspotContacts}
              disabled={syncing || removing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Sync HubSpot → Firebase</span>
                </>
              )}
            </button>
            <button
              onClick={removeHubspotUsers}
              disabled={syncing || removing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 border border-red-200 rounded-xl hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {removing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5" />
                  <span>Remove HubSpot users from Firebase</span>
                </>
              )}
            </button>
          </div>

          {syncResult && (
            <div className={`mt-4 p-4 rounded-xl border ${syncResult.ok !== false && !syncResult.error ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {syncResult.ok !== false && !syncResult.error ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span>{syncResult.ok !== false && !syncResult.error ? 'Sync result' : 'Error'}</span>
              </div>
              <pre className="text-xs overflow-auto max-h-40 bg-white/60 p-3 rounded-lg">
                {JSON.stringify(syncResult, null, 2)}
              </pre>
            </div>
          )}

          {removeResult && (
            <div className={`mt-4 p-4 rounded-xl border ${removeResult.ok !== false && !removeResult.error ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {removeResult.ok !== false && !removeResult.error ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span>{removeResult.ok !== false && !removeResult.error ? 'Remove result' : 'Error'}</span>
              </div>
              <pre className="text-xs overflow-auto max-h-40 bg-white/60 p-3 rounded-lg">
                {JSON.stringify(removeResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HubSpotImportPage;
