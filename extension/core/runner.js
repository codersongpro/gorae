// 격리 실행 준비 (DOM 없음). 실제 iframe은 sandbox.html 안에서만 만든다.
import { displayBadge } from './trust.js';

// 실행 가능 여부: html 작품이고 소용돌이(보류)가 아닐 때
export function canRun(entry) {
  if (entry.work.type !== 'html' || typeof entry.work.html !== 'string') return { ok: false, reason: 'NOT_HTML' };
  if (displayBadge(entry) === 'whirlpool') return { ok: false, reason: 'WHIRLPOOL' };
  return { ok: true };
}

export const buildRunMessage = (work) => ({ type: 'gorae-run', html: work.html });
