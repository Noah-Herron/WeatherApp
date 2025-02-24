// I used Claude to help me make this service worker

const CACHE_NAME = 'herron-weather-app-cache-v1';
const APP_URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './weather/HerronWeatherApp.png'
  // Add other static assets you want to cache
];

// API endpoints that we need to access
const API_ENDPOINTS = [
  'https://api.open-meteo.com/v1/forecast',
  'https://open-meteo.com/',
  'https://nominatim.openstreetmap.org/reverse'
];

// Install event - cache app assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(APP_URLS_TO_CACHE);
      })
  );
});

// Fetch event - handle different fetch strategies for app files vs API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Check if the request is for one of our API endpoints
  const isApiRequest = API_ENDPOINTS.some(endpoint => 
    url.href.startsWith(endpoint) || url.hostname === new URL(endpoint).hostname
  );
  
  if (isApiRequest) {
    // For API requests, use network first, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response for caching
          const responseToCache = response.clone();
          
          // Only cache successful responses
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        })
        .catch(error => {
          console.log('Fetch failed for API; trying cache', error);
          return caches.match(event.request);
        })
    );
  } else {
    // For app assets, use cache first, fall back to network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Cache hit - return response
          if (response) {
            return response;
          }
          
          // No cache match, fetch from network
          return fetch(event.request)
            .then(response => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
              
              return response;
            });
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Immediately claim any clients (pages) that are open
  event.waitUntil(self.clients.claim());
});