// 검수 도구의 핵심 로직 — 파수꾼고래의 서명 찍기, 파수꾼고래의 고래 족보 관리 (DOM 없음)
import { signWork, signReviewerList } from './tailprint.js';

export const BADGES = ['clear', 'shallow', 'whirlpool'];
export const MAX_SONG_CHARS = 80;
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const isHttps = (u) => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

// 고래 노래(한 줄 후기) 검사: 80자 이하, 작성자는 별명·학교급 표시
export function validateSongs(songs = []) {
  const errors = [];
  songs.forEach((s, i) => {
    if (!s || typeof s.text !== 'string' || !s.text.trim()) errors.push(`${i + 1}번째 고래 노래가 비어 있어요.`);
    else if ([...s.text].length > MAX_SONG_CHARS) errors.push(`${i + 1}번째 고래 노래가 ${MAX_SONG_CHARS}자를 넘어요.`);
    if (!s || !s.author) errors.push(`${i + 1}번째 고래 노래의 작성자(별명·학교급)가 없어요.`);
  });
  return errors;
}

// exe 항목은 링크·소스 저장소·SHA-256·검사 결과·실행 환경이 모두 있어야 서명할 수 있다 (FR-016)
export function validateExeItem(item) {
  const errors = [];
  if (!isHttps(item.url)) errors.push('실행 파일 링크(https)가 없어요.');
  if (!isHttps(item.sourceRepo)) errors.push('소스 저장소 링크(https)가 없어요.');
  if (!SHA256_HEX.test(item.sha256 || '')) errors.push('SHA-256 값(64자리)이 없거나 올바르지 않아요.');
  if (!item.scanResult || !String(item.scanResult).trim()) errors.push('검사 결과가 없어요.');
  if (!item.environment || !String(item.environment).trim()) errors.push('실행 환경이 없어요.');
  return { ok: errors.length === 0, errors };
}

// 작품에 검수 서명을 찍어 catalog에 넣을 항목을 만든다.
// 들어온 작품에 이미 붙어 있던 검수 서명은 버리고 새로 찍는다 (남이 만든 서명은 믿지 않음).
// 반환: { ok, item?, errors? }
export async function signForCatalog({ work, privateKey, reviewerId, badge, pick = false, songs = [], signedAt }) {
  const errors = [];
  if (!BADGES.includes(badge)) errors.push('배지(맑은 바다·얕은 바다·소용돌이)를 골라 주세요.');
  if (!reviewerId) errors.push('파수꾼고래 id가 없어요.');
  if (!privateKey) errors.push('검수 서명 열쇠가 없어요.');
  errors.push(...validateSongs(songs));
  if (work.type === 'exe-link') errors.push(...validateExeItem(work).errors);
  if (errors.length) return { ok: false, errors };
  const { tailprint, ...bare } = work;
  const item = await signWork(bare, privateKey, { reviewer: reviewerId, badge, pick, songs, signedAt });
  return { ok: true, item };
}

// ---------- 고래 족보 (파수꾼고래) ----------
const nextBody = (list, now, patch) => {
  const { rootSig, ...rest } = list;
  return { ...rest, ...patch, version: list.version + 1, issuedAt: now.toISOString() };
};

export const emptyList = (now = new Date()) => ({ version: 0, issuedAt: now.toISOString(), reviewers: [], revoked: [] });

// entry: { id, nickname, publicKey } — 파수꾼고래가 만든 공개키 묶음
export function addReviewer(list, entry, now = new Date()) {
  if (!entry || !entry.id || !entry.nickname || !entry.publicKey || entry.publicKey.kty !== 'EC') throw new Error('파수꾼고래 정보(id·별명·공개키)가 올바르지 않아요.');
  if (entry.publicKey.d) throw new Error('개인 열쇠가 섞여 있어요. 공개키만 넣어야 해요.');
  if (list.reviewers.some((r) => r.id === entry.id)) throw new Error('이미 등록된 파수꾼고래 id예요.');
  return nextBody(list, now, { reviewers: [...list.reviewers, { id: entry.id, nickname: entry.nickname, publicKey: entry.publicKey, addedAt: now.toISOString() }] });
}

// reason: 'left'(탈퇴·전근: 말소 이전 서명은 인정) | 'lost'(분실) | 'leaked'(유출): 모두 무효
export function revokeReviewer(list, id, reason, now = new Date()) {
  if (!['left', 'lost', 'leaked'].includes(reason)) throw new Error('말소 사유를 골라 주세요.');
  if (!list.reviewers.some((r) => r.id === id)) throw new Error('족보에 없는 파수꾼고래이에요.');
  if (list.revoked.some((r) => r.id === id)) throw new Error('이미 말소된 파수꾼고래이에요.');
  return nextBody(list, now, { revoked: [...list.revoked, { id, revokedAt: now.toISOString(), reason }] });
}

// 버전이 올라간 족보 본문에 관리 열쇠로 서명한다
export const signList = (body, rootPrivateKey) => signReviewerList(body, rootPrivateKey);

// catalog에 항목을 넣거나(같은 id면 교체) 뺀다
export function upsertCatalogItem(catalog, item, now = new Date()) {
  const key = item.type === 'exe-link' ? 'exeItems' : 'items';
  const rest = (catalog[key] || []).filter((w) => w.id !== item.id);
  return { ...catalog, updatedAt: now.toISOString(), [key]: [...rest, item] };
}
