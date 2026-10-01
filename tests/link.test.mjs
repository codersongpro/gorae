// 7단계: 바로 실행 링크 — AC-013(핵심 부분)·AC-014
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { buildViewerLink, readViewerFragment, MAX_LINK_CHARS } from '../shared/link.js';

const VIEWER = 'https://example.github.io/gorae/viewer.html';
const small = { id: 'w1', title: '분수 피자', type: 'html', html: '<p>안녕 🍕</p>', grade: '초4', subject: '수학', howToUse: '눌러 보세요' };
const hashOf = (url) => url.slice(url.indexOf('#'));

test('작은 작품은 링크로 만들고, 주소의 # 뒤에만 작품이 들어간다', async () => {
  const r = await buildViewerLink(small, VIEWER);
  assert.equal(r.ok, true);
  assert.ok(r.url.startsWith(VIEWER + '#g1.'));
  assert.ok(!r.url.split('#')[0].includes('%') && r.url.split('#')[0] === VIEWER); // 서버로 가는 부분엔 작품 없음
  assert.ok(r.length <= MAX_LINK_CHARS);
});

test('링크에서 읽은 작품은 원본과 같다 (한글·이모지 포함)', async () => {
  const r = await buildViewerLink(small, VIEWER);
  const back = await readViewerFragment(hashOf(r.url));
  assert.equal(back.ok, true);
  assert.deepEqual(back.work, small);
});

test('AC-014 압축 후 16,000자를 넘는 작품은 링크로 만들지 않는다', async () => {
  // 무작위 문자열은 압축이 잘 안 되므로 확실히 큰 작품이 된다
  const noise = Array.from({ length: 30000 }, () => Math.random().toString(36).slice(2, 4)).join('');
  const r = await buildViewerLink({ ...small, html: `<p>${noise}</p>` }, VIEWER);
  assert.deepEqual([r.ok, r.reason], [false, 'TOO_BIG']);
});

test('깨진 링크·엉뚱한 데이터는 안전하게 거부한다', async () => {
  assert.equal((await readViewerFragment('')).reason, 'NO_DATA');
  assert.equal((await readViewerFragment('#abc')).reason, 'NO_DATA');
  assert.equal((await readViewerFragment('#g1.!!!')).reason, 'BROKEN');
  assert.equal((await readViewerFragment('#g1.AAAA')).reason, 'BROKEN');
  const bad = await buildViewerLink({ id: 'x', title: 'x', type: 'url', url: 'http://evil.test' }, VIEWER);
  assert.equal((await readViewerFragment(hashOf(bad.url))).reason, 'INVALID'); // http 주소 거부
});

test('압축 폭탄(아주 크게 펴지는 데이터)은 읽지 않는다', async () => {
  const bomb = { ...small, html: 'a'.repeat(5 * 1024 * 1024) }; // 5MB지만 압축하면 아주 작다
  const r = await buildViewerLink(bomb, VIEWER);
  assert.equal(r.ok, true);
  assert.equal((await readViewerFragment(hashOf(r.url))).ok, false);
});

test('AC-013 링크로 받은 서명된 작품도 검수 서명 검증을 통과하고, 고치면 실패한다', async () => {
  const root = await tp.generateKeyPair({ extractable: true });
  const guard = await tp.generateKeyPair();
  const list = await tp.signReviewerList(
    { version: 1, issuedAt: '2026-10-01T00:00:00Z', reviewers: [{ id: 'g1', nickname: '푸른물결', publicKey: await tp.exportPublicJwk(guard.publicKey), addedAt: '2026-10-01T00:00:00Z' }], revoked: [] },
    root.privateKey,
  );
  const verifier = await tp.createVerifier({ rootPublicJwk: await tp.exportPublicJwk(root.publicKey), list });
  const signed = await tp.signWork(small, guard.privateKey, { reviewer: 'g1', badge: 'clear' });
  const link = await buildViewerLink(signed, VIEWER);
  const got = await readViewerFragment(hashOf(link.url));
  assert.equal((await verifier.verify(got.work)).ok, true);
  const tampered = await buildViewerLink({ ...signed, html: '<p>바꿈</p>' }, VIEWER);
  const bad = await readViewerFragment(hashOf(tampered.url));
  assert.equal((await verifier.verify(bad.work)).reason, tp.REASON.CONTENT_CHANGED);
});
