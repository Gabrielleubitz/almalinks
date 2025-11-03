import React from 'react';
import { Shield, Eye, Users, EyeOff, Check } from 'lucide-react';
import { UserProfileForm, ProfileVisibility } from '../../../types/user';
import { getVisibilityDescription } from '../../../utils/privacy';
import FormField from '../FormField';

interface PrivacyStepProps {
  formData: UserProfileForm;
  errors: Record<string, string>;
  touchedFields: Set<string>;
  onUpdate: (field: string, value: any) => void;
}

const VISIBILITY_OPTIONS = [
  {
    value: 'public' as ProfileVisibility,
    icon: Eye,
    title: 'Public Profile',
    subtitle: 'Visible to everyone',
    description: 'Your profile will be visible to all users on the platform and will appear in public searches and the directory.',
    color: 'blue',
    features: [
      'Appears in platform directory',
      'Visible in public searches',
      'Anyone can see your contact info',
      'Maximum networking opportunities'
    ]
  },
  {
    value: 'event_only' as ProfileVisibility,
    icon: Users,
    title: 'Event Connections',
    subtitle: 'Visible to event attendees (Recommended)',
    description: 'Your profile will only be visible to people who attend the same events as you and your direct connections.',
    color: 'green',
    features: [
      'Visible to event co-attendees',
      'Visible to your connections',
      'Balanced privacy and networking',
      'Default setting for most users'
    ]
  },
  {
    value: 'hidden' as ProfileVisibility,
    icon: EyeOff,
    title: 'Private Profile',
    subtitle: 'Maximum privacy',
    description: 'Your profile will only be visible to people you are directly connected with and platform administrators.',
    color: 'purple',
    features: [
      'Only visible to connections',
      'Not in public directory',
      'Maximum privacy control',
      'Admin visibility only'
    ]
  }
];

const PrivacyStep: React.FC<PrivacyStepProps> = ({
  formData,
  errors,
  touchedFields,
  onUpdate
}) => {
  const selectedOption = VISIBILITY_OPTIONS.find(option => option.value === formData.profileVisibility);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your privacy level</h2>
        <p className="text-gray-600">
          Control who can see your profile and contact information. You can change this anytime.
        </p>
      </div>

      {/* Privacy Options */}
      <div className="space-y-4">
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = formData.profileVisibility === option.value;
          const IconComponent = option.icon;
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onUpdate('profileVisibility', option.value)}
              className={`
                w-full text-left p-6 rounded-2xl border-2 transition-all duration-200
                ${isSelected
                  ? `border-${option.color}-500 bg-${option.color}-50 shadow-lg`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }
              `}
            >
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className={`
                  flex-shrink-0 p-3 rounded-2xl
                  ${isSelected
                    ? `bg-${option.color}-100 text-${option.color}-700`
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  <IconComponent className="h-6 w-6" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`
                        text-lg font-semibold
                        ${isSelected ? `text-${option.color}-900` : 'text-gray-900'}
                      `}>
                        {option.title}
                      </h3>
                      <p className={`
                        text-sm
                        ${isSelected ? `text-${option.color}-700` : 'text-gray-600'}
                      `}>
                        {option.subtitle}
                      </p>
                    </div>
                    
                    {/* Selection Indicator */}
                    <div className={`
                      flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${isSelected
                        ? `border-${option.color}-500 bg-${option.color}-500`
                        : 'border-gray-300'
                      }
                    `}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  
                  <p className={`
                    text-sm mt-2
                    ${isSelected ? `text-${option.color}-700` : 'text-gray-600'}
                  `}>
                    {option.description}
                  </p>
                  
                  {/* Features */}
                  <ul className={`
                    text-sm mt-3 space-y-1
                    ${isSelected ? `text-${option.color}-600` : 'text-gray-500'}
                  `}>
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <div className={`
                          w-1 h-1 rounded-full
                          ${isSelected ? `bg-${option.color}-400` : 'bg-gray-400'}
                        `} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional Information */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <div className="flex items-start space-x-3">
          <Shield className="h-6 w-6 text-brand-light flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Your Privacy is Important</h4>
            <div className="text-blue-800 text-sm space-y-2">
              <p>• Your email address will only be shown to people based on your privacy settings</p>
              <p>• Phone numbers are only shown if you explicitly enable the "Show Phone" option</p>
              <p>• You can change your privacy settings at any time from your profile</p>
              <p>• Administrators can always see profiles for support purposes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Selection Summary */}
      {selectedOption && (
        <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
          <h3 className="font-semibold text-gray-900 mb-3">Your Privacy Settings</h3>
          <div className="flex items-start space-x-4">
            <div className={`p-2 rounded-lg bg-${selectedOption.color}-100`}>
              <selectedOption.icon className={`h-5 w-5 text-${selectedOption.color}-600`} />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{selectedOption.title}</h4>
              <p className="text-gray-600 text-sm mt-1">{selectedOption.description}</p>
              <div className="mt-3 space-y-1">
                {selectedOption.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                    <Check className="h-3 w-3 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.profileVisibility && touchedFields.has('profileVisibility') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">{errors.profileVisibility}</p>
        </div>
      )}
    </div>
  );
};

export default PrivacyStep;