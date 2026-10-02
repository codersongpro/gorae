// 웹 버전용 어댑터: 확장앱이 쓰는 chrome.* 중 필요한 것만 브라우저 기능으로 대신한다.
// 같은 화면·같은 로직(extension/)을 웹 주소에서 그대로 쓰기 위한 얇은 껍데기다. 고래곳간 코드는 건드리지 않는다.
(() => {
  globalThis.GORAE_WEB = true;
  const BASE = new URL('./', document.baseURI).href;

  // 저장소: IndexedDB 한 칸짜리 키-값 (큰 값도 담을 수 있고 여러 탭이 같이 쓴다)
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('gorae-kv', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => { db.close(); res(req && req.result); };
      t.onerror = () => { db.close(); rej(t.error); };
    });
  };
  const local = {
    async get(key) {
      const keys = typeof key === 'string' ? [key] : Array.isArray(key) ? key : Object.keys(key || {});
      const out = {};
      for (const k of keys) {
        const v = await tx('readonly', (s) => s.get(k));
        if (v !== undefined) out[k] = v;
      }
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) await tx('readwrite', (s) => s.put(v === undefined ? null : v, k));
    },
  };

  // 새 창: 팝업 창을 요청하고, 막히면 새 탭으로 연다 (브라우저가 팝업을 막을 수 있다)
  const openWindow = (opts, cb) => {
    const popup = opts.type === 'popup';
    const w = window.open(opts.url, '_blank', popup ? `popup=yes,width=${opts.width || 1024},height=${opts.height || 768}` : 'noopener');
    if (cb) cb(w);
  };

  globalThis.chrome = {
    storage: { local },
    runtime: { getURL: (p) => new URL(p, BASE).href },
    windows: { create: openWindow },
    tabs: {
      create: (o) => window.open(o.url, '_blank', 'noopener'),
      query: async () => [], // 다른 사이트 탭 주소는 웹 페이지가 볼 수 없다 → 서비스 인식·시험 잠금은 쓰지 않는다
    },
  };
})();
