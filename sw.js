const CACHE_NAME = 'dragon-story-shell-v13';
const CORE_FILES = [
  './',
  './index.html',
  './style.css?v=20260824-multi-filter1',
  './data.js?v=20260727-skeleton4',
  './ticket-dragons.js?v=20260727-lang1',
  './app.js?v=20260824-multi-filter1',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./'))));
    return;
  }
  if (url.pathname.endsWith('/style.css') || url.pathname.endsWith('/data.js') || url.pathname.endsWith('/ticket-dragons.js') || url.pathname.endsWith('/app.js')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    })));
  }
});
