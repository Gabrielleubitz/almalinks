import React, { useState } from 'react';
import { X, Eye, Users, EyeOff, Shield, Info } from 'lucide-react';
import { DiscoverabilityLevel } from '../../types/connection';
import { PrivacyService } from '../../services/privacyService';

interface DiscoverabilityConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (discoverability: DiscoverabilityLevel) => void;
  userId: string;
}

const DiscoverabilityConsentModal: React.FC<DiscoverabilityConsentModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  userId
}) => {
  const [selectedLevel, setSelectedLevel] = useState<DiscoverabilityLevel>('event_only');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await PrivacyService.updateDiscoverabilitySettings(userId, selectedLevel, true);
      onComplete(selectedLevel);
    } catch (error) {
      console.error('❌ Error updating discoverability settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const privacyOptions = [
    {
      value: 'public' as DiscoverabilityLevel,
      icon: Eye,
      title: 'Public',
      description: 'Visible in global directory and event connections',
      details: [
        'Anyone can find and connect with you',
        'You appear in the global user directory',
        'Maximum networking opportunities'
      ],
      color: 'text-green-600 bg-green-100'
    },
    {
      value: 'event_only' as DiscoverabilityLevel,
      icon: Users,
      title: 'Event Only (Recommended)',
      description: 'Only visible to people who share an event with you',
      details: [
        'Only attendees of the same events can find you',
        'Balanced privacy and networking',
        'Most popular choice'
      ],
      color: 'text-brand-light bg-blue-50'
    },
    {
      value: 'hidden' as DiscoverabilityLevel,
      icon: EyeOff,
      title: 'Hidden',
      description: 'Only visible to existing connections and admins',
      details: [
        'Maximum privacy protection',
        'Only existing connections can find you',
        'Manual connections only'
      ],
      color: 'text-gray-600 bg-gray-100'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl px-8 pt-6 pb-8 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Shield className="h-6 w-6 text-brand-light" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Privacy & Discovery Settings
                </h3>
                <p className="text-sm text-gray-600">
                  Choose how others can find and connect with you
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Info Alert */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-brand-light mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-800 font-medium mb-1">
                  New Auto-Connect Feature
                </p>
                <p className="text-blue-700">
                  We've replaced QR code scanning with automatic connections! When you register for an event, 
                  you'll automatically connect with other attendees based on your privacy settings.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Options */}
          <div className="space-y-4 mb-6">
            {privacyOptions.map((option) => {
              const IconComponent = option.icon;
              const isSelected = selectedLevel === option.value;

              return (
                <label
                  key={option.value}
                  className={`block cursor-pointer rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start space-x-4">
                      <input
                        type="radio"
                        name="discoverability"
                        value={option.value}
                        checked={isSelected}
                        onChange={(e) => setSelectedLevel(e.target.value as DiscoverabilityLevel)}
                        className="mt-1 h-4 w-4 text-brand-light focus:ring-blue-500 border-gray-300"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg ${option.color}`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {option.title}
                              {option.value === 'event_only' && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                                  Recommended
                                </span>
                              )}
                            </h4>
                            <p className="text-sm text-gray-600">{option.description}</p>
                          </div>
                        </div>
                        
                        <ul className="ml-2 space-y-1">
                          {option.details.map((detail, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-center">
                              <div className="w-1 h-1 bg-gray-400 rounded-full mr-2 flex-shrink-0" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 flex-1">
              You can always change these settings later in your profile preferences.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-lg hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoverabilityConsentModal;