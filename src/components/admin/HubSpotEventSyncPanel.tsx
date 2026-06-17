import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import {
  fetchHubSpotIntegrationConfig,
  syncEventToHubSpot,
  type HubSpotIntegrationConfig,
} from '../../utils/hubspotEventSync';

const HUBSPOT_DEALS_URL = 'https://app.hubspot.com/contacts';

interface HubSpotEventSyncPanelProps {
  eventId: string;
  eventName?: string;
  hubspotDealId?: string | null;
  /** Shown when create/update already attempted sync and failed. */
  initialSyncError?: string;
  initialSyncHint?: string;
  /** Called when sync returns a new deal id (parent should refresh event). */
  onHubspotDealIdChange?: (dealId: string) => void;
  compact?: boolean;
  className?: string;
}

const HubSpotEventSyncPanel: React.FC<HubSpotEventSyncPanelProps> = ({
  eventId,
  eventName,
  hubspotDealId: hubspotDealIdProp,
  initialSyncError,
  initialSyncHint,
  onHubspotDealIdChange,
  compact = false,
  className = '',
}) => {
  const [config, setConfig] = useState<HubSpotIntegrationConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [localDealId, setLocalDealId] = useState(hubspotDealIdProp?.trim() || '');
  const [syncing, setSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(
    initialSyncError ? false : null
  );

  useEffect(() => {
    setLocalDealId(hubspotDealIdProp?.trim() || '');
  }, [hubspotDealIdProp, eventId]);

  useEffect(() => {
    if (initialSyncError) {
      setLastError(initialSyncError);
      setLastHint(initialSyncHint || null);
      setLastOk(false);
    }
  }, [initialSyncError, initialSyncHint, eventId]);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    fetchHubSpotIntegrationConfig().then((c) => {
      if (!cancelled) {
        setConfig(c);
        setConfigLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSync = useCallback(async () => {
    if (!eventId) return;
    setSyncing(true);
    setLastMessage(null);
    setLastError(null);
    setLastHint(null);
    setLastOk(null);

    const result = await syncEventToHubSpot(eventId);
    setSyncing(false);
    setLastOk(result.synced);

    if (result.synced) {
      setLastMessage(result.message || 'Synced to HubSpot.');
      if (result.hubspotDealId) {
        setLocalDealId(result.hubspotDealId);
        onHubspotDealIdChange?.(result.hubspotDealId);
      }
    } else {
      setLastError(result.error || 'HubSpot sync failed.');
      setLastHint(result.hint || null);
    }
  }, [eventId, onHubspotDealIdChange]);

  const tokenOk = config?.hubspot === true;
  const linked = Boolean(localDealId);

  return (
    <div
      className={`rounded-xl border ${
        lastOk === false ? 'border-red-200 bg-red-50/80' : linked ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
      } p-4 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            HubSpot Deal sync
            {linked ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle className="h-3.5 w-3.5" />
                Linked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" />
                Not linked
              </span>
            )}
          </h3>
          {!compact && eventName ? (
            <p className="text-xs text-gray-600 mt-1 truncate">{eventName}</p>
          ) : null}
          <dl className="mt-2 space-y-1 text-xs text-gray-600">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <dt className="text-gray-500">Server token</dt>
              <dd className={tokenOk ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                {configLoading
                  ? 'Checking…'
                  : config?.loadError
                    ? config.loadError
                    : tokenOk
                      ? 'Configured'
                      : 'Missing — set HUBSPOT_ACCESS_TOKEN'}
              </dd>
            </div>
            {config?.hubspotDealPipeline ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="text-gray-500">Deal pipeline</dt>
                <dd className="font-mono text-gray-800">{config.hubspotDealPipeline}</dd>
              </div>
            ) : null}
            {config?.hubspotDealStage ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="text-gray-500">Deal stage</dt>
                <dd className="font-mono text-gray-800">{config.hubspotDealStage}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <dt className="text-gray-500">Deal ID</dt>
              <dd className="font-mono text-gray-800 break-all">
                {localDealId || '— (sync to create)'}
              </dd>
            </div>
          </dl>
          {localDealId ? (
            <a
              href={`${HUBSPOT_DEALS_URL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-blue-dark hover:underline"
            >
              Open HubSpot Deals
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing || !eventId}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : linked ? 'Retry HubSpot sync' : 'Sync to HubSpot'}
        </button>
      </div>

      {lastOk === true && lastMessage ? (
        <p className="mt-3 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {lastMessage}
        </p>
      ) : null}
      {lastOk === false && lastError ? (
        <div className="mt-3 text-sm text-red-800">
          <p className="flex items-start gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {lastError}
          </p>
          {lastHint ? <p className="mt-1 ml-6 text-xs text-red-700">{lastHint}</p> : null}
          <p className="mt-2 ml-6 text-xs text-red-700">
            Common fixes: confirm <code className="bg-red-100 px-1 rounded">HUBSPOT_ACCESS_TOKEN</code>,{' '}
            <code className="bg-red-100 px-1 rounded">HUBSPOT_DEAL_PIPELINE</code>, and{' '}
            <code className="bg-red-100 px-1 rounded">HUBSPOT_DEAL_STAGE</code> match your HubSpot portal.
            Invalid chapter values on the event can also cause rejection.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default HubSpotEventSyncPanel;
