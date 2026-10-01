// 큰 곳간에 보내기: 네이버 폼에 붙여 넣을 글을 만든다 (DOM 없음, 교사고래 모드에서만 화면에 나온다)
// 폼 항목: 제출 종류(작품·고래 노래) / 별명·학교급 / 꾸러미 또는 후기 / 개인정보 미포함 확인
import { createPack, serializePack } from '../shared/pack.js';
import { MAX_SONG_CHARS } from '../shared/review.js';

const REAL_NAME = /^[가-힣]{2,4}$/;
const nickOk = (a) => typeof a === 'string' && a.trim().length > 0;

// 작품 추천 글. 반환: { ok, text?, length?, errors? }
export function buildWorkSubmission(work, { author, privacyChecked, now = new Date() } = {}) {
  const errors = [];
  if (!privacyChecked) errors.push('작품 안에 학생 이름·사진·연락처가 없는지 확인에 체크해 주세요.');
  if (!nickOk(author)) errors.push('별명·학교급을 적어 주세요.');
  else if (REAL_NAME.test(author.split('·')[0].trim())) errors.push('실명처럼 보여요. 별명과 학교급만 써 주세요.');
  if (work.type === 'exe-link') errors.push('exe 항목은 이 화면에서 보낼 수 없어요.');
  if (errors.length) return { ok: false, errors };
  const pack = serializePack(createPack({ name: work.title, items: [work], now }));
  const text = ['[고래곳간 큰 곳간 추천]', '종류: 작품', `별명·학교급: ${author.trim()}`, `작품: ${work.title}`, '개인정보 미포함 확인: 예', '', pack].join('\n');
  return { ok: true, text, length: text.length };
}

// 고래 노래(한 줄 후기) 글
export function buildSongSubmission(work, { text, author, privacyChecked } = {}) {
  const errors = [];
  const body = String(text || '').trim();
  if (!privacyChecked) errors.push('후기에 학생 이름·연락처가 없는지 확인에 체크해 주세요.');
  if (!body) errors.push('한 줄 후기를 적어 주세요.');
  else if ([...body].length > MAX_SONG_CHARS) errors.push(`후기는 ${MAX_SONG_CHARS}자 이하로 써 주세요. (지금 ${[...body].length}자)`);
  if (!nickOk(author)) errors.push('별명·학교급을 적어 주세요.');
  else if (REAL_NAME.test(author.split('·')[0].trim())) errors.push('실명처럼 보여요. 별명과 학교급만 써 주세요.');
  if (errors.length) return { ok: false, errors };
  const out = ['[고래곳간 고래 노래]', '종류: 고래 노래', `작품 id: ${work.id}`, `작품명: ${work.title}`, `별명·학교급: ${author.trim()}`, `한 줄 후기: ${body}`, '개인정보 미포함 확인: 예'].join('\n');
  return { ok: true, text: out, length: out.length };
}

// 폼 주소가 https일 때만 연다
export function validFormUrl(url) {
  try {
    return new URL(url).protocol === 'https:' ? new URL(url).href : null;
  } catch {
    return null;
  }
}
