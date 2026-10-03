// 실행 가능 여부 판단과 격리 실행 준비 (DOM 없음). 실제 iframe은 sandbox.html 안에서만 만든다.
// HTML 작품과 URL 작품 모두 같은 관문(canRun)을 통과해야 한다.
import { displayBadge } from './trust.js';

function parseHttps(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

// 반환: { ok:true, kind:'html' } | { ok:true, kind:'url', host, url } | { ok:false, reason }
// reason: WHIRLPOOL(보류) | NOT_HTML | NOT_HTTPS | UNSUPPORTED(exe 등)
export function canRun(entry) {
  const w = entry.work;
  if (displayBadge(entry) === 'whirlpool') return { ok: false, reason: 'WHIRLPOOL' }; // 종류와 무관하게 막는다
  if (w.type === 'html') {
    return typeof w.html === 'string' && w.html ? { ok: true, kind: 'html' } : { ok: false, reason: 'NOT_HTML' };
  }
  if (w.type === 'url') {
    const u = parseHttps(w.url);
    return u ? { ok: true, kind: 'url', host: u.hostname, url: u.href } : { ok: false, reason: 'NOT_HTTPS' };
  }
  return { ok: false, reason: 'UNSUPPORTED' };
}

export const buildRunMessage = (work) => ({ type: 'gorae-run', html: work.html });

// 외부 사이트(URL 작품)를 열기 전에 사용자에게 보여 줄 확인 정보
export function describeExternalOpen(entry) {
  const c = canRun(entry);
  if (!c.ok || c.kind !== 'url') return null;
  return { id: entry.work.id, host: c.host, url: c.url, verified: entry.status.ok, badge: displayBadge(entry) };
}
