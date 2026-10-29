// Portão APMG — funciona offline depois do primeiro acesso
const CACHE = 'portao-apmg-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // páginas: rede primeiro (pega atualizações), cache se estiver sem internet
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // bibliotecas, fontes, leitor de placas: cache primeiro
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
