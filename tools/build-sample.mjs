// 테스트 열쇠를 만들고 샘플 작품 2개에 서명해 site/ 샘플 파일과 확장앱 내장 공개키를 생성한다.
// 개인 열쇠는 tests/keys/ 에만 저장한다 (.gitignore 대상).
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { works, exeItems } from '../tests/sample-works.mjs';
import { tools } from '../samples/tools/index.mjs';
import * as tp from '../shared/tailprint.js';
import { signFeatured } from '../shared/featured.js';

const KEYS = new URL('../tests/keys/', import.meta.url);
const exists = (u) => access(u).then(() => true, () => false);

async function loadOrCreate(name) {
  const priv = new URL(`${name}.private.jwk`, KEYS);
  const pub = new URL(`${name}.public.jwk`, KEYS);
  if (!(await exists(priv))) {
    const kp = await tp.generateKeyPair({ extractable: true });
    await writeFile(priv, JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)));
    await writeFile(pub, JSON.stringify(await tp.exportPublicJwk(kp.publicKey)));
  }
  return {
    privateKey: await tp.importPrivateJwk(JSON.parse(await readFile(priv, 'utf8'))),
    publicJwk: JSON.parse(await readFile(pub, 'utf8')),
  };
}

await mkdir(KEYS, { recursive: true });
const root = await loadOrCreate('root');
const guard = await loadOrCreate('reviewer-guard');

const list = await tp.signReviewerList(
  {
    version: 1,
    issuedAt: '2026-10-01T00:00:00Z',
    reviewers: [{ id: 'guard-1', nickname: '푸른물결(테스트)', publicKey: guard.publicJwk, addedAt: '2026-10-01T00:00:00Z' }],
    revoked: [],
  },
  root.privateKey,
);

const signOpts = { reviewer: 'guard-1', signedAt: '2026-10-01T01:00:00Z' };
const signed = [
  await tp.signWork(works[0], guard.privateKey, { ...signOpts, badge: 'clear', pick: true, songs: [{ text: '4학년 분수 도입에 10분, 반응 최고', author: '푸른 혹등고래 · 초등', date: '2026-10-01' }] }),
  works[1],
  works[2],
  await tp.signWork(works[3], guard.privateKey, { ...signOpts, badge: 'clear', pick: false }),
  ...works.slice(4), // 수업도구·업무자동화 샘플은 미검수
];

// 기본 수업도구: HTML 파일을 읽어 작품 카드로 만들고 맑은 바다로 서명한다 (지금은 테스트 열쇠)
for (const { file, ...card } of tools) {
  const html = await readFile(new URL(`../samples/tools/${file}`, import.meta.url), 'utf8');
  signed.push(await tp.signWork({ ...card, html }, guard.privateKey, { ...signOpts, badge: 'clear', pick: false }));
}

const featured = await signFeatured(
  { month: '2026-10', title: '10월의 고래자리', note: '새 학기 수업을 여는 도구와 분수 활동', items: ['sample-fraction-pizza', 'tool-lucky-draw', 'tool-scoreboard'], issuedAt: '2026-10-01T02:00:00Z' },
  root.privateKey,
);
const catalog = { updatedAt: '2026-10-01T02:00:00Z', items: signed, exeItems, featured };
await writeFile(new URL('../site/catalog.json', import.meta.url), JSON.stringify(catalog, null, 2));
await writeFile(new URL('../site/reviewers.json', import.meta.url), JSON.stringify(list, null, 2));
await writeFile(
  new URL('../extension/core/rootkey.js', import.meta.url),
  `// 대왕고래 공개키 (현재 값은 테스트용 — 운영 전에 실제 뿌리 공개키로 교체)\nexport const ROOT_PUBLIC_JWK = ${JSON.stringify(root.publicJwk)};\n`,
);
console.log('샘플 생성 완료: site/catalog.json, site/reviewers.json, extension/core/rootkey.js');
