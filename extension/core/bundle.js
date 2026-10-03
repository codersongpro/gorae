// 꾸러미 내보내기·가져오기 (DOM 없음)
import { createPack, parsePack, serializePack } from '../shared/pack.js';
import { checkWork } from './checker.js';

// 내 곳간 기록 중 고른 것만 꾸러미 텍스트로 만든다. 반환: { text, count, fileName }
export function exportBundle(records, ids, { name, bundleType, now = new Date() } = {}) {
  const picked = records.filter((r) => ids.includes(r.id));
  const pack = createPack({ name, items: picked.map((r) => r.work), bundleType, now });
  const safe = pack.name.replace(/[\\/:*?"<>|\s]+/g, '_');
  return { text: serializePack(pack), count: picked.length, fileName: `${safe}.gorae.json` };
}

// 가져오기 미리보기: 형식 검사 → 작품마다 점검·검수 서명 검증·중복 여부.
// verifyWorks(works) → [{ work, status }] (sidebar가 현재 족보로 만든 함수를 넘긴다)
export async function previewImport(text, { verifyWorks, existingIds }) {
  const parsed = parsePack(text);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const entries = await verifyWorks(parsed.pack.items);
  return {
    ok: true,
    name: parsed.pack.name,
    items: entries.map((e) => ({
      work: e.work,
      status: e.status,
      report: checkWork(e.work),
      duplicate: existingIds.has(e.work.id),
    })),
  };
}

// 고른 작품만 내 곳간에 담는다. 반환: { added, skipped }
export async function importSelected(preview, selectedIds, store) {
  let added = 0;
  let skipped = 0;
  for (const it of preview.items) {
    if (!selectedIds.includes(it.work.id)) continue;
    const r = await store.add(it.work, { source: 'bundle', checkReport: it.report });
    if (r.ok) added++;
    else skipped++;
  }
  return { added, skipped };
}
