/*
 * 22M Vazamentos — service worker do app instalável.
 * Estratégia:
 *  - Navegação: rede primeiro (conteúdo sempre novo), com o shell em cache como reserva offline.
 *  - Estáticos (JS/CSS/fontes/ícones): cache primeiro, revalidando em segundo plano.
 *  - /api/*: nunca é cacheado (dados de conta, chat e IA precisam ser sempre atuais).
 */
const VERSION = 'v1-2026-11-24';
const SHELL = `22m-shell-${VERSION}`;
const ASSETS = `22m-assets-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put('/', response.clone());
    return response;
  } catch {
    const cached = (await cache.match('/')) || (await cache.match('/index.html'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<body style="margin:0;background:#050505;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;text-align:center">' +
        '<div><h1 style="font-size:20px;letter-spacing:.12em">SEM CONEXÃO</h1>' +
        '<p style="color:#9a9a9a;font-size:14px">Verifique sua internet e tente novamente.</p></div>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => undefined);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
