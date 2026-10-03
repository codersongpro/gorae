// 작품 분류 체계: 수업/업무 → 대표 카테고리 → 하위 카테고리 → 태그, 형태별 등록·점검, 예전 작품 호환, 찾기
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, normalizeWork, normalizeTags, normalizeTag, validateClassification, SUBJECTS_BY_LEVEL, MAX_TAGS } from '../shared/taxonomy.js';
import { validateNewWork, createWork } from '../extension/core/work.js';
import { checkWork } from '../extension/core/checker.js';
import { filterEntries, facetValues, topTags } from '../extension/core/filter.js';
import { canRun } from '../extension/core/runner.js';
import * as tp from '../shared/tailprint.js';
import { lessonInput, toolInput, workInput } from './fixtures.mjs';

const none = { ok: false, reason: tp.REASON.NO_TAILPRINT };
const codes = (r) => r.errors.map((e) => e.code).sort();

test('카테고리 정의: 수업 8개·업무 9개, 하위 id는 카테고리 안에서 겹치지 않는다', () => {
  assert.deepEqual(CATEGORIES.lesson.map((c) => c.id), ['classroom_tool', 'teaching_material', 'subject_activity', 'self_learning', 'presentation', 'assessment', 'project', 'creative']);
  assert.equal(CATEGORIES.work.length, 9);
  for (const list of Object.values(CATEGORIES)) {
    for (const c of list) assert.equal(new Set(c.subs.map((s) => s.id)).size, c.subs.length, c.id);
  }
});

test('수업/업무·형태·카테고리·하위·대상은 필수, 짝이 안 맞으면 거부', () => {
  assert.equal(validateNewWork(lessonInput()).ok, true);
  assert.equal(validateNewWork(toolInput()).ok, true);
  assert.equal(validateNewWork(workInput()).ok, true);
  assert.ok(codes(validateNewWork(lessonInput({ domain: '' }))).includes('DOMAIN'));
  assert.ok(codes(validateNewWork(lessonInput({ artifactType: 'zip' }))).includes('ARTIFACT'));
  // 업무 영역에 수업 카테고리를 넣으면 거부
  assert.ok(codes(validateNewWork(workInput({ category: 'classroom_tool', subcategory: 'timer' }))).includes('CATEGORY'));
  assert.ok(codes(validateNewWork(toolInput({ subcategory: 'grading' }))).includes('SUBCATEGORY'));
  assert.ok(codes(validateNewWork(lessonInput({ audience: [] }))).includes('AUDIENCE'));
  assert.ok(codes(validateNewWork(lessonInput({ audience: ['hacker'] }))).includes('AUDIENCE'));
});

test('교과 학습: 학교급·학년·교과·주제는 필수, 영역·단원·차시·성취기준은 선택', () => {
  assert.deepEqual(codes(validateNewWork(lessonInput({ schoolLevel: '', subject: '', topic: ' ' }))), ['SCHOOL_LEVEL', 'SUBJECT', 'TOPIC']);
  assert.ok(codes(validateNewWork(lessonInput({ schoolLevel: 'middle', grade: '5' }))).includes('GRADE')); // 중학교 5학년 없음
  const r = validateNewWork(lessonInput({ area: '', unit: '', lessonNo: '', standard: '' }));
  assert.equal(r.ok, true);
  // 다른 수업 카테고리는 교과 정보가 없어도 된다
  assert.equal(validateClassification(toolInput()).length, 0);
});

test('교과 학습 작품 카드에 상세 정보가 숫자·필드로 저장된다', () => {
  const w = createWork(lessonInput({ grade: '4', subject: '수학', area: '수와 연산', unit: '분수', lessonNo: '4/10', topic: '분수의 크기 비교', standard: '[4수01-12]', estimatedMinutes: '10', groupType: 'individual', tags: '#분수, 게임 , 모둠' }));
  assert.equal(w.domain, 'lesson');
  assert.equal(w.artifactType, 'html');
  assert.equal(w.type, 'html');
  assert.deepEqual([w.schoolLevel, w.grade, w.unit, w.lessonNo, w.estimatedMinutes, w.groupType], ['elementary', '4', '분수', '4/10', 10, 'individual']);
  assert.deepEqual(w.tags, ['분수', '게임', '모둠활동']);
});

