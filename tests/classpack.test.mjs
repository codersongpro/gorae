// 학급 꾸러미 + 웨일 클래스 공지 문구 — AC-016
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { parsePack } from '../shared/pack.js';
import { buildClassBundle, LONG_TEXT_CHARS } from '../extension/core/classpack.js';
import { previewImport } from '../extension/core/bundle.js';
import { createWork } from '../extension/core/work.js';

const mk = (title, extra = {}) =>
  createWork({ type: 'html', html: '<p>a</p>', grade: '초4', subject: '수학', howToUse: '해 보세요', author: '푸른 고래 · 초등', title, ...extra }, { idGen: () => title });
const rec = (w) => ({ id: w.id, work: w, source: 'maker' });
const verifyNone = async (works) => works.map((work) => ({ work, status: { ok: false, reason: tp.REASON.NO_TAILPRINT } }));

test('AC-016 작품 2개를 골라 학급 꾸러미를 만들면 꾸러미와 공지 문구가 함께 나온다', () => {
  const a = mk('분수 피자');
  const b = mk('구구단');
  const c = mk('안 고른 작품');
  const out = buildClassBundle([rec(a), rec(b), rec(c)], [a.id, b.id], { name: '4학년 3반', teacherNote: '이번 주 수학 시간에 해 보세요.' });
  assert.equal(out.ok, true);
  assert.equal(out.count, 2);
  assert.match(out.fileName, /^4학년_3반\.gorae\.json$/);
  assert.match(out.notice, /\[고래곳간 꾸러미\] 4학년 3반/);
  assert.match(out.notice, /1\. 분수 피자 \(초4·수학\)/);
  assert.match(out.notice, /\[가져오기\]/); // 학생용 받는 방법
  assert.match(out.notice, /이번 주 수학 시간에/);
  assert.ok(!out.notice.includes('안 고른 작품'));
  assert.ok(out.combined.includes(out.notice) && out.combined.includes(out.packText));
  assert.equal(parsePack(out.packText).pack.items.length, 2);
});

test('10개를 넘기거나 하나도 안 고르면 거부한다', () => {
  const works = Array.from({ length: 11 }, (_, i) => mk('w' + i));
  const records = works.map(rec);
  assert.deepEqual(buildClassBundle(records, works.map((w) => w.id), { name: 'x' }), { ok: false, error: 'TOO_MANY' });
  assert.deepEqual(buildClassBundle(records, [], { name: 'x' }), { ok: false, error: 'NONE' });
});

test('공지 글과 함께 통째로 붙여 넣어도 학생이 가져올 수 있다', async () => {
  const a = mk('분수 피자');
  const out = buildClassBundle([rec(a)], [a.id], { name: '반 꾸러미' });
  const prev = await previewImport('앞뒤에 다른 글이 있어도\n' + out.combined + '\n\n끝.', { verifyWorks: verifyNone, existingIds: new Set() });
  assert.equal(prev.ok, true);
  assert.equal(prev.items[0].work.id, a.id);
  // 파일 그대로(순수 JSON)도 여전히 읽힌다
  assert.equal((await previewImport(out.packText, { verifyWorks: verifyNone, existingIds: new Set() })).ok, true);
});

test('공지가 너무 길면 파일 첨부를 권하는 표시가 켜진다', () => {
  const big = mk('큰 작품', { html: '<p>' + 'a'.repeat(LONG_TEXT_CHARS) + '</p>' });
  assert.equal(buildClassBundle([rec(big)], [big.id], { name: 'x' }).tooLong, true);
  const small = mk('작은 작품');
  assert.equal(buildClassBundle([rec(small)], [small.id], { name: 'x' }).tooLong, false);
});

test('서명된 작품의 검수 서명이 학급 꾸러미에도 그대로 담긴다', async () => {
  const guard = await tp.generateKeyPair();
  const signed = await tp.signWork(mk('서명작품'), guard.privateKey, { reviewer: 'g1', badge: 'clear' });
  const out = buildClassBundle([rec(signed)], [signed.id], { name: 'x' });
  assert.ok(parsePack(out.packText).pack.items[0].tailprint.sig);
});
