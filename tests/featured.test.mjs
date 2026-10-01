// 이달의 고래자리 — FR-026, AC-031
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { signFeatured, verifyFeatured, validateFeatured, MAX_FEATURED } from '../shared/featured.js';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

async function rootKeys() {
  const kp = await tp.generateKeyPair({ extractable: true });
  return { priv: kp.privateKey, pub: await tp.exportPublicJwk(kp.publicKey) };
}

test('AC-031 대왕고래 서명이 있는 고래자리는 보이고, 목록에 없는 id는 뺀다', async () => {
  const k = await rootKeys();
  const f = await signFeatured({ month: '2026-10', title: '10월의 고래자리', note: '가을 수업 추천', items: ['a', 'c', 'gone'] }, k.priv);
  const v = await verifyFeatured(f, k.pub, items);
  assert.equal(v.ok, true);
  assert.deepEqual(v.items, ['a', 'c']);
  assert.equal(v.note, '가을 수업 추천');
});

test('AC-031 서명이 틀리면(목록·문구를 고치거나 다른 열쇠) 띠를 숨긴다', async () => {
  const k = await rootKeys();
  const other = await rootKeys();
  const f = await signFeatured({ month: '2026-10', items: ['a'] }, k.priv);
  assert.equal((await verifyFeatured({ ...f, items: ['a', 'b'] }, k.pub, items)).reason, 'INVALID');
  assert.equal((await verifyFeatured({ ...f, note: '바꿈' }, k.pub, items)).reason, 'INVALID');
  assert.equal((await verifyFeatured(f, other.pub, items)).reason, 'INVALID');
  assert.equal((await verifyFeatured({ ...f, sig: '!!' }, k.pub, items)).reason, 'INVALID');
  assert.equal((await verifyFeatured(null, k.pub, items)).reason, 'NONE');
});

test('달 형식과 개수 제한', () => {
  assert.equal(validateFeatured({ month: '2026-13', items: ['a'] }).length, 1);
  assert.equal(validateFeatured({ month: '2026-10', items: [] }).length, 1);
  assert.equal(validateFeatured({ month: '2026-10', items: Array.from({ length: MAX_FEATURED + 1 }, (_, i) => 'x' + i) }).length, 1);
  assert.equal(validateFeatured({ month: '2026-10', items: ['a'] }).length, 0);
});
