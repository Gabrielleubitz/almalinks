import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Users, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle,
  Search,
  Filter,
  Loader,
  UserMinus
} from 'lucide-react';
import { ConnectionManagementService } from '../../services/connectionManagementService';
import { EnhancedConnection } from '../../types/connection';

interface ConnectionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ConnectionManagementModal: React.FC<ConnectionManagementModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName
}) => {
  const [connections, setConnections] = useState<EnhancedConnection[]>([]);
  const [filteredConnections, setFilteredConnections] = useState<EnhancedConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'auto' | 'manual' | 'admin'>('all');
  const [deletingConnection, setDeletingConnection] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    fromName: string;
    toName: string;
    eventId: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    byType: { [key: string]: number };
    byEvent: { [key: string]: number };
  } | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Load user connections when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      loadConnections();
      loadStats();
    }
  }, [isOpen, userId]);

  // Filter connections based on search and type filter
  useEffect(() => {
    filterConnections();
  }, [connections, searchTerm, filterType]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const userConnections = await ConnectionManagementService.getUserConnections(userId, 100);
      setConnections(userConnections);
    } catch (error) {
      console.error('❌ Error loading connections:', error);
      showToast('Failed to load connections', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const userStats = await ConnectionManagementService.getUserConnectionStats(userId);
      setStats(userStats);
    } catch (error) {
      console.error('❌ Error loading stats:', error);
    }
  };

  const filterConnections = () => {
    let filtered = [...connections];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(conn => conn.connectionType === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(conn => 
        conn.fromName?.toLowerCase().includes(term) ||
        conn.toName?.toLowerCase().includes(term) ||
        conn.fromEmail?.toLowerCase().includes(term) ||
        conn.toEmail?.toLowerCase().includes(term) ||
        conn.eventId?.toLowerCase().includes(term)
      );
    }

    setFilteredConnections(filtered);
  };

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const handleDeleteClick = (connection: EnhancedConnection) => {
    setDeleteConfirmation({
      id: connection.id,
      fromName: connection.fromName || 'Unknown',
      toName: connection.toName || 'Unknown',
      eventId: connection.eventId || 'Unknown Event'
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    try {
      setDeletingConnection(deleteConfirmation.id);
      await ConnectionManagementService.deleteConnection(deleteConfirmation.id);
      
      // Remove from local state
      setConnections(prev => prev.filter(conn => conn.id !== deleteConfirmation.id));
      
      showToast('Connection deleted successfully', 'success');
      setDeleteConfirmation(null);
      
      // Reload stats
      loadStats();
      
    } catch (error) {
      console.error('❌ Error deleting connection:', error);
      showToast('Failed to delete connection', 'error');
    } finally {
      setDeletingConnection(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'auto': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-blue-100 text-blue-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOtherUser = (connection: EnhancedConnection) => {
    return connection.fromUid === userId
      ? { name: connection.toName, email: connection.toEmail, uid: connection.toUid }
      : { name: connection.fromName, email: connection.fromEmail, uid: connection.fromUid };
  };
  
  const renderConnectionReasons = (connection: any) => {
    if (!connection.reasons || connection.reasons.length === 0) return null;
    
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {connection.reasons.map((reason: any, index: number) => {
          let badgeColor = 'bg-gray-100 text-gray-800';
          let label = reason.type;
          let details = null;
          
          if (reason.type === 'admin') {
            badgeColor = 'bg-purple-100 text-purple-800';
            label = 'Admin Created';
            details = reason.adminId ? ` by ${reason.adminId}` : '';
            if (reason.context) {
              details += `: "${reason.context}"`;
            }
          } else if (reason.type === 'event') {
            badgeColor = 'bg-green-100 text-green-800';
            label = 'Event Auto-Connect';
          } else if (reason.type === 'user') {
            badgeColor = 'bg-blue-100 text-blue-800';
            label = 'User Request';
          }
          
          return (
            <div key={index} className="text-xs">
              <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${badgeColor}`}>
                {label}
              </span>
              {details && (
                <div className="text-xs text-gray-600 mt-1 italic">
                  {details}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Manage Connections
              </h2>
              <p className="text-gray-600">
                {userName}'s network connections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Connections</div>
              </div>
              <div className="bg-white p-4 rounded-xl">
                <div className="text-2xl font-bold text-green-600">{stats.byType.auto || 0}</div>
                <div className="text-sm text-gray-600">Auto Connected</div>
              </div>
              <div className="bg-white p-4 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{stats.byType.manual || 0}</div>
                <div className="text-sm text-gray-600">Manual</div>
              </div>
              <div className="bg-white p-4 rounded-xl">
                <div className="text-2xl font-bold text-purple-600">{stats.byType.admin || 0}</div>
                <div className="text-sm text-gray-600">Admin Created</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search connections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="auto">Auto Connected</option>
                <option value="manual">Manual</option>
                <option value="admin">Admin Created</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 text-purple-600 animate-spin" />
              <span className="ml-2 text-gray-600">Loading connections...</span>
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="text-center py-12">
              <UserMinus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No connections found</p>
              <p className="text-gray-500 text-sm mt-1">
                {searchTerm || filterType !== 'all' ? 'Try adjusting your filters' : 'This user has no connections yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredConnections.map((connection) => {
                const otherUser = getOtherUser(connection);
                return (
                  <div key={connection.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {otherUser.name?.charAt(0) || '?'}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {otherUser.name || 'Unknown User'}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConnectionTypeColor(connection.connectionType)}`}>
                              {connection.connectionType || 'unknown'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {otherUser.email}
                          </p>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(connection.timestamp)}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Event: {connection.eventId || 'Unknown'}
                            </span>
                          </div>
                          {connection._originalConnection && renderConnectionReasons(connection._originalConnection)}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteClick(connection)}
                        disabled={deletingConnection === connection.id}
                        className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete connection"
                      >
                        {deletingConnection === connection.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredConnections.length} of {connections.length} connections
            </div>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Delete Connection?
              </h3>
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete the connection between:
              </p>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="font-semibold text-gray-900">
                  {deleteConfirmation.fromName} ↔ {deleteConfirmation.toName}
                </p>
                <p className="text-gray-600 text-sm">
                  Event: {deleteConfirmation.eventId}
                </p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ This action cannot be undone!
                </p>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingConnection === deleteConfirmation.id}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-colors duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {deletingConnection === deleteConfirmation.id ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-70">
          <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {toast.type === 'success' && <CheckCircle className="h-5 w-5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionManagementModal;