/* Portão APMG — funciona offline depois do primeiro acesso.
   Ao publicar mudanças, altere CACHE para os celulares baixarem a versão nova. */
const CACHE = 'portao-apmg-v2.0.0';
const CORE = ['./', './index.html', './app.css', './manifest.json', './icon-192.png', './icon-512.png',
  './js/config.js', './js/util.js', './js/placas.js', './js/dados.js', './js/ocr.js', './js/importar.js', './js/relatorios.js', './js/app.js'];
// bibliotecas carregadas sob demanda (leitor de placas, planilhas, PDF, Firebase, fontes)
const CDNS = ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://www.gstatic.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('portao-apmg') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firestore, login e qualquer outro serviço: sempre direto pela rede
  if (url.origin !== self.location.origin && !CDNS.includes(url.origin)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    // arquivos do app: cache primeiro e atualiza em segundo plano
    e.respondWith(caches.match(req).then((hit) => {
      const rede = fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return res; }).catch(() => hit);
      return hit || rede;
    }));
    return;
  }
  // bibliotecas com versão fixa: cache primeiro
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return res;
  })));
});
