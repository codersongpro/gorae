// 8단계 일부: 교사고래 암호(PIN) — FR-010, AC-015
import test from 'node:test';
import assert from 'node:assert/strict';
import { setPin, checkPin, hasPin, resetPin, validPin, MAX_TRIES, LOCK_MS } from '../extension/core/pin.js';
import { createMemoryStorage } from '../extension/core/storage.js';

test('PIN은 4~8자리 숫자만, 두 번 같게 입력해야 정해진다', async () => {
  const st = createMemoryStorage();
  assert.equal(validPin('123'), false);
  assert.equal(validPin('12a4'), false);
  assert.equal(validPin('1234'), true);
  assert.deepEqual(await setPin(st, '123', '123'), { ok: false, error: 'FORMAT' });
  assert.deepEqual(await setPin(st, '1234', '1235'), { ok: false, error: 'MISMATCH' });
  assert.equal(await hasPin(st), false);
  assert.deepEqual(await setPin(st, '2580', '2580'), { ok: true });
  assert.equal(await hasPin(st), true);
});

test('PIN은 평문이 아니라 해시로만 저장된다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '2580', '2580');
  const rec = await st.get('teacherPin');
  assert.ok(!JSON.stringify(rec).includes('2580'));
  assert.ok(rec.salt && rec.hash);
});

test('AC-015 틀린 암호로는 전환되지 않고, 맞는 암호로만 된다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '2580', '2580');
  const wrong = await checkPin(st, '0000');
  assert.deepEqual([wrong.ok, wrong.error, wrong.left], [false, 'WRONG', MAX_TRIES - 1]);
  assert.equal((await checkPin(st, '2580')).ok, true);
});

test('연속으로 5번 틀리면 30초 잠기고, 잠긴 동안은 맞는 암호도 안 된다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '2580', '2580');
  const t0 = 1_000_000;
  let r;
  for (let i = 0; i < MAX_TRIES; i++) r = await checkPin(st, '1111', t0);
  assert.equal(r.error, 'LOCKED');
  assert.equal((await checkPin(st, '2580', t0 + 1000)).error, 'LOCKED');
  assert.equal((await checkPin(st, '2580', t0 + LOCK_MS + 1)).ok, true);
});

test('잊었을 때 초기화하면 암호가 지워지고 학생고래 모드로 돌아간다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '2580', '2580');
  await st.set('mode', 'mother');
  await resetPin(st);
  assert.equal(await hasPin(st), false);
  assert.equal(await st.get('mode'), 'baby');
  assert.equal((await checkPin(st, '2580')).error, 'NO_PIN');
});

// ---- 공모전·배포판: 기본 암호 없음 ----
import * as pinModule from '../extension/core/pin.js';
import { readFile } from 'node:fs/promises';

test('처음 설치한 기기에는 기본 암호가 없다 (1234 자동 설정 없음)', async () => {
  const st = createMemoryStorage();
  assert.equal('ensureDefaultPin' in pinModule, false);
  assert.equal('TEMP_DEFAULT_PIN' in pinModule, false);
  assert.equal(await pinModule.migrateLegacyDefaultPin(st), 'NONE'); // 앱 시작 때 부르는 정리 함수도 암호를 만들지 않는다
  assert.equal(await hasPin(st), false);
  assert.equal((await checkPin(st, '1234')).error, 'NO_PIN');
  // 사이드바 시작 코드에도 기본 암호를 넣는 부분이 없다
  const src = await readFile(new URL('../extension/sidebar.js', import.meta.url), 'utf8');
  assert.ok(!/ensureDefaultPin|setPin\(storage,\s*['"]\d+/.test(src));
});

test('처음 교사고래로 바꿀 때 직접 두 번 입력해 정하면 그 암호로만 들어간다', async () => {
  const st = createMemoryStorage();
  assert.equal(await hasPin(st), false); // → 화면은 '교사고래 암호를 처음 설정해 주세요.'
  assert.equal((await setPin(st, '13579', '13579')).ok, true);
  assert.equal((await checkPin(st, '13579')).ok, true);
  assert.equal((await checkPin(st, '1234')).error, 'WRONG');
});

test('예전 시험판이 넣은 임시 암호 1234는 시작할 때 지워지고 학생고래로 돌아간다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '1234', '1234');
  await st.set('pinDefaultSeeded', true);
  await st.set('mode', 'mother');
  assert.equal(await pinModule.migrateLegacyDefaultPin(st), 'RESET');
  assert.equal(await hasPin(st), false);
  assert.equal(await st.get('mode'), 'baby');
  assert.equal(await pinModule.migrateLegacyDefaultPin(st), 'NONE'); // 한 번만
});

test('예전 시험판 기기라도 교사가 암호를 바꿨다면 그 암호는 그대로 둔다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '8642', '8642');
  await st.set('pinDefaultSeeded', true);
  assert.equal(await pinModule.migrateLegacyDefaultPin(st), 'KEPT');
  assert.equal((await checkPin(st, '8642')).ok, true);
  assert.equal(await st.get('pinDefaultSeeded'), null);
});
