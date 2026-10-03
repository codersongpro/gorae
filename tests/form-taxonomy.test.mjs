// 분류 체계가 구글 폼 → 응답 시트 → 나눔 곳간을 거쳐도 사라지지 않는지 (웹앱 포함)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharePackage } from '../extension/core/submit.js';
import { buildPrefillUrl, parseMarketCsv, buildClassificationText, parseClassificationText, toDriveDownloadUrl } from '../shared/market.js';
import { fetchEntryWorks, importEntry } from '../extension/core/market.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';
import { normalizeWork } from '../shared/taxonomy.js';

const KEEP = ['domain', 'category', 'subcategory', 'schoolLevel', 'grade', 'subject', 'area', 'unit', 'lessonNo', 'topic', 'standard', 'estimatedMinutes', 'groupType', 'audience', 'tags', 'artifactType'];
const lesson = {
  id: 'my-pizza', title: '분수 피자 게임', type: 'url', artifactType: 'webapp', url: 'https://pizza.example.com/play',
  domain: 'lesson', category: 'subject_activity', subcategory: 'game',
  schoolLevel: 'elementary', grade: '4', subject: '수학', area: '수와 연산', unit: '분수', lessonNo: '3/10', topic: '분수의 크기 비교',
  standard: '[4수01-12]', estimatedMinutes: 10, groupType: 'individual', audience: ['student', 'teacher'], tags: ['분수', '게임', '형성평가'],
  description: '피자 조각으로 분수 크기를 비교해요.', howToUse: '조각을 눌러요', version: 1,
};
const config = { fetchTimeoutMs: 2000, maxFileBytes: 2 * 1024 * 1024 };
const FORM = 'https://docs.google.com/forms/d/e/F/viewform';
const ENTRY = { nickname: 'entry.1', title: 'entry.2', kind: 'entry.3', description: 'entry.4', format: 'entry.5', address: 'entry.6' };
// 실제 응답 시트의 열 이름 (docs/google-form.md)
const HEAD = '타임스탬프,제작하신 분의 닉네임을 적어주세요.,제작한 앱의 제목을 적어주세요.,"제작한 앱의 종류를 선택해주세요. 복수 선택 가능합니다.",도구에 대한 설명을 간단히 적어주세요,만드신 자료의 종류는?,배포하신 웹 앱 주소를 알려주세요.,바이브코딩 자료를 업로드 해주세요.';
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;

// 폼에 미리 채운 값 → (사용자가 제출) → 시트 한 줄이 된다고 보고 CSV를 만든다
function sheetRowFrom(prefillUrl, fileUrl = '') {
  const p = new URL(prefillUrl).searchParams;
  return ['2026-10-03 9:00:00', p.get('entry.1'), p.get('entry.2'), p.getAll('entry.3').join(', '), p.get('entry.4'), p.get('entry.5'), p.get('entry.6') || '', fileUrl].map(q).join(',');
}
const pick = (w) => Object.fromEntries(KEEP.map((k) => [k, normalizeWork(w)[k]]));

test('교과 메타데이터가 제출 정보(설명 칸의 분류 정보 글)에 모두 들어간다', () => {
  const pkg = buildSharePackage(lesson, { nickname: '파란고래 · 초등', role: 'teacher', privacyChecked: true });
  assert.equal(pkg.ok, true);
  const d = pkg.prefill.description;
  for (const line of ['수업 › 교과활동 › 게임·퀴즈', '[lesson/subject_activity/game]', '형태: webapp', '학교급: elementary', '학년: 4', '교과: 수학', '영역: 수와 연산',
    '단원: 분수', '차시: 3/10', '주제: 분수의 크기 비교', '성취기준: [4수01-12]', '시간: 10', '활동형태: individual', '대상: student, teacher', '태그: 분수, 게임, 형성평가']) {
    assert.ok(d.includes(line), line);
  }
  // 미리 채우기 주소에도 실제로 실린다 (예전에는 분류가 빠졌다)
  const url = new URL(buildPrefillUrl(FORM, ENTRY, pkg.prefill));
  assert.ok(url.searchParams.get('entry.4').includes('[lesson/subject_activity/game]'));
});

