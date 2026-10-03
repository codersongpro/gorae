// 나눔 곳간(공유 마켓) — 서버 없이 구글 폼(등록) + 구글 시트(목록) + 구글 드라이브(파일)로 운영 (DOM 없음)
// 에듀노트 스킬마켓 구조를 옮긴 것. 화면과 분리된 순수 함수만 둔다(단위 시험 대상).
//   CSV 파싱(셀 안 줄바꿈·"" 이스케이프 처리) · 열 이름 찾기 · 드라이브 공유 주소 → 직접 받기 주소 · 폼 미리 채우기 주소
//   분류 정보 글(수업/업무 → 카테고리 → 하위 → 교과 정보·태그): 폼 → 시트를 거쳐도 원래 분류를 되살린다
import { normalizeWork, findCategory, findSub, levelOf, GROUP_TYPES, AUDIENCES, ARTIFACT_TYPES, CONTENT_TYPES, LEARNING_MODES, DIFFICULTIES, CREATION_METHODS, normalizeTags, gradeLabel } from './taxonomy.js';

// ---------- CSV (RFC 4180) ----------
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// ---------- 열 찾기 ----------
// 폼 질문 순서·문구가 바뀌어도 동작하도록 정확히 일치 → 키워드 부분 일치 순으로 찾는다
export const MARKET_COLUMNS = {
  timestamp: ['타임스탬프', 'Timestamp'],
  whale: ['어떤 고래', '고래 종류'],
  nickname: ['닉네임', '작성자'],
  title: ['제목', '앱 이름', '작품 이름'],
  kind: ['앱의 종류', '앱 종류'], // 교무행정 / 수업자료 / 학생관리 / 기타 (복수 선택)
  format: ['자료의 종류', '자료 종류'], // HTML 파일 또는 exe파일 / 배포한 웹 앱
  description: ['설명'],
  category: ['분류', '카테고리'],
  address: ['주소', '웹앱'],
  comment: ['한 마디', '한마디'],
  file: ['파일', '업로드'],
};

export function findColumns(header, spec = MARKET_COLUMNS) {
  const norm = header.map((h) => String(h || '').trim());
  const used = new Set();
  const cols = {};
  for (const [key, words] of Object.entries(spec)) {
    let idx = norm.findIndex((h, i) => !used.has(i) && words.includes(h));
    if (idx < 0) idx = norm.findIndex((h, i) => !used.has(i) && words.some((w) => h.includes(w)));
    if (idx >= 0) {
      cols[key] = idx;
      used.add(idx);
    }
  }
  return cols;
}

// 폼의 '앱 종류' 선택지 ↔ 고래곳간 영역 (선택지 글자는 폼과 똑같아야 미리 채우기가 된다)
export const KIND_OPTIONS = ['교무행정', '수업자료', '학생관리', '기타'];
export function kindsForWork(meta) {
  if (meta.domain === 'lesson') return ['수업자료'];
  if (meta.domain === 'work') return ['class_management', 'student_life'].includes(meta.category) ? ['학생관리'] : ['교무행정'];
  return ['기타'];
}
export const FORMAT_OPTIONS = { file: 'HTML 파일', webapp: '배포한 웹 앱' }; // 폼 5번 선택지 글자와 같아야 한다
const domainOfKinds = (kinds) => (kinds.includes('수업자료') ? 'lesson' : kinds.some((k) => k === '교무행정' || k === '학생관리') ? 'work' : '');

// '수업 › 수업도구 › 럭키드로우·랜덤뽑기 [lesson/classroom_tool/lucky_draw]' → 분류 코드
export function parseCategoryCode(text) {
  const m = /\[([a-z_]+)\/([a-z_]+)\/([a-z_]+)\]/.exec(String(text || ''));
  return m ? { domain: m[1], category: m[2], subcategory: m[3] } : null;
}
export const categoryText = (path, code) => `${path.join(' › ')} [${code.domain}/${code.category}/${code.subcategory}]`;

// ---------- 분류 정보 글 ----------
// 웹앱은 HTML 안에 작품 정보를 숨길 수 없으므로, 폼의 '설명' 칸 끝에 사람도 읽을 수 있는 분류 정보 글을 붙인다.
// 시트에서 읽을 때 이 글을 다시 작품 필드로 되살린다. 폼 문항을 늘리지 않는다.
//   [고래곳간 분류 정보]
//   수업 › 교과활동 › 게임·퀴즈
//   [lesson/subject_activity/game]
//   형태: webapp
//   학교급: elementary
//   학년: 4 ...
export const CLASSIFICATION_MARK = '[고래곳간 분류 정보]';
const CLS_FIELDS = [
  ['contentType', '자료유형'], ['learningMode', '학습방식'], ['selfDirected', '혼자학습'], ['difficulty', '난이도'], ['creationMethod', '제작방식'],
  ['artifactType', '형태'], ['schoolLevel', '학교급'], ['grade', '학년'], ['subject', '교과'], ['area', '영역'], ['unit', '단원'],
  ['lessonNo', '차시'], ['topic', '주제'], ['standard', '성취기준'], ['estimatedMinutes', '시간'], ['groupType', '활동형태'],
  ['audience', '대상'], ['tags', '태그'],
];
const oneLine = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 200);

