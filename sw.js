const CACHE = 'laylat-ziab-v8';
const ROLE_IMAGES = ['werewolf', 'villager', 'seer', 'witch', 'hunter', 'cupid', 'guard', 'little_girl', 'traitor'].map(role => `./assets/roles/${role}.jpeg`);
const CORE = ['./', './index.html', './style.css', './app.js', './roles.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './deal-audio.mp4', ...ROLE_IMAGES];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  const freshFiles = ['/index.html', '/style.css', '/app.js', '/roles.js'];
  if (url.pathname.endsWith('/') || freshFiles.some(path => url.pathname.endsWith(path))) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
