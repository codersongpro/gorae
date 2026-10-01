// 물뿜기(익명 추천) — 서버 없이 동작한다 (DOM 없음)
// ① 기기에서 💨을 누르면 기기에만 기록 (기기당 작품 하나에 1회, 교사/학생 구분)
// ② 모인 물뿜기를 '물뿜기 보고' 글로 만들어 의견 설문으로 보냄 (개인정보 없음: 작품 id와 교사/학생 구분뿐)
// ③ 파수꾼·대왕고래가 검수 도구에 폼 응답을 붙여 넣으면 catalog.json의 spouts 숫자가 늘어남
// ④ 모든 카드에 "💨 교사 N · 학생 M"을 그대로 보여 준다 (구간·등급 없음)

export const ROLES = ['teacher', 'student'];
const HEADER = '[고래곳간 물뿜기]';
const ROLE_LABEL = { teacher: '교사', student: '학생' };
const LABEL_ROLE = { 교사: 'teacher', 학생: 'student' };
const ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
const MARKET_ID = /^(m|sample)-[a-z0-9-]{1,60}$/;
export const MAX_SPOUT_SEEN = 5000; // 같은 보고를 두 번 더하지 않으려고 기억하는 보고 번호 수

// 보고 글 만들기. pending: [{ workId, role }]
export function buildSpoutReport(pending, { reportId }) {
  const by = { teacher: [], student: [] };
  for (const p of pending) if (ROLES.includes(p.role) && ID_RE.test(p.workId) && !by[p.role].includes(p.workId)) by[p.role].push(p.workId);
  return [HEADER, `보고 번호: ${reportId}`, `교사: ${by.teacher.join(', ')}`, `학생: ${by.student.join(', ')}`].join('\n');
}

// 붙여 넣은 글(폼 응답 여러 개가 섞여 있어도 됨)에서 보고들을 찾아낸다
// 반환: [{ reportId, teacher: [id], student: [id] }]
export function parseSpoutReports(text) {
  const out = [];
  const blocks = String(text || '').split(HEADER).slice(1);
  for (const b of blocks) {
    const rid = /보고 번호:\s*([A-Za-z0-9-]{4,40})/.exec(b);
    if (!rid) continue;
    const r = { reportId: rid[1], teacher: [], student: [] };
    // [ \t]* : 빈 줄("교사: ")에서 다음 줄로 넘어가 읽지 않게 한다
    for (const m of b.matchAll(/^(교사|학생):[ \t]*(.*)$/gm)) {
      const role = LABEL_ROLE[m[1]];
      for (const id of m[2].split(',').map((s) => s.trim()).filter((s) => ID_RE.test(s))) if (!r[role].includes(id)) r[role].push(id);
    }
    if (!out.some((x) => x.reportId === r.reportId)) out.push(r);
  }
  return out;
}

// 보고들을 catalog의 spouts에 더한다. 목록에 없는 작품, 이미 더한 보고 번호는 건너뛴다.
// 반환: { catalog, added: 더한 횟수, skippedReports, unknownIds }
export function applySpoutReports(catalog, reports, { now = new Date() } = {}) {
  const known = new Set([...(catalog.items || []), ...(catalog.exeItems || [])].map((w) => w.id));
  const seen = new Set(catalog.spoutSeen || []);
  const spouts = JSON.parse(JSON.stringify(catalog.spouts || {}));
  let added = 0;
  let skippedReports = 0;
  const unknownIds = new Set();
  for (const r of reports) {
    if (seen.has(r.reportId)) {
      skippedReports++;
      continue;
    }
    seen.add(r.reportId);
    for (const role of ROLES) {
      for (const id of r[role]) {
        // 나눔 곳간 작품(m-…: 시트 항목, sample-…: 앱 안 샘플)은 catalog 밖이지만 숫자를 함께 모은다
        if (!known.has(id) && !MARKET_ID.test(id)) {
          unknownIds.add(id);
          continue;
        }
        spouts[id] = spouts[id] || { teacher: 0, student: 0 };
        spouts[id][role] += 1;
        added++;
      }
    }
  }
  const spoutSeen = [...seen].slice(-MAX_SPOUT_SEEN);
  return { catalog: { ...catalog, spouts, spoutSeen, updatedAt: now.toISOString() }, added, skippedReports, unknownIds: [...unknownIds] };
}

// ---------- 바로 반영 (클릭 즉시 설문에 자동 제출 → 응답 시트를 읽어 센다) ----------
const CANCEL_HEADER = '[고래곳간 물뿜기 취소]';
export function buildCancelReport(items, { reportId }) {
  return buildSpoutReport(items, { reportId }).replace(HEADER, CANCEL_HEADER);
}

// 응답 시트 글 전체 → 작품별 숫자. 같은 보고 번호는 한 번만, 취소 보고는 1을 뺀다(0 아래로는 안 감).
// 반환: { counts: { [id]: { teacher, student } }, seen: Set(보고 번호) }
export function tallySpouts(text) {
  const t = String(text || '');
  const counts = {};
  const seen = new Set();
  const add = (reports, delta) => {
    for (const r of reports) {
      if (seen.has(r.reportId)) continue;
      seen.add(r.reportId);
      for (const role of ROLES) {
        for (const id of r[role]) {
          counts[id] = counts[id] || { teacher: 0, student: 0 };
          counts[id][role] = Math.max(0, counts[id][role] + delta);
        }
      }
    }
  };
  // 취소 블록과 일반 블록을 나눠 같은 해석기로 읽는다 (취소는 머리글만 다르다)
  const segs = t.split(CANCEL_HEADER);
  const likes = segs.map((seg, i) => (i === 0 ? seg : seg.includes(HEADER) ? seg.slice(seg.indexOf(HEADER)) : '')).join('\n');
  const cancels = segs.slice(1).map((seg) => HEADER + seg.split(HEADER)[0]).join('\n');
  add(parseSpoutReports(likes), 1);
  add(parseSpoutReports(cancels), -1);
  return { counts, seen };
}

// 카드에 보일 숫자.
// base: 응답 시트에서 센 숫자(live) 또는 catalog.spouts. mine: 이 기기의 내 물뿜기.
// 시트에 아직 안 올라간 내 물뿜기는 +1, 시트에 아직 안 올라간 내 취소는 -1 (누르자마자 숫자가 바뀌게)
export function spoutCountsFor(catalog, workId, mine = null, live = null, pendingCancel = null) {
  const src = live ? live.counts[workId] : catalog && catalog.spouts && catalog.spouts[workId];
  const c = src || { teacher: 0, student: 0 };
  const out = { teacher: Number(c.teacher) || 0, student: Number(c.student) || 0 };
  if (mine && ROLES.includes(mine.role) && (!mine.sent || (live && !live.seen.has(mine.reportId)))) out[mine.role] += 1;
  if (pendingCancel && live && live.seen.has(pendingCancel.likeId) && !live.seen.has(pendingCancel.reportId) && ROLES.includes(pendingCancel.role)) {
    out[pendingCancel.role] = Math.max(0, out[pendingCancel.role] - 1);
  }
  return out;
}

export const spoutTotal = (c) => (c ? c.teacher + c.student : 0);
export const roleLabel = (r) => ROLE_LABEL[r] || r;
