import React from 'react';
import { Upload, X, FileText, Image, Presentation, File as FileIcon } from 'lucide-react';

interface SpeakerFileUploaderProps {
  speakerEvents: Array<{
    id: string;
    eventId: string;
    eventName: string;
    eventDate: string;
  }>;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  fileDescription: string;
  setFileDescription: (description: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploading: boolean;
  uploadError: string | null;
  setUploadError: (error: string | null) => void;
  handleUpload: () => void;
  formatFileSize: (bytes: number) => string;
}

const SpeakerFileUploader: React.FC<SpeakerFileUploaderProps> = ({
  speakerEvents,
  selectedEventId,
  setSelectedEventId,
  fileDescription,
  setFileDescription,
  selectedFile,
  setSelectedFile,
  uploading,
  uploadError,
  setUploadError,
  handleUpload,
  formatFileSize
}) => {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setUploadError(null);
    }
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New File</h3>
      
      <div className="space-y-4">
        {/* Event Selection */}
        <div>
          <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Event *
          </label>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            required
            disabled={speakerEvents.length === 0 || uploading}
          >
            <option value="">Select an event...</option>
            {speakerEvents.map(event => (
              <option key={event.id || event.eventId} value={event.eventId || event.id}>
                {event.eventName} - {new Date(event.eventDate).toLocaleDateString()}
              </option>
            ))}
          </select>
          
          {speakerEvents.length === 0 && (
            <p className="text-sm text-red-600 mt-1">
              You need to be assigned to an event before you can upload files.
            </p>
          )}
        </div>
        
        {/* File Input */}
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Select File *
          </label>
          <div className="relative">
            <input
              id="file-upload"
              type="file"
              onChange={handleFileSelect}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
              disabled={uploading || speakerEvents.length === 0}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Accepted formats: PDF, Word, PowerPoint, Images, Text (Max 50MB)
          </p>
        </div>
        
        {/* File Description */}
        <div>
          <label htmlFor="file-description" className="block text-sm font-medium text-gray-700 mb-2">
            File Description *
          </label>
          <textarea
            id="file-description"
            value={fileDescription}
            onChange={(e) => setFileDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
            placeholder="Briefly describe this file (e.g., 'Presentation slides for my talk', 'Handout for attendees')"
            disabled={uploading || speakerEvents.length === 0}
            required
          />
        </div>
        
        {/* Selected File Preview */}
        {selectedFile && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="text-brand-light mt-1">
                {selectedFile.type.includes('pdf') ? (
                  <FileText className="h-6 w-6" />
                ) : selectedFile.type.includes('image') ? (
                  <Image className="h-6 w-6" />
                ) : selectedFile.type.includes('presentation') || selectedFile.type.includes('powerpoint') ? (
                  <Presentation className="h-6 w-6" />
                ) : (
                  <FileIcon className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 break-all">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/')[1]?.toUpperCase() || selectedFile.type}
                </p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-gray-700"
                disabled={uploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        
        {/* Upload Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !fileDescription.trim() || !selectedEventId || speakerEvents.length === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Upload File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerFileUploader;