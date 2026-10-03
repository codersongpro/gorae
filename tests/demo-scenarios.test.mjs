// 공모전 시연 시나리오 A~E가 로직 수준에서 끊기지 않는지 (화면 조작은 수동 확인 — 보고서의 시연 절차 참고)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveTrustedList, buildEntries, displayBadge } from '../extension/core/trust.js';
import { filterEntries } from '../extension/core/filter.js';
import { createMemoryStorage } from '../extension/core/storage.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';
import { ROOT_PUBLIC_JWK } from '../extension/core/rootkey.js';
import { buildShare } from '../extension/core/share.js';
import { canRun } from '../extension/core/runner.js';
import { checkWork } from '../extension/core/checker.js';
import { validateNewWork, createWork } from '../extension/core/work.js';
import { remixInput } from '../extension/core/remix.js';
import { exportBundle, previewImport, importSelected } from '../extension/core/bundle.js';
import { createPack, serializePack } from '../shared/pack.js';
import { buildCatalogLink, isPublishedInCatalog } from '../shared/link.js';
import { S } from '../extension/ui/strings.js';
import { lessonInput } from './fixtures.mjs';

const data = (f) => readFile(new URL(`./data/${f}`, import.meta.url), 'utf8').then(JSON.parse);
const catalog = await data('catalog.json');
const list = await data('reviewers.json');
const storage = createMemoryStorage();
await resolveTrustedList({ candidate: list, storage, rootJwk: ROOT_PUBLIC_JWK });
const verifyWorks = (works) => buildEntries({ works, list, storage, rootJwk: ROOT_PUBLIC_JWK });
const entries = await verifyWorks(catalog.items);

test('A 교사: 수업 › 교과활동 › 초4 › 수학 › 분수로 찾아 실행하고 클래스 공유 글에 필요한 정보가 다 있다', () => {
  const found = filterEntries(entries, { mode: 'mother', domain: 'lesson', category: 'subject_activity', grade: '초4', subject: '수학', query: '분수' });
  const pizza = found.find((e) => e.work.id === 'sample-fraction-pizza');
  assert.ok(pizza, '분수 피자 게임이 찾아져야 한다');
  assert.equal(canRun(pizza).ok, true);
  const link = isPublishedInCatalog(catalog, pizza.work) ? buildCatalogLink(pizza.work.id, 'https://codersongpro.github.io/gorae/viewer.html') : null;
  const { text } = buildShare('class', pizza.work, { link, status: pizza.status });
  for (const part of [pizza.work.title, pizza.work.howToUse, '동안 활동합니다', '맑은 바다', '검수 서명 확인됨', '▶ 바로 실행', '?id=sample-fraction-pizza']) assert.ok(text.includes(part), part);
  if (pizza.work.standard) assert.ok(text.includes(`성취기준: ${pizza.work.standard}`));
});

test('B 학생 작품: 만들기 → 자동 점검 → 저장 → 꾸러미 → (클래스 제출용) 다시 가져오기', async () => {
  const store = createStore(createMemoryBackend());
  const input = lessonInput({ title: '분수 퀴즈 만들기', html: '<!doctype html><p>1/2 와 1/3 중 큰 것은?</p>' });
  assert.equal(validateNewWork(input).ok, true);
  const work = createWork(input);
  const report = checkWork(work);
  assert.equal(report.ok, true);
  await store.add(work, { source: 'maker', checkReport: report });
  const out = exportBundle(await store.list(), [work.id], { name: '내 작품' });
  assert.ok(out.fileName.endsWith('.gorae.json'));
  const other = createStore(createMemoryBackend());
  const pv = await previewImport(out.text, { verifyWorks, existingIds: new Set() });
  assert.equal(pv.ok, true);
  await importSelected(pv, [work.id], other);
  assert.equal((await other.list())[0].work.title, '분수 퀴즈 만들기');
});

test('C 팀보드: 학생 작품 카드 글에 실행 링크·댓글 안내·리믹스 안내가 있고, 받은 쪽에서 리믹스할 수 있다', () => {
  const work = createWork(lessonInput({ title: '우리 반 퀴즈' }));
  const { text } = buildShare('teamboard', work, { link: 'https://x.example/viewer.html#g1.AAAA', status: { ok: false, reason: 'NO_TAILPRINT' } });
  for (const part of ['작품명: 우리 반 퀴즈', '▶ 바로 실행', '팀보드 댓글', '리믹스해 보세요', '아직 검수되지 않은 작품']) assert.ok(text.includes(part), part);
  const remix = createWork({ ...remixInput(work), author: '친구고래 · 초등' });
  assert.equal(remix.remixOf, work.id);
});

test('D 리믹스: 원작 → 리믹스 → 수정 → 새 작품 저장 → 계보 표시 → 미검수 (원작 검수 서명은 복제되지 않음)', async () => {
  const original = entries.find((e) => e.work.id === 'sample-fraction-pizza');
  assert.equal(original.status.ok, true);
  const input = { ...remixInput(original.work), author: '새고래 · 초등', howToUse: '내 반에 맞게 바꿨어요' };
  assert.equal('tailprint' in input, false);
  const remix = createWork(input);
  assert.notEqual(remix.id, original.work.id);
  assert.equal(remix.tailprint, undefined);
  assert.equal(remix.remixOf, original.work.id);
  assert.equal(remix.remixOfTitle, original.work.title);
  // 누군가 원작 서명을 리믹스 작품에 억지로 붙여도 내용이 달라 인정되지 않는다
  const [forged] = await verifyWorks([{ ...remix, tailprint: original.work.tailprint }]);
  assert.equal(forged.status.ok, false);
  const [e] = await verifyWorks([remix]);
  assert.equal(displayBadge(e), 'shallow');
  assert.ok(buildShare('class', remix, { link: null, status: e.status }).text.includes('리믹스한 작품'));
});

test('E 안전성: 검수된 HTML 작품 코드를 바꾸면 서명 검증 실패 → 맑은 바다 제거 → 얕은 바다 + "서명 뒤 내용이 바뀌었습니다."', async () => {
  const pizza = catalog.items.find((w) => w.id === 'sample-fraction-pizza');
  const [before] = await verifyWorks([pizza]);
  assert.equal(displayBadge(before), 'clear');
  const tampered = { ...pizza, html: pizza.html + '\n<!-- 서명 뒤에 바꾼 줄 -->' };
  const pv = await previewImport(serializePack(createPack({ name: '변조 시연', items: [tampered] })), { verifyWorks, existingIds: new Set() });
  const [item] = pv.items;
  assert.deepEqual([item.status.ok, item.status.reason], [false, 'CONTENT_CHANGED']);
  assert.equal(displayBadge(item), 'shallow');
  assert.equal(S.reason.CONTENT_CHANGED, '서명 뒤 내용이 바뀌었습니다.');
  // 학생고래 목록에서는 사라지고(맑은 바다만), 공유 글에도 검수 표시가 없다
  assert.equal(filterEntries([item], { mode: 'baby' }).length, 0);
  assert.ok(!buildShare('class', tampered, { status: item.status }).text.includes('맑은 바다'));
});
