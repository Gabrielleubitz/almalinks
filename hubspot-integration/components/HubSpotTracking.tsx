'use client';

import Script from 'next/script';

/**
 * HubSpot Tracking Component
 * 
 * Loads the HubSpot tracking script globally for page tracking and analytics.
 * Only loads on the client side after the page becomes interactive.
 * 
 * Requires: NEXT_PUBLIC_HUBSPOT_PORTAL_ID environment variable
 */
export default function HubSpotTracking() {
  const portalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

  if (!portalId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[HubSpot] NEXT_PUBLIC_HUBSPOT_PORTAL_ID is not set');
    }
    return null;
  }

  return (
    <Script
      id="hubspot-tracking"
      strategy="afterInteractive"
      src={`https://js.hs-scripts.com/${portalId}.js`}
    />
  );
}

