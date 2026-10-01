// 내 곳간 (작품을 기기에만 저장). backend: { getAll, get, put, delete } — 실제로는 IndexedDB.
export function createStore(backend, { now = () => new Date() } = {}) {
  return {
    list: async () => (await backend.getAll()).sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
    get: (id) => backend.get(id),
    remove: (id) => backend.delete(id),
    put: (rec) => backend.put(rec), // 기존 기록 갱신(수정 저장)
    clear: async () => {
      for (const r of await backend.getAll()) await backend.delete(r.id);
    },
    // source: 'maker'(직접 만듦) | 'catalog'(큰 곳간) | 'bundle'(꾸러미) | 'link'(바로 실행 링크)
    async add(work, { source, checkReport }) {
      if (await backend.get(work.id)) return { ok: false, duplicate: true };
      const rec = { id: work.id, work, source, importedAt: now().toISOString(), checkReport, favorite: false };
      await backend.put(rec);
      return { ok: true, record: rec };
    },
  };
}

export function createMemoryBackend() {
  const m = new Map();
  return {
    getAll: async () => [...m.values()].map((v) => structuredClone(v)),
    get: async (id) => (m.has(id) ? structuredClone(m.get(id)) : undefined),
    put: async (rec) => void m.set(rec.id, structuredClone(rec)),
    delete: async (id) => void m.delete(id),
  };
}
