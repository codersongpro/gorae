// 웨일 스페이스(클래스·팀보드)에 붙여 넣을 공유 묶음 만들기 (DOM 없음)
// 다른 서비스의 화면을 조작하지 않는다. 텍스트를 만들어 복사하면 교사·학생이 직접 붙여 넣는다.
// 학급 명단·댓글·평가는 다루지 않는다 (웨일 서비스가 맡는다).
import { normalizeWork } from '../shared/taxonomy.js';

export const SHARE_KINDS = ['class', 'teamboard', 'space'];

const FALLBACK_LINE = '※ 작품이 커서 링크를 만들 수 없어요. 꾸러미(.gorae.json) 파일을 받아 고래곳간 [가져오기]로 열어 주세요.';

const remixLine = (w) => (w.remixOf ? `🔄 ‘${w.remixOfTitle || w.remixOf}’을(를) 리믹스한 작품이에요. (버전 ${w.version})` : null);
const classLabel = (w) => [w.grade, w.subject].filter(Boolean).join('·');
// 예상 시간 안내 (예: 약 5분 동안 활동합니다.)
const minutesLine = (m) => (!m ? null : m === 45 ? '한 차시 동안 활동합니다.' : m >= 90 ? '여러 차시에 걸쳐 활동합니다.' : `약 ${m}분 동안 활동합니다.`);
// 링크가 너무 길면(작품이 클수록 길어진다) 글이 지저분해지므로 넣지 않고, 파일 첨부를 안내한다
export const MAX_INLINE_LINK = 300;
const ATTACH_LINE = '📎 작품 파일을 첨부했어요. 고래곳간 [가져오기]에서 파일을 열어 주세요.';
const shortLink = (link) => (link && link.length <= MAX_INLINE_LINK ? link : null);
const linkLines = (link) => (link ? (shortLink(link) ? ['▶ 바로 실행', link] : [ATTACH_LINE]) : [FALLBACK_LINE]);
const clean = (lines) => lines.filter((l) => l !== null && l !== undefined && l !== false).join('\n');

// 검수 상태 한 줄 (status는 core/trust.js의 검증 결과)
function reviewLine(status) {
  if (status && status.ok) {
    const badge = { clear: '맑은 바다(학생 사용 가능)', shallow: '얕은 바다(교사용)', whirlpool: '소용돌이(보류)' }[status.badge] || status.badge;
    return `검수 상태: ${badge} · 검수 서명 확인됨 (파수꾼고래 ${status.reviewer.nickname})`;
  }
  return '검수 상태: 미검수 (검수 서명 없음)';
}

const BUILDERS = {
  // 웨일 클래스 공지·과제에 붙이는 안내
  class: (w, link) =>
    clean([
      w.title,
      w.howToUse,
      minutesLine(w.minutes),
      w.standard ? `성취기준: ${w.standard}` : null,
      ...linkLines(link),
      remixLine(w),
    ]),

  // 팀보드 전시 카드
  teamboard: (w, link) =>
    clean([
      '🐋 우리 반 바이브코딩 작품',
      `작품명: ${w.title}`,
      `만든이: ${w.author || '이름 없음'}`,
      `설명: ${w.description || w.howToUse}`,
      ...linkLines(link),
      remixLine(w),
      '🔄 이 작품을 리믹스해 보세요. (고래곳간에서 [가져오기] 후 [리믹스])',
      '💬 칭찬과 제안은 팀보드 댓글로 남겨 주세요.',
    ]),

  // 그 밖의 웨일 스페이스 화면에 붙이는 간단한 소개
  space: (w, link) =>
    clean([
      `🐋 ${w.title} (${classLabel(w)})`,
      w.howToUse,
      `만든이: ${w.author || '이름 없음'}`,
      ...linkLines(link),
      remixLine(w),
    ]),
};

// 반환: { kind, text, link }  — link는 QR 만들기용으로 함께 돌려준다 (QR 그리기는 후속)
export function buildShare(kind, work, { link = null, status = null } = {}) {
  const build = BUILDERS[kind];
  if (!build) throw new Error('알 수 없는 공유 종류: ' + kind);
  // 예전 작품('초4' 형식)과 새 작품(학교급+학년)을 같은 모양으로 맞춘다
  const m = normalizeWork(work);
  const view = { ...work, grade: m.gradeLabel, subject: m.subject, standard: m.standard, minutes: m.estimatedMinutes, description: m.description, path: m.path.join(' › ') };
  return { kind, text: build(view, link, status), link };
}