test('웹앱: 폼 → 시트 → 나눔 곳간 → 작품으로 되살릴 때 분류 정보 16개 필드가 그대로다', async () => {
  const pkg = buildSharePackage(lesson, { nickname: '파란고래 · 초등', role: 'teacher', privacyChecked: true });
  const csv = `${HEAD}\n${sheetRowFrom(buildPrefillUrl(FORM, ENTRY, pkg.prefill))}`;
  const r = parseMarketCsv(csv);
  assert.equal(r.ok, true);
  const [entry] = r.entries;
  assert.equal(entry.description, '피자 조각으로 분수 크기를 비교해요.'); // 화면에는 분류 정보 글 없이 설명만
  assert.equal(entry.categoryText, '수업 › 교과활동 › 게임·퀴즈');
  assert.deepEqual(entry.category, { domain: 'lesson', category: 'subject_activity', subcategory: 'game' });
  const { works } = await fetchEntryWorks(entry, { fetchFn: async () => { throw new Error('웹앱은 내려받지 않는다'); }, config });
  assert.equal(works[0].url, 'https://pizza.example.com/play');
  assert.deepEqual(pick(works[0]), pick(lesson));
});

test('HTML: 업로드 파일 속 작품 정보와 설명 칸 분류 정보가 함께 있어도 원래 값이 유지된다', async () => {
  const html = { ...lesson, type: 'html', artifactType: 'html', url: undefined, html: '<!doctype html><p>피자</p>' };
  const pkg = buildSharePackage(html, { nickname: '노을', role: 'student', privacyChecked: true });
  const FILE = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv';
  const [entry] = parseMarketCsv(`${HEAD}\n${sheetRowFrom(buildPrefillUrl(FORM, ENTRY, pkg.prefill), FILE)}`).entries;
  const fetchFn = async (u) => {
    assert.equal(u, toDriveDownloadUrl(FILE));
    const body = new TextEncoder().encode(pkg.file.text);
    return { ok: true, status: 200, url: u, headers: { get: () => 'text/html' }, body: new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }) };
  };
  const store = createStore(createMemoryBackend());
  await importEntry(entry, { fetchFn, config, store });
  const [rec] = await store.list();
  assert.deepEqual(pick(rec.work), pick(html));
  assert.deepEqual(rec.work.tags, ['분수', '게임', '형성평가']); // 태그 유지
});

test('고래곳간 밖에서 만든 HTML(작품 정보 없음)도 설명 칸 분류 정보로 교과·태그를 되살린다', async () => {
  const text = `직접 만든 게임\n\n${buildClassificationText(lesson)}`;
  const csv = `${HEAD}\n${['t', '노을', '내 게임', '수업자료', text, 'HTML 파일', '', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view'].map(q).join(',')}`;
  const [entry] = parseMarketCsv(csv).entries;
  const body = new TextEncoder().encode('<!doctype html><p>게임</p>');
  const fetchFn = async (u) => ({ ok: true, status: 200, url: u, headers: { get: () => 'text/html' }, body: new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }) });
  const { works } = await fetchEntryWorks(entry, { fetchFn, config });
  assert.equal(works[0].artifactType, 'html'); // 파일 형태는 실제 파일을 따른다
  assert.equal(works[0].standard, '[4수01-12]');
  assert.deepEqual(works[0].tags, ['분수', '게임', '형성평가']);
  assert.equal(works[0].description, '직접 만든 게임');
});

test('분류 정보 글은 알 수 없는 값을 버린다 (시트는 누구나 고칠 수 있다)', () => {
  const r = parseClassificationText('[고래곳간 분류 정보]\n[lesson/nope/x]\n학교급: mars\n학년: 9\n활동형태: party\n대상: alien, student\n시간: 9999\n형태: virus\n태그: #AI, 인공지능, 게임');
  assert.deepEqual(r.meta, { domain: 'lesson', audience: ['student'], tags: ['AI', '게임'] });
  assert.equal(parseClassificationText('그냥 설명'), null);
});

test('나눔 곳간 작품은 파일 속에 검수 서명이 있어도 떼어 내 인증 작품처럼 보이지 않는다', async () => {
  const entry = { id: 'm', title: 't', files: [], address: '', payload: `<!--gorae-card ${JSON.stringify({ id: 'x', title: 't', type: 'html', howToUse: 'h', version: 1, tailprint: { sig: 'forged', badge: 'clear' } })} -->\n<p>x</p>` };
  const { works, reports } = await fetchEntryWorks(entry, { fetchFn: null, config });
  assert.equal('tailprint' in works[0], false);
  assert.equal(reports.length, 1);
});

test('목록에 올리기 전 최소 점검: 드라이브가 아닌 파일 주소·http 주소 줄은 보이지 않는다', () => {
  const csv = `${HEAD}\n${['t', 'a', '이상한 파일', '기타', '', 'HTML 파일', '', 'https://evil.example.com/a.html'].map(q).join(',')}\n${['t', 'b', 'http 웹앱', '기타', '', '배포한 웹 앱', 'http://app.example.com', ''].map(q).join(',')}`;
  assert.deepEqual(parseMarketCsv(csv).entries, []);
});
