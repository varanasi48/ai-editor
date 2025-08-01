// Force update service worker
const CACHE_NAME = 'zu-edits-v3.0.0-' + Date.now();

self.addEventListener('install', (event) => {
  console.log('Service Worker: Install - ZU-edits');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate - ZU-edits');
  // Clean up ALL old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Service Worker: Deleting cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Force reload all clients
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ action: 'FORCE_RELOAD' });
      });
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
