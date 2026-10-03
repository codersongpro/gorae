// 운영 열쇠로 샘플 작품에 검수 서명을 찍고 site/ 목록·족보와 확장앱 샘플을 만든다.
// 열쇠는 저장소 밖 폴더(GORAE_KEY_DIR, 기본 ~/gorae-keys)의 암호 건 백업에서만 읽는다. 열쇠를 새로 만들지 않는다.
// 열쇠 만들기·공개키 반영은 tools/keys.mjs (docs/root-key-setup.md).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { works, exeItems } from '../tests/sample-works.mjs';
import { tools, DEMO_PICKS } from '../samples/tools/index.mjs';
import { catalogExtras, marketSamples, mypodSamples, CLASS_SAMPLE_NAME } from '../samples/more/index.mjs';
import { toSubmissionHtml } from '../shared/submission.js';
import * as tp from '../shared/tailprint.js';
import { signFeatured } from '../shared/featured.js';
import { loadKeys, assertOutsideRepo, fingerprintOf } from './keys.mjs';
import { ROOT_PUBLIC_JWK } from '../extension/core/rootkey.js';

const KEY_DIR = process.env.GORAE_KEY_DIR || join(homedir(), 'gorae-keys');
assertOutsideRepo(KEY_DIR);
const { root, reviewer } = await loadKeys(KEY_DIR);
// 코드에 든 관리 공개키와 열쇠 폴더의 관리 열쇠가 같아야 한다 (다르면 tools/keys.mjs apply 먼저)
if ((await fingerprintOf(root.publicJwk)) !== (await fingerprintOf(ROOT_PUBLIC_JWK))) {
  throw new Error('extension/core/rootkey.js 의 관리 공개키가 열쇠 폴더와 달라요. 먼저 node tools/keys.mjs apply --dir ' + KEY_DIR);
}
const guard = reviewer;

// 족보 버전은 내려가면 안 된다 (이미 본 버전보다 낮은 족보는 거부됨)
const prevVersion = await readFile(new URL('../site/reviewers.json', import.meta.url), 'utf8').then((t) => JSON.parse(t).version || 0, () => 0);
const list = await tp.signReviewerList(
  {
    version: Math.max(2, prevVersion),
    issuedAt: '2026-10-01T00:00:00Z',
    reviewers: [{ id: guard.id, nickname: guard.nickname, publicKey: guard.publicJwk, addedAt: '2026-10-01T00:00:00Z' }],
    revoked: [],
  },
  root.privateKey,
);

const signOpts = { reviewer: guard.id, signedAt: '2026-10-01T01:00:00Z' };
const signed = [
  await tp.signWork(works[0], guard.privateKey, { ...signOpts, badge: 'clear', pick: true, songs: [{ text: '4학년 분수 도입에 10분, 반응 최고', author: '푸른 혹등고래 · 초등', date: '2026-10-01' }] }),
  works[1], // 구구단 번개 퀴즈: 미검수 (얕은 바다 시연)
  works[2], // 곱셈 연습 카드: 미검수 (위조 시연에 사용)
  await tp.signWork(works[3], guard.privateKey, { ...signOpts, badge: 'clear', pick: false }),
  await tp.signWork({ ...works[4], html: await readFile(new URL('../samples/more/timer.html', import.meta.url), 'utf8') }, guard.privateKey, { ...signOpts, badge: 'clear', pick: false }), // 교실 모래시계 타이머
  await tp.signWork(works[5], guard.privateKey, { ...signOpts, badge: 'shallow', pick: false }), // 설문 CSV 집계기: 교사용(얕은 바다, 검수됨)
];

// 기본 수업도구: HTML 파일을 읽어 작품 카드로 만들고 맑은 바다로 서명한다
for (const { file, ...card } of tools) {
  const html = await readFile(new URL(`../samples/tools/${file}`, import.meta.url), 'utf8');
  signed.push(await tp.signWork({ ...card, html }, guard.privateKey, { ...signOpts, badge: 'clear', pick: DEMO_PICKS.includes(card.id) }));
}

// 큰 곳간 추가 샘플 (시계 읽기·영어 단어·회의록 정리기)
const readMore = (file) => readFile(new URL(`../samples/more/${file}`, import.meta.url), 'utf8');
for (const { file, badge, ...card } of catalogExtras) {
  signed.push(await tp.signWork({ ...card, html: await readMore(file) }, guard.privateKey, { ...signOpts, badge, pick: false }));
}

// 나눔 곳간 샘플: 시트 목록과 함께 보이는 앱 안 샘플 (미검수). 업로드 파일과 같은 형식(payload)으로 담아 같은 검증을 거친다
const marketOut = [];
for (const s of marketSamples) {
  const work = { ...s.work, author: s.nickname, html: await readMore(s.file) };
  marketOut.push({
    id: 'sample-' + work.id, sample: true, timestamp: s.timestamp, whale: s.whale, nickname: s.nickname, title: work.title,
    description: work.description, kinds: s.kinds, format: 'HTML 파일', categoryText: '', comment: '', address: '', files: [],
    category: { domain: work.domain, category: work.category, subcategory: work.subcategory },
    payload: toSubmissionHtml(work),
  });
}
await writeFile(new URL('../extension/sample/market-samples.json', import.meta.url), JSON.stringify(marketOut, null, 2));

// 내 곳간 샘플: 처음 실행할 때 한 번 담긴다. 학급 꾸러미는 이 샘플들을 미리 골라 둔다
const mypodOut = [];
for (const s of mypodSamples) mypodOut.push({ ...s.work, html: await readMore(s.file) });
await writeFile(new URL('../extension/sample/mypod-samples.json', import.meta.url), JSON.stringify({ className: CLASS_SAMPLE_NAME, works: mypodOut }, null, 2));

const featured = await signFeatured(
  { month: '2026-10', title: '10월의 고래자리', note: '새 학기 수업을 여는 도구와 재미있는 단어 게임', items: ['tool-lucky-draw', 'tool-scoreboard', 'sample-word-match'], issuedAt: '2026-10-01T02:00:00Z' },
  root.privateKey,
);
const catalog = { updatedAt: '2026-10-01T02:00:00Z', items: signed, exeItems, featured };
await writeFile(new URL('../site/catalog.json', import.meta.url), JSON.stringify(catalog, null, 2));
await writeFile(new URL('../site/reviewers.json', import.meta.url), JSON.stringify(list, null, 2));
// 시험용 고정 사본: 검수 도구에서 [검수 완료]를 누르면 site/catalog.json이 계속 바뀌므로, 시험은 이 사본으로 한다
await mkdir(new URL('../tests/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../tests/data/catalog.json', import.meta.url), JSON.stringify(catalog, null, 2));
await writeFile(new URL('../tests/data/reviewers.json', import.meta.url), JSON.stringify(list, null, 2));
console.log('샘플 생성 완료: site/catalog.json, site/reviewers.json (족보 버전 ' + list.version + ')');
