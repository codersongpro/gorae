// 나눔 곳간: 시트 목록 불러오기 · 드라이브 파일 내려받기 · 검증 후 내 곳간에 담기 (DOM 없음)
// 외부 데이터는 전부 믿지 않는다: https만, 리다이렉트 뒤 주소 재검사, 크기·시간 상한, 검증 통과분만 저장.
import { parseMarketCsv, sheetCsvUrls, toDriveDownloadUrl, isAllowedDownloadHost } from '../shared/market.js';
import { readSubmission } from '../shared/submission.js';
import { checkWork } from './checker.js';

// 오류 코드 → 화면 문구는 ui/strings.js의 S.market.error
export class MarketError extends Error {
  constructor(code, detail = '') {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

async function readCapped(res, maxBytes) {
  const reader = res.body ? res.body.getReader() : null;
  if (!reader) {
    const t = await res.text();
    if (new TextEncoder().encode(t).length > maxBytes) throw new MarketError('TOO_BIG');
    return t;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MarketError('TOO_BIG');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(all);
}

// 안전하게 글 내려받기: 주소·리다이렉트 검사, 시간·크기 상한, 쿠키 보내지 않음
export async function fetchText({ fetchFn, url, maxBytes, timeoutMs, allowHost }) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new MarketError('BAD_URL');
  }
  if (u.protocol !== 'https:' || !allowHost(u.hostname)) throw new MarketError('BAD_URL');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let res;
    try {
      res = await fetchFn(u.href, { signal: ctl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      throw new MarketError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
    }
    const finalUrl = new URL(res.url || u.href);
    if (finalUrl.hostname === 'accounts.google.com') throw new MarketError('PRIVATE'); // 로그인 화면으로 보냄 = 비공개
    if (finalUrl.protocol !== 'https:' || !allowHost(finalUrl.hostname)) throw new MarketError('BAD_REDIRECT', finalUrl.hostname);
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new MarketError('PRIVATE');
    if (!res.ok) throw new MarketError('HTTP', String(res.status));
    return { text: await readCapped(res, maxBytes), contentType: (res.headers && res.headers.get && res.headers.get('content-type')) || '' };
  } finally {
    clearTimeout(timer);
  }
}

// 운영은 설정된 공개목록 CSV와 그 주소의 캐시만 사용한다. 원응답은 개발 모드에서 명시적으로 허용해야 한다.
// 반환: { entries, source: 'network'|'cache', header, missing }
export async function loadMarket({ fetchFn, config, storage }) {
  if (storage) await storage.set('marketCache', null); // 예전 원응답 캐시는 삭제하고 사용하지 않는다.
  const urls = sheetCsvUrls(config);
  if (!urls.length) throw new MarketError('NOT_CONFIGURED');
  let lastErr = null;
  for (const url of urls) {
    try {
      const { text, contentType } = await fetchText({ fetchFn, url, maxBytes: 5 * 1024 * 1024, timeoutMs: config.fetchTimeoutMs, allowHost: (h) => h === 'docs.google.com' || /\.googleusercontent\.com$/.test(h) });
      if (/text\/html/i.test(contentType) || /^\s*</.test(text)) throw new MarketError('PRIVATE'); // CSV 대신 웹 화면 = 공개 안 됨
      const parsed = parseMarketCsv(text);
      if (!parsed.ok) return { entries: [], source: 'network', header: parsed.header, missing: parsed.missing };
      if (storage) await storage.set('marketPublicCache', { text, url, at: new Date().toISOString() });
      return { entries: parsed.entries, source: 'network', header: parsed.header, missing: [] };
    } catch (e) {
      lastErr = e instanceof MarketError ? e : new MarketError('NETWORK');
    }
  }
  const cached = storage && (await storage.get('marketPublicCache'));
  if (cached && urls.includes(cached.url)) {
    const parsed = parseMarketCsv(cached.text);
    if (parsed.ok) return { entries: parsed.entries, source: 'cache', header: parsed.header, missing: [], error: lastErr.code };
  }
  throw lastErr;
}

// 목록 항목 → 작품 카드 [여러 개]. 파일이 있으면 드라이브에서 받고, 없으면 주소 칸을 읽는다.
export async function fetchEntryWorks(entry, { fetchFn, config }) {
  let res;
  if (entry.payload) {
    // 앱에 들어 있는 나눔 곳간 샘플: 업로드 파일과 같은 형식이라 같은 검증을 거친다
    res = readSubmission(entry.payload, { fileName: entry.title + '.html' });
  } else if (entry.files.length) {
    const url = toDriveDownloadUrl(entry.files[0]);
    if (!url) throw new MarketError('BAD_URL');
    const { text } = await fetchText({ fetchFn, url, maxBytes: config.maxFileBytes, timeoutMs: config.fetchTimeoutMs, allowHost: isAllowedDownloadHost });
    res = readSubmission(text, { fileName: entry.title + '.html' });
  } else {
    res = readSubmission(entry.address);
  }
  if (!res.ok) throw new MarketError('INVALID', res.errors.map((e) => e.message).join(' '));
  // 고래곳간 밖에서 만든 파일은 시트에 적힌 정보로 빈칸을 채운다
  const works = res.works.map((w) => {
    // 나눔 곳간 작품은 검수 전이다: 파일 속에 검수 서명이 들어 있어도 떼어 내서 인증 작품처럼 보이지 않게 한다
    const { tailprint, ...out } = w;
    void tailprint;
    // 설명 칸의 '분류 정보' 글에서 되살린 값으로 빈 필드만 채운다 (웹앱·주소 작품은 이것이 유일한 분류 정보)
    if (entry.meta) {
      for (const [k, v] of Object.entries(entry.meta)) {
        const cur = out[k];
        if (cur === undefined || cur === '' || (Array.isArray(cur) && !cur.length)) out[k] = Array.isArray(v) ? [...v] : v;
      }
    }
    // 고래곳간 밖에서 만든 파일·주소만 있는 응답은 시트에 적힌 제목을 쓴다
    if (res.kind === 'html-plain' || res.kind === 'url-plain' || !out.title) out.title = entry.title;
    if (!out.howToUse) out.howToUse = entry.description || '';
    if (!out.description && entry.description) out.description = entry.description;
    if (!out.author && entry.nickname) out.author = entry.nickname;
    if (!out.domain && entry.category) Object.assign(out, entry.category);
    return out;
  });
  // 자동 안전 점검 결과도 함께 돌려준다 (미리 보기·가져오기 전에 화면에서 쓴다)
  return { works, warnings: res.warnings, reports: works.map((w) => checkWork(w)) };
}

// 검증을 통과한 작품만 내 곳간에 담는다. 같은 id나 같은 제목이 있으면 건너뛴다.
// 반환: { added: [제목], skipped: [제목], warnings }
export async function importEntry(entry, { fetchFn, config, store }) {
  const { works, warnings } = await fetchEntryWorks(entry, { fetchFn, config });
  const existing = await store.list();
  const titles = new Set(existing.map((r) => r.work.title));
  const added = [];
  const skipped = [];
  for (const w of works) {
    if (titles.has(w.title)) {
      skipped.push(w.title);
      continue;
    }
    const r = await store.add(w, { source: 'market', checkReport: checkWork(w), extra: { market: { entryId: entry.id, nickname: entry.nickname, whale: entry.whale, at: entry.timestamp } } });
    if (r.ok) {
      added.push(w.title);
      titles.add(w.title);
    } else skipped.push(w.title);
  }
  return { added, skipped, warnings };
}
