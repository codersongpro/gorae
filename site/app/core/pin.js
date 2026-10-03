// 교사고래 암호(PIN): 기기별 4자리 이상 숫자, 해시(PBKDF2-SHA256 + 소금값)로만 저장한다 (DOM 없음)
// 학생 앞 '실수 방지' 수준의 잠금이다. 진짜 권한 경계는 검수 서명이다.
import { toB64u, fromB64u } from '../shared/tailprint.js';

const KEY = 'teacherPin';
const ITER = 100000;
export const MAX_TRIES = 5; // 연속으로 틀리면
export const LOCK_MS = 30 * 1000; // 잠시 잠근다

export const validPin = (pin) => /^\d{4,8}$/.test(String(pin || ''));

async function hashPin(pin, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256);
  return toB64u(bits);
}

export async function hasPin(storage) {
  return !!(await storage.get(KEY));
}

// 반환: { ok, error? }
export async function setPin(storage, pin, confirm) {
  if (!validPin(pin)) return { ok: false, error: 'FORMAT' };
  if (pin !== confirm) return { ok: false, error: 'MISMATCH' };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await storage.set(KEY, { salt: toB64u(salt), hash: await hashPin(pin, salt), iter: ITER, fails: 0, lockedUntil: 0 });
  return { ok: true };
}

// 반환: { ok } | { ok:false, error:'NO_PIN'|'WRONG'|'LOCKED', left?, waitMs? }
export async function checkPin(storage, pin, now = Date.now()) {
  const rec = await storage.get(KEY);
  if (!rec) return { ok: false, error: 'NO_PIN' };
  if (rec.lockedUntil > now) return { ok: false, error: 'LOCKED', waitMs: rec.lockedUntil - now };
  const same = (await hashPin(String(pin || ''), fromB64u(rec.salt), rec.iter)) === rec.hash;
  if (same) {
    await storage.set(KEY, { ...rec, fails: 0, lockedUntil: 0 });
    return { ok: true };
  }
  const fails = rec.fails + 1;
  const locked = fails >= MAX_TRIES;
  await storage.set(KEY, { ...rec, fails: locked ? 0 : fails, lockedUntil: locked ? now + LOCK_MS : 0 });
  return locked ? { ok: false, error: 'LOCKED', waitMs: LOCK_MS } : { ok: false, error: 'WRONG', left: MAX_TRIES - fails };
}

// 잊었을 때: 암호를 지우고 학생고래 모드로 돌아간다 (다시 정해야 교사고래 모드를 쓸 수 있다)
export async function resetPin(storage) {
  await storage.set(KEY, null);
  await storage.set('mode', 'baby');
}

// 예전 시험판이 처음 쓰는 기기에 자동으로 넣던 임시 암호(1234)를 정리한다.
// 지금은 기본 암호를 절대 만들지 않는다. 처음 교사고래로 바꿀 때 교사가 직접 정한다.
// 자동으로 들어간 기록(pinDefaultSeeded)이 있고 암호가 아직 그 값 그대로면 지우고 학생고래 모드로 돌린다.
// 교사가 이미 다른 암호로 바꿨으면 그 암호는 그대로 둔다. 반환: 'RESET' | 'KEPT' | 'NONE'
const LEGACY_SEED_FLAG = 'pinDefaultSeeded';
const LEGACY_DEFAULT = '1234';
export async function migrateLegacyDefaultPin(storage) {
  if (!(await storage.get(LEGACY_SEED_FLAG))) return 'NONE';
  const rec = await storage.get(KEY);
  let reset = false;
  if (rec && rec.salt && rec.hash) reset = (await hashPin(LEGACY_DEFAULT, fromB64u(rec.salt), rec.iter)) === rec.hash; // 실패 횟수는 건드리지 않는다
  if (reset) await resetPin(storage);
  await storage.set(LEGACY_SEED_FLAG, null);
  return reset ? 'RESET' : 'KEPT';
}
