import React, { useState, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminConnectionManager from '../../components/admin/AdminConnectionManager';
import AdminConnectionWidget from '../../components/admin/AdminConnectionWidget';

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
      // TODO: Implement export functionality
      // This would export connection statistics to CSV
      // Implementation would depend on your requirements
      console.log('Export functionality not yet implemented');
      // For now, show a user-friendly message
      const shouldProceed = window.confirm('Export functionality is not yet implemented. Would you like to be notified when it becomes available?');
      if (shouldProceed) {
        // Could integrate with a notification system here
        console.log('User requested export notification');
      }
    } catch (error) {
      console.error('❌ Error exporting stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader title="Connection Management" />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-x-hidden w-full max-w-full box-border">
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
          {/* Left: Back + Title */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link
              to="/admin"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="whitespace-nowrap">Back to Admin Dashboard</span>
            </Link>
            <div className="hidden sm:block text-gray-400">|</div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 whitespace-normal break-words sm:whitespace-nowrap">
              Connection Management
            </h1>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleExportStats}
              className="inline-flex items-center justify-center space-x-2 px-3 sm:px-4 py-2.5 sm:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0 whitespace-nowrap w-full sm:w-auto"
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              <span>Export Stats</span>
            </button>

            <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setActiveView('overview')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                  activeView === 'overview'
                    ? 'bg-white text-brand-light shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveView('management')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                  activeView === 'management'
                    ? 'bg-white text-brand-light shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Management
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeView === 'overview' ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Widget */}
            <AdminConnectionWidget className="w-full" />

            {/* Additional Overview Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Connection Health */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Connection Health</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-900">Auto-Connect System</p>
                      <p className="text-sm text-green-600">Functioning normally</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">Global Directory</p>
                      <p className="text-sm text-brand-light">Active and searchable</p>
                    </div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-orange-900">QR Code System</p>
                      <p className="text-sm text-orange-600">Legacy system active</p>
                    </div>
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 sm:space-x-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        15 auto-connections created
                      </p>
                      <p className="text-xs text-gray-600 truncate">Alma Links Event - 2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 sm:space-x-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        8 manual connections via directory
                      </p>
                      <p className="text-xs text-gray-600 truncate">Global directory - 4 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 sm:space-x-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        3 QR code connections
                      </p>
                      <p className="text-xs text-gray-600 truncate">Legacy QR system - 6 hours ago</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                  <Link
                    to="/admin/connections?tab=stats"
                    className="text-xs sm:text-sm text-brand-light hover:text-blue-700 font-medium"
                  >
                    View detailed analytics →
                  </Link>
                </div>
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 flex-shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-gray-900">System Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="p-3 sm:p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Auto-Connect Default</h4>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    New events automatically enable auto-connect by default.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto-connect-default"
                      defaultChecked={true}
                      className="h-4 w-4 text-brand-light focus:ring-blue-500 border-gray-300 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                    />
                    <label htmlFor="auto-connect-default" className="ml-2 text-xs sm:text-sm text-gray-900">
                      Enabled
                    </label>
                  </div>
                </div>

                <div className="p-3 sm:p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Rate Limiting</h4>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    Daily manual connection request limit per user.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="number"
                      defaultValue={50}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 min-h-[44px] sm:min-h-0"
                    />
                    <span className="ml-2 text-xs sm:text-sm text-gray-600">requests/day</span>
                  </div>
                </div>

                <div className="p-3 sm:p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Directory Search</h4>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    Global directory search functionality.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="directory-search"
                      defaultChecked={true}
                      className="h-4 w-4 text-brand-light focus:ring-blue-500 border-gray-300 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                    />
                    <label htmlFor="directory-search" className="ml-2 text-xs sm:text-sm text-gray-900">
                      Enabled
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                <button className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0">
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