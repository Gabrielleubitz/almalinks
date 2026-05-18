import React from 'react';
import { User, Mail, Phone, Briefcase, Check, X, UserCheck, Clock } from 'lucide-react';

interface RegistrationData {
  id: string;
  name: string;
  email: string;
  phone: string;
  work: string;
  status: 'registered' | 'attended';
  isAttending?: boolean;
  ticketId?: string;
  profileImage?: string | null;
}

interface RegistrationDetailsProps {
  registration: RegistrationData;
  onCheckIn?: () => void;
  error?: string | null;
  success?: string | null;
}

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  registration,
  onCheckIn,
  error,
  success
}) => {
  return (
    <div className="mt-8">
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <X className="h-5 w-5 text-red-600" />
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-green-600 font-medium">{success}</p>
          </div>
        )}

        {/* Registration Details */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6">Registration Found</h3>
          
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                {registration.profileImage ? (
                  <img 
                    src={registration.profileImage} 
                    alt={registration.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-brand-dark flex items-center justify-center text-white font-bold text-2xl">
                    {registration.name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">{registration.name}</h4>
                <p className="text-gray-600">{registration.work}</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Email</div>
                    <div className="font-medium text-gray-900">{registration.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Phone</div>
                    <div className="font-medium text-gray-900">{registration.phone}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Briefcase className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Work</div>
                    <div className="font-medium text-gray-900">{registration.work}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <div className="font-medium">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        registration.status === 'attended' 
                          ? 'bg-blue-50 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        <Check className="h-4 w-4 mr-1" />
                        {registration.status === 'attended' ? 'Checked In' : 'Confirmed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Check-in Button */}
          {registration.status === 'registered' && onCheckIn && (
            <div className="flex justify-center">
              <button
                onClick={onCheckIn}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold text-lg flex items-center space-x-3"
              >
                <UserCheck className="h-6 w-6" />
                <span>Confirm Check-In</span>
              </button>
            </div>
          )}

          {registration.status === 'attended' && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 text-green-600 font-semibold">
                <Check className="h-5 w-5" />
                <span>This attendee has already been checked in</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationDetails;