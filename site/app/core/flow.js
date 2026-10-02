// 수업 진행(도입 → 활동 → 정리) 순서 만들기와 웨일 서비스별 추천 (DOM 없음)
import { normalizeWork } from '../shared/taxonomy.js';

// 단계 이름: 3개면 도입·활동·정리, 2개면 도입·활동, 그 밖에는 번호
export function flowLabels(n) {
  if (n === 3) return ['도입', '활동', '정리'];
  if (n === 2) return ['도입', '활동'];
  return Array.from({ length: n }, (_, i) => `${i + 1}단계`);
}

// ids 순서대로 내 곳간 기록을 단계로 만든다. 없는 작품은 건너뛴다.
export function buildFlowSteps(records, ids) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const picked = ids.map((id) => byId.get(id)).filter(Boolean);
  const labels = flowLabels(picked.length);
  return picked.map((r, i) => ({ id: r.id, label: labels[i], work: r.work, minutes: normalizeWork(r.work).estimatedMinutes || 0 }));
}

export const totalMinutes = (steps) => steps.reduce((a, s) => a + s.minutes, 0);

// 웨일온 수업 중에 바로 쓰기 좋은 도구: 전체·교사용, 짧은(10분 이하) 작품을 위에서 limit개
export function recommendForRemote(entries, limit = 4) {
  return entries
    .filter((e) => {
      const m = normalizeWork(e.work);
      return m.estimatedMinutes > 0 && m.estimatedMinutes <= 10 && ['whole_class', 'teacher'].includes(m.groupType);
    })
    .slice(0, limit);
}

// 학급 꾸러미와 함께 올리는 '과제 안내문' (웨일 클래스 과제 글에 붙여 넣기)
export function buildAssignment({ name, works, teacherNote = '' }) {
  const labels = flowLabels(works.length);
  const total = works.reduce((a, w) => a + (normalizeWork(w).estimatedMinutes || 0), 0);
  return [
    `[과제] ${name}`,
    teacherNote.trim() || null,
    total ? `예상 시간: 약 ${total}분` : null,
    '',
    '해야 할 일',
    ...works.map((w, i) => `${works.length > 1 ? `${labels[i]}: ` : ''}${w.title} — ${w.howToUse || ''}`.trim()),
    '',
    '내는 방법',
    '1. 고래곳간에서 작품을 실행해 활동합니다.',
    '2. 활동 뒤에 알게 된 점이나 느낀 점을 한두 문장으로 적어 이 과제에 댓글로 냅니다.',
    '※ 이름·연락처 같은 개인정보는 작품에 넣지 마세요.',
  ].filter((l) => l !== null).join('\n');
}
