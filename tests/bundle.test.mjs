// 5단계: 꾸러미 내보내기·가져오기, 리믹스·버전 — AC-010~012, AC-017·018
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { parsePack, createPack } from '../shared/pack.js';
import { exportBundle, previewImport, importSelected } from '../extension/core/bundle.js';
import { remixInput, editInput, saveEdit } from '../extension/core/remix.js';
import { createWork } from '../extension/core/work.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';

const base = { type: 'html', html: '<p>a</p>', grade: '초4', subject: '수학', howToUse: '해 보세요', author: '푸른 고래 · 초등' };
const mk = (title, extra = {}) => createWork({ ...base, title, ...extra }, { idGen: () => title });

async function env() {
  const root = await tp.generateKeyPair({ extractable: true });
  const guard = await tp.generateKeyPair();
  const rootJwk = await tp.exportPublicJwk(root.publicKey);
  const list = await tp.signReviewerList(
    { version: 1, issuedAt: '2026-10-01T00:00:00Z', reviewers: [{ id: 'g1', nickname: '푸른물결', publicKey: await tp.exportPublicJwk(guard.publicKey), addedAt: '2026-10-01T00:00:00Z' }], revoked: [] },
    root.privateKey,
  );
  const verifier = await tp.createVerifier({ rootPublicJwk: rootJwk, list });
  const verifyWorks = (works) => Promise.all(works.map(async (work) => ({ work, status: await verifier.verify(work) })));
  const signed = await tp.signWork(mk('서명작품'), guard.privateKey, { reviewer: 'g1', badge: 'clear', pick: true });
  return { verifyWorks, signed };
}
const rec = (work, source = 'maker') => ({ id: work.id, work, source, importedAt: '2026-10-01T00:00:00Z', checkReport: null, favorite: false });

test('AC-010 서명된 작품 1개 포함 3개를 내보내면 3개가 저장되고 검수 서명이 따라간다', async () => {
  const { signed } = await env();
  const records = [rec(mk('일')), rec(mk('이')), rec(signed, 'catalog'), rec(mk('사'))];
  const out = exportBundle(records, [records[0].id, records[1].id, signed.id], { name: '우리 반 꾸러미' });
  assert.equal(out.count, 3);
  assert.match(out.fileName, /\.gorae\.json$/);
  const parsed = parsePack(out.text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.pack.items.length, 3);
  assert.ok(parsed.pack.items.find((w) => w.id === signed.id).tailprint.sig);
});

test('AC-010 내보낸 꾸러미를 가져오면 서명 검증이 그대로 통과한다', async () => {
  const { signed, verifyWorks } = await env();
  const text = exportBundle([rec(signed, 'catalog')], [signed.id], { name: 'x' }).text;
  const prev = await previewImport(text, { verifyWorks, existingIds: new Set() });
  assert.equal(prev.items[0].status.ok, true);
  assert.equal(prev.items[0].status.badge, 'clear');
});

test('AC-011 형식이 틀린 JSON은 거부하고 내 곳간은 그대로다', async () => {
  const { verifyWorks } = await env();
  const store = createStore(createMemoryBackend());
  const bad = ['{ 깨진', '[]', '{"format":"other"}', JSON.stringify({ format: 'gorae-pack', formatVersion: 99, items: [] }),
    JSON.stringify({ format: 'gorae-pack', formatVersion: 1, items: [] }),
    JSON.stringify({ format: 'gorae-pack', formatVersion: 1, items: [{ id: 'a', title: 'b', type: 'exe-link' }] }),
    JSON.stringify({ format: 'gorae-pack', formatVersion: 1, items: [{ id: 'a', title: 'b', type: 'url', url: 'http://x.test' }] })];
  for (const text of bad) {
    const prev = await previewImport(text, { verifyWorks, existingIds: new Set() });
    assert.equal(prev.ok, false, text.slice(0, 40));
    assert.ok(prev.errors.length >= 1);
  }
  assert.equal((await store.list()).length, 0);
});

test('꾸러미는 작품 10개까지, 11개는 만들 수도 읽을 수도 없다', () => {
  const works = Array.from({ length: 11 }, (_, i) => mk('w' + i));
  assert.throws(() => createPack({ name: 'x', items: works }));
  assert.equal(parsePack({ format: 'gorae-pack', formatVersion: 1, items: works }).errors[0].code, 'TOO_MANY');
  assert.throws(() => createPack({ name: 'x', items: [] }));
});

