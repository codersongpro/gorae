// 웨일 스페이스 공유 묶음(클래스·팀보드·일반)과 서비스 판별
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShare, SHARE_KINDS } from '../extension/core/share.js';
import { detectService, orderShareKinds } from '../extension/core/services.js';
import { remixInput } from '../extension/core/remix.js';
import { createWork } from '../extension/core/work.js';

const work = {
  id: 'w1', title: '분수 피자 게임', type: 'html', grade: '초4', subject: '수학', standard: '[4수01-12]',
  author: '파란고래 · 초등', howToUse: '피자 조각을 눌러 분수를 만들어 보세요.', promptRecipe: '피자 나누기 게임을 만들어 줘', version: 2, minutes: 5,
};
const LINK = 'https://example.github.io/gorae/viewer.html#g1.AAAA';

test('클래스용 안내: 제목·설명·시간·성취기준·바로 실행 링크가 한 번에 붙는다', () => {
  const { text } = buildShare('class', work, { link: LINK });
  const lines = text.split('\n');
  assert.equal(lines[0], '🐋 분수 피자 게임');
  assert.ok(text.includes('초4 · 수학'));
  assert.ok(text.includes('피자 조각을 눌러 분수를 만들어 보세요.'));
  assert.ok(text.includes('약 5분 동안 활동합니다.'));
  assert.ok(text.includes('성취기준: [4수01-12]'));
  assert.ok(text.includes('▶ 바로 실행\n' + LINK));
});

test('팀보드 전시 카드: 만든이는 별명·학교급만, 리믹스 안내가 있다', () => {
  const { text } = buildShare('teamboard', work, { link: LINK });
  assert.ok(text.includes('작품명: 분수 피자 게임'));
  assert.ok(text.includes('만든이: 파란고래 · 초등'));
  assert.ok(text.includes('▶ 바로 실행\n' + LINK));
  assert.ok(text.includes('이 작품을 리믹스해 보세요'));
});

test('링크를 못 만든 큰 작품은 꾸러미 파일 안내로 바뀐다', () => {
  for (const kind of SHARE_KINDS) {
    const { text, link } = buildShare(kind, work, { link: null });
    assert.equal(link, null);
    assert.ok(text.includes('꾸러미(.gorae.json) 파일'), kind);
    assert.ok(!text.includes('https://'), kind);
  }
});

test('명단·댓글·평가 같은 개인정보 항목은 공유 묶음에 없다', () => {
  for (const kind of SHARE_KINDS) {
    const { text } = buildShare(kind, work, { link: LINK });
    assert.ok(!/학생 이름|명단|점수|성적/.test(text), kind);
  }
});

test('리믹스 작품은 계보 문구가 보이고 원본 정보를 그대로 쓴다', () => {
  const input = { ...remixInput(work), author: '새고래 · 초등' };
  assert.equal(input.remixOfTitle, '분수 피자 게임');
  const remixed = createWork(input);
  assert.equal(remixed.remixOfTitle, '분수 피자 게임');
  assert.ok(buildShare('class', remixed, { link: LINK }).text.includes('‘분수 피자 게임’을(를) 리믹스한 작품'));
});

test('도메인으로 웨일 서비스를 알아본다 (확인된 도메인만, https만)', () => {
  assert.equal(detectService('https://class.whalespace.io/c/123'), 'class');
  assert.equal(detectService('https://teamboard.whale.naver.com/b/1'), 'teamboard');
  assert.equal(detectService('https://teamboard.whalespace.io/'), 'teamboard');
  assert.equal(detectService('https://ubt.whalespace.io/exam'), null); // UBT 연계는 하지 않는다
  assert.equal(detectService('https://study.whaleon.naver.com/'), 'remote');
  for (const no of ['http://class.whalespace.io', 'https://class.whalespace.io.evil.test/', 'https://evil.test/class.whalespace.io', 'https://example.com', 'chrome://x', '', undefined]) {
    assert.equal(detectService(no), null, String(no));
  }
});

test('지금 서비스에 맞는 공유 버튼이 맨 앞에 온다', () => {
  assert.deepEqual(orderShareKinds('class'), ['class', 'teamboard', 'space']);
  assert.deepEqual(orderShareKinds('teamboard'), ['teamboard', 'class', 'space']);
  assert.deepEqual(orderShareKinds(null), SHARE_KINDS);
  assert.deepEqual(orderShareKinds('remote'), SHARE_KINDS);
});


test('링크가 너무 길면 글에 넣지 않고 파일 첨부를 안내한다 (클래스·팀보드·스페이스)', () => {
  const long = 'https://example.com/v#' + 'a'.repeat(400);
  for (const kind of ['class', 'teamboard', 'space']) {
    const { text } = buildShare(kind, work, { link: long });
    assert.ok(!text.includes('aaaa'), kind);
    assert.ok(text.includes('파일을 첨부했어요'), kind);
  }
});
