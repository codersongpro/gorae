// 메인 탭이 어떤 웨일 서비스인지 도메인만 보고 판별한다 (주소는 저장·전송하지 않는다).
// 도메인은 웨일 퀘스트 개발 때 실제 화면에서 확인한 값이다. 확인되지 않은 서비스는 추가하지 않는다.
// UBT 시험 화면의 정확한 주소 형태는 미확인 — 시험 잠금(FR-018)은 확인 후 구현한다.
import { SHARE_KINDS } from './share.js';

export const SERVICE_RULES = [
  { host: 'class.whalespace.io', service: 'class' },
  { host: 'teamboard.whalespace.io', service: 'teamboard' },
  { host: 'teamboard.whale.naver.com', service: 'teamboard' },
  { host: 'ubt.whalespace.io', service: 'ubt' },
  { host: 'study.whaleon.naver.com', service: 'remote' },
];

export const SERVICE_LABEL = { class: '웨일 클래스', teamboard: '팀보드', ubt: '웨일 UBT', remote: '웨일온' };

// 반환: 'class' | 'teamboard' | 'ubt' | 'remote' | null
export function detectService(url, rules = SERVICE_RULES) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    const rule = rules.find((r) => r.host === u.hostname);
    return rule ? rule.service : null;
  } catch {
    return null;
  }
}

// 지금 화면의 서비스에 맞는 공유 버튼을 맨 앞으로 보낸다
export function orderShareKinds(service) {
  const first = SHARE_KINDS.includes(service) ? service : null;
  return first ? [first, ...SHARE_KINDS.filter((k) => k !== first)] : [...SHARE_KINDS];
}
