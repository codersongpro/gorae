// 리믹스·수정 저장 (DOM 없음)
import { createWork, validateNewWork } from './work.js';
import { checkWork } from './checker.js';
import { normalizeWork } from '../shared/taxonomy.js';

// 작품 카드 → 등록 화면 입력값. 예전 작품은 분류를 추정해 채우고, 모자란 칸은 등록 화면에서 고르게 한다.
function formInput(w) {
  const m = normalizeWork(w);
  const input = {
    title: w.title, artifactType: m.artifactType, domain: m.domain, category: m.category, subcategory: m.subcategory,
    contentType: m.contentType, learningMode: m.learningMode, selfDirected: m.selfDirected, difficulty: m.difficulty, creationMethod: m.creationMethod,
    audience: m.audience.length ? m.audience : ['student'], tags: m.tags, description: m.description,
    howToUse: w.howToUse, promptRecipe: w.promptRecipe, author: w.author,
    schoolLevel: m.schoolLevel, grade: m.grade, subject: m.subject, area: m.area, unit: m.unit, lessonNo: m.lessonNo,
    topic: m.topic, standard: m.standard, groupType: m.groupType, estimatedMinutes: m.estimatedMinutes || '',
    html: w.html, url: w.url,
  };
  if (w.referenceOnly === true) input.referenceOnly = true;
  for (const k of ['sourceUrl', 'loginRequired', 'usesExternalApi', 'mobileSupported', 'collectsPersonalInfo', 'needsInternet', 'sourceRepo', 'sha256', 'scanResult', 'environment']) {
    if (w[k] !== undefined) input[k] = w[k];
  }
  return input;
}

// 리믹스 시작용 입력값: 원본 내용과 레시피를 복사하고 remixOf를 기록한다. 검수 서명·배지는 따라가지 않는다.
export function remixInput(original) {
  return {
    ...formInput(original),
    title: `${original.title} (리믹스)`,
    author: '', // 새 작성자 별명을 직접 쓰게 비워 둔다
    remixOf: original.id,
    remixOfTitle: original.title,
  };
}

export const editInput = (work) => formInput(work);

// 수정 저장.
// - 내가 직접 만들었고 검수 서명이 없는 작품: 같은 기록에서 버전만 올린다.
// - 인증 곳간·꾸러미 작품이거나 검수 서명이 있는 작품: 원본은 그대로 두고 '내 수정본(미검수)'을 따로 저장한다.
// 반환: { ok, errors?, warnings?, record?, separate? }
export async function saveEdit(store, record, input, opts = {}) {
  const v = validateNewWork(input);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
  const inPlace = record.source === 'maker' && !record.work.tailprint;
  const keepLineage = (work) => {
    if (record.work.remixOf) Object.assign(work, { remixOf: record.work.remixOf, remixOfTitle: record.work.remixOfTitle });
    return work;
  };
  if (inPlace) {
    const work = keepLineage({ ...createWork(input, opts), id: record.work.id, addedAt: record.work.addedAt, version: record.work.version + 1 });
    const next = { ...record, work, checkReport: checkWork(work) };
    await store.put(next);
    return { ok: true, record: next, separate: false, warnings: v.warnings };
  }
  const work = keepLineage({ ...createWork(input, opts), editedFrom: record.work.id, version: record.work.version + 1 });
  const r = await store.add(work, { source: 'maker', checkReport: checkWork(work) });
  return { ok: true, record: r.record, separate: true, warnings: v.warnings };
}
