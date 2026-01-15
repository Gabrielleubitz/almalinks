import React, { useState } from 'react';
import { Smartphone, Monitor, Settings } from 'lucide-react';
import { useLayoutPreference, LayoutPreference } from '../hooks/useLayoutPreference';

interface LayoutPreferenceToggleProps {
  className?: string;
}

const LayoutPreferenceToggle: React.FC<LayoutPreferenceToggleProps> = ({ className = '' }) => {
  const { preference, updatePreference, loading } = useLayoutPreference();
  const [updating, setUpdating] = useState(false);

  const handlePreferenceChange = async (newPreference: LayoutPreference) => {
    if (updating) return;
    
    setUpdating(true);
    try {
      await updatePreference(newPreference);
    } catch (error) {
      console.error('Failed to update layout preference:', error);
    } finally {
      setUpdating(false);
    }
  };

  const options = [
    {
      value: 'auto' as const,
      label: 'Auto',
      icon: Settings,
      description: 'Responsive to screen size'
    },
    {
      value: 'mobile' as const,
      label: 'Mobile',
      icon: Smartphone,
      description: 'Always use mobile layout'
    },
    {
      value: 'desktop' as const,
      label: 'Desktop',
      icon: Monitor,
      description: 'Always use desktop layout'
    }
  ];

  if (loading) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Layout Preference</h3>
      <div className="space-y-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => handlePreferenceChange(option.value)}
              disabled={updating}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                preference === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon className={`h-5 w-5 ${
                preference === option.value ? 'text-blue-600' : 'text-gray-500'
              }`} />
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500">{option.description}</div>
              </div>
              {preference === option.value && (
                <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LayoutPreferenceToggle;