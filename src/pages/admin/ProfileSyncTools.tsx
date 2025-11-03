import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RefreshCw, Users, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import { ProfileSyncService } from '../../services/profileSyncService';

const ProfileSyncTools: React.FC = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [syncType, setSyncType] = useState<'single' | 'all'>('single');
  const [targetUserId, setTargetUserId] = useState('');

  // Show loading while checking admin status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const addResult = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    setResults(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  const runSingleUserSync = async () => {
    if (!targetUserId.trim()) {
      addResult('Please enter a user ID', 'error');
      return;
    }

    setIsRunning(true);
    setResults([]);
    
    try {
      addResult(`Starting profile sync for user: ${targetUserId}`, 'info');
      await ProfileSyncService.syncUserProfileData(targetUserId);
      addResult('Profile sync completed successfully!', 'success');
    } catch (error: any) {
      addResult(`Sync failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runAllUsersSync = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      addResult('Starting profile sync for ALL users...', 'info');
      addResult('⚠️ This may take several minutes', 'info');
      
      // Override console.log temporarily to capture sync logs
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      
      console.log = (message: string, ...args: any[]) => {
        if (typeof message === 'string' && (message.includes('✅') || message.includes('❌') || message.includes('🔄'))) {
          addResult(message, message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : 'info');
        }
        originalConsoleLog(message, ...args);
      };
      
      console.error = (message: string, ...args: any[]) => {
        if (typeof message === 'string') {
          addResult(message, 'error');
        }
        originalConsoleError(message, ...args);
      };
      
      await ProfileSyncService.manualSyncAllUsers();
      
      // Restore console methods
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      
      addResult('🎉 All users sync completed successfully!', 'success');
    } catch (error: any) {
      addResult(`Sync failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Profile Sync Tools" 
        subtitle="Sync profile pictures across connections and events"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Information Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
          <div className="flex items-start space-x-3">
            <Info className="h-6 w-6 text-brand-light mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">What does this tool do?</h3>
              <div className="text-blue-800 space-y-2">
                <p>This tool ensures profile pictures are consistently displayed across:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>User connections (QR code scans)</li>
                  <li>Speaker assignments in events</li>
                  <li>Event speaker displays</li>
                </ul>
                <p className="mt-4 font-medium">Use this when users report their profile pictures not showing up for other users.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Options */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sync Options</h2>
          
          <div className="space-y-6">
            {/* Single User Sync */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="radio"
                  id="single"
                  name="syncType"
                  value="single"
                  checked={syncType === 'single'}
                  onChange={(e) => setSyncType(e.target.value as 'single' | 'all')}
                  className="h-4 w-4 text-brand-dark"
                />
                <label htmlFor="single" className="text-lg font-medium text-gray-900">
                  Single User Sync
                </label>
              </div>
              
              {syncType === 'single' && (
                <div className="ml-7 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      User ID (from URL or Firebase console)
                    </label>
                    <input
                      type="text"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      placeholder="e.g., abc123def456"
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isRunning}
                    />
                  </div>
                  <button
                    onClick={runSingleUserSync}
                    disabled={isRunning || !targetUserId.trim()}
                    className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync User
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* All Users Sync */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="radio"
                  id="all"
                  name="syncType"
                  value="all"
                  checked={syncType === 'all'}
                  onChange={(e) => setSyncType(e.target.value as 'single' | 'all')}
                  className="h-4 w-4 text-brand-dark"
                />
                <label htmlFor="all" className="text-lg font-medium text-gray-900">
                  All Users Sync
                </label>
              </div>
              
              {syncType === 'all' && (
                <div className="ml-7 space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-yellow-800">
                        <p className="font-medium">Caution: Bulk Operation</p>
                        <p className="text-sm mt-1">
                          This will sync ALL users in the database. It may take several minutes and should be used sparingly to avoid rate limits.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={runAllUsersSync}
                    disabled={isRunning}
                    className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing All...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Sync All Users
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sync Results</h3>
              <button
                onClick={clearResults}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="font-mono text-sm space-y-1">
                {results.map((result, index) => (
                  <div 
                    key={index} 
                    className={`${
                      result.includes('✅') ? 'text-green-700' : 
                      result.includes('❌') ? 'text-red-700' : 
                      'text-gray-700'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSyncTools;