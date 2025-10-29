import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminConnectionManager from '../../components/admin/AdminConnectionManager';
import AdminConnectionWidget from '../../components/admin/AdminConnectionWidget';

const ConnectionManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'management'>('overview');

  const handleExportStats = async () => {
    try {
      // This would export connection statistics to CSV
      // Implementation would depend on your requirements
      alert('Export functionality would be implemented here');
    } catch (error) {
      console.error('❌ Error exporting stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Admin Dashboard</span>
            </Link>
            <div className="text-gray-400">|</div>
            <h1 className="text-2xl font-bold text-gray-900">Connection Management</h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportStats}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              <span>Export Stats</span>
            </button>

            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView('overview')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'overview'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveView('management')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'management'
                    ? 'bg-white text-blue-600 shadow-sm'
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
          <div className="space-y-6">
            {/* Stats Widget */}
            <AdminConnectionWidget className="w-full" />

            {/* Additional Overview Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connection Health */}
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Connection Health</h3>
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
                      <p className="text-sm text-blue-600">Active and searchable</p>
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
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        15 auto-connections created
                      </p>
                      <p className="text-xs text-gray-600">Wine & Grind Event - 2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        8 manual connections via directory
                      </p>
                      <p className="text-xs text-gray-600">Global directory - 4 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        3 QR code connections
                      </p>
                      <p className="text-xs text-gray-600">Legacy QR system - 6 hours ago</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link
                    to="/admin/connections?tab=stats"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View detailed analytics →
                  </Link>
                </div>
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Settings className="h-6 w-6 text-gray-600" />
                <h3 className="text-lg font-bold text-gray-900">System Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">Auto-Connect Default</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    New events automatically enable auto-connect by default.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto-connect-default"
                      defaultChecked={true}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="auto-connect-default" className="ml-2 text-sm text-gray-900">
                      Enabled
                    </label>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">Rate Limiting</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Daily manual connection request limit per user.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="number"
                      defaultValue={50}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">requests/day</span>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">Directory Search</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Global directory search functionality.
                  </p>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="directory-search"
                      defaultChecked={true}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="directory-search" className="ml-2 text-sm text-gray-900">
                      Enabled
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
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