// 8단계 일부: 어미고래 암호(PIN) — FR-010, AC-015
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

test('잊었을 때 초기화하면 암호가 지워지고 아기고래 모드로 돌아간다', async () => {
  const st = createMemoryStorage();
  await setPin(st, '2580', '2580');
  await st.set('mode', 'mother');
  await resetPin(st);
  assert.equal(await hasPin(st), false);
  assert.equal(await st.get('mode'), 'baby');
  assert.equal((await checkPin(st, '2580')).error, 'NO_PIN');
});
