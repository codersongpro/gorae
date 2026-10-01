// 1단계: 목록 읽기·오프라인·필터 — AC-001~003
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCatalog } from '../extension/core/catalog.js';
import { createMemoryStorage } from '../extension/core/storage.js';
import { CONFIG } from '../extension/core/config.js';
import { buildEntries, resolveTrustedList, displayBadge } from '../extension/core/trust.js';
import { filterEntries, sortEntries } from '../extension/core/filter.js';
import { ROOT_PUBLIC_JWK } from '../extension/core/rootkey.js';
import { checkHtml } from '../extension/core/checker.js';

const site = (f) => JSON.parse(readFileSyncUtf8(new URL(`../site/${f}`, import.meta.url)));
import { readFileSync } from 'node:fs';
function readFileSyncUtf8(u) {
  return readFileSync(u, 'utf8');
}

const jsonRes = (data) => ({ ok: true, status: 200, json: async () => data });
const localFetch = async (url) => {
  const m = String(url).match(/(catalog|reviewers)\.json$/);
  if (!m) throw new Error('unexpected ' + url);
  return jsonRes(site(m[0]));
};
const downFetch = async () => {
  throw new TypeError('network down');
};
const resolveLocal = (p) => 'https://local/' + p;
const sampleFetch = async (url) => (String(url).startsWith('https://local/') ? localFetch(url) : downFetch());

async function entriesFrom(res, storage) {
  const t = await resolveTrustedList({ candidate: res.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  return buildEntries({ works: res.catalog.items, list: t.list, storage, rootJwk: ROOT_PUBLIC_JWK });
}

test('AC-001 인터넷이 되면 목록과 족보를 받아 작품 카드를 만든다', async () => {
  const storage = createMemoryStorage();
  const res = await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal });
  assert.equal(res.source, 'network');
  assert.equal(res.offline, false);
  const entries = await entriesFrom(res, storage);
  assert.equal(entries.length, 13); // 샘플 6개 + 기본 수업도구 7개
  assert.equal(entries.filter((e) => e.status.ok).length, 9); // 서명된 샘플 2개 + 수업도구 7개만 검증 통과
});

test('AC-002 한 번 받은 뒤 인터넷이 끊겨도 사본으로 보여 주고 배지 검증도 된다', async () => {
  const storage = createMemoryStorage();
  await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal });
  const res = await loadCatalog({ fetchFn: downFetch, storage, config: CONFIG, resolveLocal });
  assert.deepEqual([res.source, res.offline], ['cache', true]);
  const entries = await entriesFrom(res, storage);
  assert.equal(entries.filter((e) => displayBadge({ status: e.status }) === 'clear').length, 9);
});

test('처음부터 인터넷이 없으면 번들 샘플 목록을 쓴다', async () => {
  const res = await loadCatalog({ fetchFn: sampleFetch, storage: createMemoryStorage(), config: CONFIG, resolveLocal });
  assert.equal(res.source, 'sample');
});

test('AC-003 초4·수학 3건 중 고래 픽 1건을 필터하면 1건만 나온다', async () => {
  const storage = createMemoryStorage();
  const entries = await entriesFrom(await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal }), storage);
  const g4 = filterEntries(entries, { grade: '초4', subject: '수학', mode: 'mother' });
  assert.equal(g4.length, 3);
  const picked = filterEntries(entries, { grade: '초4', subject: '수학', pickOnly: true, mode: 'mother' });
  assert.deepEqual(picked.map((e) => e.work.id), ['sample-fraction-pizza']);
});

test('학생고래 모드는 맑은 바다(검증 통과)만 보인다', async () => {
  const storage = createMemoryStorage();
  const entries = await entriesFrom(await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal }), storage);
  const baby = filterEntries(entries, { mode: 'baby' });
  assert.ok(baby.length === 9 && baby.every((e) => displayBadge(e) === 'clear'));
});

test('정렬: 고래 픽 먼저 / 새로 들어옴 / 물뿜기 많은 순', async () => {
  const storage = createMemoryStorage();
  const entries = await entriesFrom(await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal }), storage);
  assert.equal(sortEntries(entries, 'pick')[0].work.id, 'sample-fraction-pizza');
  const newest = [...entries].sort((a, b) => Date.parse(b.work.addedAt) - Date.parse(a.work.addedAt))[0].work.addedAt;
  assert.equal(sortEntries(entries, 'new')[0].work.addedAt, newest);
  assert.equal(sortEntries(entries, 'spout', { 'sample-times-quiz': 99 })[0].work.id, 'sample-times-quiz');
});

test('exe 항목은 서명이 없으면 검증 실패로 표시된다', async () => {
  const storage = createMemoryStorage();
  const res = await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal });
  const t = await resolveTrustedList({ candidate: res.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  const exe = await buildEntries({ works: res.catalog.exeItems, list: t.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  assert.equal(exe[0].status.ok, false);
});

test('기본 수업도구 7개가 수업도구 카테고리로 들어 있고 모두 검수 서명·점검을 통과한다', async () => {
  const storage = createMemoryStorage();
  const entries = await entriesFrom(await loadCatalog({ fetchFn: localFetch, storage, config: CONFIG, resolveLocal }), storage);
  const tools = filterEntries(entries, { domain: 'lesson', category: 'classroom_tool', mode: 'baby' });
  assert.equal(tools.length, 7);
  assert.ok(tools.every((e) => e.status.ok && checkHtml(e.work.html).ok));
  assert.deepEqual(filterEntries(entries, { query: '뽑기' }).map((e) => e.work.id), ['tool-lucky-draw']);
  assert.deepEqual(filterEntries(entries, { subcategory: 'scoreboard' }).map((e) => e.work.id), ['tool-scoreboard']);
});
