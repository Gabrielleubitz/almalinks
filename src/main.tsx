import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Disable browser scroll restoration - we handle it manually per route
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Initialize Hotjar only in production (not localhost)
// Hotjar requires HTTPS and doesn't work on localhost
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' ||
                     hostname === '' ||
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.startsWith('172.');
  const isProduction = import.meta.env.PROD || 
                       import.meta.env.VITE_APP_ENV === 'production';
  
  // Only initialize Hotjar if not localhost AND in production
  if (!isLocalhost && isProduction) {
    (function(h: any, o: Document, t: string, j: string, a: HTMLElement | null, r: HTMLScriptElement) {
      h.hj = h.hj || function(){(h.hj.q = h.hj.q || []).push(arguments)};
      h._hjSettings = {hjid: 6439323, hjsv: 6};
      a = o.getElementsByTagName('head')[0];
      r = o.createElement('script');
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      if (a) {
        a.appendChild(r);
      }
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA functionality
serviceWorkerRegistration.register();