export function buildClassificationText(work) {
  const m = normalizeWork(work);
  const lines = [CLASSIFICATION_MARK, m.path.join(' › '), `[${m.domain}/${m.category || ''}/${m.subcategory || ''}]`];
  for (const [key, label] of CLS_FIELDS) {
    const v = m[key];
    const text = Array.isArray(v) ? v.map(oneLine).filter(Boolean).join(', ') : key === 'estimatedMinutes' ? (v ? String(v) : '') : oneLine(v);
    if (text) lines.push(`${label}: ${text}`);
  }
  return lines.join('\n');
}

// 글에서 분류 정보를 찾아 되살린다. 알 수 없는 값은 버린다(시트는 누구나 고칠 수 있다고 본다).
// 반환: { meta: { domain?, category?, subcategory?, artifactType?, schoolLevel?, ... }, rest: 표시 글, path } | null
export function parseClassificationText(text) {
  const t = String(text || '');
  const at = t.indexOf(CLASSIFICATION_MARK);
  if (at < 0) return null;
  const rest = t.slice(0, at).trim();
  const meta = {};
  const byLabel = Object.fromEntries(CLS_FIELDS.map(([k, l]) => [l, k]));
  for (const raw of t.slice(at + CLASSIFICATION_MARK.length).split(/\r?\n/)) {
    const line = raw.trim();
    const code = /^\[([a-z_]+)\/([a-z_]*)\/([a-z_]*)\]$/.exec(line);
    if (code) {
      const [, domain, category, subcategory] = code;
      if (findCategory(domain, category)) {
        Object.assign(meta, { domain, category });
        if (findSub(domain, category, subcategory)) meta.subcategory = subcategory;
      } else if (domain === 'lesson' || domain === 'work') meta.domain = domain;
      continue;
    }
    const kv = /^([^:：]{1,10})[:：]\s*(.*)$/.exec(line);
    if (!kv || !byLabel[kv[1].trim()]) continue;
    const key = byLabel[kv[1].trim()];
    const v = oneLine(kv[2]);
    if (!v) continue;
    if (key === 'audience') {
      const ids = v.split(/\s*,\s*/).filter((a) => AUDIENCES.some((x) => x.id === a));
      if (ids.length) meta.audience = ids;
    } else if (key === 'tags') meta.tags = normalizeTags(v);
    else if (key === 'estimatedMinutes') { const n = Math.round(Number(v)); if (n > 0 && n <= 600) meta.estimatedMinutes = n; }
    else if (key === 'schoolLevel') { if (levelOf(v)) meta.schoolLevel = v; }
    else if (key === 'grade') { if (/^\d$/.test(v)) meta.grade = v; }
    else if (key === 'groupType') { if (GROUP_TYPES.some((g) => g.id === v)) meta.groupType = v; }
    else if (key === 'artifactType') { if (ARTIFACT_TYPES.some((a) => a.id === v)) meta.artifactType = v; }
    else if (key === 'selfDirected') { if (v === 'true' || v === 'false') meta.selfDirected = v === 'true'; }
    else if (key === 'creationMethod') meta.creationMethod = v.split(/\s*,\s*/).filter(id => CREATION_METHODS.some(x => x.id === id));
    else if (['contentType', 'learningMode', 'difficulty'].includes(key)) {
      const choices = { contentType: CONTENT_TYPES, learningMode: LEARNING_MODES, difficulty: DIFFICULTIES }[key];
      if (choices.some(x => x.id === v)) meta[key] = v;
    }
    else meta[key] = v;
  }
  if (meta.grade && !(meta.schoolLevel && levelOf(meta.schoolLevel).grades.includes(meta.grade))) delete meta.grade;
  const path = meta.domain ? normalizeWork({ ...meta, tags: [] }).path : [];
  return { meta, rest, path, gradeLabel: gradeLabel(meta.schoolLevel, meta.grade) };
}

const URL_RE = /https:\/\/[^\s,]+/g;
function shortHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

