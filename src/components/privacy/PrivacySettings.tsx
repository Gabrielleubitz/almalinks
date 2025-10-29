import React, { useState, useEffect } from 'react';
import { Shield, Eye, Users, EyeOff, Clock, AlertCircle } from 'lucide-react';
import { DiscoverabilityLevel } from '../../types/connection';
import { PrivacyService } from '../../services/privacyService';
import { useAuth } from '../../hooks/useAuth';

const PrivacySettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<DiscoverabilityLevel>('event_only');
  const [rateLimitStatus, setRateLimitStatus] = useState({
    requests: 0,
    remaining: 50,
    resetDate: ''
  });

  useEffect(() => {
    if (user?.uid) {
      loadPrivacySettings();
      loadRateLimitStatus();
    }
  }, [user]);

  const loadPrivacySettings = async () => {
    if (!user?.uid) return;

    try {
      const settings = await PrivacyService.getUserDiscoverabilitySettings(user.uid);
      setCurrentLevel(settings.discoverability);
    } catch (error) {
      console.error('❌ Error loading privacy settings:', error);
    }
  };

  const loadRateLimitStatus = async () => {
    if (!user?.uid) return;

    try {
      const status = await PrivacyService.getRateLimitStatus(user.uid);
      setRateLimitStatus(status);
    } catch (error) {
      console.error('❌ Error loading rate limit status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverabilityChange = async (newLevel: DiscoverabilityLevel) => {
    if (!user?.uid || saving) return;

    try {
      setSaving(true);
      await PrivacyService.updateDiscoverabilitySettings(user.uid, newLevel, true);
      setCurrentLevel(newLevel);
    } catch (error) {
      console.error('❌ Error updating discoverability:', error);
    } finally {
      setSaving(false);
    }
  };

  const privacyOptions = [
    {
      value: 'public' as DiscoverabilityLevel,
      icon: Eye,
      title: 'Public',
      description: 'Visible in global directory and event connections',
      color: 'text-green-600'
    },
    {
      value: 'event_only' as DiscoverabilityLevel,
      icon: Users,
      title: 'Event Only',
      description: 'Only visible to people who share an event with you',
      color: 'text-blue-600'
    },
    {
      value: 'hidden' as DiscoverabilityLevel,
      icon: EyeOff,
      title: 'Hidden',
      description: 'Only visible to existing connections and admins',
      color: 'text-gray-600'
    }
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Shield className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Privacy & Discovery</h3>
      </div>

      {/* Current Setting */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="font-semibold text-blue-900 mb-2">Current Setting</h4>
        <div className="flex items-center space-x-3">
          {privacyOptions.map(option => {
            const IconComponent = option.icon;
            if (option.value === currentLevel) {
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <IconComponent className={`h-5 w-5 ${option.color}`} />
                  <span className="font-medium text-blue-900">{option.title}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
        <p className="text-sm text-blue-700 mt-1">
          {privacyOptions.find(opt => opt.value === currentLevel)?.description}
        </p>
      </div>

      {/* Change Setting */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">Change Discovery Level</h4>
        <div className="space-y-3">
          {privacyOptions.map((option) => {
            const IconComponent = option.icon;
            const isSelected = currentLevel === option.value;

            return (
              <button
                key={option.value}
                onClick={() => handleDiscoverabilityChange(option.value)}
                disabled={saving || isSelected}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 cursor-default'
                    : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  <IconComponent className={`h-5 w-5 ${option.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{option.title}</span>
                      {isSelected && (
                        <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rate Limiting Info */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-start space-x-3">
          <Clock className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">Connection Request Limits</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Daily manual connection requests:</span>
                <span className="font-medium">
                  {rateLimitStatus.requests}/50
                </span>
              </div>
              <div className="flex justify-between">
                <span>Remaining today:</span>
                <span className={`font-medium ${
                  rateLimitStatus.remaining === 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {rateLimitStatus.remaining}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Limits reset daily at midnight UTC. Auto-connections have no limits.
              </p>
            </div>
          </div>
        </div>

        {rateLimitStatus.remaining === 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Daily limit reached
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              You've reached your daily limit for manual connection requests. 
              Try again tomorrow or rely on auto-connections from events.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          Privacy settings control who can find and connect with you. 
          Auto-connections happen when you register for events, while manual connections 
          allow direct outreach in the global directory.
        </p>
      </div>

      {saving && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-900 font-medium">Updating privacy settings...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacySettings;