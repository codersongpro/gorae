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
