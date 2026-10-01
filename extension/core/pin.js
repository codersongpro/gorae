// 어미고래 암호(PIN): 기기별 4자리 이상 숫자, 해시(PBKDF2-SHA256 + 소금값)로만 저장한다 (DOM 없음)
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

// 잊었을 때: 암호를 지우고 아기고래 모드로 돌아간다 (다시 정해야 어미고래 모드를 쓸 수 있다)
export async function resetPin(storage) {
  await storage.set(KEY, null);
  await storage.set('mode', 'baby');
}
