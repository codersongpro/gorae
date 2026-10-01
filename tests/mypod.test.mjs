// 3단계: 내 곳간·만들기·자동 점검 — AC-006~009
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHtml, looksLikeRealName } from '../extension/core/checker.js';
import { validateNewWork, createWork } from '../extension/core/work.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';

import { lessonInput } from './fixtures.mjs';

const base = lessonInput();

test('AC-006 꾸러미에서 가져온 작품은 출처가 기록된다', async () => {
  const store = createStore(createMemoryBackend());
  const w = createWork(base);
  await store.add(w, { source: 'bundle', checkReport: checkHtml(w.html) });
  const [rec] = await store.list();
  assert.equal(rec.source, 'bundle');
  assert.equal(rec.work.title, '내 퀴즈');
  assert.equal((await store.add(w, { source: 'bundle' })).duplicate, true);
  await store.remove(w.id);
  assert.equal((await store.list()).length, 0);
});

test('AC-007 1MB를 넘는 HTML은 거부한다', () => {
  const big = validateNewWork({ ...base, html: 'a'.repeat(1024 * 1024 + 1) });
  assert.equal(big.ok, false);
  assert.equal(big.errors[0].code, 'HTML_TOO_BIG');
  assert.equal(validateNewWork({ ...base, html: 'a'.repeat(1024 * 1024) }).ok, true);
  // 한글은 글자 수가 아니라 바이트로 센다
  assert.equal(validateNewWork({ ...base, html: '가'.repeat(400000) }).ok, false);
});

test('AC-008 http:// 주소는 거부하고 https만 받는다', () => {
  const u = { ...base, artifactType: 'webapp', html: undefined };
  assert.equal(validateNewWork({ ...u, url: 'http://example.com' }).errors[0].code, 'URL_NOT_HTTPS');
  assert.equal(validateNewWork({ ...u, url: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateNewWork({ ...u, url: '아무말' }).ok, false);
  assert.equal(validateNewWork({ ...u, url: 'https://example.com/x' }).ok, true);
});

test('분류·사용 방법·제목이 없으면 거부하고, 실명 같은 작성자는 경고한다', () => {
  const r = validateNewWork({ ...base, grade: '', howToUse: ' ', title: '' });
  assert.deepEqual(r.errors.map((e) => e.code).sort(), ['GRADE', 'HOW_TO_USE', 'TITLE']);
  assert.equal(validateNewWork({ ...base, author: '홍길동' }).warnings[0].code, 'REAL_NAME');
  assert.equal(looksLikeRealName('푸른 혹등고래 · 초등'), false);
});

test('AC-009 이름·전화번호 입력란이 있으면 개인정보 경고', () => {
  const html = '<input name="studentName" placeholder="이름"><input type="tel">';
  const r = checkHtml(html);
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => w.code === 'PII_INPUT' && w.reason));
  assert.equal(checkHtml('<input id="answer" type="number" aria-label="답">').ok, true);
});

test('자동 점검: 외부 전송·비밀값·외부 스크립트·위험 동작을 잡는다', () => {
  const codes = (h) => checkHtml(h).warnings.map((w) => w.code);
  assert.deepEqual(codes('<script>fetch("https://x.test")</script>'), ['NETWORK']);
  assert.deepEqual(codes('<script>navigator.sendBeacon("/a")</script>'), ['NETWORK']);
  assert.deepEqual(codes('<form action="https://evil.test"></form>'), ['NETWORK']);
  assert.deepEqual(codes('<script>var k="sk-abcdefghijklmnopqrstuvwxyz123456"</script>'), ['SECRET']);
  assert.deepEqual(codes('<script>const key="AIza' + 'a'.repeat(35) + '"</script>'), ['SECRET']);
  assert.deepEqual(codes('<script src="https://cdn.example/x.js"></script>'), ['EXT_SCRIPT']);
  assert.deepEqual(codes('<script>eval("1")</script>'), ['DANGEROUS']);
  assert.deepEqual(codes('<script>document.cookie</script>'), ['DANGEROUS']);
  assert.deepEqual(codes('<a href="setup.exe">받기</a>'), ['DANGEROUS']);
  assert.deepEqual(codes('<p>평범한 작품</p><script>let a=1</script>'), []);
});

test('같은 작품이면 점검 결과가 같다 (내 곳간 기록에 보관)', async () => {
  const store = createStore(createMemoryBackend());
  const w = createWork({ ...base, html: '<script>fetch("/")</script>' });
  const report = checkHtml(w.html);
  await store.add(w, { source: 'maker', checkReport: report });
  assert.deepEqual((await store.get(w.id)).checkReport, report);
});
