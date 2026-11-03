/* Offline support for the installed app.
   BUMP VERSION ON EVERY DEPLOY. Files are served from the cache first, so a
   phone keeps running the old build until this string changes. Every path is
   relative so it works from username.github.io/bubble-craps/. */
var VERSION = 'bc-2026-11-03a';
var FILES = [
  './', './index.html', './blackjack.html', './baccarat.html', './lights.html', './pinball.html',
  './casino.css', './app.js', './engine.js', './layout.js', './sounds.js', './common.js',
  './bj.js', './blackjack.js', './bac.js', './baccarat.js',
  './slots.js', './games.js', './slotfx.js', './lights.js', './pinball.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];
var FONTS = 'bc-fonts';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== FONTS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Google Fonts: keep a copy so the type survives going offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
        if (hit) { net.catch(function () {}); return hit; }
        return net;
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      if (req.mode === 'navigate') return caches.match('./index.html');
    });
  }));
});
