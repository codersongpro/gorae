// 바로 실행 뷰어: 인증 곳간 작품 짧은 링크(?id=)와 기존 # 링크 호환
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalogLink, readViewerQuery, readCatalogWork, isPublishedInCatalog, buildViewerLink, readViewerFragment } from '../shared/link.js';
import { createVerifier } from '../shared/tailprint.js';
import { ROOT_PUBLIC_JWK } from '../extension/core/rootkey.js';

const data = (f) => readFile(new URL(`./data/${f}`, import.meta.url), 'utf8').then(JSON.parse);
const catalog = await data('catalog.json');
const list = await data('reviewers.json');
const VIEWER = 'https://codersongpro.github.io/gorae/viewer.html';
const verify = async (work) => (await createVerifier({ rootPublicJwk: ROOT_PUBLIC_JWK, list })).verify(work);

test('인증 곳간 작품 id 링크는 짧고, 뷰어가 id를 다시 읽는다', () => {
  const url = buildCatalogLink('sample-fraction-pizza', VIEWER);
  assert.equal(url, `${VIEWER}?id=sample-fraction-pizza`);
  assert.ok(url.length < 100);
  assert.equal(readViewerQuery(new URL(url).search), 'sample-fraction-pizza');
});

test('id에는 영문·숫자·-·_만 (주소 조작 거부)', () => {
  for (const bad of ['?id=../catalog', '?id=a%20b', '?id=<script>', '?id=', '', '?x=1', `?id=${'a'.repeat(81)}`]) assert.equal(readViewerQuery(bad), null, bad);
  assert.equal(buildCatalogLink('a/b', VIEWER), null);
});

test('id 링크: 목록에서 찾아 검수 서명을 다시 확인한다 (맑은 바다)', async () => {
  const r = readCatalogWork(catalog, 'sample-fraction-pizza');
  assert.equal(r.ok, true);
  const st = await verify(r.work);
  assert.equal(st.ok, true);
  assert.equal(st.badge, 'clear');
});

test('없는 id는 열지 않는다 (EXE 목록 항목도 뷰어에서는 찾지 않는다)', () => {
  assert.deepEqual(readCatalogWork(catalog, 'no-such-work'), { ok: false, reason: 'NOT_FOUND' });
  const exeId = catalog.exeItems[0] && catalog.exeItems[0].id;
  if (exeId) assert.equal(readCatalogWork(catalog, exeId).reason, 'NOT_FOUND');
});

test('목록 속 작품이 서명 뒤 바뀌었으면 배지 없이 "서명 뒤 내용이 바뀜"으로 본다', async () => {
  const tampered = { ...catalog, items: catalog.items.map((w) => (w.id === 'sample-fraction-pizza' ? { ...w, html: w.html.replace('</body>', '<p>몰래</p></body>') + ' ' } : w)) };
  const r = readCatalogWork(tampered, 'sample-fraction-pizza');
  assert.equal(r.ok, true);
  const st = await verify(r.work);
  assert.deepEqual([st.ok, st.reason], [false, 'CONTENT_CHANGED']);
  // 형식이 깨진 항목(https가 아닌 주소 등)은 아예 열지 않는다
  const broken = { items: [{ id: 'bad', title: 'x', type: 'url', url: 'http://plain.example.com', howToUse: 'h', version: 1 }] };
  assert.equal(readCatalogWork(broken, 'bad').reason, 'INVALID');
});

test('짧은 링크는 게시된 서명본과 같은 작품에만 쓴다 (수정본·미검수는 # 링크)', () => {
  const pizza = catalog.items.find((w) => w.id === 'sample-fraction-pizza');
  assert.equal(isPublishedInCatalog(catalog, pizza), true);
  const { tailprint, ...unsigned } = pizza;
  void tailprint;
  assert.equal(isPublishedInCatalog(catalog, unsigned), false);
  assert.equal(isPublishedInCatalog(catalog, { ...pizza, tailprint: { ...pizza.tailprint, sig: 'other' } }), false);
  assert.equal(isPublishedInCatalog(catalog, { ...pizza, id: 'my-copy' }), false);
});

test('기존 # 링크는 그대로 동작한다 (호환)', async () => {
  const work = catalog.items.find((w) => w.id === 'sample-fraction-pizza');
  const r = await buildViewerLink(work, VIEWER);
  assert.equal(r.ok, true);
  const back = await readViewerFragment(new URL(r.url).hash);
  assert.equal(back.ok, true);
  assert.deepEqual(back.work, work);
  assert.equal(readViewerQuery(new URL(r.url).search), null); // # 링크에는 id가 없다
});
