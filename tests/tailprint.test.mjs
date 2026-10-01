// 4단계: 꼬리지문 핵심 모듈 — AC-024~029
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { resolveTrustedList } from '../extension/core/trust.js';
import { createMemoryStorage } from '../extension/core/storage.js';

const work = { id: 'w1', title: '테스트 작품', type: 'html', html: '<p>안녕</p>', grade: '초4', subject: '수학' };

async function setup({ revoked = [], version = 1 } = {}) {
  const root = await tp.generateKeyPair({ extractable: true });
  const guard = await tp.generateKeyPair();
  const rootJwk = await tp.exportPublicJwk(root.publicKey);
  const list = await tp.signReviewerList(
    {
      version,
      issuedAt: '2026-10-01T00:00:00Z',
      reviewers: [{ id: 'g1', nickname: '푸른물결', publicKey: await tp.exportPublicJwk(guard.publicKey), addedAt: '2026-10-01T00:00:00Z' }],
      revoked,
    },
    root.privateKey,
  );
  return { root, guard, rootJwk, list };
}
const sign = (s, w = work, o = {}) => tp.signWork(w, s.guard.privateKey, { reviewer: 'g1', badge: 'clear', pick: true, signedAt: '2026-10-02T00:00:00Z', ...o });
const verifier = (s, list = s.list, lastSeen = 0) => tp.createVerifier({ rootPublicJwk: s.rootJwk, list, lastSeenVersion: lastSeen });

test('정상 서명은 3단계를 모두 통과한다', async () => {
  const s = await setup();
  const r = await (await verifier(s)).verify(await sign(s));
  assert.equal(r.ok, true);
  assert.equal(r.badge, 'clear');
  assert.equal(r.pick, true);
  assert.equal(r.reviewer.nickname, '푸른물결');
});

test('AC-024 서명 없이 badge만 clear로 고치면 꼬리지문 없음', async () => {
  const s = await setup();
  const r = await (await verifier(s)).verify({ ...work, badge: 'clear' });
  assert.deepEqual([r.ok, r.reason], [false, tp.REASON.NO_TAILPRINT]);
});

test('AC-024 서명된 작품의 배지·고래 픽·노래를 고치면 서명 불일치', async () => {
  const s = await setup();
  const v = await verifier(s);
  const signed = await sign(s, work, { badge: 'shallow', pick: false });
  for (const patch of [{ badge: 'clear' }, { pick: true }, { songs: [{ text: '가짜' }] }]) {
    const r = await v.verify({ ...signed, tailprint: { ...signed.tailprint, ...patch } });
    assert.deepEqual([r.ok, r.reason], [false, tp.REASON.SIG_INVALID], JSON.stringify(patch));
  }
});

test('AC-025 서명 뒤 HTML을 한 글자 고치면 내용 변경', async () => {
  const s = await setup();
  const signed = await sign(s);
  const r = await (await verifier(s)).verify({ ...signed, html: '<p>안녕!</p>' });
  assert.deepEqual([r.ok, r.reason], [false, tp.REASON.CONTENT_CHANGED]);
});

test('AC-026 족보에 없는 열쇠의 서명은 거부', async () => {
  const s = await setup();
  const stranger = await tp.generateKeyPair();
  const signed = await tp.signWork(work, stranger.privateKey, { reviewer: 'stranger', badge: 'clear' });
  assert.equal((await (await verifier(s)).verify(signed)).reason, tp.REASON.REVIEWER_UNKNOWN);
  // 등록된 id를 사칭해도 열쇠가 다르면 거부
  const forged = await tp.signWork(work, stranger.privateKey, { reviewer: 'g1', badge: 'clear' });
  assert.equal((await (await verifier(s)).verify(forged)).reason, tp.REASON.SIG_INVALID);
});

test('족보를 고치면(파수꾼 추가 등) 대왕고래 서명이 깨진다', async () => {
  const s = await setup();
  const evil = await tp.generateKeyPair();
  const tampered = { ...s.list, reviewers: [...s.list.reviewers, { id: 'evil', nickname: '가짜', publicKey: await tp.exportPublicJwk(evil.publicKey), addedAt: '2026-10-01T00:00:00Z' }] };
  const signed = await tp.signWork(work, evil.privateKey, { reviewer: 'evil', badge: 'clear' });
  const r = await (await verifier(s, tampered)).verify(signed);
  assert.deepEqual([r.ok, r.reason], [false, tp.REASON.LIST_INVALID]);
});

test('AC-027 개인 열쇠는 꺼낼 수 없고 공개키만 내보낼 수 있다', async () => {
  const kp = await tp.generateKeyPair();
  await assert.rejects(() => crypto.subtle.exportKey('jwk', kp.privateKey));
  const pub = await tp.exportPublicJwk(kp.publicKey);
  assert.equal(pub.kty, 'EC');
  assert.equal('d' in pub, false);
});

test('AC-028 이미 본 버전보다 낮은 족보는 거부하고 기존 족보를 유지한다', async () => {
  const s = await setup({ version: 7 });
  const storage = createMemoryStorage();
  const first = await resolveTrustedList({ candidate: s.list, storage, rootJwk: s.rootJwk });
  assert.deepEqual([first.accepted, first.version], [true, 7]);
  const old = await tp.signReviewerList({ ...s.list, version: 6 }, s.root.privateKey);
  const second = await resolveTrustedList({ candidate: old, storage, rootJwk: s.rootJwk });
  assert.equal(second.accepted, false);
  assert.equal(second.reason, tp.REASON.LIST_OLD);
  assert.equal(second.list.version, 7);
  assert.equal(await storage.get('lastListVersion'), 7);
  // 같은 버전, 더 높은 버전은 통과
  assert.equal((await resolveTrustedList({ candidate: s.list, storage, rootJwk: s.rootJwk })).accepted, true);
});

test('AC-029 말소된 파수꾼의 말소 이후 서명은 무효 (사유별 규칙)', async () => {
  const left = await setup({ revoked: [{ id: 'g1', revokedAt: '2026-10-05T00:00:00Z', reason: 'left' }] });
  const vLeft = await verifier(left);
  const after = await sign(left, work, { signedAt: '2026-10-06T00:00:00Z' });
  const before = await sign(left, work, { signedAt: '2026-10-04T00:00:00Z' });
  assert.equal((await vLeft.verify(after)).reason, tp.REASON.REVIEWER_REVOKED);
  assert.equal((await vLeft.verify(before)).ok, true); // 탈퇴: 말소 이전 서명은 인정

  const lost = await setup({ revoked: [{ id: 'g1', revokedAt: '2026-10-05T00:00:00Z', reason: 'lost' }] });
  const early = await sign(lost, work, { signedAt: '2026-10-04T00:00:00Z' });
  assert.equal((await (await verifier(lost)).verify(early)).reason, tp.REASON.REVIEWER_REVOKED); // 분실·유출: 모두 무효
});

test('canonicalize는 키 순서와 무관하다', () => {
  assert.equal(tp.canonicalize({ b: 1, a: [2, { d: 1, c: 2 }] }), tp.canonicalize({ a: [2, { c: 2, d: 1 }], b: 1 }));
});

test('작품 200개 검증은 1초 이내 (비기능 요구)', async () => {
  const s = await setup();
  const v = await verifier(s);
  const signed = await sign(s);
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: 200 }, () => v.verify(signed)));
  const ms = performance.now() - t0;
  assert.ok(rs.every((r) => r.ok));
  assert.ok(ms < 1000, `200개 검증 ${ms.toFixed(0)}ms`);
});
