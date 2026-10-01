// 큰 곳간에 보내기(네이버 폼용 글) — FR-014, 고래 노래 FR-025, 검수대로 이어지는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkSubmission, buildSongSubmission, validFormUrl } from '../extension/core/submit.js';
import { parsePack, extractPackText } from '../shared/pack.js';

const work = { id: 'w1', title: '분수 피자', type: 'html', html: '<p>a</p>', grade: '초4', subject: '수학', howToUse: '해 보세요', author: '푸른 고래 · 초등', version: 1 };

test('개인정보 확인 체크 없이는 보낼 글을 만들지 않는다', () => {
  const r = buildWorkSubmission(work, { author: '푸른 고래 · 초등', privacyChecked: false });
  assert.equal(r.ok, false);
  assert.ok(r.errors[0].includes('체크'));
  assert.equal(buildSongSubmission(work, { text: '좋아요', author: 'a · 초등', privacyChecked: false }).ok, false);
});

test('작품 추천 글에는 별명·학교급과 꾸러미가 들어가고, 검수대가 그대로 읽을 수 있다', () => {
  const r = buildWorkSubmission(work, { author: '푸른 고래 · 초등', privacyChecked: true });
  assert.equal(r.ok, true);
  assert.ok(r.text.startsWith('[고래곳간 큰 곳간 추천]'));
  assert.ok(r.text.includes('별명·학교급: 푸른 고래 · 초등'));
  const back = parsePack(extractPackText(r.text));
  assert.equal(back.ok, true);
  assert.equal(back.pack.items[0].id, 'w1');
});

test('실명처럼 보이는 작성자와 빈 작성자는 막는다', () => {
  for (const author of ['홍길동', '', '   ', undefined]) {
    assert.equal(buildWorkSubmission(work, { author, privacyChecked: true }).ok, false, String(author));
  }
  assert.equal(buildWorkSubmission(work, { author: '홍길동 · 초등', privacyChecked: true }).ok, false);
});

test('exe 항목은 보낼 수 없다', () => {
  assert.equal(buildWorkSubmission({ ...work, type: 'exe-link' }, { author: '고래 · 초등', privacyChecked: true }).ok, false);
});

test('고래 노래는 80자 이하만, 글자 수로 센다', () => {
  const ok = buildSongSubmission(work, { text: '가'.repeat(80), author: '노을 고래 · 초등', privacyChecked: true });
  assert.equal(ok.ok, true);
  assert.ok(ok.text.includes('작품 id: w1'));
  const long = buildSongSubmission(work, { text: '가'.repeat(81), author: '노을 고래 · 초등', privacyChecked: true });
  assert.equal(long.ok, false);
  assert.ok(long.errors[0].includes('81자'));
  assert.equal(buildSongSubmission(work, { text: ' ', author: 'a · 초등', privacyChecked: true }).ok, false);
});

test('폼 주소는 https만 연다', () => {
  assert.equal(validFormUrl('https://naver.me/abcd'), 'https://naver.me/abcd');
  for (const bad of ['http://naver.me/a', 'javascript:alert(1)', '', undefined, '아무말']) assert.equal(validFormUrl(bad), null, String(bad));
});
