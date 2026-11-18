// Service worker: lets the installed app open with no internet.
// Network first (so updates show straight away), saved copy when offline. Bump CACHE on each release.
const CACHE = 'bio-study-v14';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'diagrams.js', 'presets.js', 'refs.js', 'manifest.webmanifest',
  'icons/icon.svg', 'img/animal-cell.jpg', 'img/er.jpg', 'img/golgi.jpg', 'img/lysosome.jpg', 'img/mitochondria.jpg', 'img/ribosome.jpg', 'img/slides/nucleus-slide19.jpg', 'img/notes/phospholipid-bilayer.jpg', 'img/notes/micelle.jpg', 'img/notes/amphipathic-molecule.jpg', 'img/ref/animal-cell.svg', 'img/ref/plant-cell.svg', 'img/ref/mitochondrion.svg', 'img/ref/nucleus.svg', 'img/ref/endomembrane.svg', 'img/ref/golgi.svg', 'img/ref/ribosome.svg', 'img/ref/chloroplast.svg', 'img/ref/peroxisome.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bio-study-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin || new URL(req.url).pathname.includes('/api/')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
