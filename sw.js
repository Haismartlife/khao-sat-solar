// Service worker: lưu toàn bộ app vào máy để mở được khi không có mạng
const CACHE = 'ks-solar-8637ab50';
const FILES = [
 "./",
 "fonts.css",
 "fonts/archivo-latin-600-normal.woff2",
 "fonts/archivo-latin-700-normal.woff2",
 "fonts/archivo-latin-800-normal.woff2",
 "fonts/archivo-latin-ext-600-normal.woff2",
 "fonts/archivo-latin-ext-700-normal.woff2",
 "fonts/archivo-latin-ext-800-normal.woff2",
 "fonts/archivo-vietnamese-600-normal.woff2",
 "fonts/archivo-vietnamese-700-normal.woff2",
 "fonts/archivo-vietnamese-800-normal.woff2",
 "fonts/be-vietnam-pro-latin-400-normal.woff2",
 "fonts/be-vietnam-pro-latin-500-normal.woff2",
 "fonts/be-vietnam-pro-latin-600-normal.woff2",
 "fonts/be-vietnam-pro-latin-ext-400-normal.woff2",
 "fonts/be-vietnam-pro-latin-ext-500-normal.woff2",
 "fonts/be-vietnam-pro-latin-ext-600-normal.woff2",
 "fonts/be-vietnam-pro-vietnamese-400-normal.woff2",
 "fonts/be-vietnam-pro-vietnamese-500-normal.woff2",
 "fonts/be-vietnam-pro-vietnamese-600-normal.woff2",
 "fonts/tinos-latin-400-italic.woff2",
 "fonts/tinos-latin-400-normal.woff2",
 "fonts/tinos-latin-700-normal.woff2",
 "fonts/tinos-latin-ext-400-italic.woff2",
 "fonts/tinos-latin-ext-400-normal.woff2",
 "fonts/tinos-latin-ext-700-normal.woff2",
 "fonts/tinos-vietnamese-400-italic.woff2",
 "fonts/tinos-vietnamese-400-normal.woff2",
 "fonts/tinos-vietnamese-700-normal.woff2",
 "icons/icon-180.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "index.html",
 "js/app.js",
 "js/calc.js",
 "js/data.js",
 "js/export.js",
 "js/fields.js",
 "js/pdf.js",
 "js/store-local.js",
 "manifest.webmanifest",
 "vendor/exceljs.min.js",
 "vendor/html2canvas.min.js",
 "vendor/jspdf.umd.min.js"
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return r; }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
