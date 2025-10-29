import React from 'react';
import { User, Mail, AtSign } from 'lucide-react';
import { UserProfileForm } from '../../../types/user';
import FormField from '../FormField';

interface ProfileBasicsStepProps {
  formData: UserProfileForm;
  errors: Record<string, string>;
  touchedFields: Set<string>;
  onUpdate: (field: string, value: any) => void;
}

const ProfileBasicsStep: React.FC<ProfileBasicsStepProps> = ({
  formData,
  errors,
  touchedFields,
  onUpdate
}) => {
  // Auto-generate display name from first and last name
  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    onUpdate(field, value);
    
    // Auto-generate display name if it hasn't been manually set
    const otherField = field === 'firstName' ? 'lastName' : 'firstName';
    const otherValue = formData[otherField] || '';
    const newDisplayName = field === 'firstName' 
      ? `${value} ${otherValue}`.trim()
      : `${otherValue} ${value}`.trim();
    
    // Only auto-update display name if it matches the current auto-generated pattern
    const currentAutoName = `${formData.firstName} ${formData.lastName}`.trim();
    if (!formData.displayName || formData.displayName === currentAutoName) {
      onUpdate('displayName', newDisplayName);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's get to know you</h2>
        <p className="text-gray-600">
          We'll use this information to create your professional profile
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* First Name */}
        <FormField
          label="First Name"
          required
          error={touchedFields.has('firstName') ? errors.firstName : undefined}
        >
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleNameChange('firstName', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                ${errors.firstName && touchedFields.has('firstName')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
              placeholder="Enter your first name"
              autoComplete="given-name"
            />
          </div>
        </FormField>

        {/* Last Name */}
        <FormField
          label="Last Name"
          required
          error={touchedFields.has('lastName') ? errors.lastName : undefined}
        >
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleNameChange('lastName', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                ${errors.lastName && touchedFields.has('lastName')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
              placeholder="Enter your last name"
              autoComplete="family-name"
            />
          </div>
        </FormField>
      </div>

      {/* Email */}
      <FormField
        label="Email Address"
        required
        error={touchedFields.has('email') ? errors.email : undefined}
        helpText="We'll use this to send you important updates and help others connect with you"
      >
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => onUpdate('email', e.target.value)}
            className={`
              block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
              ${errors.email && touchedFields.has('email')
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }
              focus:ring-2 focus:ring-opacity-20
            `}
            placeholder="Enter your email address"
            autoComplete="email"
          />
        </div>
      </FormField>

      {/* Display Name */}
      <FormField
        label="Display Name"
        required
        error={touchedFields.has('displayName') ? errors.displayName : undefined}
        helpText="This is how your name will appear to others on the platform"
      >
        <div className="relative">
          <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => onUpdate('displayName', e.target.value)}
            className={`
              block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
              ${errors.displayName && touchedFields.has('displayName')
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }
              focus:ring-2 focus:ring-opacity-20
            `}
            placeholder="How should others see your name?"
            autoComplete="name"
          />
        </div>
      </FormField>

      {/* Preview Card */}
      <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
        <h3 className="font-semibold text-gray-900 mb-3">Preview</h3>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
            {formData.displayName ? formData.displayName.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              {formData.displayName || 'Your Name'}
            </h4>
            <p className="text-gray-600 text-sm">
              {formData.email || 'your.email@example.com'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileBasicsStep;