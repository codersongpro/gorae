// 바로 실행 링크 — 작품 1개를 압축해 주소의 # 뒤에 담는다 (# 뒤는 서버로 전송되지 않는다)
// DOM 없이 CompressionStream(deflate-raw)만 사용. 확장앱과 웹 뷰어가 같은 코드를 쓴다.
import { toB64u, fromB64u } from './tailprint.js';
import { PACK_FORMAT, PACK_VERSION, parsePack } from './pack.js';

export const MAX_LINK_CHARS = 16000; // 주소 전체 길이 상한 (웨일 클래스·팀보드 게시 시험 전 임시 기준)
export const MAX_INFLATED_BYTES = 2 * 1024 * 1024; // 압축 폭탄 방지
const PREFIX = '#g1.';

async function transform(bytes, stream, maxOut) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (maxOut && total > maxOut) {
      await reader.cancel();
      throw new Error('TOO_BIG');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// 반환: { ok:true, url, length } | { ok:false, reason:'TOO_BIG' }
export async function buildViewerLink(work, viewerUrl) {
  const json = JSON.stringify(work);
  const packed = await transform(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  const url = viewerUrl + PREFIX + toB64u(packed);
  if (url.length > MAX_LINK_CHARS) return { ok: false, reason: 'TOO_BIG', length: url.length };
  return { ok: true, url, length: url.length };
}

// location.hash 문자열을 받아 작품 1개를 꺼낸다. 형식이 틀리면 { ok:false, reason }
export async function readViewerFragment(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(PREFIX)) return { ok: false, reason: 'NO_DATA' };
  let work;
  try {
    const raw = await transform(fromB64u(hash.slice(PREFIX.length)), new DecompressionStream('deflate-raw'), MAX_INFLATED_BYTES);
    work = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    return { ok: false, reason: e && e.message === 'TOO_BIG' ? 'TOO_BIG' : 'BROKEN' };
  }
  // 꾸러미와 같은 규칙으로 작품 형식을 검사한다 (https, 1MB 등)
  const check = parsePack({ format: PACK_FORMAT, formatVersion: PACK_VERSION, name: 'link', items: [work] });
  if (!check.ok) return { ok: false, reason: 'INVALID', errors: check.errors };
  return { ok: true, work };
}

// ---------- 인증 곳간 작품의 짧은 링크 ----------
// 인증 곳간 작품은 이미 catalog.json에 있으므로 작품 전체를 주소에 담지 않고 id만 넘긴다: viewer.html?id=...
// 뷰어가 catalog.json에서 찾아 검수 서명을 다시 확인한 뒤 실행한다. (# 링크 방식은 그대로 쓴다)
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
export function buildCatalogLink(id, viewerUrl) {
  return SAFE_ID.test(String(id || '')) ? `${viewerUrl}?id=${id}` : null;
}
// location.search 문자열 → 작품 id | null
export function readViewerQuery(search) {
  let id = null;
  try { id = new URLSearchParams(String(search || '')).get('id'); } catch { return null; }
  return id && SAFE_ID.test(id) ? id : null;
}
// 실행할 수 있는 인증 곳간 작품만 찾는다 (EXE 목록은 뷰어에서 열지 않는다)
export const findCatalogWork = (catalog, id) => ((catalog && catalog.items) || []).find((w) => w && w.id === id) || null;
// 이 작품이 게시된 인증 곳간 작품과 같은 서명본인가 (짧은 링크를 써도 되는가)
export function isPublishedInCatalog(catalog, work) {
  const c = work && findCatalogWork(catalog, work.id);
  return !!(c && work.tailprint && c.tailprint && c.tailprint.sig && c.tailprint.sig === work.tailprint.sig);
}
// 짧은 링크로 연 작품: 목록에서 찾고 # 링크와 같은 형식 검사를 거친다. 검수 서명 확인은 부르는 쪽(뷰어)이 한다.
// 반환: { ok:true, work } | { ok:false, reason:'NOT_FOUND'|'INVALID' }
export function readCatalogWork(catalog, id) {
  const work = findCatalogWork(catalog, id);
  if (!work) return { ok: false, reason: 'NOT_FOUND' };
  const check = parsePack({ format: PACK_FORMAT, formatVersion: PACK_VERSION, name: 'catalog', items: [work] });
  return check.ok ? { ok: true, work } : { ok: false, reason: 'INVALID', errors: check.errors };
}
