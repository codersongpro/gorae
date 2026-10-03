// 실행 관문: HTML·URL 작품 모두 같은 검사를 거친다 (소용돌이 차단, https, 외부 사이트 안내)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tp from '../shared/tailprint.js';
import { canRun, describeExternalOpen } from '../extension/core/runner.js';

const okStatus = (badge) => ({ ok: true, badge, pick: false, songs: [], reviewer: { id: 'g1', nickname: 'x' }, signedAt: '2026-10-01T00:00:00Z' });
const none = { ok: false, reason: tp.REASON.NO_TAILPRINT };
const html = { id: 'a', type: 'html', html: '<p>a</p>' };
const url = (u) => ({ id: 'b', type: 'url', url: u });

test('검증된 소용돌이(보류) 작품은 HTML·URL 모두 실행되지 않는다', () => {
  assert.deepEqual(canRun({ work: html, status: okStatus('whirlpool') }), { ok: false, reason: 'WHIRLPOOL' });
  assert.deepEqual(canRun({ work: url('https://example.com/x'), status: okStatus('whirlpool') }), { ok: false, reason: 'WHIRLPOOL' });
});

test('URL 작품은 https만 통과하고 http·javascript·잘못된 주소는 막는다', () => {
  for (const bad of ['http://example.com', 'javascript:alert(1)', 'data:text/html,hi', 'file:///c:/a.html', '아무말', '', undefined]) {
    assert.deepEqual(canRun({ work: url(bad), status: none }), { ok: false, reason: 'NOT_HTTPS' }, String(bad));
  }
  const r = canRun({ work: url('https://example.com/play?a=1'), status: none });
  assert.deepEqual([r.ok, r.kind, r.host], [true, 'url', 'example.com']);
});

test('URL 작품은 바로 열지 않고 외부 사이트 확인 정보를 먼저 돌려준다', () => {
  const info = describeExternalOpen({ work: url('https://example.com/play'), status: none });
  assert.deepEqual(info, { id: 'b', host: 'example.com', url: 'https://example.com/play', verified: false, badge: 'shallow' });
  assert.equal(describeExternalOpen({ work: html, status: none }), null);
  assert.equal(describeExternalOpen({ work: url('http://example.com'), status: none }), null);
  assert.equal(describeExternalOpen({ work: url('https://example.com'), status: okStatus('whirlpool') }), null);
});

test('검수 서명이 없거나 깨져 소용돌이 배지가 표시되지 않으면 일반 규칙을 따른다', () => {
  // 서명 없이 whirlpool이라고 주장해도 배지는 인정되지 않는다 (displayBadge=shallow)
  assert.equal(canRun({ work: { ...html, badge: 'whirlpool' }, status: none }).ok, true);
});

test('HTML이 비었거나 exe-link 같은 지원하지 않는 종류는 실행하지 않는다', () => {
  assert.deepEqual(canRun({ work: { id: 'c', type: 'html', html: '' }, status: none }), { ok: false, reason: 'NOT_HTML' });
  assert.deepEqual(canRun({ work: { id: 'd', type: 'exe-link', url: 'https://x.test/a.exe' }, status: none }), { ok: false, reason: 'UNSUPPORTED' });
  assert.deepEqual(canRun({ work: html, status: none }), { ok: true, kind: 'html' });
});
