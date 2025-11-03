import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface SpeakerEventProps {
  event: {
    id: string;
    eventId: string;
    eventName: string;
    eventDate: string;
    location?: string;
  };
  formatDate: (dateString: string) => {
    date: string;
    time: string;
  };
}

const SpeakerEventCard: React.FC<SpeakerEventProps> = ({ event, formatDate }) => {
  const formattedDate = formatDate(event.eventDate);
  
  return (
    <div 
      className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl p-6 hover:shadow-md transition-all duration-300"
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4">{event.eventName}</h3>
      
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-red-700" />
          <span className="text-gray-700">{formattedDate.date}</span>
        </div>
        <div className="flex items-center space-x-3">
          <Clock className="h-5 w-5 text-brand-light" />
          <span className="text-gray-700">{formattedDate.time}</span>
        </div>
        {event.location && (
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-red-700" />
            <span className="text-gray-700">{event.location}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakerEventCard;