// 웨일 스페이스(클래스·팀보드)에 붙여 넣을 공유 묶음 만들기 (DOM 없음)
// 다른 서비스의 화면을 조작하지 않는다. 텍스트를 만들어 복사하면 교사·학생이 직접 붙여 넣는다.
// 학급 명단·댓글·평가는 다루지 않는다 (웨일 서비스가 맡는다).
// 고래곳간 안의 안전 정보(검수 상태)가 클래스·팀보드로 넘어가도 사라지지 않게, 모든 공유 글에 검수 상태를 넣는다.
import { normalizeWork, levelOf } from '../shared/taxonomy.js';

export const SHARE_KINDS = ['class', 'teamboard', 'space'];

const FALLBACK_LINE = '※ 작품이 커서 링크를 만들 수 없어요. 꾸러미(.gorae.json) 파일을 받아 고래곳간 [가져오기]로 열어 주세요.';

const remixLine = (w) => (w.remixOf ? `🔄 ‘${w.remixOfTitle || w.remixOf}’을(를) 리믹스한 작품이에요. (버전 ${w.version})` : null);
const classLabel = (w) => [w.grade, w.subject].filter(Boolean).join(' · ');
// 예상 시간 안내 (예: 약 5분 동안 활동합니다.)
const minutesLine = (m) => (!m ? null : m === 45 ? '한 차시 동안 활동합니다.' : m >= 90 ? '여러 차시에 걸쳐 활동합니다.' : `약 ${m}분 동안 활동합니다.`);
// 링크가 너무 길면(작품이 클수록 길어진다) 글이 지저분해지므로 넣지 않고, 파일 첨부를 안내한다
export const MAX_INLINE_LINK = 300;
const ATTACH_LINE = '📎 작품 파일을 첨부했어요. 고래곳간 [가져오기]에서 파일을 열어 주세요.';
const shortLink = (link) => (link && link.length <= MAX_INLINE_LINK ? link : null);
const linkLines = (link) => (link ? (shortLink(link) ? ['▶ 바로 실행', link] : [ATTACH_LINE]) : [FALLBACK_LINE]);
const lines = (arr) => arr.filter((l) => l !== null && l !== undefined && l !== false && l !== '');
// 문단(줄 묶음) 사이에 빈 줄 하나
const paragraphs = (...groups) => groups.map(lines).filter((g) => g.length).map((g) => g.join('\n')).join('\n\n');

export const CLASS_TEMPLATES = [
  { id: 'lesson', label: '수업에 활용' }, { id: 'self_learning', label: '자기주도학습으로 활용' },
  { id: 'assignment', label: '과제로 활용' }, { id: 'presentation', label: '발표·공유 활동' }, { id: 'peer', label: '동료평가' },
];
export const TEAMBOARD_TEMPLATES = [
  { id: 'presentation', label: '발표자료 공유' }, { id: 'learning_result', label: '학습 결과 공유' },
  { id: 'inquiry', label: '탐구 결과 공유' }, { id: 'exhibition', label: '작품 전시' },
  { id: 'feedback', label: '피드백 요청' }, { id: 'improvement', label: '개선 아이디어 요청' },
];
function classShare(w, link, status, template = 'lesson') {
  const titles = { lesson: '학습활동', self_learning: '자기주도학습', assignment: '과제', presentation: '발표·공유 활동', peer: '동료평가' };
  const guidance = {
    lesson: ['활동 방법', w.howToUse],
    self_learning: ['오늘의 학습', '1. 개념 익히기 → 2. 활동하기 → 3. 연습하기 → 4. 스스로 확인하기', w.howToUse,
      w.selfDirected ? '혼자 진행할 수 있는 안내가 포함된 자료입니다.' : '혼자 진행 가능한지 교사가 먼저 확인해 주세요.',
      '학습이 끝나면 새롭게 알게 된 점, 어려웠던 점, 다시 공부하고 싶은 부분을 정리해 보세요.'],
    assignment: ['해야 할 일', w.howToUse, '결과 정리: 주장·발견한 점과 근거를 정리하세요.', '제출 방법: 교사가 정한 방식으로 결과물 링크 또는 파일을 웨일 클래스에 제출하세요.'],
    presentation: ['발표 순서: 주제와 질문 → 자료·근거 → 발견한 점 → 정리', w.howToUse, '발표자료 링크 또는 파일을 공유하고 친구의 질문을 받아 보세요.'],
    peer: ['동료평가 기준: 내용의 정확성 · 근거의 적절성 · 설명의 명확성', w.howToUse, '좋았던 점과 더 명확해질 점을 근거와 함께 남겨 주세요.'],
  };
  if (!titles[template]) throw new Error('알 수 없는 클래스 템플릿: ' + template);
  return paragraphs([`🐋 ${w.title}`, `[고래곳간 ${titles[template]}]`],
    [classLabel(w), minutesLine(w.minutes), w.standard ? `성취기준: ${w.standard}` : null],
    guidance[template], reviewLines(status), linkLines(link), [remixLine(w),
      w.creationMethod?.includes('vibe_coding') ? '제작 방법: AI와 바이브코딩' : null]);
}
function teamboardShare(w, link, status, template) {
  const selected = template || (w.contentType === 'presentation' ? 'presentation' : w.category === 'project' ? 'inquiry' : 'exhibition');
  const label = TEAMBOARD_TEMPLATES.find(t => t.id === selected)?.label;
  if (!label) throw new Error('알 수 없는 팀보드 템플릿: ' + selected);
  const prompts = {
    presentation: '새롭게 알게 된 점 · 궁금한 점 · 더 조사하면 좋을 점',
    learning_result: '알게 된 점 · 함께 비교할 점 · 다음 학습 질문',
    inquiry: '자료의 근거 · 발견한 변화 · 추가로 조사할 질문',
    exhibition: '인상 깊은 점 · 제작 의도가 잘 드러난 부분',
    feedback: '좋았던 점 · 구체적으로 보완하면 좋을 점',
    improvement: '바꾸면 좋을 부분 · 바꾼 이유 · 함께 시도할 방법',
  };
  return paragraphs([`🐋 ${label}`, `작품명: ${w.title}`, `만든이: ${w.author || '닉네임 없음'}`, `설명: ${w.description || w.howToUse}`],
    reviewLines(status), linkLines(link), [remixLine(w), `💬 ${prompts[selected]}을 팀보드 댓글로 남겨 주세요.`,
      !template && w.contentType === 'interactive_activity' ? '선택 활동: 필요하면 이 작품을 리믹스해 보세요. (고래곳간 [가져오기] → [리믹스])' : null]);
}

