// 작품 카드 만들기·검증 (DOM 없음)
// 구조: 최상위 영역(domain) → 대표 카테고리(category) → 하위 카테고리(subcategory) → 태그(tags)
// 실행 형태: artifactType html | webapp | exe | link | file (실행용 type: html | url | exe-link 유지)
import { CONFIG } from './config.js';
import { looksLikeRealName } from './checker.js';
import { validateClassification, normalizeTags, normalizeWork, ARTIFACT_TYPES } from '../shared/taxonomy.js';

const byteLen = (s) => new TextEncoder().encode(s).length;
const isHttps = (u) => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const triState = (v) => (v === true || v === 'yes' ? true : v === false || v === 'no' ? false : null); // 모름 = null

// input: 화면에서 모은 값 (createWork 참고)
export function validateNewWork(input) {
  const errors = [...validateClassification(input)];
  const warnings = [];
  const err = (code, message) => errors.push({ code, message });
  if (!input.title || !input.title.trim()) err('TITLE', '제목을 적어 주세요.');
  if (!input.howToUse || !input.howToUse.trim()) err('HOW_TO_USE', '사용 방법을 적어 주세요.');
  if (input.artifactType === 'html') {
    if (!input.html) err('HTML_EMPTY', 'HTML 내용이 비어 있어요.');
    else if (byteLen(input.html) > CONFIG.maxHtmlBytes) err('HTML_TOO_BIG', 'HTML은 1MB 이하만 올릴 수 있어요.');
  } else if (['webapp', 'link', 'file'].includes(input.artifactType)) {
    if (!isHttps(input.url)) err('URL_NOT_HTTPS', '자료 주소는 https:// 로 시작해야 해요.');
    if (input.sourceUrl && !isHttps(input.sourceUrl)) err('SOURCE_NOT_HTTPS', '소스코드 주소는 https:// 로 시작해야 해요.');
  } else if (input.artifactType === 'exe') {
    if (!isHttps(input.url)) err('EXE_URL', '다운로드 링크는 https:// 로 시작해야 해요.');
    if (!isHttps(input.sourceRepo)) err('EXE_SOURCE', '소스 저장소 링크(https)를 적어 주세요.');
    if (!SHA256_HEX.test(input.sha256 || '')) err('EXE_SHA256', 'SHA-256 값(64자리)을 적어 주세요.');
    if (!input.scanResult || !String(input.scanResult).trim()) err('EXE_SCAN', '바이러스 검사 결과를 적어 주세요.');
    if (!input.environment || !String(input.environment).trim()) err('EXE_ENV', '실행 환경을 적어 주세요.');
  }
  if (looksLikeRealName(input.author)) warnings.push({ code: 'REAL_NAME', message: '실명처럼 보여요. 닉네임과 학교급만 써 주세요.' });
  return { ok: errors.length === 0, errors, warnings };
}

export function createWork(input, { now = new Date(), idGen = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const art = ARTIFACT_TYPES.find((a) => a.id === input.artifactType);
  const w = {
    id: 'my-' + now.getTime().toString(36) + '-' + idGen(),
    title: input.title.trim(),
    type: art.runtime, // 실행·꾸러미 호환용
    artifactType: art.id,
    contentType: normalizeWork(input).contentType,
    learningMode: normalizeWork(input).learningMode,
    selfDirected: input.selfDirected === true,
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    creationMethod: normalizeWork(input).creationMethod,
    domain: input.domain,
    category: input.category,
    subcategory: input.subcategory,
    audience: [...new Set(input.audience)],
    tags: normalizeTags(input.tags),
    description: (input.description || '').trim(),
    howToUse: input.howToUse.trim(),
    promptRecipe: input.promptRecipe || '',
    author: (input.author || '').trim(),
    version: 1,
    addedAt: now.toISOString(),
  };
  // 교과 정보: 교과활동은 필수(검증에서 확인), 다른 카테고리는 넣었을 때만 기록
  for (const k of ['schoolLevel', 'grade', 'subject', 'area', 'unit', 'lessonNo', 'topic', 'standard', 'groupType']) {
    const v = input[k] == null ? '' : String(input[k]).trim();
    if (v) w[k] = v;
  }
  const min = Math.round(Number(input.estimatedMinutes));
  if (min > 0 && min <= 600) w.estimatedMinutes = min;
  if (input.referenceOnly === true) w.referenceOnly = true; // 교사 전용 설정: 학생고래는 열람만
  if (input.remixOf) {
    w.remixOf = input.remixOf; // 리믹스 원본 id
    w.remixOfTitle = input.remixOfTitle || ''; // 계보 표시용 원본 제목
  }
  if (art.id === 'html') {
    w.html = input.html;
  } else if (art.runtime === 'url') {
    w.url = input.url;
    if (input.sourceUrl) w.sourceUrl = input.sourceUrl;
    for (const k of ['loginRequired', 'usesExternalApi', 'mobileSupported', 'collectsPersonalInfo', 'needsInternet']) w[k] = triState(input[k]);
  } else {
    Object.assign(w, {
      url: input.url,
      sourceRepo: input.sourceRepo,
      sha256: String(input.sha256).toLowerCase(),
      scanResult: String(input.scanResult).trim(),
      environment: String(input.environment).trim(),
    });
  }
  return w;
}
