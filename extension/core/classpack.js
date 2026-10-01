// 학급 꾸러미: 교사고래 모드에서 작품을 골라 꾸러미와 웨일 클래스 공지 문구를 함께 만든다 (DOM 없음)
import { createPack, serializePack, MAX_ITEMS } from '../shared/pack.js';
import { normalizeWork } from '../shared/taxonomy.js';

export const CLASS_URL = 'https://class.whalespace.io';
// 공지·과제 글 길이 제한을 아직 확인하지 못해, 이 길이를 넘으면 파일 첨부를 권한다
export const LONG_TEXT_CHARS = 16000;

// 학생에게 보여 줄 안내 공지 (붙여넣기용 텍스트)
export function buildNotice({ name, works, teacherNote = '' }) {
  const list = works
    .map((w, i) => {
      const m = normalizeWork(w); // 예전 '초4' 형식과 새 학교급+학년 형식을 함께 처리
      const label = [m.gradeLabel, m.subject].filter(Boolean).join('·') || m.path.slice(1).join('·');
      return `${i + 1}. ${w.title}${label ? ` (${label})` : ''}`;
    })
    .join('\n');
  return [
    `[고래곳간 꾸러미] ${name}`,
    teacherNote.trim() ? teacherNote.trim() : null,
    `작품 ${works.length}개`,
    list,
    '',
    '받는 방법',
    '1. 웨일 사이드바에서 고래곳간을 엽니다.',
    '2. 위쪽 [가져오기]를 누릅니다.',
    '3. 첨부된 .gorae.json 파일을 고르거나, 아래 꾸러미 내용을 붙여 넣고 [확인하기]를 누릅니다.',
    '4. 담고 싶은 작품을 골라 [선택한 작품 담기]를 누릅니다.',
    '※ 작품은 내 기기에만 저장돼요. 작품에 이름·연락처를 넣지 마세요.',
  ].filter((l) => l !== null).join('\n');
}

// 반환: { ok, error?, name, count, fileName, packText, notice, combined, tooLong }
export function buildClassBundle(records, ids, { name, teacherNote, now = new Date() } = {}) {
  const picked = records.filter((r) => ids.includes(r.id));
  if (!picked.length) return { ok: false, error: 'NONE' };
  if (picked.length > MAX_ITEMS) return { ok: false, error: 'TOO_MANY' };
  const pack = createPack({ name, items: picked.map((r) => r.work), now });
  const packText = serializePack(pack);
  const notice = buildNotice({ name: pack.name, works: picked.map((r) => r.work), teacherNote });
  const combined = `${notice}\n\n--- 꾸러미 내용 (아래 전체를 복사해 붙여 넣으세요) ---\n${packText}`;
  const safe = pack.name.replace(/[\\/:*?"<>|\s]+/g, '_');
  return {
    ok: true,
    name: pack.name,
    count: picked.length,
    fileName: `${safe}.gorae.json`,
    packText,
    notice,
    combined,
    tooLong: combined.length > LONG_TEXT_CHARS,
  };
}