test('학교급별 교과 선택지는 따로 정의된다', () => {
  assert.ok(!SUBJECTS_BY_LEVEL.elementary.includes('제2외국어'));
  assert.ok(SUBJECTS_BY_LEVEL.elementary.includes('실과'));
  assert.ok(SUBJECTS_BY_LEVEL.high.includes('정보'));
});

test('태그 정규화: # 제거, 공백 정리, 비슷한 말 통일, 중복 제거, 개수 제한', () => {
  assert.equal(normalizeTag('#모둠 활동'), '모둠활동');
  assert.equal(normalizeTag('  인공지능 '), 'AI');
  assert.equal(normalizeTag('ai'), 'AI');
  assert.equal(normalizeTag('Quiz'), 'quiz');
  assert.deepEqual(normalizeTags('#게임, 게임, 게임형, 퀴즈게임'), ['게임', '퀴즈']);
  assert.equal(normalizeTags(Array.from({ length: 20 }, (_, i) => 't' + i)).length, MAX_TAGS);
  assert.equal([...normalizeTag('가'.repeat(40))].length, 20);
});

test('웹앱 등록: https만, 소스 주소도 https, 등록자가 밝힌 위험 정보로 점검', () => {
  const base = toolInput({ artifactType: 'webapp', html: undefined, url: 'https://app.example.com', sourceUrl: '' });
  assert.equal(validateNewWork(base).ok, true);
  assert.ok(codes(validateNewWork({ ...base, url: 'http://app.example.com' })).includes('URL_NOT_HTTPS'));
  assert.ok(codes(validateNewWork({ ...base, sourceUrl: 'http://github.com/x' })).includes('SOURCE_NOT_HTTPS'));
  const w = createWork({ ...base, loginRequired: 'yes', usesExternalApi: 'no', collectsPersonalInfo: 'yes', mobileSupported: '', needsInternet: 'yes' });
  assert.deepEqual([w.type, w.artifactType, w.loginRequired, w.usesExternalApi, w.mobileSupported], ['url', 'webapp', true, false, null]);
  const report = checkWork(w);
  assert.equal(report.ok, false); // 외부 웹앱은 늘 격리 밖이므로 경고
  assert.deepEqual(report.warnings.map((x) => x.code), ['EXTERNAL_WEBAPP', 'LOGIN', 'PII_INPUT', 'NO_SOURCE']);
  // 실행은 확인 카드를 거치는 외부 열기
  assert.equal(canRun({ work: w, status: none }).kind, 'url');
});

test('EXE 등록: 다운로드·소스·SHA-256·검사 결과·실행 환경 필수, 늘 높은 위험, 실행 불가', () => {
  const exe = toolInput({ artifactType: 'exe', html: undefined, url: 'https://example.com/a.exe', sourceRepo: 'https://example.com/src', sha256: 'A'.repeat(64), scanResult: '통과', environment: 'Windows 11' });
  assert.equal(validateNewWork(exe).ok, true);
  assert.deepEqual(codes(validateNewWork({ ...exe, sha256: '', sourceRepo: '' })), ['EXE_SHA256', 'EXE_SOURCE']);
  const w = createWork(exe);
  assert.equal(w.type, 'exe-link');
  assert.equal(w.sha256, 'a'.repeat(64));
  assert.deepEqual(checkWork(w).warnings.map((x) => x.code), ['EXE_HIGH_RISK']);
  assert.deepEqual(checkWork({ ...w, sha256: '' }).warnings.map((x) => x.code), ['EXE_HIGH_RISK', 'EXE_MISSING']);
  assert.equal(canRun({ work: w, status: none }).ok, false);
});

