/* Offline support for the installed app.

   Same-origin files are fetched from the network first and only fall back to
   the cache when the network does not answer. That means a deploy is picked
   up on the next launch with no version to remember: the previous design
   served the cache first, so a phone kept running the old build until this
   string was changed by hand, and forgetting once stranded every installed
   copy indefinitely.

   The network is raced against a short timer rather than waited on, so a
   flaky signal falls back to the cache quickly instead of hanging.

   Every path is relative so it works from a project page served out of a
   subdirectory. */
var VERSION = 'bc-app';          // no longer needs bumping to ship an update
var FONTS = 'bc-fonts';
var NET_TIMEOUT = 2500;
var FILES = [
  './', './index.html', './blackjack.html', './baccarat.html', './holdem.html',
  './lights.html', './purim.html', './pinball.html', './roulette.html',
  './casino.css', './app.js', './engine.js', './layout.js', './sounds.js', './common.js',
  './bj.js', './blackjack.js', './bac.js', './baccarat.js', './uth.js', './holdem.js', './roul.js', './roulette.js',
  './slots.js', './games.js', './slotfx.js', './lights.js', './pinball.js', './pots.js', './purim.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  /* one missing file must not fail the whole install */
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(FILES.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k !== VERSION && k !== FONTS;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* Google Fonts: versioned URLs that never change in place, so cache first
     and let the type survive going offline. */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res.ok || res.type === 'opaque') c.put(req, res.clone());
          return res;
        });
        if (hit) { net.catch(function () {}); return hit; }
        return net;
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fromNetwork(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});

/* Reject rather than hang when the network is there but not answering. */
function fromNetwork(req) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, NET_TIMEOUT);
    fetch(req).then(function (res) {
      if (done) return;
      done = true; clearTimeout(timer); resolve(res);
    }, function (err) {
      if (done) return;
      done = true; clearTimeout(timer); reject(err);
    });
  });
}
