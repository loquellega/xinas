/* Xinas · service worker: abre al instante y sin conexión con la copia guardada,
   y en segundo plano trae la versión nueva para la próxima vez. */
const CACHE = 'xinas-v0.9';
const FILES = ['./', './index.html', './manifest.webmanifest', './iconos/apple-touch-icon.png', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('xinas-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r, { ignoreSearch:true }) || (r.mode === 'navigate' ? await c.match('./index.html') : null);
    const net = fetch(r).then(res => { if (res && res.ok && !u.search) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit){ e.waitUntil(net); return hit; }
    return (await net) || new Response('sin conexión', { status:503 });
  }));
});
