// Enhanced service worker for PWA functionality with optimized caching
const CACHE_NAME = 'upgrade-tn-shop-v2';
const RUNTIME_CACHE = 'upgrade-tn-runtime-v2';
const urlsToCache = [
  '/',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Max age for cache items (7 days)
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          // For runtime cache, update in background
          if (event.request.url.includes('/assets/') || event.request.url.includes('.js') || event.request.url.includes('.css')) {
            // Stale-while-revalidate strategy
            fetch(event.request).then((fetchResponse) => {
              if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(event.request, fetchResponse.clone());
                });
              }
            }).catch(() => {
              // Network failed, use cache
            });
          }
          return response;
        }

        // For assets, use cache-first strategy with runtime caching
        if (event.request.url.includes('/assets/') || event.request.url.includes('.js') || event.request.url.includes('.css') || event.request.url.includes('.png') || event.request.url.includes('.jpg') || event.request.url.includes('.webp')) {
          return fetch(event.request).then((fetchResponse) => {
            // Don't cache if not a valid response
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            // Clone the response
            const responseToCache = fetchResponse.clone();

            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          }).catch(() => {
            // Network failed, no cache available
            return new Response('Network error', { status: 408, statusText: 'Network error' });
          });
        }

        // For other requests (HTML, API), use network-first
        return fetch(event.request).catch(() => {
          // If both cache and network fail, return a fallback for documents
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});

// Clean up old cache entries periodically
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIM_CACHES') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests.map((request) => {
              return cache.match(request).then((response) => {
                if (response) {
                  const dateHeader = response.headers.get('date');
                  if (dateHeader) {
                    const cacheTime = new Date(dateHeader).getTime();
                    const now = Date.now();
                    if (now - cacheTime > MAX_AGE) {
                      console.log('Removing old cache entry:', request.url);
                      return cache.delete(request);
                    }
                  }
                }
              });
            })
          );
        });
      })
    );
  }
});
