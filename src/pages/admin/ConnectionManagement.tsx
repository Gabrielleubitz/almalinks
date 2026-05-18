import React, { useState, useLayoutEffect, useEffect } from 'react';
import BackButton from '../../components/ui/BackButton';
import { ArrowLeft, Download } from 'lucide-react';
import AdminConnectionManager from '../../components/admin/AdminConnectionManager';
import AdminConnectionWidget from '../../components/admin/AdminConnectionWidget';
import AdminAllConnectionsTable from '../../components/admin/AdminAllConnectionsTable';
import { AdminConnectionService } from '../../services/adminConnectionService';

const ConnectionManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'management'>('overview');
  /** Load aggregate stats after first paint so the connections table can fetch first (less contention). */
  const [showStatsWidget, setShowStatsWidget] = useState(false);

  useEffect(() => {
    const run = () => setShowStatsWidget(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 200);
    return () => window.clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  const handleExportStats = async () => {
    try {
      const rows = await AdminConnectionService.getConnectionsForExport();
      const headers = [
        'Connection ID',
        'UID (smaller)',
        'UID (larger)',
        'Member A name',
        'Member B name',
        'Member A email',
        'Member B email',
        'Primary type',
        'Source summary',
        'Date (updated)'
      ];
      const escape = (v: string) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const csv = [
        headers.map(escape).join(','),
        ...rows.map(r =>
          [
            r.id,
            r.fromUid,
            r.toUid,
            r.fromName,
            r.toName,
            r.fromEmail,
            r.toEmail,
            r.connectionType,
            r.sourceSummary,
            r.date
          ]
            .map(escape)
            .join(',')
        )
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `almalinks-connections-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Error exporting stats:', error);
      window.alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 overflow-x-hidden w-full max-w-full box-border">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-3"><BackButton fallbackTo="/admin" className="inline-flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors font-medium text-sm" iconClassName="h-4 w-4" /></div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Connection Management
          </h1>
          <p className="mt-1 text-gray-600 text-sm sm:text-base max-w-2xl">
            See every connection, how it was created, and use tools to connect members or bulk-link an event.
          </p>
        </div>

        {/* View switcher + Export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm w-full sm:w-auto">
            <button
              onClick={() => setActiveView('overview')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeView === 'overview'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('management')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeView === 'management'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Management
            </button>
          </div>
          <button
            onClick={handleExportStats}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 whitespace-nowrap w-full sm:w-auto"
          >
            <Download className="h-4 w-4 flex-shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Content */}
        {activeView === 'overview' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-blue-950 mb-2">How to read “source”</h3>
              <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                <li>
                  <strong>By event</strong> — created from event flows (e.g. check-in auto-connect); details may include the event name.
                </li>
                <li>
                  <strong>By request</strong> — one member connected to another (directory, profile, or request flow).
                </li>
                <li>
                  <strong>By admin</strong> — created from this admin area (manual connect or bulk for an event).
                </li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  setActiveView('management');
                  window.scrollTo(0, 0);
                }}
                className="mt-3 text-sm font-semibold text-blue-800 hover:text-blue-950 underline-offset-2 hover:underline"
              >
                Go to management tools (connect / bulk) →
              </button>
            </div>

            <AdminAllConnectionsTable className="w-full" maxRows={300} />

            {showStatsWidget ? (
              <AdminConnectionWidget className="w-full" />
            ) : (
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 animate-pulse"
                aria-hidden
              >
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-5" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-500">Loading overview stats…</p>
              </div>
            )}
          </div>
        ) : (
          /* Management View */
          <AdminConnectionManager />
        )}
      </div>
    </div>
  );
};

export default ConnectionManagement;