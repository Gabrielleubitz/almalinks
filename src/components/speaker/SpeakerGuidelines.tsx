import React from 'react';
import { MessageSquare } from 'lucide-react';

const SpeakerGuidelines: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center space-x-3 mb-4">
        <MessageSquare className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900">Speaker Guidelines</h3>
      </div>
      
      <div className="space-y-3">
        <div className="p-3 bg-orange-50 rounded-lg">
          <p className="text-sm text-orange-800 font-medium">Presentation Time</p>
          <p className="text-sm text-orange-700">Each speaker has 20 minutes for presentation and 10 minutes for Q&A.</p>
        </div>
        
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">File Formats</p>
          <p className="text-sm text-blue-700">Please upload your slides in PDF or PowerPoint format for best compatibility.</p>
        </div>
        
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800 font-medium">Deadline</p>
          <p className="text-sm text-green-700">All presentation materials should be uploaded at least 48 hours before the event.</p>
        </div>
        
        <div className="p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-800 font-medium">Need Help?</p>
          <p className="text-sm text-purple-700">Contact our speaker coordinator at <a href="mailto:speakers@almalinks.com" className="underline">speakers@almalinks.com</a></p>
        </div>
      </div>
    </div>
  );
};

export default SpeakerGuidelines;