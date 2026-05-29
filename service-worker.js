// ═══════════════════════════════════════════════
//  EnsinoMoz — Service Worker (PWA)
//  Versão: 1.0.0
// ═══════════════════════════════════════════════

const CACHE_NAME = 'ensinomoz-v1';

// Ficheiros a guardar em cache (disponíveis offline)
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ── Instalação: guarda os assets no cache ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[EnsinoMoz SW] A guardar assets em cache…');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[EnsinoMoz SW] Alguns assets não foram cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activação: remove caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[EnsinoMoz SW] A remover cache antigo:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia Network First → Cache Fallback ──
self.addEventListener('fetch', event => {
  // Ignorar pedidos que não sejam GET
  if (event.request.method !== 'GET') return;

  // Ignorar pedidos ao Firebase (sempre online)
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com/firebasejs')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Guardar cópia fresca no cache
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Sem internet → servir do cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para o index.html (navegação offline)
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ── Push Notifications (futuro) ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'EnsinoMoz';
  const options = {
    body: data.body || 'Nova notificação da plataforma.',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=EM&backgroundColor=0a1628&textColor=ffffff',
    badge: 'https://api.dicebear.com/7.x/initials/svg?seed=EM&backgroundColor=0a1628&textColor=ffffff',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || './'));
});
