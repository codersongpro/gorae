// 물뿜기 (서버 없음) — 기기 기록 → 폼 보고 → 검수 도구 집계 → 카드에 교사·학생 숫자
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpoutReport, parseSpoutReports, applySpoutReports, spoutCountsFor, spoutTotal } from '../shared/spout.js';
import { recordSpout, pendingReport, markSent, mySpouts } from '../extension/core/spout-store.js';
import { createMemoryStorage } from '../extension/core/storage.js';

const catalog = { items: [{ id: 'tool-a' }, { id: 'tool-b' }], exeItems: [], spouts: { 'tool-a': { teacher: 2, student: 5 } } };

test('AC-032 한 기기에서 같은 작품은 한 번만 뿜을 수 있다', async () => {
  const st = createMemoryStorage();
  assert.deepEqual(await recordSpout(st, 'tool-a', 'student'), { ok: true });
  assert.deepEqual(await recordSpout(st, 'tool-a', 'teacher'), { ok: false, reason: 'ALREADY' });
  assert.deepEqual(await recordSpout(st, 'tool-b', 'parent'), { ok: false, reason: 'ROLE' });
});

test('보고 글에는 작품 id와 교사/학생 구분만 들어간다 (개인정보 없음)', async () => {
  const st = createMemoryStorage();
  await recordSpout(st, 'tool-a', 'teacher');
  await recordSpout(st, 'tool-b', 'teacher');
  const r = await pendingReport(st, { idGen: () => 'abc12345' });
  assert.equal(r.count, 2);
  assert.equal(r.text, '[고래곳간 물뿜기]\n보고 번호: r-abc12345\n교사: tool-a, tool-b\n학생: ');
  await markSent(st, r.ids);
  assert.equal((await pendingReport(st)).count, 0); // AC-033: 보낸 뒤엔 다시 보내지 않는다
  assert.equal((await mySpouts(st))['tool-a'].sent, true);
});

test('AC-033 보내지 못한 물뿜기는 기기에 남아 다음에 보낼 수 있다', async () => {
  const st = createMemoryStorage();
  await recordSpout(st, 'tool-a', 'student');
  const first = await pendingReport(st);
  // 보내기 실패(markSent 안 함) → 그대로 남음
  const again = await pendingReport(st);
  assert.equal(first.count, 1);
  assert.equal(again.count, 1);
});

test('검수 도구 집계: 여러 응답을 한꺼번에 붙여도 더하고, 같은 보고는 두 번 더하지 않는다', () => {
  const r1 = buildSpoutReport([{ workId: 'tool-a', role: 'teacher' }, { workId: 'tool-b', role: 'student' }], { reportId: 'r-one11' });
  const r2 = buildSpoutReport([{ workId: 'tool-a', role: 'student' }, { workId: 'ghost', role: 'student' }], { reportId: 'r-two22' });
  const pasted = `응답 1\n${r1}\n\n응답 2\n${r2}\n\n응답 3 (같은 것을 또 붙임)\n${r1}`;
  const reports = parseSpoutReports(pasted);
  assert.equal(reports.length, 2);
  const res = applySpoutReports(catalog, reports);
  assert.deepEqual(res.catalog.spouts['tool-a'], { teacher: 3, student: 6 });
  assert.deepEqual(res.catalog.spouts['tool-b'], { teacher: 0, student: 1 });
  assert.equal(res.added, 3);
  assert.deepEqual(res.unknownIds, ['ghost']);
  // 같은 보고를 다음에 또 붙여도 더하지 않는다
  const again = applySpoutReports(res.catalog, parseSpoutReports(r1));
  assert.equal(again.added, 0);
  assert.equal(again.skippedReports, 1);
  assert.deepEqual(again.catalog.spouts['tool-a'], { teacher: 3, student: 6 });
});

test('카드 숫자: 공개된 숫자 + 내가 누르고 아직 안 보낸 1번 (구간이 아닌 실제 숫자)', () => {
  assert.deepEqual(spoutCountsFor(catalog, 'tool-a'), { teacher: 2, student: 5 });
  assert.deepEqual(spoutCountsFor(catalog, 'tool-a', { role: 'student', sent: false }), { teacher: 2, student: 6 });
  assert.deepEqual(spoutCountsFor(catalog, 'tool-a', { role: 'student', sent: true }), { teacher: 2, student: 5 });
  assert.deepEqual(spoutCountsFor(catalog, 'tool-b'), { teacher: 0, student: 0 });
  assert.equal(spoutTotal({ teacher: 2, student: 5 }), 7);
});

test('엉뚱한 글이나 이상한 id는 무시한다', () => {
  assert.deepEqual(parseSpoutReports('그냥 글'), []);
  assert.deepEqual(parseSpoutReports('[고래곳간 물뿜기]\n교사: a'), []); // 보고 번호 없음
  const r = parseSpoutReports('[고래곳간 물뿜기]\n보고 번호: r-xx11\n교사: ok-id, <script>, ok-id\n학생: ');
  assert.deepEqual(r[0].teacher, ['ok-id']);
});

test('좋아요처럼 취소: 보내기 전에는 지울 수 있고, 보낸 뒤에는 지울 수 없다', async () => {
  const { unrecordSpout } = await import('../extension/core/spout-store.js');
  const st = createMemoryStorage();
  await recordSpout(st, 'tool-a', 'student');
  assert.equal(await unrecordSpout(st, 'tool-a'), true);
  assert.equal((await mySpouts(st))['tool-a'], undefined);
  assert.equal((await recordSpout(st, 'tool-a', 'student')).ok, true); // 취소 뒤 다시 누를 수 있다
  await markSent(st, ['tool-a']);
  assert.equal(await unrecordSpout(st, 'tool-a'), false);
  assert.equal(await unrecordSpout(st, 'nothing'), false);
});

test('나눔 곳간 작품(m-…, sample-…)의 물뿜기도 집계된다', () => {
  const rep = buildSpoutReport([{ workId: 'm-1abc', role: 'student' }, { workId: 'sample-share-bingo', role: 'teacher' }, { workId: 'ghost', role: 'student' }], { reportId: 'r-mk1' });
  const res = applySpoutReports(catalog, parseSpoutReports(rep));
  assert.deepEqual(res.catalog.spouts['m-1abc'], { teacher: 0, student: 1 });
  assert.deepEqual(res.catalog.spouts['sample-share-bingo'], { teacher: 1, student: 0 });
  assert.deepEqual(res.unknownIds, ['ghost']);
});
