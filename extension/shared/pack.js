// 꾸러미(.gorae.json) 형식 — DOM 없이 만들고 읽는다 (확장앱·뷰어·검수 도구 공용)
export const PACK_FORMAT = 'gorae-pack';
export const PACK_VERSION = 1;
export const MAX_ITEMS = 10;
export const MAX_HTML_BYTES = 1024 * 1024;
export const MAX_PACK_CHARS = 12 * 1024 * 1024;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const err = (code, message, index) => ({ code, message, ...(index === undefined ? {} : { index }) });
const byteLen = (s) => new TextEncoder().encode(s).length;

// 작품 1~10개를 꾸러미 객체로 묶는다. 꼬리지문(tailprint)이 있으면 그대로 함께 담긴다.
export function createPack({ name, items, now = new Date() }) {
  if (!Array.isArray(items) || items.length < 1) throw new Error('작품을 1개 이상 골라 주세요.');
  if (items.length > MAX_ITEMS) throw new Error(`꾸러미에는 작품을 ${MAX_ITEMS}개까지 담을 수 있어요.`);
  return {
    format: PACK_FORMAT,
    formatVersion: PACK_VERSION,
    name: String(name || '').trim().slice(0, 60) || '이름 없는 꾸러미',
    createdAt: now.toISOString(),
    items,
  };
}

export const serializePack = (pack) => JSON.stringify(pack);

// 문자열 또는 객체를 받아 형식을 검사한다. 하나라도 틀리면 꾸러미 전체를 거부한다.
// 반환: { ok, pack?, errors[] }
export function parsePack(input) {
  let obj = input;
  if (typeof input === 'string') {
    if (input.length > MAX_PACK_CHARS) return { ok: false, errors: [err('TOO_BIG', '꾸러미 파일이 너무 커요.')] };
    try {
      obj = JSON.parse(input);
    } catch {
      return { ok: false, errors: [err('NOT_JSON', '꾸러미 형식이 아니에요. (JSON을 읽을 수 없어요)')] };
    }
  }
  if (!isObj(obj) || obj.format !== PACK_FORMAT) return { ok: false, errors: [err('BAD_FORMAT', '고래곳간 꾸러미 파일이 아니에요.')] };
  if (obj.formatVersion !== PACK_VERSION) return { ok: false, errors: [err('BAD_VERSION', '지원하지 않는 꾸러미 버전이에요. 확장앱을 업데이트해 보세요.')] };
  if (!Array.isArray(obj.items) || obj.items.length < 1) return { ok: false, errors: [err('NO_ITEMS', '꾸러미에 작품이 없어요.')] };
  if (obj.items.length > MAX_ITEMS) return { ok: false, errors: [err('TOO_MANY', `꾸러미 작품은 ${MAX_ITEMS}개까지예요.`)] };

  const errors = [];
  obj.items.forEach((w, i) => {
    if (!isObj(w)) return errors.push(err('BAD_ITEM', '작품 형식이 틀렸어요.', i));
    if (typeof w.id !== 'string' || !w.id || typeof w.title !== 'string' || !w.title) return errors.push(err('BAD_ITEM', '작품의 id나 제목이 없어요.', i));
    if (w.type === 'html') {
      if (typeof w.html !== 'string' || !w.html) errors.push(err('BAD_ITEM', '작품 HTML이 비어 있어요.', i));
      else if (byteLen(w.html) > MAX_HTML_BYTES) errors.push(err('HTML_TOO_BIG', 'HTML이 1MB를 넘어요.', i));
    } else if (w.type === 'url') {
      let ok = false;
      try {
        ok = new URL(w.url).protocol === 'https:';
      } catch {
        ok = false;
      }
      if (!ok) errors.push(err('URL_NOT_HTTPS', '작품 주소가 https가 아니에요.', i));
    } else {
      errors.push(err('BAD_TYPE', '꾸러미에 담을 수 없는 작품 종류예요.', i));
    }
    if (w.tailprint !== undefined && !isObj(w.tailprint)) errors.push(err('BAD_TAILPRINT', '꼬리지문 형식이 틀렸어요.', i));
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, pack: obj, errors: [] };
}
