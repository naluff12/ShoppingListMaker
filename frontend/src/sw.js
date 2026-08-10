/* Service Worker PWA + Web Push. VitePWA lo procesa con injectManifest. */
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkFirst({
  cacheName: 'api-cache', networkTimeoutSeconds: 6,
  plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 86400 })],
}));
registerRoute(({ url }) => url.pathname.startsWith('/uploads/'), new StaleWhileRevalidate({
  cacheName: 'uploads-cache',
  plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 2592000 })],
}));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'Lista del Súper';
  const options = {
    body: data.body || 'Tienes una actualización en tu lista.',
    icon: data.icon || '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    tag: data.tag || 'shopping-list',
    data: data.data || { url: '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((w) => w.url.startsWith(self.location.origin));
    if (existing) { existing.focus(); existing.navigate(target); }
    else if (clients.openWindow) return clients.openWindow(target);
  }));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
