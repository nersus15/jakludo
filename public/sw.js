const CACHE_NAME = 'jakludo-pwa-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/jakludo-logo.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

// Install: Cache initial app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up previous caches & claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Jangan intersep WebSocket & socket.io polling/handshake
  if (url.pathname.startsWith('/socket.io')) {
    return;
  }

  // Jangan intersep request API dinamis (biarkan live network)
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Hanya proses method GET
  if (request.method !== 'GET') {
    return;
  }

  // Navigation requests (HTML shell): Network-First dengan Fallback ke Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/', responseClone));
          }
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Static Assets (JS, CSS, Images, Audio): Cache-First dengan Network Revalidate
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
