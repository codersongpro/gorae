// 개인 열쇠 백업 파일 — 비밀번호로 암호화한다 (PBKDF2-SHA256 + AES-GCM). DOM 없이 WebCrypto만 사용.
// 검수 도구가 열쇠를 만들 때 한 번 백업 파일을 내려받게 하고, 브라우저에는 꺼낼 수 없는 형태로만 보관한다.
import { toB64u, fromB64u } from './tailprint.js';

export const BACKUP_FORMAT = 'gorae-keybackup';
export const MIN_PASSWORD = 8;
const ITER = 310000;
const enc = new TextEncoder();

export const checkPassword = (pw) => (typeof pw === 'string' && pw.length >= MIN_PASSWORD ? { ok: true } : { ok: false, message: `암호는 ${MIN_PASSWORD}자 이상이어야 해요.` });

async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// 개인 열쇠(JWK)를 암호 걸어 백업 객체로 만든다. 이 객체를 파일로 저장한다.
export async function encryptJwk(jwk, password, { kind = 'reviewer' } = {}) {
  const pw = checkPassword(password);
  if (!pw.ok) throw new Error(pw.message);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITER);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(jwk)));
  return { format: BACKUP_FORMAT, v: 1, kind, kdf: 'PBKDF2-SHA256', iter: ITER, salt: toB64u(salt), iv: toB64u(iv), data: toB64u(data) };
}

// 백업 객체와 암호로 개인 열쇠(JWK)를 되살린다. 암호가 틀리면 BAD_PASSWORD 오류.
export async function decryptJwk(backup, password) {
  if (!backup || backup.format !== BACKUP_FORMAT || backup.v !== 1) throw new Error('BAD_BACKUP');
  try {
    const key = await deriveKey(password, fromB64u(backup.salt), backup.iter);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(backup.iv) }, key, fromB64u(backup.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('BAD_PASSWORD');
  }
}
