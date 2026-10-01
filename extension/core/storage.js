// 저장소 어댑터 — core 로직은 get/set 인터페이스만 안다 (테스트에서는 메모리로 대체)
export function createChromeStorage() {
  return {
    async get(key) {
      const r = await chrome.storage.local.get(key);
      return r[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
  };
}

export function createMemoryStorage() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    set: async (k, v) => void m.set(k, structuredClone(v)),
  };
}
