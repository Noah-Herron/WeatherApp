// I used Claude to help me make this service worker

const CACHE_NAME = 'weather-app-cache-v1';
const APP_STATIC_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './weather/HerronWeatherApp.png',
  // Add other static assets you want to cache (CSS, JS, etc.)
];

// Install handler - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(APP_STATIC_RESOURCES);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate handler - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients/pages immediately
  event.waitUntil(self.clients.claim());
});

// Fetch handler with special handling for API requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Special handling for API requests
  if (requestUrl.hostname === 'api.open-meteo.com' || 
      requestUrl.hostname === 'nominatim.openstreetmap.org') {
    
    // For API requests: network first, then cache fallback
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Clone the response for caching
          const responseToCache = networkResponse.clone();
          
          if (networkResponse.ok) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Store the fresh data in cache
                cache.put(event.request, responseToCache);
              });
          }
          
          return networkResponse;
        })
        .catch(() => {
          // If network fetch fails, try to get from cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If nothing in cache for this API request, return a fallback
              return new Response(JSON.stringify({
                error: 'Network request failed and no cached data available'
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  } else {
    // For static app resources: cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Return cached response if available
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise fetch from network
          return fetch(event.request)
            .then((networkResponse) => {
              // Don't cache non-successful responses or opaque responses
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                return networkResponse;
              }
              
              // Clone the response for caching
              const responseToCache = networkResponse.clone();
              
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
                
              return networkResponse;
            });
        })
    );
  }
});