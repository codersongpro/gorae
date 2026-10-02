// 6단계: 검수 도구 핵심 — AC-020·021·027·028, 고래 노래, 열쇠 백업, 고래 족보 관리
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { encryptJwk, decryptJwk, checkPassword } from '../shared/keybackup.js';
import { signForCatalog, validateExeItem, validateSongs, addReviewer, revokeReviewer, signList, emptyList, upsertCatalogItem, MAX_SONG_CHARS } from '../shared/review.js';
import { parsePack } from '../shared/pack.js';
import { extractPackText } from '../shared/pack.js';

const work = { id: 'w1', title: '분수 피자', type: 'html', html: '<p>a</p>', grade: '초4', subject: '수학', howToUse: '해 보세요', author: '푸른 고래 · 초등', version: 1 };

async function world() {
  const root = await tp.generateKeyPair({ extractable: true });
  const guard = await tp.generateKeyPair();
  const rootJwk = await tp.exportPublicJwk(root.publicKey);
  let body = addReviewer(emptyList(new Date('2026-10-01')), { id: 'g1', nickname: '푸른물결', publicKey: await tp.exportPublicJwk(guard.publicKey) }, new Date('2026-10-01'));
  const list = await signList(body, root.privateKey);
  return { root, guard, rootJwk, list };
}
const verifierOf = (w, list = w.list, last = 0) => tp.createVerifier({ rootPublicJwk: w.rootJwk, list, lastSeenVersion: last });

test('AC-020 족보에 등록된 파수꾼고래가 맑은 바다+고래 픽을 찍으면 검증되는 catalog 항목이 나온다', async () => {
  const w = await world();
  const res = await signForCatalog({ work, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'clear', pick: true, songs: [{ text: '4학년 분수 도입에 10분, 반응 최고', author: '노을 고래 · 초등', date: '2026-10-02' }] });
  assert.equal(res.ok, true);
  const v = await (await verifierOf(w)).verify(res.item);
  assert.equal(v.ok, true);
  assert.deepEqual([v.badge, v.pick, v.songs.length], ['clear', true, 1]);
});

test('들어온 작품에 붙어 있던 남의 서명은 버리고 새로 찍는다', async () => {
  const w = await world();
  const stranger = await tp.generateKeyPair();
  const forged = await tp.signWork(work, stranger.privateKey, { reviewer: 'evil', badge: 'clear' });
  const res = await signForCatalog({ work: forged, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'shallow' });
  assert.equal(res.item.tailprint.reviewer, 'g1');
  assert.equal(res.item.tailprint.badge, 'shallow');
  assert.equal((await (await verifierOf(w)).verify(res.item)).ok, true);
});

test('배지·열쇠가 없거나 고래 노래가 80자를 넘으면 서명하지 않는다', async () => {
  const w = await world();
  assert.equal((await signForCatalog({ work, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'great' })).ok, false);
  assert.equal((await signForCatalog({ work, privateKey: null, reviewerId: 'g1', badge: 'clear' })).ok, false);
  const long = [{ text: '가'.repeat(MAX_SONG_CHARS + 1), author: 'a · 초등' }];
  assert.equal((await signForCatalog({ work, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'clear', songs: long })).ok, false);
  assert.equal(validateSongs([{ text: '가'.repeat(MAX_SONG_CHARS), author: 'a · 초등' }]).length, 0);
  assert.equal(validateSongs([{ text: '좋아요', author: '' }]).length, 1);
});

test('AC-021 해시 등 필수 항목이 빠진 exe 항목은 서명을 거부한다', async () => {
  const w = await world();
  const exe = { id: 'x1', title: '도구', type: 'exe-link', url: 'https://example.com/a.exe', sourceRepo: 'https://example.com/src', sha256: 'a'.repeat(64), scanResult: '통과', environment: 'Windows 10', version: 1 };
  assert.equal(validateExeItem(exe).ok, true);
  const noHash = { ...exe, sha256: '' };
  const res = await signForCatalog({ work: noHash, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'shallow' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('SHA-256')));
  assert.equal(validateExeItem({ ...exe, url: 'http://x.test/a.exe' }).ok, false);
  assert.equal(validateExeItem({ ...exe, sha256: 'zz' }).ok, false);
  const ok = await signForCatalog({ work: exe, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'shallow' });
  assert.equal(ok.ok, true);
  assert.equal((await (await verifierOf(w)).verify(ok.item)).ok, true);
});

