// 설문 제출물 ↔ 작품 카드 (DOM 없음, 확장앱과 검수 도구가 함께 쓴다)
// 폼 구성: 1 어떤 고래(학생고래/교사고래) · 2 닉네임 · 3 앱 제목(100자) · 4 HTML/실행 파일인가요?
//          → 아니오: 5 웹페이지 주소(2000자) / 네: 6 파일 업로드
// HTML 작품은 업로드 파일 맨 앞 주석에 작품 정보(분류·레시피·버전 등)를 숨겨 담는다. 파일은 그대로 열어도 실행된다.
// 주소 작품은 주소 다음 줄에 [고래곳간 작품 정보]를 붙인다.
import { PACK_FORMAT, PACK_VERSION, parsePack, extractPackText } from './pack.js';

const MARK = 'gorae-card';
const LINE_MARK = '[고래곳간 작품 정보]';

// 주석·줄 안에서 안전하도록 JSON의 '--'와 '<'를 유니코드 이스케이프로 바꾼다 (값은 그대로)
const safeJson = (o) => JSON.stringify(o).replace(/--/g, '-\\u002d').replace(/</g, '\\u003c');
const cardOf = (work) => {
  const { html, tailprint, ...card } = work; // 검수 서명은 파수꾼고래가 새로 찍으므로 보내지 않는다
  return card;
};

export function toSubmissionHtml(work) {
  return `<!--${MARK} ${safeJson(cardOf(work))} -->\n${work.html}`;
}
export const cardLine = (work) => `${LINE_MARK} ${safeJson(cardOf(work))}`;

// 짧은 내용 지문 (id가 없는 일반 HTML에 붙일 id)
function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
const titleFromHtml = (html) => {
  const m = /<title[^>]*>([^<]{1,100})<\/title>/i.exec(html);
  return m ? m[1].trim() : '';
};

// 붙여 넣은 글이나 내려받은 파일을 작품 목록으로 읽는다.
// 반환: { ok, works?: [], kind?, warnings?: [], errors?: [] }
export function readSubmission(text, { fileName = '' } = {}) {
  const t = String(text || '');
  const warnings = [];
  let works = null;
  let kind = '';
  try {
    if (t.trimStart().startsWith(`<!--${MARK} `)) {
      // ① 고래곳간이 만든 업로드용 HTML
      const s = t.trimStart();
      const end = s.indexOf(' -->');
      const card = JSON.parse(s.slice(MARK.length + 5, end));
      works = [{ ...card, html: s.slice(end + 4).replace(/^\n/, '') }];
      kind = 'html-card';
    } else if (t.includes(LINE_MARK)) {
      // ② 주소 칸에 붙은 작품 정보
      const line = t.slice(t.indexOf(LINE_MARK) + LINE_MARK.length).split('\n')[0].trim();
      works = [JSON.parse(line)];
      kind = 'url-card';
    } else if (t.includes('"format":"gorae-pack"') || t.includes('"format": "gorae-pack"')) {
      // ③ 꾸러미
      const p = JSON.parse(extractPackText(t));
      works = p.items;
      kind = 'pack';
    } else if (/<(html|!doctype|body|script|div|p)\b/i.test(t)) {
      // ④ 고래곳간 밖에서 만든 일반 HTML: 분류 정보 없이 최소 카드만 만든다
      const title = titleFromHtml(t) || fileName.replace(/\.[^.]+$/, '') || '제목 없는 작품';
      works = [{ id: 'sub-' + fingerprint(t), title, type: 'html', artifactType: 'html', html: t, howToUse: '', version: 1, addedAt: new Date().toISOString() }];
      kind = 'html-plain';
      warnings.push('고래곳간에서 만든 파일이 아니라 분류·사용 방법 정보가 없어요. 검수 전에 제작자에게 확인하세요.');
    } else {
      const url = t.trim().split(/\s+/)[0];
      if (/^https:\/\/\S+$/.test(url)) {
        // ⑤ 주소만 있는 응답
        works = [{ id: 'sub-' + fingerprint(url), title: '주소 작품', type: 'url', artifactType: 'webapp', url, howToUse: '', version: 1, addedAt: new Date().toISOString() }];
        kind = 'url-plain';
        warnings.push('주소만 있어 분류 정보가 없어요.');
      }
    }
  } catch {
    return { ok: false, errors: [{ code: 'BROKEN', message: '작품 정보를 읽을 수 없어요. 파일이나 글이 잘리지 않았는지 확인하세요.' }] };
  }
  if (!works) return { ok: false, errors: [{ code: 'UNKNOWN', message: '고래곳간 제출물(업로드 파일·주소·꾸러미)을 찾지 못했어요.' }] };
  // 꾸러미와 같은 규칙으로 형식 검사 (https, 1MB 등). exe는 꾸러미 규칙 밖이므로 따로 둔다.
  const plain = works.filter((w) => w.type !== 'exe-link');
  if (plain.length) {
    const check = parsePack({ format: PACK_FORMAT, formatVersion: PACK_VERSION, name: 'submission', items: plain });
    if (!check.ok) return { ok: false, errors: check.errors };
  }
  return { ok: true, works, kind, warnings };
}