test('예전 작품(분류 없음)은 고치지 않고 화면용 분류만 만든다', () => {
  const old = { id: 'o', title: '옛 작품', type: 'html', html: '<p>a</p>', grade: '초4', subject: '수학', standard: '[4수01-12]', audience: 'student', minutes: 5 };
  const frozen = JSON.stringify(old);
  const m = normalizeWork(old);
  assert.equal(JSON.stringify(old), frozen); // 원본 그대로 (서명 보호)
  assert.deepEqual([m.legacy, m.domain, m.category, m.schoolLevel, m.grade, m.gradeLabel, m.estimatedMinutes], [true, 'lesson', 'subject_activity', 'elementary', '4', '초4', 5]);
  assert.deepEqual(m.audience, ['student']);
  assert.deepEqual(m.path, ['수업', '교과 학습']);
  assert.deepEqual(normalizeWork({ id: 'x', title: 'x', type: 'url', url: 'https://a.b' }).path, ['수업', '분류 없음(예전 작품)']);
});

test('찾기: "10분 안에 쓸 수 있는 초4 수학 활동"과 태그·대상·영역·검색어', () => {
  const e = (w) => ({ work: w, status: none });
  const list = [
    e(createWork(lessonInput({ title: '분수 비교', grade: '4', subject: '수학', topic: '분수', standard: '[4수01-12]', estimatedMinutes: 10, groupType: 'individual', tags: ['분수', '게임'] }), { idGen: () => 'a' })),
    e(createWork(lessonInput({ title: '긴 분수 프로젝트', grade: '4', subject: '수학', topic: '분수', estimatedMinutes: 90, tags: ['분수', '프로젝트'] }), { idGen: () => 'b' })),
    e(createWork(toolInput({ title: '교실 타이머', tags: ['타이머'] }), { idGen: () => 'c' })),
    e(createWork(workInput({ title: '출결 CSV 정리', tags: ['자동화', 'csv'] }), { idGen: () => 'd' })),
    e({ id: 'old', title: '옛 분수 퀴즈', type: 'html', html: 'x', grade: '초4', subject: '수학', minutes: 5 }),
  ];
  const ids = (c) => filterEntries(list, c).map((x) => x.work.title);
  assert.deepEqual(ids({ grade: '초4', subject: '수학', maxMinutes: 10 }), ['분수 비교', '옛 분수 퀴즈']);
  assert.deepEqual(ids({ domain: 'work' }), ['출결 CSV 정리']);
  assert.deepEqual(ids({ domain: 'lesson', category: 'classroom_tool', subcategory: 'timer' }), ['교실 타이머']);
  assert.deepEqual(ids({ tag: '프로젝트' }), ['긴 분수 프로젝트']);
  assert.deepEqual(ids({ audience: 'teacher' }), ['교실 타이머', '출결 CSV 정리']);
  assert.deepEqual(ids({ query: '4수01-12' }), ['분수 비교']); // 성취기준은 대괄호 없이도
  assert.deepEqual(ids({ query: '#자동화' }), ['출결 CSV 정리']);
  assert.deepEqual(ids({ groupType: 'individual' }), ['분수 비교']);
  assert.deepEqual(facetValues(list, 'gradeLabel'), ['초4', '초6'].filter((g) => list.some((x) => normalizeWork(x.work).gradeLabel === g)));
  assert.equal(topTags(list)[0], '분수');
});

test('학생고래 모드에서는 EXE가 보이지 않는다', () => {
  const exe = createWork(toolInput({ artifactType: 'exe', html: undefined, url: 'https://e.x/a.exe', sourceRepo: 'https://e.x/s', sha256: 'a'.repeat(64), scanResult: 'ok', environment: 'win' }));
  const signedLike = { work: exe, status: { ok: true, badge: 'clear', pick: false, songs: [], reviewer: { id: 'g', nickname: 'g' }, signedAt: 'x' } };
  assert.equal(filterEntries([signedLike], { mode: 'baby' }).length, 0);
  assert.equal(filterEntries([signedLike], { mode: 'mother' }).length, 1);
});
