// 이달의 고래자리: 파수꾼고래가 관리 열쇠로 서명한 이달의 전시 목록 (DOM 없음)
// catalog.featured = { month: '2026-10', title, note, items: [작품 id…], issuedAt, sig }
// 서명이 맞지 않으면 띠를 아예 보여 주지 않는다 (AC-031).
import { canonicalize, toB64u, fromB64u, importPublicJwk } from './tailprint.js';

const SIGN = { name: 'ECDSA', hash: 'SHA-256' };
export const MAX_FEATURED = 6;
const payload = (f) => canonicalize({ month: f.month, title: f.title || '', note: f.note || '', items: f.items, issuedAt: f.issuedAt });

export function validateFeatured({ month, items }) {
  const errors = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) errors.push('달(YYYY-MM)을 적어 주세요.');
  if (!Array.isArray(items) || !items.length) errors.push('전시할 작품을 하나 이상 골라 주세요.');
  else if (items.length > MAX_FEATURED) errors.push(`이달의 고래자리는 ${MAX_FEATURED}개까지예요.`);
  return errors;
}

export async function signFeatured({ month, title = '', note = '', items, issuedAt = new Date().toISOString() }, rootPrivateKey) {
  const errors = validateFeatured({ month, items });
  if (errors.length) throw new Error(errors.join(' '));
  const body = { month, title, note, items: [...items], issuedAt };
  const sig = await crypto.subtle.sign(SIGN, rootPrivateKey, new TextEncoder().encode(payload(body)));
  return { ...body, sig: toB64u(sig) };
}

// 반환: { ok:true, month, title, note, items:[목록에 실제 있는 id] } | { ok:false, reason: 'NONE'|'INVALID' }
export async function verifyFeatured(featured, rootPublicJwk, catalogItems = []) {
  if (!featured) return { ok: false, reason: 'NONE' };
  if (!Array.isArray(featured.items) || typeof featured.sig !== 'string') return { ok: false, reason: 'INVALID' };
  let good = false;
  try {
    const key = await importPublicJwk(rootPublicJwk);
    good = await crypto.subtle.verify(SIGN, key, fromB64u(featured.sig), new TextEncoder().encode(payload(featured)));
  } catch {
    good = false;
  }
  if (!good) return { ok: false, reason: 'INVALID' };
  const ids = new Set(catalogItems.map((w) => w.id));
  return { ok: true, month: featured.month, title: featured.title, note: featured.note, items: featured.items.filter((id) => ids.has(id)) };
}
