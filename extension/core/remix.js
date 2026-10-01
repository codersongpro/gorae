// 리믹스·수정 저장 (DOM 없음)
import { createWork, validateNewWork } from './work.js';
import { checkHtml } from './checker.js';

// 리믹스 시작용 입력값: 원본 내용과 레시피를 복사하고 remixOf를 기록한다. 꼬리지문은 따라가지 않는다.
export function remixInput(original) {
  const w = original;
  return {
    title: `${w.title} (리믹스)`,
    type: w.type,
    html: w.html,
    url: w.url,
    grade: w.grade,
    subject: w.subject,
    standard: w.standard,
    author: '', // 새 작성자 별명을 직접 쓰게 비워 둔다
    howToUse: w.howToUse,
    promptRecipe: w.promptRecipe,
    remixOf: w.id,
  };
}

export function editInput(work) {
  const { title, type, html, url, grade, subject, standard, author, howToUse, promptRecipe } = work;
  return { title, type, html, url, grade, subject, standard, author, howToUse, promptRecipe };
}

// 수정 저장.
// - 내가 직접 만들었고 꼬리지문이 없는 작품: 같은 기록에서 버전만 올린다.
// - 큰 곳간·꾸러미 작품이거나 꼬리지문이 있는 작품: 원본은 그대로 두고 '내 수정본(미검수)'을 따로 저장한다.
// 반환: { ok, errors?, warnings?, record?, separate? }
export async function saveEdit(store, record, input, opts = {}) {
  const v = validateNewWork(input);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
  const report = input.type === 'html' ? checkHtml(input.html) : null;
  const inPlace = record.source === 'maker' && !record.work.tailprint;
  if (inPlace) {
    const work = { ...createWork(input, opts), id: record.work.id, addedAt: record.work.addedAt, version: record.work.version + 1 };
    if (record.work.remixOf) work.remixOf = record.work.remixOf;
    const next = { ...record, work, checkReport: report };
    await store.put(next);
    return { ok: true, record: next, separate: false, warnings: v.warnings };
  }
  const work = { ...createWork(input, opts), editedFrom: record.work.id, version: record.work.version + 1 };
  if (record.work.remixOf) work.remixOf = record.work.remixOf;
  const r = await store.add(work, { source: 'maker', checkReport: report });
  return { ok: true, record: r.record, separate: true, warnings: v.warnings };
}
