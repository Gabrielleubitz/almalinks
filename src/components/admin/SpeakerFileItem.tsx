import React from 'react';
import { Calendar, Info, FileText, Image, Presentation, File as FileIcon, MessageSquare, Download, Trash2 } from 'lucide-react';
import { SpeakerFile } from '../../services/speakerService';

interface SpeakerFileItemProps {
  file: SpeakerFile;
  eventName: string;
  onViewDetails: (file: SpeakerFile) => void;
  onDelete: (fileId: string) => void;
}

const SpeakerFileItem: React.FC<SpeakerFileItemProps> = ({
  file,
  eventName,
  onViewDetails,
  onDelete
}) => {
  const getFileTypeIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-6 w-6 text-red-600" />;
    } else if (fileType.includes('image')) {
      return <Image className="h-6 w-6 text-brand-light" />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      return <Presentation className="h-6 w-6 text-orange-600" />;
    } else {
      return <FileIcon className="h-6 w-6 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const fileIcon = getFileTypeIcon(file.fileType);

  return (
    <div 
      className="p-6 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={() => onViewDetails(file)}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-4">
          {fileIcon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 break-all mb-1">{file.originalName}</h4>
          <p className="text-sm text-gray-600">{file.description}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3">
            <div className="flex items-center text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" />
              <span>{formatTimestamp(file.uploadedAt)}</span>
            </div>
            
            <div className="flex items-center text-xs text-gray-500">
              <Info className="h-3.5 w-3.5 mr-1 text-gray-400" />
              <span>{formatFileSize(file.fileSize)}</span>
            </div>
            
            <div className="flex items-center text-xs text-gray-500">
              <FileText className="h-3.5 w-3.5 mr-1 text-gray-400" />
              <span>{getFileTypeLabel(file.fileType)}</span>
            </div>
          </div>
          
          <div className="flex items-center mt-2 text-xs font-medium text-brand-light">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            <span>Event: {eventName}</span>
          </div>
          
          {/* Admin Note Indicator */}
          {file.adminNote && (
            <div className="mt-3 flex items-center text-xs font-medium text-brand-dark">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              <span>Has feedback from organizers</span>
            </div>
          )}
        </div>
        
        <div className="flex space-x-2 ml-4">
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-brand-light hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors duration-200"
            title="Download file"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id);
            }}
            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
            title="Delete file"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerFileItem;