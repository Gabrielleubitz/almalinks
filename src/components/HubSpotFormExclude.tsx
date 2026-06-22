import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { markHubspotDoNotCollectOnForms } from '../utils/hubspotForm';

/**
 * HubSpot's embed script collects all HTML forms unless opted out. This marks every
 * app form so profile/signup data is not sent with wrong field mapping (e.g. name → company).
 */
export default function HubSpotFormExclude() {
  const location = useLocation();

  useEffect(() => {
    markHubspotDoNotCollectOnForms();

    const root = document.getElementById('root');
    if (!root) return;

    const observer = new MutationObserver(() => {
      markHubspotDoNotCollectOnForms(root);
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}
