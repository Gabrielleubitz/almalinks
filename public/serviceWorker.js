// Cache name with version - increment when you need to bust cache
const CACHE_NAME = 'almalinks-cache-v3';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest'
];

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
  );
}

function offlineResponse() {
  return new Response('Network error occurred', {
    status: 408,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function spaFallback() {
  return caches.match('/index.html').then((response) => response || offlineResponse());
}

function ensureResponse(response, request) {
  if (response) return response;
  if (isNavigationRequest(request)) return spaFallback();
  return offlineResponse();
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  // Claim clients to ensure the service worker controls all clients immediately
  event.waitUntil(self.clients.claim());
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip browser extension requests and API calls
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin || 
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('firebase') ||
    url.pathname.includes('firestore')
  ) {
    return;
  }
  
  // Network-first strategy for JS/CSS, cache-first for assets
  const isStaticAsset = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?)$/);
  const isAppFile = url.pathname.match(/\.(js|css|html)$/);
  
  if (isStaticAsset) {
    // Cache-first for images and fonts
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  } else if (isAppFile) {
    // Network-first for app files (JS/CSS/HTML) to get updates
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((response) => {
          return ensureResponse(response, event.request);
        });
      })
    );
  } else {
    // SPA routes (e.g. /admin/email) — network-first with index.html fallback
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
        .then((response) => ensureResponse(response, event.request))
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New notification from AlmaLinks',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'AlmaLinks', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // If a window client is already open, focus it
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});
