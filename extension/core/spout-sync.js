// 물뿜기 바로 반영 (서버 없음, DOM 없음)
// 누르면 → '고래곳간 물뿜기' 구글 설문에 자동 제출(로그인 없는 공개 설문) → 응답 시트를 읽어 모두의 숫자를 센다.
import { buildSpoutReport, buildCancelReport, tallySpouts } from '../shared/spout.js';
import { sheetCsvUrls, parseCsv } from '../shared/market.js';
import { fetchText } from './market.js';
import { mySpouts } from './spout-store.js';

// 설문 응답 주소: …/viewform → …/formResponse
export function formResponseUrl(viewformUrl) {
  try {
    const u = new URL(viewformUrl);
    if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com' || !/\/forms\/d\/e\/[\w-]+\/viewform$/.test(u.pathname)) return null;
    return `https://docs.google.com${u.pathname.replace(/\/viewform$/, '/formResponse')}`;
  } catch {
    return null;
  }
}

// 설문에 글 한 칸을 제출한다. 응답 내용은 읽을 수 없으므로(no-cors) 네트워크 오류가 없으면 보낸 것으로 본다.
export async function postToForm({ fetchFn, formUrl, entry, text }) {
  const url = formResponseUrl(formUrl);
  if (!url || !/^entry\.\d+$/.test(entry || '')) return false;
  try {
    await fetchFn(url, { method: 'POST', mode: 'no-cors', credentials: 'omit', body: new URLSearchParams({ [entry]: text }) });
    return true;
  } catch {
    return false;
  }
}

const newId = (prefix) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 누르기: 기기에 기록하고 바로 제출. 실패하면 기기에 남아 다음에 다시 보낸다.
// 반환: { ok, sent }
export async function likeNow({ storage, fetchFn, config, workId, role }) {
  const all = await mySpouts(storage);
  if (all[workId]) return { ok: false, reason: 'ALREADY' };
  const reportId = newId('r');
  all[workId] = { role, at: new Date().toISOString(), sent: false, reportId };
  await storage.set('spouts', all);
  const sent = await postToForm({ fetchFn, formUrl: config.feedbackFormUrl, entry: config.feedbackEntry, text: buildSpoutReport([{ workId, role }], { reportId }) });
  if (sent) {
    all[workId].sent = true;
    await storage.set('spouts', all);
  }
  return { ok: true, sent };
}

// 취소: 아직 안 보냈으면 기록만 지우고, 보냈으면 취소 보고를 제출한다.
// 반환: { ok, pendingCancel?: { likeId, reportId, role } } — 시트에 반영되기 전까지 화면에서 1을 빼 두는 데 쓴다
export async function unlikeNow({ storage, fetchFn, config, workId }) {
  const all = await mySpouts(storage);
  const mine = all[workId];
  if (!mine) return { ok: false };
  if (mine.sent) {
    const reportId = newId('c');
    const sent = await postToForm({ fetchFn, formUrl: config.feedbackFormUrl, entry: config.feedbackEntry, text: buildCancelReport([{ workId, role: mine.role }], { reportId }) });
    if (!sent) return { ok: false, reason: 'NETWORK' };
    delete all[workId];
    await storage.set('spouts', all);
    return { ok: true, pendingCancel: { likeId: mine.reportId, reportId, role: mine.role } };
  }
  delete all[workId];
  await storage.set('spouts', all);
  return { ok: true };
}

// 보내지 못한 물뿜기를 다시 보낸다 (앱을 열 때)
export async function flushPending({ storage, fetchFn, config }) {
  const all = await mySpouts(storage);
  let sent = 0;
  for (const [workId, v] of Object.entries(all)) {
    if (v.sent) continue;
    v.reportId = v.reportId || newId('r');
    if (await postToForm({ fetchFn, formUrl: config.feedbackFormUrl, entry: config.feedbackEntry, text: buildSpoutReport([{ workId, role: v.role }], { reportId: v.reportId }) })) {
      v.sent = true;
      sent++;
    }
  }
  await storage.set('spouts', all);
  return sent;
}

// 물뿜기 응답 시트를 읽어 센다. 반환: { counts, seen } (tallySpouts 참고)
export async function loadSpoutCounts({ fetchFn, config }) {
  // 물뿜기는 작품 ID·교사/학생 구분만 있는 익명 집계. 자료공유 원응답 시트의 정책과 구분한다.
  const urls = config.spoutCsvUrl ? sheetCsvUrls({ publishedCsvUrl: config.spoutCsvUrl }) : config.spoutSheetId ? [
    'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(config.spoutSheetId) + '/export?format=csv',
    'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(config.spoutSheetId) + '/pub?output=csv',
  ] : [];
  if (!urls.length) return null;
  for (const url of urls) {
    try {
      const { text, contentType } = await fetchText({ fetchFn, url, maxBytes: 5 * 1024 * 1024, timeoutMs: 15000, allowHost: (h) => h === 'docs.google.com' || /\.googleusercontent\.com$/.test(h) });
      if (/text\/html/i.test(contentType) || /^\s*</.test(text)) continue;
      return tallySpouts(parseCsv(text).map((r) => r.join('\n')).join('\n'));
    } catch {
      /* 다음 주소 */
    }
  }
  return null;
}
