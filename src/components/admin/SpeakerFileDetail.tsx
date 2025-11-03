import React from 'react';
import { X, MessageSquare, Download, Trash2 } from 'lucide-react';
import { SpeakerFile } from '../../services/speakerService';

interface SpeakerFileDetailProps {
  file: SpeakerFile;
  eventName: string;
  onClose: () => void;
  onDelete: (fileId: string) => void;
  getFileTypeIcon: (fileType: string) => JSX.Element;
  getFileTypeLabel: (fileType: string) => string;
  formatFileSize: (bytes: number) => string;
  formatTimestamp: (timestamp: any) => string;
}

const SpeakerFileDetail: React.FC<SpeakerFileDetailProps> = ({
  file,
  eventName,
  onClose,
  onDelete,
  getFileTypeIcon,
  getFileTypeLabel,
  formatFileSize,
  formatTimestamp
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {getFileTypeIcon(file.fileType)}
            <h3 className="text-2xl font-bold text-gray-900 break-all">
              {file.originalName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">File Type</div>
              <div className="font-medium text-gray-900">{getFileTypeLabel(file.fileType)}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">File Size</div>
              <div className="font-medium text-gray-900">{formatFileSize(file.fileSize)}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Uploaded On</div>
              <div className="font-medium text-gray-900">{formatTimestamp(file.uploadedAt)}</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Associated Event</div>
              <div className="font-medium text-gray-900">{eventName}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Description</div>
              <div className="font-medium text-gray-900">{file.description}</div>
            </div>
            
            <div className="flex space-x-3 pt-2">
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-brand-mid transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </a>
              
              <button
                onClick={() => {
                  onDelete(file.id);
                  onClose();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Admin Note (if any) */}
        {file.adminNote && (
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 mb-6">
            <div className="flex items-start space-x-3">
              <MessageSquare className="h-5 w-5 text-brand-dark flex-shrink-0 mt-1" />
              <div>
                <div className="font-medium text-purple-900 mb-1">Note from Organizers</div>
                <div className="text-purple-800">{file.adminNote}</div>
                {file.adminNoteAt && (
                  <div className="text-xs text-brand-dark mt-1">
                    Added {formatTimestamp(file.adminNoteAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerFileDetail;