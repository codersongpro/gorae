// 나눔 곳간 (구글 폼 → 시트 → 드라이브) — CSV·열 찾기·드라이브 주소·미리 채우기·가져오기 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, findColumns, parseMarketCsv, toDriveDownloadUrl, driveFileId, buildPrefillUrl, parseCategoryCode, sheetCsvUrls, isAllowedDownloadHost } from '../shared/market.js';
import { loadMarket, fetchEntryWorks, importEntry, fetchText } from '../extension/core/market.js';
import { buildSharePackage } from '../extension/core/submit.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';
import { createMemoryStorage } from '../extension/core/storage.js';
import { toSubmissionHtml } from '../shared/submission.js';

const config = { sheetId: 'SHEET123', publishedCsvUrl: '', fetchTimeoutMs: 2000, maxFileBytes: 2 * 1024 * 1024 };
const work = { id: 'my-1', title: '럭키 뽑기', type: 'html', artifactType: 'html', domain: 'lesson', category: 'classroom_tool', subcategory: 'lucky_draw', audience: ['teacher'], tags: ['랜덤'], html: '<p>뽑기</p>', howToUse: '누르세요', description: '무작위로 뽑아요', version: 1 };

const HEADER = '타임스탬프,어떤 고래이신가요?,제작하신 분의 닉네임,제작한 앱의 제목,설명,분류,웹앱 주소,한 마디,제작한 파일을 업로드 해주세요.';
const csvOf = (...rows) => [HEADER, ...rows].join('\r\n');
const FILE = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv';

// 가짜 fetch: url → { status, body, url(최종), type }
const mockFetch = (routes) => async (url) => {
  const r = routes[url] || routes['*'];
  if (!r) throw new TypeError('network');
  if (r === 'NETWORK') throw new TypeError('network');
  const body = new TextEncoder().encode(r.body || '');
  return {
    ok: (r.status || 200) < 400, status: r.status || 200, url: r.url || url,
    headers: { get: (k) => (k === 'content-type' ? r.type || 'text/csv' : null) },
    body: new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }),
  };
};

test('CSV: 셀 안의 줄바꿈·쉼표·따옴표("")가 있어도 행이 깨지지 않는다', () => {
  const rows = parseCsv('a,b,c\r\n1,"여러 줄\n설명, 쉼표","그는 ""고래""라 했다"\r\n\r\n2,x,y');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ['1', '여러 줄\n설명, 쉼표', '그는 "고래"라 했다']);
  assert.deepEqual(parseCsv('﻿제목\n가'), [['제목'], ['가']]);
});

test('열 찾기: 정확히 일치 → 부분 일치, 질문 순서가 바뀌어도 된다', () => {
  const cols = findColumns(['제작한 앱의 제목', '타임스탬프', '파일 업로드', '닉네임']);
  assert.deepEqual(cols, { title: 0, timestamp: 1, file: 2, nickname: 3 });
});

test('시트 목록: 항목·파일 주소·분류 코드를 읽고, 최근 등록이 위로', () => {
  const csv = csvOf(
    `2026. 10. 1 오후 3:00:00,교사고래,파란 고래,럭키 뽑기,"무작위로 뽑아요\n여러 줄",수업 › 수업도구 › 럭키드로우·랜덤뽑기 [lesson/classroom_tool/lucky_draw],,재밌어요,${FILE}`,
    '2026. 10. 2 오전 9:00:00,학생고래,노을,분수 웹앱,설명,,https://app.example.com/f,,',
    '2026. 10. 3 오전 9:00:00,학생고래,빈칸,파일도 주소도 없음,,,,,',
  );
  const r = parseMarketCsv(csv);
  assert.equal(r.ok, true);
  assert.deepEqual(r.entries.map((e) => e.title), ['분수 웹앱', '럭키 뽑기']); // 파일·주소 없는 행은 뺀다
  const lucky = r.entries[1];
  assert.deepEqual(lucky.category, { domain: 'lesson', category: 'classroom_tool', subcategory: 'lucky_draw' });
  assert.equal(lucky.categoryText, '수업 › 수업도구 › 럭키드로우·랜덤뽑기');
  assert.deepEqual(lucky.files, [FILE]);
  assert.equal(lucky.description, '무작위로 뽑아요\n여러 줄');
});

test('필수 열(제목, 파일/주소)이 없으면 감지된 열 이름을 돌려준다', () => {
  const r = parseMarketCsv('타임스탬프,아무거나\n1,2');
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['title', 'file']);
  assert.deepEqual(r.header, ['타임스탬프', '아무거나']);
});

test('드라이브 공유 주소 → 직접 받기 주소, 구글이 아닌 주소·http는 거부', () => {
  assert.equal(toDriveDownloadUrl(FILE), 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv');
  assert.equal(driveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'), '1AbCdEfGhIjKlMnOpQrStUv');
  for (const bad of ['http://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv', 'https://evil.test/open?id=1AbCdEfGhIjKlMnOpQrStUv', 'https://drive.google.com.evil.test/open?id=1AbCdEfGhIjKl', 'https://drive.google.com/open?id=short', '아무말']) {
    assert.equal(toDriveDownloadUrl(bad), null, bad);
  }
  assert.equal(isAllowedDownloadHost('drive.usercontent.google.com'), true);
  assert.equal(isAllowedDownloadHost('evil.test'), false);
});

test('폼 미리 채우기 주소: entry 번호가 있는 값만, docs.google.com만', () => {
  const url = buildPrefillUrl('https://docs.google.com/forms/d/e/FORMID/viewform', { title: 'entry.111', nickname: 'entry.222', bad: 'x.333' }, { title: '럭키 뽑기 & 친구', nickname: '파란 고래', bad: 'no', comment: '없음' });
  const u = new URL(url);
  assert.equal(u.searchParams.get('usp'), 'pp_url');
  assert.equal(u.searchParams.get('entry.111'), '럭키 뽑기 & 친구');
  assert.equal(u.searchParams.get('entry.222'), '파란 고래');
  assert.equal([...u.searchParams.keys()].length, 3);
  assert.equal(buildPrefillUrl('https://evil.test/forms', {}, {}), null);
});

test('공유 묶음: 업로드 파일 + 미리 채우기 값(분류 코드 포함), 개인정보 확인 필수', () => {
  assert.equal(buildSharePackage(work, { nickname: '파란 고래', role: 'teacher', privacyChecked: false }).ok, false);
  const p = buildSharePackage(work, { nickname: '파란 고래', role: 'teacher', comment: '추천해요', privacyChecked: true });
  assert.equal(p.file.name, '럭키_뽑기.html');
  assert.equal(p.prefill.whale, '교사고래');
  assert.equal(p.prefill.category, '수업 › 수업도구 › 럭키드로우·랜덤뽑기 [lesson/classroom_tool/lucky_draw]');
  assert.deepEqual(parseCategoryCode(p.prefill.category), { domain: 'lesson', category: 'classroom_tool', subcategory: 'lucky_draw' });
  assert.equal(p.prefill.description, '무작위로 뽑아요');
  assert.equal(p.prefill.comment, '추천해요');
});

test('시트 불러오기: 비공개(웹 화면이 옴)면 다음 주소, 모두 실패하면 보관된 사본, 그것도 없으면 오류', async () => {
  const [exportUrl, pubUrl] = sheetCsvUrls(config);
  const csv = csvOf(`t,교사고래,a,럭키 뽑기,,,,,${FILE}`);
  const storage = createMemoryStorage();
  const ok = await loadMarket({ fetchFn: mockFetch({ [exportUrl]: { body: '<html>로그인</html>', type: 'text/html' }, [pubUrl]: { body: csv } }), config, storage });
  assert.deepEqual([ok.source, ok.entries.length], ['network', 1]);
  const cached = await loadMarket({ fetchFn: mockFetch({}), config, storage });
  assert.equal(cached.source, 'cache');
  await assert.rejects(() => loadMarket({ fetchFn: mockFetch({ '*': { status: 403 } }), config, storage: createMemoryStorage() }), (e) => e.code === 'PRIVATE');
  await assert.rejects(() => loadMarket({ fetchFn: mockFetch({}), config: { ...config, sheetId: '' }, storage }), (e) => e.code === 'NOT_CONFIGURED');
});

test('내려받기 안전장치: 로그인 화면으로 보내면 비공개, 엉뚱한 곳으로 리다이렉트·크기 초과는 거부', async () => {
  const url = 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv';
  const base = { url, maxBytes: 100, timeoutMs: 1000, allowHost: isAllowedDownloadHost };
  await assert.rejects(() => fetchText({ ...base, fetchFn: mockFetch({ [url]: { url: 'https://accounts.google.com/signin', body: 'login' } }) }), (e) => e.code === 'PRIVATE');
  await assert.rejects(() => fetchText({ ...base, fetchFn: mockFetch({ [url]: { url: 'https://evil.test/x', body: 'x' } }) }), (e) => e.code === 'BAD_REDIRECT');
  await assert.rejects(() => fetchText({ ...base, fetchFn: mockFetch({ [url]: { body: 'a'.repeat(101) } }) }), (e) => e.code === 'TOO_BIG');
  await assert.rejects(() => fetchText({ ...base, url: 'http://drive.google.com/x', fetchFn: mockFetch({}) }), (e) => e.code === 'BAD_URL');
  const ok = await fetchText({ ...base, fetchFn: mockFetch({ [url]: { url: 'https://drive.usercontent.google.com/download?id=1', body: 'hello' } }) });
  assert.equal(ok.text, 'hello');
});

test('가져오기: 검증 통과분만 내 곳간에(출처: 나눔 곳간), 같은 제목은 건너뜀, 잘못된 파일은 저장하지 않음', async () => {
  const store = createStore(createMemoryBackend());
  const dl = toDriveDownloadUrl(FILE);
  const entry = { id: 'm-1', title: '럭키 뽑기', nickname: '파란 고래', whale: '교사고래', description: '', files: [FILE], address: '', category: null, timestamp: 't' };
  const fetchFn = mockFetch({ [dl]: { body: toSubmissionHtml(work), type: 'text/html' } });
  const r = await importEntry(entry, { fetchFn, config, store });
  assert.deepEqual(r.added, ['럭키 뽑기']);
  const [rec] = await store.list();
  assert.equal(rec.source, 'market');
  assert.equal(rec.market.nickname, '파란 고래');
  assert.equal(rec.work.category, 'classroom_tool'); // 파일 속 작품 정보로 분류가 살아남
  assert.deepEqual((await importEntry(entry, { fetchFn, config, store })).skipped, ['럭키 뽑기']);
  const bad = mockFetch({ [dl]: { body: '그냥 글' } });
  await assert.rejects(() => importEntry({ ...entry, title: '다른 것' }, { fetchFn: bad, config, store }), (e) => e.code === 'INVALID');
  assert.equal((await store.list()).length, 1);
});

test('고래곳간 밖에서 만든 HTML은 시트 정보로 제목·설명·분류를 채운다', async () => {
  const dl = toDriveDownloadUrl(FILE);
  const entry = { id: 'm-2', title: '내 게임', nickname: '노을', description: '게임 설명', files: [FILE], address: '', category: { domain: 'lesson', category: 'classroom_tool', subcategory: 'quiz_game' } };
  const { works, warnings } = await fetchEntryWorks(entry, { fetchFn: mockFetch({ [dl]: { body: '<!doctype html><p>게임</p>' } }), config });
  assert.equal(works[0].title, '내 게임');
  assert.equal(works[0].howToUse, '게임 설명');
  assert.equal(works[0].subcategory, 'quiz_game');
  assert.equal(warnings.length, 1);
});
