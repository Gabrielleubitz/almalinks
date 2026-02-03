import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  X,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
  Info,
} from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import { apiRequest } from '../../utils/apiClient';

const HubSpotImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok?: boolean; totalUpserted?: number; error?: string } | null>(null);
  const [syncingDeals, setSyncingDeals] = useState(false);
  const [dealsResult, setDealsResult] = useState<any | null>(null);
  const [creatingFromDeals, setCreatingFromDeals] = useState(false);
  const [createFromDealsResult, setCreateFromDealsResult] = useState<{ ok?: boolean; created?: number; skipped?: number; totalDeals?: number; error?: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<{ ok?: boolean; deletedUsers?: number; deletedContacts?: number; error?: string } | null>(null);

  const syncHubspotContacts = async () => {
    setSyncing(true);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
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

  const syncHubspotDeals = async () => {
    setSyncingDeals(true);
    setDealsResult(null);
    setSyncResult(null);
    setCreateFromDealsResult(null);
    setRemoveResult(null);
    try {
      const res = await apiRequest('/api/sync-hubspot-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setDealsResult(data);
    } catch (err: any) {
      setDealsResult({ ok: false, error: err?.message || 'Request failed' });
    } finally {
      setSyncingDeals(false);
    }
  };

  const removeHubspotUsers = async () => {
    if (!window.confirm('Remove all users that were imported from HubSpot from this site? This cannot be undone.')) return;
    setRemoving(true);
    setRemoveResult(null);
    setSyncResult(null);
    setDealsResult(null);
    setCreateFromDealsResult(null);
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

  const createEventsFromDeals = async () => {
    setCreatingFromDeals(true);
    setCreateFromDealsResult(null);
    setSyncResult(null);
    setDealsResult(null);
    setRemoveResult(null);
    try {
      const res = await apiRequest('/api/create-events-from-deals', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setCreateFromDealsResult(data);
    } catch (err: any) {
      setCreateFromDealsResult({ ok: false, error: err?.message || 'Request failed' });
    } finally {
      setCreatingFromDeals(false);
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

        {/* Quick steps — clear instructions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 border-l-4 border-l-emerald-500">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick steps</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-800 text-sm">
            <li><strong>Import people:</strong> Click <strong>Sync HubSpot → Alma Links</strong>. Everyone in your HubSpot CRM gets a login.</li>
            <li><strong>Import deals:</strong> Click <strong>Import HubSpot Deals</strong>. This copies your deals into Alma Links.</li>
            <li><strong>Create past events:</strong> Click <strong>Create past events from deals</strong>. Each deal becomes a past event on the Events page. You can run this again later; deals that already have an event are skipped.</li>
          </ol>
        </div>

        {/* What it does */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-blue-600" />
            What this does
          </h2>
          <ul className="space-y-2 text-gray-700 text-sm list-disc list-inside">
            <li>Imports <strong>all contacts</strong> from your HubSpot CRM into Alma Links.</li>
            <li>Creates a <strong>login for each person</strong> using their HubSpot email and a default password (set by your site administrator).</li>
            <li>After first sign-in, each person is asked to <strong>complete their profile</strong> on the site.</li>
            <li>Imported contacts appear in your site&apos;s member directory and can connect with others once they finish onboarding.</li>
            <li>Imports <strong>all deals (pipeline records)</strong> from HubSpot into a Firestore collection named <code>hubspotDeals</code> for reporting, analytics, or custom automations. These deals are not shown in the Alma Links UI by default.</li>
          </ul>
        </div>

        {/* How to use */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-600" />
            How to use
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-700 text-sm">
            <li><strong>Sync:</strong> Click <strong>Sync HubSpot → Alma Links</strong> below. Every contact in your HubSpot CRM will be imported and given a site account. You&apos;ll see how many were added when the sync finishes.</li>
            <li><strong>Deals:</strong> Click <strong>Import HubSpot Deals</strong> to upsert all deals into Firestore under <code>hubspotDeals</code>. Then click <strong>Create past events from deals</strong> to turn each deal into a past event in Alma Links (they will appear on the Events page with status &quot;completed&quot;). Deals that already have an event are skipped.</li>
            <li><strong>Logging in:</strong> Each imported person signs in with their <strong>HubSpot email</strong> and the <strong>default password</strong> (your site admin configures this). They should change it after first login.</li>
            <li><strong>After import:</strong> New users will be prompted to complete their profile (name, photo, bio, etc.) the first time they sign in.</li>
            <li><strong>Remove:</strong> To remove all users that were imported from HubSpot from the site, click <strong>Remove HubSpot users</strong>. This cannot be undone — use only if you want to clear the import and start over.</li>
          </ol>
          <p className="mt-4 text-gray-500 text-xs">
            If sync fails or you see an error, your site administrator may need to connect HubSpot in the project settings.
          </p>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <button
              onClick={syncHubspotContacts}
              disabled={syncing || syncingDeals || removing}
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
                  <span>Sync HubSpot → Alma Links</span>
                </>
              )}
            </button>
            <button
              onClick={syncHubspotDeals}
              disabled={syncing || syncingDeals || creatingFromDeals || removing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {syncingDeals ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Import HubSpot Deals...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Import HubSpot Deals</span>
                </>
              )}
            </button>
            <button
              onClick={createEventsFromDeals}
              disabled={syncing || syncingDeals || creatingFromDeals || removing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {creatingFromDeals ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Creating past events...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Create past events from deals</span>
                </>
              )}
            </button>
            <button
              onClick={removeHubspotUsers}
              disabled={syncing || syncingDeals || creatingFromDeals || removing}
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
                  <span>Remove HubSpot users</span>
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

          {dealsResult && (
            <div className={`mt-4 p-4 rounded-xl border ${dealsResult.ok !== false && !dealsResult.error ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {dealsResult.ok !== false && !dealsResult.error ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span>{dealsResult.ok !== false && !dealsResult.error ? 'Deals sync result' : 'Error'}</span>
              </div>
              <pre className="text-xs overflow-auto max-h-40 bg-white/60 p-3 rounded-lg">
                {JSON.stringify(dealsResult, null, 2)}
              </pre>
            </div>
          )}

          {createFromDealsResult && (
            <div className={`mt-4 p-4 rounded-xl border ${createFromDealsResult.ok !== false && !createFromDealsResult.error ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {createFromDealsResult.ok !== false && !createFromDealsResult.error ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span>{createFromDealsResult.ok !== false && !createFromDealsResult.error ? 'Past events created' : 'Error'}</span>
              </div>
              {createFromDealsResult.ok !== false && !createFromDealsResult.error ? (
                <p className="text-sm text-gray-700">
                  Created {createFromDealsResult.created ?? 0} past event(s), skipped {createFromDealsResult.skipped ?? 0} (already had events). Total deals: {createFromDealsResult.totalDeals ?? 0}.
                </p>
              ) : null}
              <pre className="text-xs overflow-auto max-h-40 bg-white/60 p-3 rounded-lg mt-2">
                {JSON.stringify(createFromDealsResult, null, 2)}
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
