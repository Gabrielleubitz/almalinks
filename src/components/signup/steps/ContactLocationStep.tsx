import React from 'react';
import { Phone, Linkedin, Globe, Twitter, MapPin, Clock } from 'lucide-react';
import { UserProfileForm } from '../../../types/user';
import FormField from '../FormField';

interface ContactLocationStepProps {
  formData: UserProfileForm;
  errors: Record<string, string>;
  touchedFields: Set<string>;
  onUpdate: (field: string, value: any) => void;
}

// Popular timezones for quick selection
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai/Delhi (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' }
];

const ContactLocationStep: React.FC<ContactLocationStepProps> = ({
  formData,
  errors,
  touchedFields,
  onUpdate
}) => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">How can people reach you?</h2>
        <p className="text-gray-600">
          Add your contact information and location to help others connect with you
        </p>
      </div>

      {/* Contact Information */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Phone className="h-5 w-5 mr-2 text-brand-light" />
          Contact Information
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Phone */}
          <FormField
            label="Phone Number"
            error={touchedFields.has('phone') ? errors.phone : undefined}
            helpText="Optional - We'll respect your privacy settings"
          >
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => onUpdate('phone', e.target.value)}
                className={`
                  block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                  ${errors.phone && touchedFields.has('phone')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }
                  focus:ring-2 focus:ring-opacity-20
                `}
                placeholder="+1 (555) 123-4567"
                autoComplete="tel"
              />
            </div>
          </FormField>

          {/* Show Phone Toggle */}
          <FormField
            label="Phone Visibility"
            helpText="Choose whether to show your phone number on your profile"
          >
            <div className="flex items-center space-x-3 pt-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showPhone}
                  onChange={(e) => onUpdate('showPhone', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                <span className="ml-3 text-sm text-gray-700">
                  {formData.showPhone ? 'Show phone number' : 'Hide phone number'}
                </span>
              </label>
            </div>
          </FormField>
        </div>
      </div>

      {/* Social Links */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Globe className="h-5 w-5 mr-2 text-brand-light" />
          Social & Professional Links
        </h3>

        <div className="space-y-4">
          {/* LinkedIn */}
          <FormField
            label="LinkedIn Profile"
            error={touchedFields.has('linkedin') ? errors.linkedin : undefined}
            helpText="Your LinkedIn profile URL"
          >
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="url"
                value={formData.linkedin}
                onChange={(e) => onUpdate('linkedin', e.target.value)}
                className={`
                  block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                  ${errors.linkedin && touchedFields.has('linkedin')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }
                  focus:ring-2 focus:ring-opacity-20
                `}
                placeholder="https://www.linkedin.com/in/yourprofile"
              />
            </div>
          </FormField>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Website */}
            <FormField
              label="Website"
              error={touchedFields.has('website') ? errors.website : undefined}
              helpText="Your personal or company website"
            >
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => onUpdate('website', e.target.value)}
                  className={`
                    block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                    ${errors.website && touchedFields.has('website')
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }
                    focus:ring-2 focus:ring-opacity-20
                  `}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </FormField>

            {/* Twitter */}
            <FormField
              label="Twitter/X Profile"
              error={touchedFields.has('twitter') ? errors.twitter : undefined}
              helpText="Your Twitter or X profile URL"
            >
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.twitter}
                  onChange={(e) => onUpdate('twitter', e.target.value)}
                  className={`
                    block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                    ${errors.twitter && touchedFields.has('twitter')
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }
                    focus:ring-2 focus:ring-opacity-20
                  `}
                  placeholder="https://twitter.com/yourusername"
                />
              </div>
            </FormField>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-brand-light" />
          Location & Timezone
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* City */}
          <FormField
            label="City"
            error={touchedFields.has('city') ? errors.city : undefined}
            helpText="Where are you located?"
          >
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={formData.city}
                onChange={(e) => onUpdate('city', e.target.value)}
                className={`
                  block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                  ${errors.city && touchedFields.has('city')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }
                  focus:ring-2 focus:ring-opacity-20
                `}
                placeholder="San Francisco"
                autoComplete="address-level2"
              />
            </div>
          </FormField>

          {/* Country */}
          <FormField
            label="Country"
            error={touchedFields.has('country') ? errors.country : undefined}
            helpText="Your country"
          >
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={formData.country}
                onChange={(e) => onUpdate('country', e.target.value)}
                className={`
                  block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                  ${errors.country && touchedFields.has('country')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }
                  focus:ring-2 focus:ring-opacity-20
                `}
                placeholder="United States"
                autoComplete="country-name"
              />
            </div>
          </FormField>
        </div>

        {/* Timezone */}
        <FormField
          label="Timezone"
          error={touchedFields.has('timezone') ? errors.timezone : undefined}
          helpText="This helps others know when to reach out to you"
        >
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={formData.timezone}
              onChange={(e) => onUpdate('timezone', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200 appearance-none
                ${errors.timezone && touchedFields.has('timezone')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
            >
              <option value="">Select your timezone</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </FormField>
      </div>

      {/* Preview Card */}
      <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
        <h3 className="font-semibold text-gray-900 mb-3">Contact Preview</h3>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-gray-900">
              {formData.displayName || 'Your Name'}
            </h4>
            <p className="text-gray-600">
              {formData.title && formData.company 
                ? `${formData.title} @ ${formData.company}`
                : formData.title || formData.company || 'Your Title @ Company'
              }
            </p>
            {(formData.city || formData.country) && (
              <p className="text-gray-500 text-sm">
                📍 {[formData.city, formData.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {formData.phone && formData.showPhone && (
              <p className="text-sm text-gray-700">📞 {formData.phone}</p>
            )}
            {formData.linkedin && (
              <p className="text-sm text-brand-light">💼 LinkedIn Profile</p>
            )}
            {formData.website && (
              <p className="text-sm text-brand-light">🌐 Website</p>
            )}
            {formData.twitter && (
              <p className="text-sm text-brand-light">🐦 Twitter/X</p>
            )}
            {formData.timezone && (
              <p className="text-sm text-gray-600">
                🕐 {COMMON_TIMEZONES.find(tz => tz.value === formData.timezone)?.label || formData.timezone}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactLocationStep;