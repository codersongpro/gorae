// 큰 곳간에 공유하기 — 사용자가 만든 네이버 폼 문항에 맞춘 답·업로드 파일, 검수 도구가 다시 읽기
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkSubmission, buildSongSubmission, validFormUrl, FORM_LIMITS } from '../extension/core/submit.js';
import { readSubmission, toSubmissionHtml } from '../shared/submission.js';

const html = { id: 'my-1', title: '럭키 뽑기', type: 'html', artifactType: 'html', domain: 'lesson', category: 'classroom_tool', subcategory: 'lucky_draw', audience: ['teacher'], tags: ['랜덤'], html: '<!doctype html><title>x</title><p>뽑기 -- 시작</p>', howToUse: '누르세요', promptRecipe: '레시피 --> 끝', author: '푸른 고래', version: 2 };
const webapp = { id: 'my-2', title: '분수 웹앱', type: 'url', artifactType: 'webapp', domain: 'lesson', category: 'subject_activity', subcategory: 'game', url: 'https://app.example.com/f', howToUse: '열어요', version: 1 };
const exe = { id: 'my-3', title: '설치 도구', type: 'exe-link', artifactType: 'exe', url: 'https://e.x/a.exe', sourceRepo: 'https://e.x/src', sha256: 'a'.repeat(64), scanResult: '통과', environment: 'Windows 11', howToUse: '설치', version: 1 };
const ok = { nickname: '파란 고래', privacyChecked: true };

test('개인정보 확인·닉네임이 없거나 실명 같으면, 제목이 100자를 넘으면 만들지 않는다', () => {
  assert.equal(buildWorkSubmission(html, { ...ok, privacyChecked: false }).ok, false);
  assert.equal(buildWorkSubmission(html, { ...ok, nickname: ' ' }).ok, false);
  const real = buildWorkSubmission(html, { ...ok, nickname: '홍길동' });
  assert.equal(real.ok, true); // 실명 같아도 막지 않고 경고만
  assert.equal(real.warnings.length, 1);
  assert.equal(buildWorkSubmission({ ...html, title: '가'.repeat(FORM_LIMITS.title + 1) }, ok).ok, false);
});

test('폼 문항 1~4 답: 고래 종류는 모드에서, HTML은 "네"', () => {
  const t = buildWorkSubmission(html, { ...ok, role: 'teacher' });
  assert.deepEqual(t.answers, { whale: '교사고래', nickname: '파란 고래', title: '럭키 뽑기', isFile: '네' });
  assert.equal(buildWorkSubmission(html, { ...ok, role: 'student' }).answers.whale, '학생고래');
});

test('HTML 작품은 업로드용 .html 파일이 되고, 그대로 열어도 실행되며 검수 도구가 작품 정보를 되살린다', () => {
  const r = buildWorkSubmission(html, ok);
  assert.equal(r.file.name, '럭키_뽑기.html');
  assert.ok(r.file.text.startsWith('<!--gorae-card '));
  assert.ok(r.file.text.endsWith(html.html)); // 원래 HTML이 그대로 뒤에 있다
  assert.equal((r.file.text.match(/-->/g) || []).length, 1); // 주석이 중간에 끊기지 않는다
  const back = readSubmission(r.file.text);
  assert.equal(back.ok, true);
  assert.equal(back.kind, 'html-card');
  assert.deepEqual(back.works[0], html);
});

test('업로드 파일에는 원래 검수 서명을 넣지 않는다 (파수꾼이 새로 찍음)', () => {
  const signed = { ...html, tailprint: { sig: 'x', badge: 'clear' } };
  assert.ok(!toSubmissionHtml(signed).includes('tailprint'));
});

test('웹앱은 "아니오" + 주소 칸에 주소와 작품 정보, 검수 도구가 읽는다', () => {
  const r = buildWorkSubmission(webapp, ok);
  assert.equal(r.answers.isFile, '아니오');
  assert.ok(r.answers.address.startsWith('https://app.example.com/f\n[고래곳간 작품 정보] '));
  assert.ok(r.answers.address.length <= FORM_LIMITS.address);
  const back = readSubmission('응답 내용:\n' + r.answers.address);
  assert.equal(back.kind, 'url-card');
  assert.deepEqual(back.works[0], webapp);
});

test('EXE는 파일을 올리지 않고 주소 칸에 링크·소스·SHA-256·검사·환경을 낸다', () => {
  const r = buildWorkSubmission(exe, ok);
  assert.equal(r.answers.isFile, '아니오');
  assert.equal(r.file, undefined);
  for (const part of ['다운로드 링크: https://e.x/a.exe', 'SHA-256: ' + 'a'.repeat(64), '실행 환경: Windows 11']) assert.ok(r.answers.address.includes(part), part);
  assert.equal(readSubmission(r.answers.address).works[0].sha256, 'a'.repeat(64));
});

test('작품 정보가 너무 길면 주소만 보낸다', () => {
  const long = { ...webapp, promptRecipe: '가'.repeat(3000) };
  const r = buildWorkSubmission(long, ok);
  assert.equal(r.ok, true);
  assert.equal(r.answers.address, long.url);
  assert.equal(r.warnings.length, 1);
});

test('고래곳간 밖에서 만든 HTML·주소만 있는 응답도 경고와 함께 읽는다, 엉뚱한 글은 거부', () => {
  const plain = readSubmission('<!doctype html><title>내 게임</title><p>hi</p>', { fileName: 'game.html' });
  assert.equal(plain.kind, 'html-plain');
  assert.equal(plain.works[0].title, '내 게임');
  assert.equal(plain.warnings.length, 1);
  assert.equal(readSubmission('https://app.example.com').kind, 'url-plain');
  assert.equal(readSubmission('http://app.example.com').ok, false);
  assert.equal(readSubmission('그냥 글').ok, false);
  assert.equal(readSubmission('<!--gorae-card {깨짐 -->').ok, false);
});

test('고래 노래는 80자 이하만', () => {
  assert.equal(buildSongSubmission(html, { text: '가'.repeat(80), author: '노을', privacyChecked: true }).ok, true);
  assert.equal(buildSongSubmission(html, { text: '가'.repeat(81), author: '노을', privacyChecked: true }).ok, false);
});

test('폼 주소는 https만 연다', () => {
  assert.equal(validFormUrl('https://naver.me/abcd'), 'https://naver.me/abcd');
  for (const bad of ['http://naver.me/a', 'javascript:alert(1)', '', undefined]) assert.equal(validFormUrl(bad), null, String(bad));
});
