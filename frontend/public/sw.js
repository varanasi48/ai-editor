// Force update service worker
const CACHE_NAME = 'ai-editor-v2.1.0-' + Date.now();

self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always fetch from network for HTML files
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache'
      })
    );
    return;
  }
  
  // For other resources, try network first
  event.respondWith(
    fetch(event.request, {
      cache: 'no-cache'
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
