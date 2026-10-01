// 필터·정렬 (순수 함수). 항목 형태: { work, status } (core/trust.js 참고)
import { displayBadge } from './trust.js';

// criteria: { grade, subject, standard, audience, badge, pickOnly, mode: 'baby'|'mother' }
export function filterEntries(entries, c = {}) {
  return entries.filter((e) => {
    const w = e.work;
    const badge = displayBadge(e);
    if (c.mode === 'baby' && badge !== 'clear') return false; // 아기고래 모드: 맑은 바다만
    if (c.grade && w.grade !== c.grade) return false;
    if (c.subject && w.subject !== c.subject) return false;
    if (c.standard && !(w.standard || '').includes(c.standard)) return false;
    if (c.audience && w.audience !== c.audience) return false;
    if (c.badge && badge !== c.badge) return false;
    if (c.pickOnly && !(e.status.ok && e.status.pick)) return false; // 고래 픽은 검증 통과분만
    return true;
  });
}

const byDateDesc = (a, b) => (Date.parse(b.work.addedAt) || 0) - (Date.parse(a.work.addedAt) || 0);

// key: 'pick'(고래 픽 먼저) | 'new'(새로 들어옴) | 'spout'(물뿜기 많은 순, counts: {id: n})
export function sortEntries(entries, key = 'pick', counts = {}) {
  const arr = [...entries];
  if (key === 'new') return arr.sort(byDateDesc);
  if (key === 'spout') return arr.sort((a, b) => (counts[b.work.id] || 0) - (counts[a.work.id] || 0) || byDateDesc(a, b));
  const pick = (e) => (e.status.ok && e.status.pick ? 1 : 0);
  return arr.sort((a, b) => pick(b) - pick(a) || byDateDesc(a, b));
}

// 필터 선택지: 목록에 실제로 있는 값만
export function facetValues(entries, field) {
  return [...new Set(entries.map((e) => e.work[field]).filter(Boolean))].sort();
}