test('AC-012 작품 5개 꾸러미에서 2개만 고르면 2개만 담긴다', async () => {
  const { verifyWorks } = await env();
  const works = ['a', 'b', 'c', 'd', 'e'].map((t) => mk(t));
  const text = exportBundle(works.map((w) => rec(w)), works.map((w) => w.id), { name: '다섯' }).text;
  const prev = await previewImport(text, { verifyWorks, existingIds: new Set() });
  const store = createStore(createMemoryBackend());
  const res = await importSelected(prev, [works[1].id, works[3].id], store);
  assert.deepEqual([res.added, res.skipped], [2, 0]);
  const list = await store.list();
  assert.deepEqual(list.map((r) => r.work.id).sort(), [works[1].id, works[3].id].sort());
  assert.ok(list.every((r) => r.source === 'bundle'));
  // 같은 꾸러미를 다시 가져오면 중복으로 건너뛴다
  assert.equal((await importSelected(prev, [works[1].id], store)).skipped, 1);
});

test('꾸러미 안의 배지를 직접 고치면 가져올 때 배지가 사라진다 (위조 시나리오)', async () => {
  const { verifyWorks, signed } = await env();
  const forged = JSON.parse(exportBundle([rec(signed, 'catalog')], [signed.id], { name: 'x' }).text);
  forged.items[0].tailprint.badge = 'whirlpool';
  const unsignedFake = { ...mk('가짜'), badge: 'clear' };
  forged.items.push(unsignedFake);
  const prev = await previewImport(JSON.stringify(forged), { verifyWorks, existingIds: new Set() });
  assert.equal(prev.items[0].status.ok, false);
  assert.equal(prev.items[1].status.reason, tp.REASON.NO_TAILPRINT);
});

test('가져오기 미리보기에 자동 점검 결과가 붙는다', async () => {
  const { verifyWorks } = await env();
  const risky = mk('위험', { html: '<script>fetch("https://x.test")</script>' });
  const text = exportBundle([rec(risky)], [risky.id], { name: 'x' }).text;
  const prev = await previewImport(text, { verifyWorks, existingIds: new Set() });
  assert.equal(prev.items[0].report.ok, false);
});

test('AC-017 서명된 작품을 리믹스해 저장하면 remixOf가 기록되고 새 작품은 미검수', async () => {
  const { signed, verifyWorks } = await env();
  const input = { ...remixInput(signed), author: '새 고래 · 초등' };
  assert.equal(input.remixOf, signed.id);
  assert.equal(input.promptRecipe, signed.promptRecipe);
  const work = createWork(input);
  assert.equal(work.remixOf, signed.id);
  assert.equal(work.tailprint, undefined);
  const [e] = await verifyWorks([work]);
  assert.deepEqual([e.status.ok, e.status.reason], [false, tp.REASON.NO_TAILPRINT]);
});

test('AC-018 큰 곳간 작품을 수정하면 별도 사본이 생기고 원본과 배지는 그대로', async () => {
  const { signed, verifyWorks } = await env();
  const store = createStore(createMemoryBackend());
  await store.add(signed, { source: 'catalog', checkReport: null });
  const orig = await store.get(signed.id);
  const res = await saveEdit(store, orig, { ...editInput(signed), title: '내 수정본' });
  assert.equal(res.ok, true);
  assert.equal(res.separate, true);
  const list = await store.list();
  assert.equal(list.length, 2);
  const copy = list.find((r) => r.id !== signed.id).work;
  assert.equal(copy.editedFrom, signed.id);
  assert.equal(copy.version, signed.version + 1);
  assert.equal(copy.tailprint, undefined);
  const [o, c] = await verifyWorks([(await store.get(signed.id)).work, copy]);
  assert.equal(o.status.ok, true); // 원본 배지 유지
  assert.equal(c.status.ok, false); // 수정본은 미검수
});

test('FR-013 내가 만든 작품은 같은 기록에서 버전만 올라간다', async () => {
  const store = createStore(createMemoryBackend());
  const w = mk('내것');
  await store.add(w, { source: 'maker', checkReport: null });
  const res = await saveEdit(store, await store.get(w.id), { ...editInput(w), howToUse: '새 설명' });
  assert.equal(res.separate, false);
  const list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].work.version, 2);
  assert.equal(list[0].work.id, w.id);
  assert.equal(list[0].work.howToUse, '새 설명');
  // 검증 실패 시 저장하지 않는다
  const bad = await saveEdit(store, list[0], { ...editInput(w), howToUse: '' });
  assert.equal(bad.ok, false);
  assert.equal((await store.get(w.id)).work.version, 2);
});
