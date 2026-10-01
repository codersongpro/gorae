// 검수 서명(전자서명) 핵심 모듈 — DOM 없이 WebCrypto만 사용 (확장앱·뷰어·검수 도구 공용)
// 서명: ECDSA P-256 + SHA-256. 검증 3단계: 족보 서명 → 파수꾼 등록·미말소 → 작품 서명.

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

// 검증 실패 이유 코드 (화면 문구는 ui/strings.js에서 매핑)
export const REASON = Object.freeze({
  NO_TAILPRINT: 'NO_TAILPRINT',
  LIST_INVALID: 'LIST_INVALID',
  LIST_OLD: 'LIST_OLD',
  REVIEWER_UNKNOWN: 'REVIEWER_UNKNOWN',
  REVIEWER_REVOKED: 'REVIEWER_REVOKED',
  CONTENT_CHANGED: 'CONTENT_CHANGED',
  SIG_INVALID: 'SIG_INVALID',
});

// ---------- 인코딩 ----------
export function toB64u(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 키 순서를 고정한 직렬화 (서명·해시 대상이 항상 같은 바이트가 되도록)
export function canonicalize(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
}

export async function sha256Hex(text) {
  const d = await subtle().digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- 열쇠 ----------
// extractable=false 이면 개인 열쇠를 꺼낼 수 없다(공개키는 항상 내보내기 가능).
// 대왕고래·백업 파일이 필요한 경우에만 true.
export async function generateKeyPair({ extractable = false } = {}) {
  return subtle().generateKey(ALGO, extractable, ['sign', 'verify']);
}
export async function exportPublicJwk(publicKey) {
  const { kty, crv, x, y } = await subtle().exportKey('jwk', publicKey);
  return { kty, crv, x, y };
}
export function importPublicJwk(jwk) {
  return subtle().importKey('jwk', jwk, ALGO, true, ['verify']);
}
export function importPrivateJwk(jwk) {
  return subtle().importKey('jwk', jwk, ALGO, false, ['sign']);
}

async function signText(privateKey, text) {
  return toB64u(await subtle().sign(SIGN, privateKey, enc.encode(text)));
}
async function verifyText(publicKey, sigB64u, text) {
  try {
    return await subtle().verify(SIGN, publicKey, fromB64u(sigB64u), enc.encode(text));
  } catch {
    return false;
  }
}

// ---------- 작품 서명 ----------
// 작품 카드에서 tailprint를 뺀 나머지의 해시
export function contentHash(work) {
  const { tailprint, ...rest } = work;
  return sha256Hex(canonicalize(rest));
}
const workPayload = (t) =>
  canonicalize({
    contentHash: t.contentHash,
    badge: t.badge,
    pick: !!t.pick,
    songs: t.songs || [],
    reviewer: t.reviewer,
    signedAt: t.signedAt,
  });

// 파수꾼이 작품에 검수 서명을 찍는다. 반환: tailprint가 붙은 새 작품 카드
export async function signWork(work, privateKey, { reviewer, badge, pick = false, songs = [], signedAt }) {
  const t = {
    contentHash: await contentHash(work),
    badge,
    pick: !!pick,
    songs,
    reviewer,
    signedAt: signedAt || new Date().toISOString(),
  };
  t.sig = await signText(privateKey, workPayload(t));
  return { ...work, tailprint: t };
}

// ---------- 고래 족보 ----------
const listPayload = (list) => {
  const { rootSig, ...rest } = list;
  return canonicalize(rest);
};

// 대왕고래가 족보에 서명한다 (버전은 호출하는 쪽에서 올려서 넘김)
export async function signReviewerList(list, rootPrivateKey) {
  const body = { ...list };
  delete body.rootSig;
  return { ...body, rootSig: await signText(rootPrivateKey, listPayload(body)) };
}

// 족보 검증: 대왕고래 서명 + 이미 본 버전보다 낮으면 거부
export async function verifyReviewerList(list, rootPublicJwk, lastSeenVersion = 0) {
  if (!list || typeof list.version !== 'number' || !list.rootSig) return { ok: false, reason: REASON.LIST_INVALID };
  const rootKey = await importPublicJwk(rootPublicJwk);
  if (!(await verifyText(rootKey, list.rootSig, listPayload(list)))) return { ok: false, reason: REASON.LIST_INVALID };
  if (list.version < lastSeenVersion) return { ok: false, reason: REASON.LIST_OLD };
  return { ok: true, version: list.version };
}

// 검증기: 족보를 한 번 검증해 두고 작품을 3단계로 확인한다.
// 말소 규칙: reason이 'left'(탈퇴)면 말소일 이전 서명만 인정, 그 밖의 사유(분실·유출)는 모두 무효.
export async function createVerifier({ rootPublicJwk, list, lastSeenVersion = 0 }) {
  const listResult = await verifyReviewerList(list, rootPublicJwk, lastSeenVersion);
  const keyCache = new Map();
  const keyOf = async (r) => {
    if (!keyCache.has(r.id)) keyCache.set(r.id, await importPublicJwk(r.publicKey));
    return keyCache.get(r.id);
  };
  return {
    listResult,
    async verify(work) {
      const t = work && work.tailprint;
      if (!t) return { ok: false, reason: REASON.NO_TAILPRINT };
      // ① 족보
      if (!listResult.ok) return { ok: false, reason: listResult.reason };
      // ② 파수꾼 등록·미말소
      const reviewer = (list.reviewers || []).find((r) => r.id === t.reviewer);
      if (!reviewer) return { ok: false, reason: REASON.REVIEWER_UNKNOWN };
      const rev = (list.revoked || []).find((r) => r.id === t.reviewer);
      if (rev) {
        const before = rev.reason === 'left' && Date.parse(t.signedAt) < Date.parse(rev.revokedAt);
        if (!before) return { ok: false, reason: REASON.REVIEWER_REVOKED };
      }
      // ③ 작품 내용·서명
      if ((await contentHash(work)) !== t.contentHash) return { ok: false, reason: REASON.CONTENT_CHANGED };
      if (!(await verifyText(await keyOf(reviewer), t.sig, workPayload(t)))) return { ok: false, reason: REASON.SIG_INVALID };
      return {
        ok: true,
        badge: t.badge,
        pick: !!t.pick,
        songs: t.songs || [],
        reviewer: { id: reviewer.id, nickname: reviewer.nickname },
        signedAt: t.signedAt,
      };
    },
  };
}
