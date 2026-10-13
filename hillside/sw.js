// Stitches the three engine binary parts back into index.wasm on the fly.
const PARTS = ['index.wasm.p0', 'index.wasm.p1', 'index.wasm.p2'];
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/index.wasm')) {
    e.respondWith((async () => {
      const base = url.pathname.slice(0, url.pathname.length - 'index.wasm'.length);
      const bufs = await Promise.all(PARTS.map(async (p) => {
        const r = await fetch(base + p);
        if (!r.ok) throw new Error('engine part failed: ' + p);
        return r.arrayBuffer();
      }));
      const blob = new Blob(bufs, { type: 'application/wasm' });
      return new Response(blob, { headers: { 'Content-Type': 'application/wasm' } });
    })());
  }
});
