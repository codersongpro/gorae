// 시험용 등록 입력값 — 새 분류 체계(수업/업무 → 카테고리 → 하위 → 태그)를 모두 채운 기본값
export const lessonInput = (o = {}) => ({
  title: '내 퀴즈',
  artifactType: 'html',
  html: '<p>hi</p>',
  domain: 'lesson',
  category: 'subject_activity',
  subcategory: 'practice',
  schoolLevel: 'elementary',
  grade: '6',
  subject: '국어',
  topic: '낱말 퀴즈',
  audience: ['student'],
  tags: ['퀴즈'],
  howToUse: '풀어 보세요',
  author: '푸른 고래 · 초등',
  ...o,
});

export const toolInput = (o = {}) => lessonInput({ category: 'classroom_tool', subcategory: 'timer', schoolLevel: '', grade: '', subject: '', topic: '', audience: ['teacher'], tags: ['타이머'], ...o });

export const workInput = (o = {}) => lessonInput({ domain: 'work', category: 'automation', subcategory: 'spreadsheet', schoolLevel: '', grade: '', subject: '', topic: '', audience: ['teacher'], tags: ['자동화'], ...o });
