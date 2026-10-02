// 큰 곳간 목록·고래 족보 받기. 성공하면 사본을 보관하고, 실패하면 사본 → 번들 샘플 순으로 대신한다.
async function getJson(fetchFn, url, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 반환: { catalog, list, source: 'network'|'cache'|'sample', offline }
export async function loadCatalog({ fetchFn, storage, config, resolveLocal }) {
  try {
    const [catalog, list] = await Promise.all([
      getJson(fetchFn, config.catalogUrl, config.fetchTimeoutMs),
      getJson(fetchFn, config.reviewersUrl, config.fetchTimeoutMs),
    ]);
    if (!Array.isArray(catalog.items)) throw new Error('목록 형식 오류');
    await storage.set('listCache', { catalog, list, fetchedAt: new Date().toISOString() });
    return { catalog, list, source: 'network', offline: false };
  } catch {
    const cached = await storage.get('listCache');
    if (cached) return { catalog: cached.catalog, list: cached.list, source: 'cache', offline: true };
    const [catalog, list] = await Promise.all([
      getJson(fetchFn, resolveLocal(config.sampleCatalogPath), config.fetchTimeoutMs),
      getJson(fetchFn, resolveLocal(config.sampleReviewersPath), config.fetchTimeoutMs),
    ]);
    return { catalog, list, source: 'sample', offline: false };
  }
}
