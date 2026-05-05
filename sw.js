// ============================================================
//  ClimaObra — Service Worker
//  v11 — Multi-obra PWA
// ============================================================

const CACHE_NAME = 'climaobra-v11';

// Archivos a cachear en la instalación
const ASSETS = [
  '/climaobra/',
  '/climaobra/index.html',
  '/climaobra/manifest.json',
  '/climaobra/favicon.svg'
];

// ── INSTALL: precachear assets estáticos ─────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting(); // activa inmediatamente
    })
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim(); // toma control inmediato
    })
  );
});

// ── FETCH: estrategia network-first ──────────────────────────
// Para assets estáticos: cache-first
// Para llamadas al GAS (script.google.com): siempre network, sin cache
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Llamadas al GAS y a APIs externas → siempre red, sin cache
  if (
    url.includes('script.google.com') ||
    url.includes('accounts.google.com') ||
    url.includes('wttr.in') ||
    url.includes('tile.openstreetmap.org') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets propios: network-first, fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Guardar respuesta fresca en cache
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Sin red → servir desde cache
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Fallback final: index.html para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/climaobra/index.html');
          }
        });
      })
  );
});