// 반환: { ok, entries, columns: 찾은 열, header: 감지된 열 이름들, missing: 못 찾은 필수 열 }
export function parseMarketCsv(text, spec = MARKET_COLUMNS) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: true, entries: [], columns: {}, header: [], missing: [] };
  const [header, ...body] = rows;
  const cols = findColumns(header, spec);
  const missing = ['title'].filter((k) => cols[k] === undefined);
  if (cols.file === undefined && cols.address === undefined) missing.push('file');
  if (missing.length) return { ok: false, entries: [], columns: cols, header, missing };
  const cell = (r, k) => (cols[k] === undefined ? '' : String(r[cols[k]] || '').trim());
  const entries = body
    .map((r) => {
      const title = cell(r, 'title');
      const files = cell(r, 'file').match(URL_RE) || [];
      const address = cell(r, 'address');
      const kinds = cell(r, 'kind').split(',').map((x) => x.trim()).filter(Boolean);
      // 분류 정보 글은 '설명' 칸 끝(고래곳간이 미리 채움)이나 '분류' 열에 있다
      const cls = parseClassificationText(cell(r, 'description')) || parseClassificationText(cell(r, 'category'));
      const code = cls && cls.meta.domain ? { domain: cls.meta.domain, ...(cls.meta.category ? { category: cls.meta.category } : {}), ...(cls.meta.subcategory ? { subcategory: cls.meta.subcategory } : {}) } : parseCategoryCode(cell(r, 'category'));
      return {
        id: 'm-' + shortHash(cell(r, 'timestamp') + '|' + title + '|' + files.join(',')),
        timestamp: cell(r, 'timestamp'),
        whale: cell(r, 'whale'),
        nickname: cell(r, 'nickname'),
        title,
        description: cls ? cls.rest : cell(r, 'description'),
        categoryText: cls && cls.path.length ? cls.path.join(' › ') : cell(r, 'category').replace(/\s*\[[a-z_/]+\]\s*$/, ''),
        meta: cls ? cls.meta : null, // 분류 정보 글에서 되살린 작품 필드 (학교급·교과·성취기준·태그 등)
        kinds,
        format: cell(r, 'format'),
        // 분류 코드가 없으면 '앱 종류'로 영역만 짐작한다
        category: code || (domainOfKinds(kinds) ? { domain: domainOfKinds(kinds) } : null),
        address,
        comment: cell(r, 'comment'),
        files,
      };
    })
    // 목록에 올리기 전 최소 점검: 제목이 있고, 파일은 구글 드라이브 https 주소, 주소 작품은 https만
    .filter((e) => e.title && (e.files.some((f) => driveFileId(f)) || /^https:\/\//.test(e.address)))
    .map((e) => ({ ...e, files: e.files.filter((f) => driveFileId(f)) }));
  return { ok: true, entries: entries.reverse(), columns: cols, header, missing: [] }; // 최근 등록이 위로
}

// ---------- 드라이브 ----------
const GOOGLE_HOST = /(^|\.)google\.com$|(^|\.)googleusercontent\.com$/;
export function driveFileId(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !GOOGLE_HOST.test(u.hostname)) return null;
    const id = u.searchParams.get('id') || (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1];
    return id && /^[\w-]{10,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const toDriveDownloadUrl = (url) => {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
};
// 내려받을 때 거쳐도 되는 곳 (리다이렉트마다 다시 검사)
export const isAllowedDownloadHost = (host) => ['drive.google.com', 'drive.usercontent.google.com', 'docs.google.com'].includes(host) || /\.googleusercontent\.com$/.test(host);

// ---------- 시트 CSV 주소 ----------
export function sheetCsvUrls({ sheetId, publishedCsvUrl, environment, allowRawSheetFallback }) {
  const out = [];
  if (publishedCsvUrl) out.push(publishedCsvUrl); // '웹에 게시' → CSV 주소
  if (sheetId && environment === 'development' && allowRawSheetFallback === true) {
    out.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`); // 링크가 있는 모든 사용자 보기
    out.push(`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`);
  }
  return out.filter((u) => /^https:\/\/docs\.google\.com\//.test(u));
}

// ---------- 폼 미리 채우기 ----------
// entryIds: { whale: 'entry.123', ... }  values: { whale: '교사고래', ... }
export function buildPrefillUrl(formUrl, entryIds, values) {
  let u;
  try {
    u = new URL(formUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com') return null;
  u.searchParams.set('usp', 'pp_url');
  for (const [k, v] of Object.entries(values)) {
    const id = entryIds[k];
    if (!id || !/^entry\.\d+$/.test(id) || !v || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) for (const x of v) u.searchParams.append(id, String(x)); // 체크박스(복수 선택)
    else u.searchParams.set(id, String(v));
  }
  return u.href;
}
