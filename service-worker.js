/* Minimal, safe service worker.
 *
 * - Caches ONLY this app's own static files (same origin, same folder).
 * - Never touches youtube.com or any other origin.
 * - Never caches non-GET requests, query-string requests, or video/streams.
 * - Pages: the app's own start page is served from cache instantly and
 *   refreshed in the background, so launching from the Home Screen never waits
 *   on the network before heading to YouTube (and still works offline).
 *
 * To ship an update: change the VERSION string below.
 */
var VERSION = 'v5';
var CACHE = 'yt-launcher-' + VERSION;

// Relative to this file's location, so it works in a GitHub Pages subfolder.
var APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'youtube-shorts-filter.txt',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png'
];

var NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key.indexOf('yt-launcher-') === 0 && key !== CACHE) return caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function fetchWithTimeout(request, ms) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
    fetch(request).then(
      function (response) { clearTimeout(timer); resolve(response); },
      function (error) { clearTimeout(timer); reject(error); }
    );
  });
}

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle GET requests to our own origin. Everything else (including
  // all YouTube traffic) goes straight to the network, untouched.
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations to our own start page: cache first (instant launch),
  // refreshed in the background. Query strings (?go=...) all map to the same
  // cached index.html. Any other path is left to the network.
  if (request.mode === 'navigate') {
    if (!/\/(index\.html)?$/.test(url.pathname)) return;
    event.respondWith(
      caches.match('index.html').then(function (cached) {
        var refresh = fetchWithTimeout(request, NETWORK_TIMEOUT_MS)
          .then(function (response) {
            if (isCacheable(response)) {
              var copy = response.clone();
              caches.open(CACHE).then(function (cache) { cache.put('index.html', copy); });
            }
            return response;
          })
          .catch(function () { return cached; });
        event.waitUntil(refresh.catch(function () {}));
        return cached || refresh;
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate (fast, and refreshes in background).
  event.respondWith(
    caches.match(request).then(function (cached) {
      var refresh = fetch(request)
        .then(function (response) {
          if (isCacheable(response)) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || refresh;
    })
  );
});
