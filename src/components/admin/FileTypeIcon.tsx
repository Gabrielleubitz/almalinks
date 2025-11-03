import React from 'react';
import { FileText, Image, Presentation, File as FileIcon } from 'lucide-react';

interface FileTypeIconProps {
  fileType: string;
  className?: string;
}

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ fileType, className = "h-6 w-6" }) => {
  if (fileType.includes('pdf')) {
    return <FileText className={`${className} text-red-600`} />;
  } else if (fileType.includes('image')) {
    return <Image className={`${className} text-brand-light`} />;
  } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
    return <Presentation className={`${className} text-orange-600`} />;
  } else {
    return <FileIcon className={`${className} text-gray-600`} />;
  }
};

export default FileTypeIcon;