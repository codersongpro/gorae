// 공유 글에 검수 상태가 따라가는지 (클래스·팀보드·웨일온), 보류 작품 공유 차단, UBT 평가용 정보
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildShare, buildAssessmentText, SHARE_KINDS, shareBlocked } from '../extension/core/share.js';
import { buildClassBundle } from '../extension/core/classpack.js';
import { buildEntries, resolveTrustedList } from '../extension/core/trust.js';
import { createMemoryStorage } from '../extension/core/storage.js';
import { ROOT_PUBLIC_JWK } from '../extension/core/rootkey.js';
import { remixInput } from '../extension/core/remix.js';
import { createWork } from '../extension/core/work.js';

const data = (f) => readFile(new URL(`./data/${f}`, import.meta.url), 'utf8').then(JSON.parse);
const catalog = await data('catalog.json');
const list = await data('reviewers.json');
const storage = createMemoryStorage();
await resolveTrustedList({ candidate: list, storage, rootJwk: ROOT_PUBLIC_JWK });
const verify = (works) => buildEntries({ works, list, storage, rootJwk: ROOT_PUBLIC_JWK });
const [pizza] = await verify([catalog.items.find((w) => w.id === 'sample-fraction-pizza')]);
const [unreviewed] = await verify([catalog.items.find((w) => !w.tailprint)]);
const LINK = 'https://codersongpro.github.io/gorae/viewer.html?id=sample-fraction-pizza';

test('검수된 작품: 클래스 공유 글에 제목·학년교과·시간·검수 상태·파수꾼고래·실행 링크가 순서대로 들어간다', () => {
  assert.equal(pizza.status.ok, true);
  const { text } = buildShare('class', pizza.work, { link: LINK, status: pizza.status });
  const parts = text.split('\n\n');
  assert.ok(parts[0].startsWith('🐋 '));
  assert.ok(parts[1].includes('초4 · 수학'));
  assert.ok(/약 \d+분 동안 활동합니다\./.test(parts[1]));
  assert.equal(parts[2], `🟢 맑은 바다\n검수 서명 확인됨 · 파수꾼고래 ${pizza.status.reviewer.nickname}`);
  assert.equal(parts[3], `▶ 바로 실행\n${LINK}`);
});

test('팀보드·웨일온 공유 글에도 검수 상태가 들어간다', () => {
  for (const kind of SHARE_KINDS) {
    const { text } = buildShare(kind, pizza.work, { link: LINK, status: pizza.status });
    assert.ok(text.includes('🟢 맑은 바다\n검수 서명 확인됨'), kind);
  }
});

test('미검수 작품은 모든 공유 글에 미검수 안내가 들어간다', () => {
  for (const kind of SHARE_KINDS) {
    const { text } = buildShare(kind, unreviewed.work, { link: LINK, status: unreviewed.status });
    assert.ok(text.includes('🟡 아직 검수되지 않은 작품입니다.\n교사가 먼저 확인한 뒤 사용해 주세요.'), kind);
    assert.ok(!text.includes('맑은 바다'), kind);
  }
  // 상태 정보가 아예 없으면(예전 호출) 미검수로 본다
  assert.ok(buildShare('class', unreviewed.work, { link: LINK }).text.includes('아직 검수되지 않은 작품'));
});

test('서명 뒤 내용이 바뀐 작품은 검수 표시 없이 "내용이 바뀌었다"는 안내가 들어간다', async () => {
  const [tampered] = await verify([{ ...pizza.work, html: pizza.work.html + '<!-- 몰래 바꿈 -->' }]);
  assert.equal(tampered.status.reason, 'CONTENT_CHANGED');
  const { text } = buildShare('teamboard', tampered.work, { link: LINK, status: tampered.status });
  assert.ok(text.includes('아직 검수되지 않은 작품'));
  assert.ok(text.includes('서명 뒤 내용이 바뀌어'));
  assert.ok(!text.includes('맑은 바다'));
});

test('소용돌이(보류) 작품은 공유 글을 만들지 않는다 (클래스·팀보드·웨일온·학급 꾸러미·UBT)', () => {
  const status = { ok: true, badge: 'whirlpool', reviewer: { nickname: '푸른물결' }, pick: false, songs: [] };
  assert.equal(shareBlocked(status), true);
  for (const kind of SHARE_KINDS) assert.deepEqual(buildShare(kind, pizza.work, { link: LINK, status }), { kind, text: null, link: null, blocked: 'WHIRLPOOL' });
  assert.equal(buildAssessmentText(pizza.work, { link: LINK, status }).blocked, 'WHIRLPOOL');
  const rec = { id: pizza.work.id, work: pizza.work };
  assert.deepEqual(buildClassBundle([rec], [rec.id], { name: 'x', statuses: new Map([[rec.id, status]]) }), { ok: false, error: 'WHIRLPOOL' });
});

test('학급 꾸러미 과제 글에도 작품마다 검수 상태가 붙는다', () => {
  const recs = [pizza, unreviewed].map((e) => ({ id: e.work.id, work: e.work }));
  const statuses = new Map([pizza, unreviewed].map((e) => [e.work.id, e.status]));
  const out = buildClassBundle(recs, recs.map((r) => r.id), { name: '4학년 3반', statuses });
  assert.ok(out.assignment.includes('🟢 맑은 바다 · 검수 서명 확인됨'));
  assert.ok(out.assignment.includes('🟡 미검수 · 교사가 먼저 확인해 주세요'));
});

test('UBT 평가용 정보: 작품·교과·성취기준·실행 링크·버전·원작·레시피를 담고 자동 제출이 아님을 밝힌다', () => {
  const input = { ...remixInput(pizza.work), author: '새고래 · 초등', promptRecipe: '분수 퀴즈로 바꿔 줘' };
  const remix = { ...createWork(input), version: 3 };
  const [e] = [{ work: remix, status: { ok: false, reason: 'NO_TAILPRINT' } }];
  const { text } = buildAssessmentText(e.work, { link: 'https://x.example/viewer.html#g1.AAAA', status: e.status });
  for (const part of ['[고래곳간 수행평가 결과물]', `작품명: ${remix.title}`, '학교급: 초등', '학년: 4', '교과: 수학', '작품 실행:\nhttps://x.example/viewer.html#g1.AAAA',
    '버전: 3', '리믹스 여부: 있음', `원작: ${pizza.work.title}`, '프롬프트 레시피:\n분수 퀴즈로 바꿔 줘', '🟡 미검수', '자동으로 제출·채점되지 않습니다']) {
    assert.ok(text.includes(part), part);
  }
  if (pizza.work.standard) assert.ok(text.includes(`성취기준: ${pizza.work.standard}`));
  // 원작(리믹스 아님)은 리믹스 여부 없음, 검수 상태 표시
  const orig = buildAssessmentText(pizza.work, { link: LINK, status: pizza.status }).text;
  assert.ok(orig.includes('리믹스 여부: 없음'));
  assert.ok(orig.includes('🟢 맑은 바다 · 검수 서명 확인됨'));
  assert.ok(!/학생 이름|이메일|전화/.test(orig));
});