test('AC-027 열쇠 백업: 암호로만 풀리고 틀린 암호는 거부, 되살린 열쇠로 서명이 된다', async () => {
  const kp = await tp.generateKeyPair({ extractable: true });
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const backup = await encryptJwk(jwk, 'correct-horse-9');
  assert.ok(!JSON.stringify(backup).includes(jwk.d)); // 평문 개인 열쇠가 파일에 없다
  await assert.rejects(() => decryptJwk(backup, 'wrong-password'), /BAD_PASSWORD/);
  await assert.rejects(() => decryptJwk({ format: 'x' }, 'correct-horse-9'), /BAD_BACKUP/);
  const back = await decryptJwk(backup, 'correct-horse-9');
  const key = await tp.importPrivateJwk(back); // 꺼낼 수 없는 형태로 가져온다
  await assert.rejects(() => crypto.subtle.exportKey('jwk', key));
  const signed = await tp.signWork(work, key, { reviewer: 'g1', badge: 'clear' });
  assert.ok(signed.tailprint.sig);
  assert.equal(checkPassword('짧음').ok, false);
  await assert.rejects(() => encryptJwk(jwk, '1234'));
});

test('고래 족보 관리: 파수꾼고래를 추가하면 버전이 올라가고 서명이 유효하다 (AC-028 연계)', async () => {
  const w = await world();
  const other = await tp.generateKeyPair();
  const body = addReviewer(w.list, { id: 'g2', nickname: '새벽고래', publicKey: await tp.exportPublicJwk(other.publicKey) });
  assert.equal(body.version, 2);
  assert.equal(body.rootSig, undefined);
  const v2 = await signList(body, w.root.privateKey);
  assert.equal((await tp.verifyReviewerList(v2, w.rootJwk, 1)).ok, true);
  // 이미 2를 본 확장앱에 1을 주면 거부
  assert.equal((await tp.verifyReviewerList(w.list, w.rootJwk, 2)).reason, tp.REASON.LIST_OLD);
  assert.throws(() => addReviewer(w.list, { id: 'g1', nickname: 'x', publicKey: w.list.reviewers[0].publicKey }), /이미 등록/);
  assert.throws(() => addReviewer(w.list, { id: 'g3', nickname: 'x', publicKey: { kty: 'EC', crv: 'P-256', x: 'a', y: 'b', d: 'SECRET' } }), /개인 열쇠/);
});

test('AC-029 파수꾼고래 말소: 분실은 모두 무효, 탈퇴는 말소 이후 서명만 무효', async () => {
  const w = await world();
  const oldSig = (await signForCatalog({ work, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'clear', signedAt: '2026-10-02T00:00:00Z' })).item;
  const lostList = await signList(revokeReviewer(w.list, 'g1', 'lost', new Date('2026-10-05')), w.root.privateKey);
  assert.equal((await (await verifierOf(w, lostList)).verify(oldSig)).reason, tp.REASON.REVIEWER_REVOKED);
  const leftList = await signList(revokeReviewer(w.list, 'g1', 'left', new Date('2026-10-05')), w.root.privateKey);
  assert.equal((await (await verifierOf(w, leftList)).verify(oldSig)).ok, true);
  const lateSig = (await signForCatalog({ work, privateKey: w.guard.privateKey, reviewerId: 'g1', badge: 'clear', signedAt: '2026-10-06T00:00:00Z' })).item;
  assert.equal((await (await verifierOf(w, leftList)).verify(lateSig)).reason, tp.REASON.REVIEWER_REVOKED);
  assert.throws(() => revokeReviewer(w.list, 'nobody', 'left'), /족보에 없는/);
  assert.throws(() => revokeReviewer(w.list, 'g1', 'whatever'), /사유/);
});

test('catalog에 항목을 넣으면 같은 id는 교체되고 exe는 exeItems로 간다', () => {
  const cat = { updatedAt: 'x', items: [{ id: 'a', v: 1 }], exeItems: [] };
  const c2 = upsertCatalogItem(cat, { id: 'a', v: 2, type: 'html' });
  assert.deepEqual(c2.items, [{ id: 'a', v: 2, type: 'html' }]);
  assert.equal(upsertCatalogItem(c2, { id: 'e', type: 'exe-link' }).exeItems.length, 1);
});

test('폼 응답 글(안내 문구 + 꾸러미)에서 꾸러미를 뽑아 검수대로 가져온다', () => {
  const pack = JSON.stringify({ format: 'gorae-pack', formatVersion: 1, name: 'x', createdAt: 'x', items: [work] });
  const pasted = `[고래곳간 큰 곳간 추천]\n종류: 작품\n별명: 푸른 고래 · 초등\n\n${pack}\n개인정보 미포함 확인: 예`;
  const r = parsePack(extractPackText(pasted));
  assert.equal(r.ok, true);
  assert.equal(r.pack.items[0].id, 'w1');
});
