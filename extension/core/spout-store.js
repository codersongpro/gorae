// 이 기기의 물뿜기 기록 (DOM 없음). storage 키 'spouts': { [workId]: { role, at, sent } }
// 서버 없이: 누르면 기기에 기록 → 모아서 네이버 폼으로 보냄 → 보냈다고 표시
import { buildSpoutReport, ROLES } from '../shared/spout.js';

const KEY = 'spouts';

export async function mySpouts(storage) {
  return (await storage.get(KEY)) || {};
}

// 반환: { ok:true } | { ok:false, reason:'ALREADY'|'ROLE' }
export async function recordSpout(storage, workId, role, now = new Date()) {
  if (!ROLES.includes(role)) return { ok: false, reason: 'ROLE' };
  const all = await mySpouts(storage);
  if (all[workId]) return { ok: false, reason: 'ALREADY' }; // 기기당 작품 하나에 1회
  all[workId] = { role, at: now.toISOString(), sent: false };
  await storage.set(KEY, all);
  return { ok: true };
}

// 아직 보내지 않은 물뿜기 → 보고 글. 반환: { count, text, reportId, ids } (없으면 count 0)
export async function pendingReport(storage, { idGen = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const all = await mySpouts(storage);
  const pending = Object.entries(all).filter(([, v]) => !v.sent).map(([workId, v]) => ({ workId, role: v.role }));
  if (!pending.length) return { count: 0 };
  const reportId = 'r-' + idGen();
  return { count: pending.length, reportId, ids: pending.map((p) => p.workId), text: buildSpoutReport(pending, { reportId }) };
}

export async function markSent(storage, ids) {
  const all = await mySpouts(storage);
  for (const id of ids) if (all[id]) all[id].sent = true;
  await storage.set(KEY, all);
}
