import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  X, 
  Search, 
  Filter,
  ChevronDown,
  User,
  Shield,
  UserPlus,
  UserMinus,
  Key,
  RefreshCw,
  Download,
  Calendar,
  Clock
} from 'lucide-react';

interface AuditLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string;
}

interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  details: any;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ 
  isOpen, 
  onClose, 
  adminId 
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<string | null>(null);

  const actionTypes = [
    'USER_CREATED',
    'BULK_IMPORT', 
    'FORCE_PASSWORD_RESET',
    'USER_DELETED',
    'ROLE_CHANGED'
  ];

  const loadLogs = async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/user-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-audit-logs',
          adminId: adminId,
          limit: 50,
          startAfter: reset ? null : lastDoc
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load audit logs');
      }

      if (reset) {
        setLogs(result.logs);
      } else {
        setLogs(prev => [...prev, ...result.logs]);
      }
      
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);

    } catch (error: any) {
      console.error('❌ Error loading audit logs:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs(true);
    }
  }, [isOpen]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'USER_CREATED':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'BULK_IMPORT':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'FORCE_PASSWORD_RESET':
        return <Key className="h-4 w-4 text-orange-600" />;
      case 'USER_DELETED':
        return <UserMinus className="h-4 w-4 text-red-600" />;
      case 'ROLE_CHANGED':
        return <Shield className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'USER_CREATED':
        return 'bg-green-100 text-green-800';
      case 'BULK_IMPORT':
        return 'bg-blue-100 text-blue-800';
      case 'FORCE_PASSWORD_RESET':
        return 'bg-orange-100 text-orange-800';
      case 'USER_DELETED':
        return 'bg-red-100 text-red-800';
      case 'ROLE_CHANGED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatActionDescription = (log: AuditLog) => {
    switch (log.action) {
      case 'USER_CREATED':
        return `Created user ${log.details.targetName} (${log.details.targetEmail}) with role ${log.details.targetRole}`;
      case 'BULK_IMPORT':
        return `Bulk imported ${log.details.successful} users (${log.details.failed} failed, ${log.details.duplicates} duplicates)`;
      case 'FORCE_PASSWORD_RESET':
        return `Forced password reset for ${log.details.targetName} (${log.details.targetEmail})`;
      case 'USER_DELETED':
        return `Deleted user ${log.details.targetName} (${log.details.targetEmail})`;
      case 'ROLE_CHANGED':
        return `Changed role for ${log.details.targetName} from ${log.details.oldRole} to ${log.details.newRole}`;
      default:
        return log.action.replace(/_/g, ' ').toLowerCase();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatActionDescription(log).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.targetEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.targetName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterAction === '' || log.action === filterAction;

    return matchesSearch && matchesFilter;
  });

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Action,Admin ID,Description,Details',
      ...filteredLogs.map(log => {
        const description = formatActionDescription(log);
        const details = JSON.stringify(log.details).replace(/"/g, '""');
        return `${log.timestamp},"${log.action}","${log.adminId}","${description}","${details}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
              <p className="text-sm text-gray-600">Track all administrative actions and changes</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs by action, email, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Filter */}
            <div className="relative">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Actions</option>
                {actionTypes.map(action => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadLogs(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {loading && logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading audit logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No audit logs found</p>
              <p className="text-gray-500 text-sm mt-1">
                {searchTerm || filterAction ? 'Try adjusting your search or filter' : 'No administrative actions have been logged yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log, index) => {
                const timestamp = formatTimestamp(log.timestamp);
                
                return (
                  <div 
                    key={log.id} 
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        
                        {/* Action Icon */}
                        <div className="p-2 bg-gray-50 rounded-lg">
                          {getActionIcon(log.action)}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Action and Description */}
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm text-gray-500">
                              Admin ID: {log.adminId === adminId ? 'You' : log.adminId.slice(0, 8)}...
                            </span>
                          </div>
                          
                          <p className="text-gray-900 font-medium mb-2">
                            {formatActionDescription(log)}
                          </p>

                          {/* Additional Details */}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {Object.entries(log.details).map(([key, value]) => {
                                  if (key === 'targetUserId' || key === 'adminId') return null;
                                  
                                  return (
                                    <div key={key}>
                                      <span className="text-gray-500 capitalize">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                                      </span>
                                      <span className="ml-2 text-gray-700 font-medium">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {log.userAgent && log.userAgent !== 'API' && (
                              <span>User Agent: {log.userAgent}</span>
                            )}
                            {log.ipAddress && log.ipAddress !== 'unknown' && (
                              <span>IP: {log.ipAddress}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-right text-sm text-gray-500 ml-4">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{timestamp.date}</span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1">
                          <Clock className="h-4 w-4" />
                          <span>{timestamp.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && !loading && (
                <div className="text-center pt-6">
                  <button
                    onClick={() => loadLogs(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load More Logs
                  </button>
                </div>
              )}

              {/* Loading More */}
              {loading && logs.length > 0 && (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 text-sm mt-2">Loading more logs...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {filteredLogs.length} of {logs.length} logs</span>
            <span>Logs are retained for 90 days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;