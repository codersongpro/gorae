// 나눔 곳간(공유 마켓) — 서버 없이 구글 폼(등록) + 구글 시트(목록) + 구글 드라이브(파일)로 운영 (DOM 없음)
// 에듀노트 스킬마켓 구조를 옮긴 것. 화면과 분리된 순수 함수만 둔다(단위 시험 대상).
//   CSV 파싱(셀 안 줄바꿈·"" 이스케이프 처리) · 열 이름 찾기 · 드라이브 공유 주소 → 직접 받기 주소 · 폼 미리 채우기 주소

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

// '수업 › 수업도구 › 럭키드로우·랜덤뽑기 [lesson/classroom_tool/lucky_draw]' → 분류 코드
export function parseCategoryCode(text) {
  const m = /\[([a-z_]+)\/([a-z_]+)\/([a-z_]+)\]/.exec(String(text || ''));
  return m ? { domain: m[1], category: m[2], subcategory: m[3] } : null;
}
export const categoryText = (path, code) => `${path.join(' › ')} [${code.domain}/${code.category}/${code.subcategory}]`;

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
      return {
        id: 'm-' + shortHash(cell(r, 'timestamp') + '|' + title + '|' + files.join(',')),
        timestamp: cell(r, 'timestamp'),
        whale: cell(r, 'whale'),
        nickname: cell(r, 'nickname'),
        title,
        description: cell(r, 'description'),
        categoryText: cell(r, 'category').replace(/\s*\[[a-z_/]+\]\s*$/, ''),
        category: parseCategoryCode(cell(r, 'category')),
        address,
        comment: cell(r, 'comment'),
        files,
      };
    })
    .filter((e) => e.title && (e.files.length || /^https:\/\//.test(e.address)));
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
export function sheetCsvUrls({ sheetId, publishedCsvUrl }) {
  const out = [];
  if (publishedCsvUrl) out.push(publishedCsvUrl); // '웹에 게시' → CSV 주소
  if (sheetId) {
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
    if (id && /^entry\.\d+$/.test(id) && v) u.searchParams.set(id, String(v));
  }
  return u.href;
}
