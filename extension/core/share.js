// 웨일 스페이스(클래스·팀보드·UBT)에 붙여 넣을 공유 묶음 만들기 (DOM 없음)
// 다른 서비스의 화면을 조작하지 않는다. 텍스트를 만들어 복사하면 교사·학생이 직접 붙여 넣는다.
// 학급 명단·댓글·평가는 다루지 않는다 (웨일 서비스가 맡는다).

export const SHARE_KINDS = ['class', 'teamboard', 'ubt', 'space'];

const FALLBACK_LINE = '※ 작품이 커서 링크를 만들 수 없어요. 꾸러미(.gorae.json) 파일을 받아 고래곳간 [가져오기]로 열어 주세요.';

const remixLine = (w) => (w.remixOf ? `🔄 ‘${w.remixOfTitle || w.remixOf}’을(를) 리믹스한 작품이에요. (버전 ${w.version})` : null);
const classLabel = (w) => [w.grade, w.subject].filter(Boolean).join('·');
const linkLines = (link) => (link ? ['▶ 바로 실행', link] : [FALLBACK_LINE]);
const clean = (lines) => lines.filter((l) => l !== null && l !== undefined && l !== false).join('\n');

// 검수 상태 한 줄 (status는 core/trust.js의 검증 결과)
function reviewLine(status) {
  if (status && status.ok) {
    const badge = { clear: '맑은 바다(학생 사용 가능)', shallow: '얕은 바다(교사용)', whirlpool: '소용돌이(보류)' }[status.badge] || status.badge;
    return `검수 상태: ${badge} · 검수 서명 확인됨 (파수꾼 ${status.reviewer.nickname})`;
  }
  return '검수 상태: 미검수 (검수 서명 없음)';
}

const BUILDERS = {
  // 웨일 클래스 공지·과제에 붙이는 안내
  class: (w, link) =>
    clean([
      w.title,
      w.howToUse,
      w.minutes ? `약 ${w.minutes}분 동안 활동합니다.` : null,
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
      `설명: ${w.howToUse}`,
      ...(link ? ['▶ 작품 실행', link] : [FALLBACK_LINE]),
      remixLine(w),
      '🔄 이 작품을 리믹스해 보세요. (고래곳간에서 [가져오기] 후 [리믹스])',
      '💬 칭찬과 제안은 팀보드 댓글로 남겨 주세요.',
    ]),

  // UBT 평가용 제출물 정리 (UBT 자체를 대신하지 않는다)
  ubt: (w, link, status) =>
    clean([
      '[고래곳간 작품 제출]',
      `작품명: ${w.title}`,
      `학년·교과: ${classLabel(w)}`,
      w.standard ? `성취기준: ${w.standard}` : null,
      `작품 설명: ${w.howToUse}`,
      `프롬프트 레시피: ${w.promptRecipe || '(기록 없음)'}`,
      `버전: ${w.version}`,
      w.remixOf ? `계보: ‘${w.remixOfTitle || w.remixOf}’을(를) 리믹스` : '계보: 새로 만든 작품',
      reviewLine(status),
      ...(link ? ['작품 실행 링크:', link] : [FALLBACK_LINE]),
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
  return { kind, text: build(work, link, status), link };
}
