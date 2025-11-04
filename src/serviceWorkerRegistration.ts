// Check if the browser supports service workers
const isServiceWorkerSupported = 'serviceWorker' in navigator;

// Register the service worker
export function register() {
  if (isServiceWorkerSupported && import.meta.env.MODE === 'production') {
    window.addEventListener('load', () => {
      const swUrl = '/serviceWorker.js';

      registerValidSW(swUrl);

      // Show iOS install prompt if needed
      showIOSInstallPrompt();
    });
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('Service Worker registered successfully:', registration);
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log('New content is available and will be used when all tabs for this page are closed.');
            } else {
              // At this point, everything has been precached.
              console.log('Content is cached for offline use.');
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

// Unregister service worker
export function unregister() {
  if (isServiceWorkerSupported) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

// Show iOS install prompt
function showIOSInstallPrompt() {
  // Check if it's iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // Check if it's Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Check if it's in standalone mode already
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone === true;
  
  if (isIOS && isSafari && !isInStandaloneMode) {
    // Show the prompt after a delay
    setTimeout(() => {
      showInstallPrompt();
    }, 5000);
  }
}

// Show the install prompt for iOS
function showInstallPrompt() {
  // Check if we've already shown the prompt
  const hasShownPrompt = localStorage.getItem('pwaInstallPromptShown');
  
  if (hasShownPrompt) {
    return;
  }
  
  // Create the prompt element
  const promptContainer = document.createElement('div');
  promptContainer.className = 'ios-install-prompt';
  promptContainer.style.position = 'fixed';
  promptContainer.style.bottom = '20px';
  promptContainer.style.left = '50%';
  promptContainer.style.transform = 'translateX(-50%)';
  promptContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  promptContainer.style.color = 'white';
  promptContainer.style.padding = '12px 16px';
  promptContainer.style.borderRadius = '12px';
  promptContainer.style.zIndex = '9999';
  promptContainer.style.maxWidth = '90%';
  promptContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  promptContainer.style.display = 'flex';
  promptContainer.style.alignItems = 'center';
  promptContainer.style.justifyContent = 'space-between';
  
  // Add the message
  const message = document.createElement('div');
  message.textContent = 'Want quick access? Tap the share icon in Safari and choose "Add to Home Screen."';
  message.style.fontSize = '14px';
  message.style.marginRight = '12px';
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.backgroundColor = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 8px';
  
  // Add event listener to close button
  closeButton.addEventListener('click', () => {
    document.body.removeChild(promptContainer);
    localStorage.setItem('pwaInstallPromptShown', 'true');
  });
  
  // Append elements
  promptContainer.appendChild(message);
  promptContainer.appendChild(closeButton);
  
  // Add to body
  document.body.appendChild(promptContainer);
  
  // Auto-hide after 15 seconds
  setTimeout(() => {
    if (document.body.contains(promptContainer)) {
      document.body.removeChild(promptContainer);
      localStorage.setItem('pwaInstallPromptShown', 'true');
    }
  }, 15000);
}