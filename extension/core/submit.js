// 큰 곳간에 공유하기: 구글 설문 문항에 맞춘 답과 업로드 파일을 만든다 (DOM 없음)
// 폼: 1 어떤 고래이신가요?(학생고래/교사고래) · 2 닉네임 · 3 앱 제목(100자 이내)
//     4 HTML 또는 실행 파일인가요? → 네: 6 파일 업로드 / 아니오: 5 웹페이지 주소(2000자 이내)
// 고래 노래·물뿜기는 이 폼에 문항이 없어 따로 쓰는 '의견 폼'(CONFIG.feedbackFormUrl)으로 보낸다.
import { MAX_SONG_CHARS } from '../shared/review.js';
import { toSubmissionHtml, cardLine } from '../shared/submission.js';
import { normalizeWork } from '../shared/taxonomy.js';
import { categoryText } from '../shared/market.js';

export const FORM_LIMITS = { title: 100, address: 2000 };
const REAL_NAME = /^[가-힣]{2,4}$/;
const nickOk = (a) => typeof a === 'string' && a.trim().length > 0;
const safeName = (t) => String(t).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '고래곳간_작품';

// 반환: { ok, answers?: { whale, nickname, title, isFile, address? }, file?: { name, text, type }, warnings?, errors? }
export function buildWorkSubmission(work, { nickname, role, privacyChecked } = {}) {
  const errors = [];
  const warnings = [];
  const nick = String(nickname || '').trim();
  if (!privacyChecked) errors.push('작품 안에 학생 이름·사진·연락처가 없는지 확인에 체크해 주세요.');
  if (!nickOk(nick)) errors.push('닉네임을 적어 주세요.');
  if ([...work.title].length > FORM_LIMITS.title) errors.push(`앱 제목이 ${FORM_LIMITS.title}자를 넘어요. 제목을 줄여 주세요.`);
  if (errors.length) return { ok: false, errors };

  // 2~4글자 한글은 실명일 수도 있어 경고만 한다 (파란고래 같은 닉네임도 많다)
  if (REAL_NAME.test(nick.split('·')[0].trim())) warnings.push('실명이 아니라 닉네임인지 한 번 더 확인해 주세요.');
  const answers = {
    whale: role === 'teacher' ? '교사고래' : '학생고래',
    nickname: nick,
    title: work.title,
    isFile: work.type === 'html' ? '네' : '아니오', // EXE는 파일을 올리지 않고 링크·해시로 낸다
  };
  if (work.type === 'html') {
    return { ok: true, answers, file: { name: `${safeName(work.title)}.html`, text: toSubmissionHtml(work), type: 'text/html' }, warnings };
  }
  let address;
  if (work.type === 'exe-link') {
    address = [`다운로드 링크: ${work.url}`, `소스 저장소: ${work.sourceRepo}`, `SHA-256: ${work.sha256}`, `검사 결과: ${work.scanResult}`, `실행 환경: ${work.environment}`].join('\n');
  } else {
    address = work.url;
  }
  const withCard = `${address}\n${cardLine(work)}`;
  if (withCard.length <= FORM_LIMITS.address) address = withCard;
  else warnings.push('작품 정보가 길어 주소만 보내요. 파수꾼이 분류를 직접 확인해야 해요.');
  if (address.length > FORM_LIMITS.address) return { ok: false, errors: [`주소 칸은 ${FORM_LIMITS.address}자까지예요.`] };
  return { ok: true, answers: { ...answers, address }, warnings };
}

// 나눔 곳간 공유 묶음: 업로드 파일 + 구글 폼 미리 채우기 값 (에듀노트 스킬마켓의 ShareModal과 같은 흐름)
// 반환: { ok, file?, prefill: { whale, nickname, title, description, category, address, comment }, warnings, errors? }
export function buildSharePackage(work, { nickname, role, comment = '', privacyChecked } = {}) {
  const base = buildWorkSubmission(work, { nickname, role, privacyChecked });
  if (!base.ok) return base;
  const m = normalizeWork(work);
  const code = { domain: m.domain, category: m.category || 'etc', subcategory: m.subcategory || 'etc' };
  const prefill = {
    whale: base.answers.whale,
    nickname: base.answers.nickname,
    title: work.title,
    description: (m.description || work.howToUse || '').slice(0, 500),
    category: categoryText(m.path, code),
    address: base.answers.address || '',
    comment: String(comment || '').trim().slice(0, 100),
  };
  return { ok: true, file: base.file, prefill, warnings: base.warnings };
}

// 고래 노래(한 줄 후기) 글 — 의견 폼으로 보낸다
export function buildSongSubmission(work, { text, author, privacyChecked } = {}) {
  const errors = [];
  const body = String(text || '').trim();
  if (!privacyChecked) errors.push('후기에 학생 이름·연락처가 없는지 확인에 체크해 주세요.');
  if (!body) errors.push('한 줄 후기를 적어 주세요.');
  else if ([...body].length > MAX_SONG_CHARS) errors.push(`후기는 ${MAX_SONG_CHARS}자 이하로 써 주세요. (지금 ${[...body].length}자)`);
  if (!nickOk(author)) errors.push('닉네임을 적어 주세요.');
  if (errors.length) return { ok: false, errors };
  const out = ['[고래곳간 고래 노래]', `작품 id: ${work.id}`, `작품명: ${work.title}`, `닉네임: ${author.trim()}`, `한 줄 후기: ${body}`].join('\n');
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