// ---------- 검수 상태 (status는 core/trust.js의 검증 결과) ----------
const BADGE_LINE = { clear: '🟢 맑은 바다', shallow: '🔵 얕은 바다 (교사용)', whirlpool: '🔴 소용돌이 (보류)' };
// 보류(소용돌이)로 검수된 작품은 공유하지 않는다
export const shareBlocked = (status) => !!(status && status.ok && status.badge === 'whirlpool');
export function reviewLines(status) {
  if (status && status.ok) return [BADGE_LINE[status.badge] || status.badge, `검수 서명 확인됨 · 파수꾼고래 ${status.reviewer.nickname}`];
  const lead = '🟡 아직 검수되지 않은 작품입니다.';
  if (status && status.reason === 'CONTENT_CHANGED') return [lead, '서명 뒤 내용이 바뀌어 검수 표시를 지웠어요. 교사가 먼저 확인한 뒤 사용해 주세요.'];
  return [lead, '교사가 먼저 확인한 뒤 사용해 주세요.'];
}
// 한 줄 요약 (학급 과제 글의 작품 목록용)
export function reviewShort(status) {
  if (status && status.ok) return `${BADGE_LINE[status.badge] || status.badge} · 검수 서명 확인됨`;
  return '🟡 미검수 · 교사가 먼저 확인해 주세요';
}

const BUILDERS = {
  class: classShare,
  teamboard: teamboardShare,
  // 그 밖의 웨일 스페이스 화면(웨일온 등)에 붙이는 간단한 소개
  space: (w, link, status) =>
    paragraphs(
      ['🐋 오늘 수업', `${w.title}${classLabel(w) ? ` (${classLabel(w)})` : ''}`, w.howToUse, `만든이: ${w.author || '이름 없음'}`],
      reviewLines(status),
      linkLines(link),
      [remixLine(w)],
    ),
};

const viewOf = (work) => {
  // 예전 작품('초4' 형식)과 새 작품(학교급+학년)을 같은 모양으로 맞춘다
  const m = normalizeWork(work);
  return { ...work, contentType: m.contentType, selfDirected: m.selfDirected, creationMethod: m.creationMethod, grade: m.gradeLabel, subject: m.subject, standard: m.standard, minutes: m.estimatedMinutes, description: m.description, path: m.path.join(' › ') };
};

// 반환: { kind, text, link } | { kind, text: null, link: null, blocked: 'WHIRLPOOL' }
export function buildShare(kind, work, { link = null, status = null, template } = {}) {
  const build = BUILDERS[kind];
  if (!build) throw new Error('알 수 없는 공유 종류: ' + kind);
  if (shareBlocked(status)) return { kind, text: null, link: null, blocked: 'WHIRLPOOL' };
  const view = viewOf(work);
  return { kind, text: build(view, link, status, template), link };
}

// ---------- UBT 수행평가 등에 붙여 넣는 평가용 정보 ----------
// UBT와 자동으로 연결하지 않는다(공식 연동 없음). 교사가 복사해서 수행평가 문항·채점 메모 등에 직접 붙여 넣는다.
// 반환: { text } | { text: null, blocked: 'WHIRLPOOL' }
export function buildAssessmentText(work, { link = null, status = null, originalTitle = '' } = {}) {
  if (shareBlocked(status)) return { text: null, blocked: 'WHIRLPOOL' };
  const m = normalizeWork(work);
  const level = levelOf(m.schoolLevel);
  const run = link ? (shortLink(link) ? link : '(링크가 길어 꾸러미 파일로 제출 — 고래곳간 [가져오기]로 열기)') : '(링크 없음 — 꾸러미 파일 .gorae.json으로 제출)';
  const text = paragraphs(
    ['[고래곳간 수행평가 결과물]'],
    [`작품명: ${work.title}`, `작품 설명: ${m.description || work.howToUse || ''}`, work.author ? `만든이: ${work.author}` : null],
    [
      level ? `학교급: ${level.label}` : null, m.grade ? `학년: ${m.grade}` : null, m.subject ? `교과: ${m.subject}` : null,
      m.unit ? `단원: ${m.unit}` : null, m.topic ? `주제: ${m.topic}` : null, m.standard ? `성취기준: ${m.standard}` : null,
    ],
    ['작품 실행:', run],
    [
      `버전: ${work.version || 1}`,
      work.remixOf ? '리믹스 여부: 있음' : null,
      work.remixOf ? `원작: ${originalTitle || work.remixOfTitle || work.remixOf}` : null,
      `검수 상태: ${reviewShort(status)}`,
    ],
    work.promptRecipe ? ['프롬프트 레시피:', work.promptRecipe] : [],
    ['※ 고래곳간이 만든 붙여넣기용 정보예요. UBT에 자동으로 제출·채점되지 않습니다.'],
  );
  return { text };
}
