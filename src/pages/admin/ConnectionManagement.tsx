import React, { useState, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminConnectionManager from '../../components/admin/AdminConnectionManager';
import AdminConnectionWidget from '../../components/admin/AdminConnectionWidget';
import { AdminConnectionService } from '../../services/adminConnectionService';

const ConnectionManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'management'>('overview');

  // Scroll to top synchronously before paint to prevent visible scroll jump
  useLayoutEffect(() => {
    // Capture scroll position before reset
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    
    // Reset all possible scroll positions (order matters for compatibility)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    
    // Verify scroll was reset
    const scrollAfter = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    
    // Dev-only console log for verification
    if (process.env.NODE_ENV === 'development') {
      console.log('[ConnectionManagement] Scroll reset:', {
        target: 'window',
        scrollBefore,
        scrollAfter,
        success: scrollAfter === 0,
        windowScrollY: window.scrollY,
        docElementScrollTop: document.documentElement.scrollTop,
        bodyScrollTop: document.body.scrollTop
      });
    }
  }, []);

  const handleExportStats = async () => {
    try {
      const rows = await AdminConnectionService.getConnectionsForExport();
      const headers = ['Connection ID', 'From UID', 'To UID', 'From Name', 'To Name', 'From Email', 'To Email', 'Type', 'Date'];
      const escape = (v: string) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const csv = [headers.map(escape).join(','), ...rows.map(r => [r.id, r.fromUid, r.toUid, r.fromName, r.toName, r.fromEmail, r.toEmail, r.connectionType, r.date].map(escape).join(','))].join('\n');
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
    <div className="min-h-screen bg-gray-100">
      <AdminHeader title="Connection Management" />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 overflow-x-hidden w-full max-w-full box-border">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <Link
            to="/admin"
            className="inline-flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors font-medium text-sm mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Connection Management
          </h1>
          <p className="mt-1 text-gray-600 text-sm sm:text-base max-w-2xl">
            View connection stats, health status, and create or bulk-manage connections between members.
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
            <span>Export Stats</span>
          </button>
        </div>

        {/* Content */}
        {activeView === 'overview' ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Widget */}
            <AdminConnectionWidget className="w-full" />

            {/* Additional Overview Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Connection Health */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Connection Health</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                    <div>
                      <p className="font-semibold text-green-900">Auto-Connect System</p>
                      <p className="text-sm text-green-800">Functioning normally</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div>
                      <p className="font-semibold text-blue-900">Global Directory</p>
                      <p className="text-sm text-blue-800">Active and searchable</p>
                    </div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <p className="font-semibold text-amber-900">Legacy System</p>
                      <p className="text-sm text-amber-800">Active</p>
                    </div>
                    <div className="w-3 h-3 bg-amber-500 rounded-full flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Auto-connections created</p>
                      <p className="text-xs text-gray-600">Event-based</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Manual connections</p>
                      <p className="text-xs text-gray-600">Via directory</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Legacy connections</p>
                      <p className="text-xs text-gray-600">In-person / scan</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link
                    to="/admin/connections?tab=stats"
                    className="text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    View detailed analytics →
                  </Link>
                </div>
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-bold text-gray-900">System Settings</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                  <h4 className="font-semibold text-gray-900 mb-2">Auto-Connect Default</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    New events enable auto-connect by default.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Enabled</span>
                  </label>
                </div>
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                  <h4 className="font-semibold text-gray-900 mb-2">Rate Limiting</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Daily manual connection requests per user.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      defaultValue={5}
                      className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-700">per day</span>
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                  <h4 className="font-semibold text-gray-900 mb-2">Directory Search</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Global directory search.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Enabled</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium text-sm">
                  Save Settings
                </button>
              </div>
            </div>
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