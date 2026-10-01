// 작품 카드 만들기·검증 (DOM 없음)
import { CONFIG } from './config.js';
import { looksLikeRealName } from './checker.js';

const byteLen = (s) => new TextEncoder().encode(s).length;

// input: { title, type:'html'|'url', html?, url?, grade, subject, standard?, audience?, author, howToUse, promptRecipe? }
export function validateNewWork(input) {
  const errors = [];
  const warnings = [];
  if (!input.title || !input.title.trim()) errors.push({ code: 'TITLE', message: '제목을 적어 주세요.' });
  if (!input.grade || !input.subject) errors.push({ code: 'CATEGORY', message: '학년과 교과를 골라 주세요.' });
  if (!input.howToUse || !input.howToUse.trim()) errors.push({ code: 'HOW_TO_USE', message: '사용 방법을 적어 주세요.' });
  if (input.type === 'html') {
    if (!input.html) errors.push({ code: 'HTML_EMPTY', message: 'HTML 내용이 비어 있어요.' });
    else if (byteLen(input.html) > CONFIG.maxHtmlBytes) errors.push({ code: 'HTML_TOO_BIG', message: 'HTML은 1MB 이하만 올릴 수 있어요.' });
  } else if (input.type === 'url') {
    let ok = false;
    try {
      ok = new URL(input.url).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) errors.push({ code: 'URL_NOT_HTTPS', message: '주소는 https:// 로 시작해야 해요.' });
  } else {
    errors.push({ code: 'TYPE', message: '작품 종류가 올바르지 않아요.' });
  }
  if (looksLikeRealName(input.author)) warnings.push({ code: 'REAL_NAME', message: '실명처럼 보여요. 별명과 학교급만 써 주세요.' });
  return { ok: errors.length === 0, errors, warnings };
}

export function createWork(input, { now = new Date(), idGen = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const w = {
    id: 'my-' + now.getTime().toString(36) + '-' + idGen(),
    title: input.title.trim(),
    type: input.type,
    grade: input.grade,
    subject: input.subject,
    standard: input.standard || '',
    audience: input.audience || 'student',
    author: input.author || '',
    howToUse: input.howToUse.trim(),
    promptRecipe: input.promptRecipe || '',
    version: 1,
    addedAt: now.toISOString(),
  };
  if (input.remixOf) w.remixOf = input.remixOf; // 리믹스 원본 id
  if (input.type === 'html') w.html = input.html;
  else w.url = input.url;
  return w;
}
