// 시연용 샘플: 내 곳간 첫 실행 담기, 학급 꾸러미 미리 고르기, 나눔 곳간 앱 안 샘플(미리 실행·가져오기)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedMypod, samplesInMypod } from '../extension/core/seed.js';
import { fetchEntryWorks, importEntry } from '../extension/core/market.js';
import { createStore, createMemoryBackend } from '../extension/core/store.js';
import { createMemoryStorage } from '../extension/core/storage.js';
import { checkWork } from '../extension/core/checker.js';

const mypod = JSON.parse(readFileSync(new URL('../extension/sample/mypod-samples.json', import.meta.url), 'utf8'));
const market = JSON.parse(readFileSync(new URL('../extension/sample/market-samples.json', import.meta.url), 'utf8'));
const noFetch = async () => {
  throw new Error('네트워크를 쓰면 안 됨');
};
const config = { fetchTimeoutMs: 1000, maxFileBytes: 2 * 1024 * 1024 };

test('내 곳간 샘플은 처음 한 번만 담기고, 지운 뒤 다시 열어도 다시 담기지 않는다', async () => {
  const storage = createMemoryStorage();
  const store = createStore(createMemoryBackend());
  const ids = await seedMypod({ storage, store, samples: mypod.works });
  assert.equal(ids.length, 3);
  const list = await store.list();
  assert.ok(list.every((r) => r.sample === true && r.source === 'maker'));
  assert.ok(list.every((r) => r.checkReport.ok)); // 샘플은 자동 점검 통과
  const roulette = list.find((r) => r.id === 'my-sample-roulette').work;
  assert.deepEqual([roulette.remixOf, roulette.remixOfTitle], ['tool-lucky-draw', '럭키드로우']); // 리믹스 계보 시연
  await store.remove('my-sample-intro');
  assert.deepEqual(await seedMypod({ storage, store, samples: mypod.works }), []);
  assert.deepEqual(await samplesInMypod(store, mypod.works), ['my-sample-roulette', 'my-sample-dictation']); // 학급 꾸러미 미리 고르기
  assert.ok(mypod.className.includes('샘플'));
});

test('나눔 곳간 샘플은 네트워크 없이 미리 실행·가져오기가 되고, 업로드 파일과 같은 검증을 거친다', async () => {
  assert.equal(market.length, 6);
  for (const entry of market) {
    assert.equal(entry.sample, true);
    const { works, warnings } = await fetchEntryWorks(entry, { fetchFn: noFetch, config });
    assert.equal(works.length, 1);
    assert.equal(works[0].title, entry.title);
    assert.equal(warnings.length, 0); // 고래곳간 형식이라 분류 정보가 살아 있다
    assert.ok(checkWork(works[0]).ok);
    assert.equal(works[0].tailprint, undefined); // 미검수
  }
  const store = createStore(createMemoryBackend());
  const r = await importEntry(market[0], { fetchFn: noFetch, config, store });
  assert.deepEqual(r.added, [market[0].title]);
});
