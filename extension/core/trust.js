// 꼬리지문 연결부: 족보를 고르고(낮은 버전은 거부) 목록의 모든 작품을 검증해 화면용 항목을 만든다.
import { createVerifier, verifyReviewerList } from '../shared/tailprint.js';

// 새 족보가 검증을 통과하면 채택·보관하고, 아니면 이전에 믿은 족보를 유지한다.
export async function resolveTrustedList({ candidate, storage, rootJwk }) {
  const lastSeen = (await storage.get('lastListVersion')) || 0;
  const res = await verifyReviewerList(candidate, rootJwk, lastSeen);
  if (res.ok) {
    await storage.set('trustedList', candidate);
    await storage.set('lastListVersion', res.version);
    return { list: candidate, accepted: true, version: res.version };
  }
  const kept = await storage.get('trustedList');
  return { list: kept || candidate, accepted: false, reason: res.reason, version: lastSeen };
}

// 반환: [{ work, status }] — status.ok=false 이면 배지 대신 status.reason을 보여 준다
export async function buildEntries({ works, list, storage, rootJwk }) {
  const lastSeen = (await storage.get('lastListVersion')) || 0;
  const verifier = await createVerifier({ rootPublicJwk: rootJwk, list, lastSeenVersion: lastSeen });
  return Promise.all(works.map(async (work) => ({ work, status: await verifier.verify(work) })));
}

// 화면에 보일 배지: 검증 통과 때만 서명된 배지, 아니면 얕은 바다(미검수)
export const displayBadge = (entry) => (entry.status.ok ? entry.status.badge : 'shallow');
