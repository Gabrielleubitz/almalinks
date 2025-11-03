import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  File as FileIcon, 
  AlertCircle, 
  Info, 
  ArrowLeft, 
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { SpeakerService, SpeakerFile } from '../services/speakerService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Toast from '../components/ui/Toast';
import SpeakerProfile from '../components/speaker/SpeakerProfile';
import SpeakerGuidelines from '../components/speaker/SpeakerGuidelines';
import SpeakerEventCard from '../components/speaker/SpeakerEventCard';
import SpeakerFileUploader from '../components/speaker/SpeakerFileUploader';
import SpeakerFileItem from '../components/speaker/SpeakerFileItem';
import SpeakerFileDetail from '../components/speaker/SpeakerFileDetail';

interface SpeakerEvent {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  date?: string; // For backward compatibility
  name?: string; // For backward compatibility
  location?: string;
}

const SpeakerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [speakerEvents, setSpeakerEvents] = useState<SpeakerEvent[]>([]);
  const [userFiles, setUserFiles] = useState<SpeakerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // File detail view state
  const [selectedFileDetail, setSelectedFileDetail] = useState<SpeakerFile | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Load speaker events and files
  useEffect(() => {
    if (user?.uid) {
      loadSpeakerData();
    }
  }, [user]);

  const loadSpeakerData = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setEventsLoading(true);
    setFilesLoading(true);
    
    try {
      // Check if user is a speaker
      const isSpeaker = await SpeakerService.isUserSpeaker(user.uid);
      
      if (!isSpeaker) {
        console.log('⚠️ User is not a speaker:', user.uid);
        showToast('You do not have speaker privileges. Please contact the administrator.', 'error');
        setLoading(false);
        setEventsLoading(false);
        setFilesLoading(false);
        return;
      }
      
      // Load speaker events
      const events = await SpeakerService.getUserSpeakerEvents(user.uid);
      console.log('📅 Speaker events loaded:', events);
      
      // Normalize event data format
      const normalizedEvents = events.map(event => ({
        id: event.id || '',
        eventId: event.eventId || event.id || '',
        eventName: event.eventName || event.name || 'Unnamed Event',
        eventDate: event.eventDate || event.date || new Date().toISOString(),
        location: event.location || ''
      }));
      
      setSpeakerEvents(normalizedEvents);
      
      // Set default selected event if available
      if (normalizedEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(normalizedEvents[0].eventId);
      }
      
      setEventsLoading(false);
      
      // Load speaker files
      const files = await SpeakerService.getUserFiles(user.uid);
      console.log('📁 Speaker files loaded:', files);
      setUserFiles(files);
      setFilesLoading(false);
      
    } catch (error) {
      console.error('❌ Error loading speaker data:', error);
      showToast('Failed to load speaker data. Please try again later.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!user?.uid || !selectedFile || !fileDescription.trim() || !selectedEventId) {
      setUploadError('Please select a file, add a description, and choose an event');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const uploadedFile = await SpeakerService.uploadFile(
        selectedFile,
        fileDescription,
        selectedEventId,
        user.uid
      );
      
      // Add to local state
      setUserFiles(prev => [uploadedFile, ...prev]);
      
      showToast('File uploaded successfully!', 'success');
      setSelectedFile(null);
      setFileDescription('');
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      setUploadError(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!user?.uid) return;
    
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      await SpeakerService.deleteFile(fileId, user.uid);
      
      // Update local state
      setUserFiles(prev => prev.filter(f => f.id !== fileId));
      
      showToast('File deleted successfully!', 'success');
      
      // Close detail view if open
      if (selectedFileDetail?.id === fileId) {
        setSelectedFileDetail(null);
      }
    } catch (error: any) {
      console.error('❌ Error deleting file:', error);
      showToast(error.message || 'Failed to delete file', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileIcon className="h-6 w-6 text-red-600" />;
    } else if (fileType.includes('image')) {
      return <FileIcon className="h-6 w-6 text-brand-light" />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      return <FileIcon className="h-6 w-6 text-orange-600" />;
    } else {
      return <FileIcon className="h-6 w-6 text-gray-600" />;
    }
  };

  const getFileTypeLabel = (fileType: string): string => {
    if (fileType.includes('pdf')) return 'PDF Document';
    if (fileType.includes('image/jpeg')) return 'JPEG Image';
    if (fileType.includes('image/png')) return 'PNG Image';
    if (fileType.includes('image/gif')) return 'GIF Image';
    if (fileType.includes('powerpoint')) return 'PowerPoint Presentation';
    if (fileType.includes('word')) return 'Word Document';
    if (fileType.includes('text/plain')) return 'Text Document';
    
    return fileType.split('/')[1]?.toUpperCase() || 'Unknown File Type';
  };

  const formatFileSize = (bytes: number): string => {
    return SpeakerService.formatFileSize(bytes);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({
      visible: true,
      message,
      type
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="pt-32 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading speaker dashboard...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Toast Notification */}
      {toast.visible && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      )}
      
      {/* File Detail Modal */}
      {selectedFileDetail && (
        <SpeakerFileDetail
          file={selectedFileDetail}
          eventName={speakerEvents.find(e => (e.eventId || e.id) === selectedFileDetail.eventId)?.eventName || 'Unknown Event'}
          onClose={() => setSelectedFileDetail(null)}
          onDelete={handleDeleteFile}
          getFileTypeIcon={getFileTypeIcon}
          getFileTypeLabel={getFileTypeLabel}
          formatFileSize={formatFileSize}
          formatTimestamp={formatTimestamp}
        />
      )}
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => navigate('/events')}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Events</span>
            </button>
          </div>
          
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Speaker <span className="bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent">Dashboard</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Upload presentations, manage your content, and prepare for your speaking engagements.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content - Takes 2/3 of the space */}
            <div className="lg:col-span-2 space-y-8">
              {/* Speaker Events Section */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Speaking Events</h2>
                
                {eventsLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your events...</p>
                  </div>
                ) : speakerEvents.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl">
                    <FileIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Speaking Events</h3>
                    <p className="text-gray-600">
                      You haven't been assigned to any events yet. Contact the event organizer for more information.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {speakerEvents.map((event) => (
                      <SpeakerEventCard 
                        key={event.id || event.eventId}
                        event={event}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Speaker Upload Center */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Speaker Upload Center</h2>
                
                {/* Error Message */}
                {uploadError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-600 text-sm">{uploadError}</p>
                    <button
                      onClick={() => setUploadError(null)}
                      className="text-red-600 hover:text-red-700 ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="space-y-6">
                  <SpeakerFileUploader
                    speakerEvents={speakerEvents}
                    selectedEventId={selectedEventId}
                    setSelectedEventId={setSelectedEventId}
                    fileDescription={fileDescription}
                    setFileDescription={setFileDescription}
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    uploading={uploading}
                    uploadError={uploadError}
                    setUploadError={setUploadError}
                    handleUpload={handleUpload}
                    formatFileSize={formatFileSize}
                  />
                  
                  {/* Uploaded Files List */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Uploaded Files</h3>
                    
                    {filesLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading your files...</p>
                      </div>
                    ) : userFiles.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-2xl">
                        <FileIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">No files uploaded yet</p>
                        <p className="text-gray-500 text-sm">Upload your first file using the form above.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userFiles.map((file) => (
                          <SpeakerFileItem
                            key={file.id}
                            file={file}
                            eventName={speakerEvents.find(e => (e.eventId || e.id) === file.eventId)?.eventName || 'Unknown Event'}
                            onViewDetails={setSelectedFileDetail}
                            onDelete={handleDeleteFile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Takes 1/3 of the space */}
            <div className="lg:col-span-1 space-y-8">
              {/* User Profile */}
              <SpeakerProfile user={user} />
              
              {/* Speaker Guidelines */}
              <SpeakerGuidelines />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SpeakerDashboard;