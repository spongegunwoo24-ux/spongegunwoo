// 일일플래너 오프라인 지원 (서비스 워커)
// 앱 파일을 기기에 저장해 두고, 인터넷이 끊겨도 저장해 둔 파일로 바로 화면을 띄웁니다.
// 플래너 기록(할 일, 타임테이블 등)은 원래부터 기기 안(localStorage)에 저장되므로 영향이 없습니다.
const CACHE = 'daily-planner-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const FONT_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('daily-planner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin && url.pathname.startsWith(new URL('./', self.location).pathname);
  if (!sameOrigin && url.hostname !== FONT_HOST) return;

  // 저장해 둔 파일을 먼저 보여주고, 인터넷이 되면 뒤에서 조용히 최신 파일로 바꿔 둡니다.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = req.mode === 'navigate' ? './index.html' : req;
      const cached = await cache.match(key);
      const fresh = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
        return res;
      });
      if (cached) { event.waitUntil(fresh.catch(() => {})); return cached; }
      return fresh.catch(() => cache.match('./index.html'));
    })
  );
});
