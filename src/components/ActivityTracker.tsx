import React from 'react';
import { useActivityTracking } from '../hooks/useActivityTracking';

// This component just needs to be rendered once in the app to enable automatic page tracking
const ActivityTracker: React.FC = () => {
  useActivityTracking(); // This hook handles automatic page view tracking
  return null; // This component doesn't render anything visible
};

export default ActivityTracker;