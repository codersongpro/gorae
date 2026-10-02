// 필터·정렬·검색 (순수 함수). 항목 형태: { work, status } (core/trust.js 참고)
// 분류 정보는 normalizeWork로 만든다 — 예전 작품(분류 없음)도 깨지지 않고 검색된다.
import { displayBadge } from './trust.js';
import { normalizeWork } from '../shared/taxonomy.js';

const cache = new WeakMap();
export function metaOf(entry) {
  if (!cache.has(entry.work)) cache.set(entry.work, normalizeWork(entry.work));
  return cache.get(entry.work);
}

// 검색어: 제목·설명·주제·단원·성취기준·태그·교과에서 찾는다. 성취기준 코드는 대괄호 없이 써도 찾는다.
function matchesQuery(e, q) {
  const m = metaOf(e);
  const w = e.work;
  const hay = [w.title, m.description, w.howToUse, m.topic, m.unit, m.area, m.standard, m.subject, m.gradeLabel, ...m.tags, ...m.path]
    .join(' ').toLowerCase().replace(/[[\]]/g, '');
  return q.toLowerCase().replace(/[[\]#]/g, '').split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

// criteria: { mode, domain, category, subcategory, grade(예: '초4'), schoolLevel, subject, standard,
//             audience, groupType, maxMinutes, tag, badge, pickOnly, query }
export function filterEntries(entries, c = {}) {
  return entries.filter((e) => {
    const m = metaOf(e);
    const badge = displayBadge(e);
    if (c.mode === 'baby' && badge !== 'clear') return false; // 학생고래 모드: 맑은 바다만
    if (c.mode === 'baby' && m.artifactType === 'exe') return false; // EXE는 교사고래 모드에서만
    if (c.domain && m.domain !== c.domain) return false;
    if (c.category && m.category !== c.category) return false;
    if (c.subcategory && m.subcategory !== c.subcategory) return false;
    if (c.schoolLevel && m.schoolLevel && m.schoolLevel !== c.schoolLevel) return false; // 학교급이 없는 작품은 공통이라 늘 보인다
    if (c.grade && m.gradeLabel !== c.grade) return false;
    if (c.subject && m.subject !== c.subject) return false;
    if (c.standard && !m.standard.includes(c.standard)) return false;
    if (c.audience && !m.audience.includes(c.audience)) return false;
    if (c.groupType && m.groupType !== c.groupType) return false;
    if (c.maxMinutes && !(m.estimatedMinutes > 0 && m.estimatedMinutes <= Number(c.maxMinutes))) return false;
    if (c.tag && !m.tags.includes(c.tag)) return false;
    if (c.badge && badge !== c.badge) return false;
    if (c.pickOnly && !(e.status.ok && e.status.pick)) return false; // 고래 픽은 검증 통과분만
    if (c.query && !matchesQuery(e, c.query)) return false;
    return true;
  });
}

const byDateDesc = (a, b) => (Date.parse(b.work.addedAt) || 0) - (Date.parse(a.work.addedAt) || 0);

// key: 'pick'(고래 픽 먼저) | 'new'(새로 들어옴) | 'spout'(물뿜기 많은 순, counts: {id: n})
export function sortEntries(entries, key = 'new', counts = {}) {
  const arr = [...entries];
  if (key === 'new') return arr.sort(byDateDesc);
  if (key === 'spout') return arr.sort((a, b) => (counts[b.work.id] || 0) - (counts[a.work.id] || 0) || byDateDesc(a, b));
  const pick = (e) => (e.status.ok && e.status.pick ? 1 : 0);
  return arr.sort((a, b) => pick(b) - pick(a) || byDateDesc(a, b));
}

// 필터 선택지: 목록에 실제로 있는 값만 (분류 정보 기준)
export function facetValues(entries, field) {
  const vals = entries.flatMap((e) => {
    const v = metaOf(e)[field];
    return Array.isArray(v) ? v : [v];
  });
  return [...new Set(vals.filter(Boolean))].sort();
}

// 많이 쓰인 태그 순
export function topTags(entries, limit = 12) {
  const n = new Map();
  for (const e of entries) for (const t of metaOf(e).tags) n.set(t, (n.get(t) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([t]) => t);
}
