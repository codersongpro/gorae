// 검수 도구: 검수 서명 만들기(파수꾼고래) · 검수대(파수꾼고래) · 고래 족보 관리(파수꾼고래)
// 모든 일은 이 브라우저 안에서만 한다. 개인 열쇠는 꺼낼 수 없는 형태로만 보관하고 어디로도 보내지 않는다.
import { h } from './dom.js';
import * as tp from './shared/tailprint.js';
import { encryptJwk, decryptJwk, checkPassword } from './shared/keybackup.js';
import { signForCatalog, addReviewer, revokeReviewer, signList, emptyList, upsertCatalogItem } from './shared/review.js';
import { readSubmission } from './shared/submission.js';
import { checkWork } from './shared/checker.js';
import { ROOT_PUBLIC_JWK } from './rootkey.js';
import { S } from './strings.js';
import { normalizeWork } from './shared/taxonomy.js';
import { signFeatured, MAX_FEATURED } from './shared/featured.js';
import { loadMarket, fetchEntryWorks } from './core/market.js';
import { MARKET } from './core/market-config.js';
import { parseSpoutReports, applySpoutReports, POPULAR_MIN, isPopular } from './shared/spout.js';

// 작품 미리보기 실행용 정책 (뷰어와 같은 뜻: 바깥 통신 차단)
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
const REASON_TEXT = { ...S.reason };

// ---------- 열쇠 보관 (IndexedDB, CryptoKey를 그대로 저장 = 꺼낼 수 없음) ----------
const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open('gorae-review', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('keys', { keyPath: 'slot' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const idb = async (mode, fn) => {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('keys', mode);
    const req = fn(tx.objectStore('keys'));
    tx.oncomplete = () => { db.close(); res(req.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
};
const saveKey = (rec) => idb('readwrite', (s) => s.put(rec));
const loadKey = (slot) => idb('readonly', (s) => s.get(slot));

// ---------- 공용 도우미 ----------
const state = { tab: 'queue', session: false, queue: { status: 'idle', entries: [], drafts: {}, done: {}, open: '', note: '' }, reviewer: null, root: null, catalog: null, list: null, drafts: [], msg: '', err: '' };
const panel = document.getElementById('panel');
const tabsEl = document.getElementById('tabs');

const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
const copy = async (text) => { try { await navigator.clipboard.writeText(text); say('복사했어요.'); } catch { say('복사에 실패했어요. 직접 선택해서 복사해 주세요.', true); } };
const download = (name, text, type = 'application/json') => {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
function say(msg, isErr = false) { state.msg = isErr ? '' : msg; state.err = isErr ? msg : ''; render(); }
const rand8 = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
const readFile = (input) => new Promise((res) => { const f = input.files[0]; if (!f) return res(''); f.text().then(res); });

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function ensureSiteData() {
  if (!state.catalog) { try { state.catalog = await fetchJson('catalog.json'); } catch { state.catalog = { updatedAt: new Date().toISOString(), items: [], exeItems: [], featured: null }; } }
  if (!state.list) { try { state.list = await fetchJson('reviewers.json'); } catch { state.list = emptyList(); } }
}

// ---------- A. 검수 서명 만들기 ----------
function viewMake() {
  const nick = h('input', { placeholder: '예: 푸른물결 (별명만, 실명 금지)' });
  const pw = h('input', { type: 'password', placeholder: '백업 파일 암호 (8자 이상)', autocomplete: 'new-password' });
  const bfile = h('input', { type: 'file', accept: '.keybackup,.json' });
  const bpw = h('input', { type: 'password', placeholder: '백업 암호', autocomplete: 'current-password' });
  const me = state.reviewer;
  const bundleText = me ? JSON.stringify({ id: me.reviewerId, nickname: me.nickname, publicKey: me.publicJwk }) : '';
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '1. 검수 서명 만들기 (파수꾼고래)'),
      h('p', { class: 'muted' }, '열쇠 한 쌍을 만들어요. 개인 열쇠는 이 브라우저에 꺼낼 수 없게 저장되고, 기기를 바꿀 때 쓸 암호 건 백업 파일을 내려받아요. 공개키 묶음은 관리자 파수꾼고래에게 보내 고래 족보에 올려 달라고 하세요.'),
      me ? h('p', { class: 'ok' }, `✔ 이 브라우저에 열쇠가 있어요: ${me.nickname} (${me.reviewerId})`) : h('p', { class: 'notice' }, '아직 이 브라우저에 열쇠가 없어요.'),
      field('별명', nick), field('백업 암호', pw),
      h('button', { onclick: () => makeReviewer(nick.value, pw.value) }, me ? '새 열쇠로 바꾸기' : '검수 서명 만들기')),
    me ? h('div', { class: 'card' },
      h('h3', {}, '공개키 묶음 (관리자 파수꾼고래에게 전달)'),
      h('textarea', { readonly: true, 'aria-label': '공개키 묶음' }, bundleText),
      h('button', { class: 'secondary', onclick: () => copy(bundleText) }, '복사')) : null,
    h('div', { class: 'card' },
      h('h3', {}, '백업 파일로 되살리기 (기기를 바꿨을 때)'),
      bfile, bpw,
      h('button', { class: 'secondary', onclick: async () => restoreReviewer(await readFile(bfile), bpw.value) }, '되살리기')));
}

async function makeReviewer(nickname, password) {
  if (!nickname.trim()) return say('별명을 적어 주세요.', true);
  const ok = checkPassword(password);
  if (!ok.ok) return say(ok.message, true);
  const kp = await tp.generateKeyPair({ extractable: true });
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const publicJwk = await tp.exportPublicJwk(kp.publicKey);
  const reviewerId = 'g-' + rand8();
  const backup = { ...(await encryptJwk(privJwk, password, { kind: 'reviewer' })), meta: { id: reviewerId, nickname: nickname.trim() } };
  download(`검수서명_${nickname.trim()}.keybackup`, JSON.stringify(backup));
  const privateKey = await tp.importPrivateJwk(privJwk); // 꺼낼 수 없는 형태로 다시 가져온다
  await saveKey({ slot: 'reviewer', reviewerId, nickname: nickname.trim(), privateKey, publicJwk });
  state.reviewer = { reviewerId, nickname: nickname.trim(), privateKey, publicJwk };
  say('열쇠를 만들고 백업 파일을 내려받았어요. 백업 파일은 안전한 곳에 2부 보관하세요.');
}
async function restoreReviewer(text, password) {
  try {
    const backup = JSON.parse(text);
    const jwk = await decryptJwk(backup, password);
    const publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    const privateKey = await tp.importPrivateJwk(jwk);
    const meta = backup.meta || {};
    await saveKey({ slot: 'reviewer', reviewerId: meta.id, nickname: meta.nickname, privateKey, publicJwk });
    state.reviewer = { reviewerId: meta.id, nickname: meta.nickname, privateKey, publicJwk };
    say('백업에서 열쇠를 되살렸어요.');
  } catch (e) {
    say(e.message === 'BAD_PASSWORD' ? '암호가 틀렸거나 파일이 손상됐어요.' : '백업 파일을 읽을 수 없어요.', true);
  }
}

// ---------- B. 검수대 ----------
function viewDesk() {
  if (!state.reviewer) return h('div', { class: 'notice' }, '먼저 [1. 검수 서명 만들기]에서 열쇠를 만들거나 되살려 주세요.');
  const upload = h('input', { type: 'file', accept: '.html,.htm,.json,text/html,application/json' });
  const paste = h('textarea', { placeholder: '설문 응답(주소 칸 내용·꾸러미)을 붙여 넣거나 아래에서 업로드된 파일을 고르세요', 'aria-label': '설문 응답 붙여넣기' });
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '2. 검수대'),
      h('p', { class: 'muted' }, `파수꾼고래: ${state.reviewer.nickname}. 응답을 붙여 넣으면 자동 점검 결과를 보여 줘요. 코드를 직접 보고 실행해 본 뒤 배지를 골라 서명하세요.`),
      paste,
      h('p', { class: 'muted' }, '또는 설문으로 올라온 파일(.html·.gorae.json)을 고르세요. 구글 드라이브의 설문 응답 폴더에서 내려받으면 돼요.'),
      upload,
      h('button', { onclick: async () => loadDrafts(paste.value || (await readFile(upload)), upload.files[0] ? upload.files[0].name : '') }, '확인하기')),
    ...state.drafts.map(draftCard),
    state.drafts.length || state.catalog ? catalogOut() : null);
}

function loadDrafts(text, fileName = '') {
  // 업로드된 HTML(작품 정보 주석 포함)·주소 칸 내용·꾸러미·일반 HTML을 모두 읽는다
  const res = readSubmission(text, { fileName });
  if (!res.ok) { state.drafts = []; return say(res.errors.map((e) => e.message).join(' '), true); }
  state.drafts = res.works.map((work) => {
    const report = checkWork(work);
    return { work, report, badge: report && !report.ok ? 'shallow' : 'clear', pick: false, songs: '', signed: null, check: null };
  });
  say(`작품 ${state.drafts.length}개를 읽었어요.` + (res.warnings.length ? ' ' + res.warnings.join(' ') : ''));
}

function parseSongs(text) {
  // 한 줄에 하나: "작성자 별명·학교급 | 후기 내용"
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [author, ...rest] = l.split('|');
    return { author: author.trim(), text: rest.join('|').trim(), date: new Date().toISOString().slice(0, 10) };
  });
}

function draftCard(d) {
  const w = d.work;
  const preview = h('div', { class: 'preview' });
  const badge = h('select', { 'aria-label': '배지', onchange: (e) => { d.badge = e.target.value; } },
    ['clear', 'shallow', 'whirlpool'].map((b) => h('option', { value: b, selected: d.badge === b }, S.badge[b])));
  const pick = h('input', { type: 'checkbox', checked: d.pick, onchange: (e) => { d.pick = e.target.checked; } });
  const songs = h('textarea', { placeholder: '고래 노래: 한 줄에 하나 — 작성자 별명·학교급 | 후기 (80자 이하)', 'aria-label': '고래 노래', oninput: (e) => { d.songs = e.target.value; } }, d.songs);
  return h('div', { class: 'card' },
    h('h3', {}, w.title),
    h('p', { class: 'muted' }, (() => { const m = normalizeWork(w); return [m.path.join(' › '), m.gradeLabel, m.subject, m.topic, w.author, `버전 ${w.version || 1}`].filter(Boolean).join(' · '); })()),
    h('p', {}, h('strong', {}, '사용 방법: '), w.howToUse || ''),
    d.report ? (d.report.ok ? h('p', { class: 'ok' }, '자동 점검: 걸린 항목이 없어요') : h('div', {}, h('p', { class: 'notice error' }, '자동 점검에서 걸렸어요'), h('ul', { class: 'warn-list' }, d.report.warnings.map((x) => h('li', {}, `${x.label} — ${x.reason}`))))) : h('p', { class: 'muted' }, '외부 주소 작품이에요: ' + (w.url || '')),
    w.type === 'html' ? h('div', {},
      h('button', { class: 'secondary', onclick: () => runPreview(preview, w) }, '▶ 격리해서 실행해 보기'),
      h('details', {}, h('summary', {}, '코드 보기'), h('pre', {}, w.html))) : null,
    preview,
    field('배지', badge),
    h('label', { class: 'check' }, pick, '🐋 고래 픽 (카드에 "파수꾼 고래 검수 완료" 표시)'),
    songs,
    d.quick ? h('button', { class: 'finish', onclick: () => finish(d) }, '✔ 검수 완료') : h('button', { onclick: () => sign(d) }, '검수 서명 찍기'),
    d.signed && !d.quick ? h('div', {},
      h('p', { class: d.check && d.check.ok ? 'ok' : 'notice error' }, d.check ? (d.check.ok ? '✔ 지금 불러온 고래 족보로 서명이 확인돼요.' : `⚠ 지금 불러온 족보로는 확인되지 않아요 (파수꾼고래에게 족보 등록을 요청하세요): ${REASON_TEXT[d.check.reason] || d.check.reason}`) : ''),
      h('textarea', { readonly: true, 'aria-label': '서명된 catalog 항목' }, JSON.stringify(d.signed, null, 2)),
      h('div', { class: 'row' },
        h('button', { class: 'secondary', onclick: () => copy(JSON.stringify(d.signed, null, 2)) }, '항목 복사'),
        h('button', { class: 'secondary', onclick: () => addToCatalog(d) }, 'catalog.json에 넣기'))) : null);
}

function runPreview(box, work) {
  const frame = h('iframe', { title: work.title, sandbox: 'allow-scripts' }); // allow-same-origin 없음
  frame.setAttribute('csp', CSP);
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}">${work.html}`;
  box.replaceChildren(frame);
}

async function sign(d) {
  const songs = parseSongs(d.songs);
  const res = await signForCatalog({ work: d.work, privateKey: state.reviewer.privateKey, reviewerId: state.reviewer.reviewerId, badge: d.badge, pick: d.pick, songs });
  if (!res.ok) return say(res.errors.join(' '), true);
  d.signed = res.item;
  await ensureSiteData();
  const v = await tp.createVerifier({ rootPublicJwk: ROOT_PUBLIC_JWK, list: state.list });
  d.check = await v.verify(res.item);
  say('서명했어요.');
}

async function addToCatalog(d) {
  await ensureSiteData();
  state.catalog = upsertCatalogItem(state.catalog, d.signed);
  say('catalog.json에 넣었어요. 아래에서 전체 내용을 복사하거나 내려받으세요.');
}

function catalogOut() {
  if (!state.catalog) return null;
  const text = JSON.stringify(state.catalog, null, 2);
  return h('div', { class: 'card' },
    h('h3', {}, 'catalog.json (작품 ' + (state.catalog.items || []).length + '개)'),
    h('p', { class: 'muted' }, '내려받은 파일을 저장소의 site/catalog.json에 덮어쓰고 올리면 모두의 인증 곳간에 반영돼요.'),
    h('textarea', { readonly: true, 'aria-label': 'catalog.json' }, text),
    h('div', { class: 'row' },
      h('button', { class: 'secondary', onclick: () => copy(text) }, '복사'),
      h('button', { class: 'secondary', onclick: () => download('catalog.json', text) }, '내려받기')));
}

// ---------- C. 고래 족보 관리 (파수꾼고래) ----------
function viewRoot() {
  const rootPw = h('input', { type: 'password', placeholder: '관리 열쇠 백업 암호 (8자 이상)', autocomplete: 'new-password' });
  const lfile = h('input', { type: 'file', accept: '.keybackup,.json' });
  const lpw = h('input', { type: 'password', placeholder: '관리 열쇠 백업 암호', autocomplete: 'current-password' });
  const bundle = h('textarea', { placeholder: '파수꾼고래의 공개키 묶음을 붙여 넣으세요', 'aria-label': '공개키 묶음' });
  const revokeSel = h('select', { 'aria-label': '말소할 파수꾼고래' }, (state.list ? state.list.reviewers : []).map((r) => h('option', { value: r.id }, `${r.nickname} (${r.id})`)));
  const reasonSel = h('select', { 'aria-label': '말소 사유' }, [['left', '탈퇴·전근 (말소 이전 서명은 인정)'], ['lost', '열쇠 분실 (모두 무효)'], ['leaked', '열쇠 유출 (모두 무효)']].map(([v, t]) => h('option', { value: v }, t)));
  const L = state.list;
  const listText = L && L.rootSig && state.listSigned ? JSON.stringify(L, null, 2) : '';
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '3. 고래 족보 관리 (관리자 파수꾼고래)'),
      h('p', { class: 'notice error' }, '관리 열쇠는 족보 서명 때만 불러오고, 백업 파일은 인터넷에 올리지 마세요. 분실에 대비해 서로 다른 장소에 2부 보관하세요.'),
      state.root ? h('p', { class: 'ok' }, '✔ 관리 열쇠를 불러왔어요 (이 탭을 닫으면 사라져요).') : h('p', { class: 'notice' }, '관리 열쇠가 불러와져 있지 않아요.'),
      h('h3', {}, '관리 열쇠 불러오기'), lfile, lpw,
      h('button', { onclick: async () => loadRoot(await readFile(lfile), lpw.value) }, '불러오기'),
      h('h3', {}, '처음이라면: 관리 열쇠 만들기'),
      rootPw,
      h('button', { class: 'secondary', onclick: () => makeRoot(rootPw.value) }, '관리 열쇠 만들기 + 백업 내려받기')),
    h('div', { class: 'card' },
      h('h3', {}, `현재 고래 족보 (버전 ${L ? L.version : '-'})`),
      h('button', { class: 'secondary', onclick: async () => { state.list = null; await ensureSiteData(); say('공개된 족보를 다시 불러왔어요.'); } }, '공개된 족보 불러오기'),
      L ? h('table', {}, h('tr', {}, h('th', {}, '별명'), h('th', {}, 'id'), h('th', {}, '상태')),
        L.reviewers.map((r) => { const rv = L.revoked.find((x) => x.id === r.id); return h('tr', {}, h('td', {}, r.nickname), h('td', {}, r.id), h('td', {}, rv ? `말소(${rv.reason})` : '등록')); })) : null,
      h('h3', {}, '파수꾼고래 추가'), bundle,
      h('button', { onclick: () => editList(() => addReviewer(state.list, JSON.parse(bundle.value))) }, '추가하고 서명'),
      h('h3', {}, '파수꾼고래 말소 (검수 서명 말소)'), revokeSel, reasonSel,
      h('button', { class: 'danger', onclick: () => editList(() => revokeReviewer(state.list, revokeSel.value, reasonSel.value)) }, '말소하고 서명')),
    featuredCard(),
    state.featuredSigned ? catalogOut() : null,
    listText ? h('div', { class: 'card' },
      h('h3', {}, `새 reviewers.json (버전 ${L.version})`),
      h('p', { class: 'muted' }, '내려받은 파일을 저장소의 site/reviewers.json에 덮어쓰고 올리면 반영돼요.'),
      h('textarea', { readonly: true, 'aria-label': 'reviewers.json' }, listText),
      h('div', { class: 'row' },
        h('button', { class: 'secondary', onclick: () => copy(listText) }, '복사'),
        h('button', { class: 'secondary', onclick: () => download('reviewers.json', listText) }, '내려받기'))) : null);
}

// 이달의 고래자리 선정: 인증 곳간 작품 중 골라 관리 열쇠로 서명 → catalog.json의 featured
function featuredCard() {
  const items = (state.catalog && state.catalog.items) || [];
  const now = new Date();
  const month = h('input', { value: state.catalog && state.catalog.featured ? state.catalog.featured.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, 'aria-label': '달 (YYYY-MM)' });
  const title = h('input', { placeholder: '띠 제목 (예: 10월의 고래자리)', value: (state.catalog && state.catalog.featured && state.catalog.featured.title) || '' });
  const note = h('input', { placeholder: '한 줄 소개 (선택)', value: (state.catalog && state.catalog.featured && state.catalog.featured.note) || '' });
  const current = new Set((state.catalog && state.catalog.featured && state.catalog.featured.items) || []);
  const boxes = items.map((w) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: w.id, checked: current.has(w.id) }), w.title));
  return h('div', { class: 'card' },
    h('h3', {}, `이달의 고래자리 선정 (최대 ${MAX_FEATURED}개)`),
    h('p', { class: 'muted' }, '인증 곳간 맨 위 띠에 보일 작품을 고르고 관리 열쇠로 서명해요. 서명이 틀리면 띠가 숨겨져요.'),
    month, title, note, ...boxes,
    h('button', { onclick: async () => {
      if (!state.root) return say('먼저 관리 열쇠를 불러와 주세요.', true);
      try {
        await ensureSiteData();
        const picked = boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
        const featured = await signFeatured({ month: month.value.trim(), title: title.value.trim(), note: note.value.trim(), items: picked }, state.root.privateKey);
        state.catalog = { ...state.catalog, featured, updatedAt: new Date().toISOString() };
        state.featuredSigned = true;
        say('이달의 고래자리에 서명했어요. 아래 catalog.json을 내려받아 올려 주세요.');
      } catch (e) {
        say(e.message, true);
      }
    } }, '고래자리 서명하기'));
}

async function makeRoot(password) {
  const ok = checkPassword(password);
  if (!ok.ok) return say(ok.message, true);
  const kp = await tp.generateKeyPair({ extractable: true });
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const publicJwk = await tp.exportPublicJwk(kp.publicKey);
  download('파수꾼고래_관리열쇠.keybackup', JSON.stringify(await encryptJwk(privJwk, password, { kind: 'root' })));
  state.root = { privateKey: await tp.importPrivateJwk(privJwk), publicJwk };
  state.newRootJwk = publicJwk;
  say('관리 열쇠를 만들었어요. 아래 공개키를 extension/core/rootkey.js에 넣고 확장앱을 다시 배포해야 해요.');
}
async function loadRoot(text, password) {
  try {
    const jwk = await decryptJwk(JSON.parse(text), password);
    state.root = { privateKey: await tp.importPrivateJwk(jwk), publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
    say('관리 열쇠를 불러왔어요.');
  } catch (e) {
    say(e.message === 'BAD_PASSWORD' ? '암호가 틀렸거나 파일이 손상됐어요.' : '백업 파일을 읽을 수 없어요.', true);
  }
}
async function editList(change) {
  if (!state.root) return say('먼저 관리 열쇠를 불러와 주세요.', true);
  try {
    await ensureSiteData();
    const body = change();
    state.list = await signList(body, state.root.privateKey);
    state.listSigned = true;
    say(`버전 ${state.list.version} 족보에 서명했어요.`);
  } catch (e) {
    say(e.message || '처리하지 못했어요.', true);
  }
}

// ---------- D. 물뿜기 집계 (서버 없이: 의견 설문 응답 → catalog.json의 spouts) ----------
function viewSpout() {
  const paste = h('textarea', { placeholder: '의견 설문의 물뿜기 응답들을 한꺼번에 붙여 넣으세요', 'aria-label': '물뿜기 응답 붙여넣기' });
  const top = Object.entries((state.catalog && state.catalog.spouts) || {}).sort((a, b) => b[1].teacher + b[1].student - (a[1].teacher + a[1].student)).slice(0, 10);
  const title = (id) => ((state.catalog.items || []).find((w) => w.id === id) || { title: id }).title;
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '4. 물뿜기 집계'),
      h('p', { class: 'muted' }, '폼 응답의 [고래곳간 물뿜기] 보고를 붙여 넣으면 작품별 교사·학생 숫자를 더해요. 같은 보고 번호는 두 번 더하지 않아요. 서명은 필요 없어요.'),
      paste,
      h('button', { onclick: async () => {
        await ensureSiteData();
        const reports = parseSpoutReports(paste.value);
        if (!reports.length) return say('물뿜기 보고를 찾지 못했어요.', true);
        const r = applySpoutReports(state.catalog, reports);
        state.catalog = r.catalog;
        state.spoutDone = true;
        say(`보고 ${reports.length - r.skippedReports}개, 물뿜기 ${r.added}번을 더했어요.` + (r.skippedReports ? ` (이미 더한 보고 ${r.skippedReports}개는 건너뜀)` : '') + (r.unknownIds.length ? ` 목록에 없는 작품: ${r.unknownIds.join(', ')}` : ''));
      } }, '집계하기')),
    top.length ? h('div', { class: 'card' }, h('h3', {}, '많이 뿜은 작품'),
      h('table', {}, h('tr', {}, h('th', {}, '작품'), h('th', {}, '교사'), h('th', {}, '학생'), h('th', {}, '표시')),
        top.map(([id, c]) => h('tr', {}, h('td', {}, title(id)), h('td', {}, String(c.teacher)), h('td', {}, String(c.student)), h('td', {}, isPopular(c) ? '🔥 인기' : '')))),
      h('p', { class: 'muted' }, `물뿜기 ${POPULAR_MIN}번 이상이면 앱 카드에 "🔥 인기" 표시가 붙고, 나눔 곳간 작품은 교사에게 검수 요청이 추천돼요. 이달의 고래자리 후보로 위쪽 작품들을 살펴보세요.`)) : null,
    state.spoutDone ? catalogOut() : null);
}

// ---------- 깃허브에 바로 게시 (서버 없이: 깃허브 API + 이 브라우저에만 저장한 토큰) ----------
// 토큰은 이 저장소 하나의 Contents 쓰기 권한만 가진 '세분화된 토큰'을 쓴다. 이 브라우저 밖으로는 api.github.com 외에 보내지 않는다.
const GH = { owner: 'codersongpro', repo: 'gorae', branch: 'main', path: 'site/catalog.json' };
const GH_API = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}`;
const ghHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
const b64encode = (text) => { const bytes = new TextEncoder().encode(text); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
class GhError extends Error { constructor(status, detail) { super(detail || String(status)); this.status = status; } }
async function ghRead(token) {
  const res = await fetch(`${GH_API}?ref=${GH.branch}`, { headers: ghHeaders(token), cache: 'no-store' });
  if (!res.ok) throw new GhError(res.status, res.status === 401 || res.status === 403 ? '토큰이 맞지 않거나 권한이 없어요.' : res.status === 404 ? '저장소나 파일을 찾지 못했어요.' : '깃허브에서 읽지 못했어요.');
  const j = await res.json();
  return { sha: j.sha, catalog: JSON.parse(b64decode(j.content)) };
}
async function ghWrite(token, catalog, sha, message) {
  const res = await fetch(GH_API, { method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content: b64encode(JSON.stringify(catalog, null, 2)), sha, branch: GH.branch }) });
  if (!res.ok) throw new GhError(res.status, res.status === 409 || res.status === 422 ? 'CONFLICT' : res.status === 401 || res.status === 403 ? '토큰에 쓰기 권한(Contents: Read and write)이 없어요.' : '깃허브에 쓰지 못했어요.');
}
// 서명된 항목 하나를 깃허브의 최신 catalog.json에 합쳐 올린다 (다른 사람이 먼저 올렸어도 덮어쓰지 않도록 매번 최신본에 합친다)
async function publishItem(item, title) {
  const rec = await loadKey('ghtoken');
  if (!rec || !rec.token) return { skipped: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, catalog } = await ghRead(rec.token);
    const merged = { ...upsertCatalogItem(catalog, item), updatedAt: new Date().toISOString() };
    try {
      await ghWrite(rec.token, merged, sha, `검수 완료: ${title}`);
      state.catalog = merged;
      return { ok: true };
    } catch (e) {
      if (!(e instanceof GhError) || e.message !== 'CONFLICT') throw e; // 충돌이면 최신본을 다시 받아 한 번 더
    }
  }
  throw new GhError(409, '다른 변경과 겹쳐서 올리지 못했어요. 잠시 뒤 다시 눌러 주세요.');
}
async function saveToken(token) {
  const t = String(token || '').trim();
  if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) return say('깃허브 토큰 형식이 아니에요. github_pat_ 로 시작하는 토큰을 붙여 넣어 주세요.', true);
  await saveKey({ slot: 'ghtoken', token: t });
  state.hasToken = true;
  say('게시용 토큰을 이 브라우저에 저장했어요. 이제 [검수 완료]를 누르면 바로 올라가요.');
}
async function clearToken() { await saveKey({ slot: 'ghtoken', token: '' }); state.hasToken = false; say('저장한 토큰을 지웠어요.'); }
function tokenCard() {
  const inp = h('input', { type: 'password', 'aria-label': '깃허브 토큰', placeholder: 'github_pat_… (이 브라우저에만 저장돼요)', autocomplete: 'off' });
  return h('div', { class: 'card' },
    h('h3', {}, '게시 설정 (검수 완료를 바로 올리기)'),
    state.hasToken ? h('p', { class: 'ok' }, '✔ 게시용 토큰이 저장되어 있어요. [검수 완료]를 누르면 바로 인증 곳간 목록에 올라가요.')
      : h('p', { class: 'notice' }, '토큰이 없어서 [검수 완료] 뒤에 catalog.json을 직접 올려야 해요. 아래 토큰을 한 번 저장하면 바로 올라가요.'),
    h('details', {}, h('summary', {}, '토큰 만드는 방법'),
      h('ol', { class: 'guide-list' },
        h('li', {}, 'GitHub 설정 → Developer settings → Fine-grained tokens에서 새 토큰을 만들어요.'),
        h('li', {}, 'Repository access는 [Only select repositories]에서 gorae 하나만 골라요.'),
        h('li', {}, 'Permissions → Repository permissions → [Contents]를 [Read and write]로 해요. 만료일은 짧게(예: 30일) 정해요.'),
        h('li', {}, '[Generate token]으로 나온 github_pat_… 값을 아래에 붙여 넣고 저장해요.'))),
    inp,
    h('div', { class: 'row' }, h('button', { onclick: () => saveToken(inp.value) }, '토큰 저장'), state.hasToken ? h('button', { class: 'secondary', onclick: clearToken }, '토큰 지우기') : null));
}

// ---------- 검수 도구 로그인 (임시: 검수 도구 비밀번호) ----------
const REVIEW_BACKUP_URL = 'reviewer.keybackup.json';
const SESSION_FLAG = 'gorae-review-session';
async function login(password) {
  try {
    const text = await (await fetch(REVIEW_BACKUP_URL, { cache: 'no-store' })).text();
    await restoreReviewer(text, password);
    if (!state.reviewer) return;
    state.session = true;
    try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* 저장 못 해도 이 탭에서는 계속 로그인 */ }
    state.tab = 'queue';
    say(`파수꾼고래 ${state.reviewer.nickname}(으)로 로그인했어요.`);
  } catch {
    say('로그인에 실패했어요. 비밀번호를 확인해 주세요.', true);
  }
}
function logout() {
  state.session = false;
  try { sessionStorage.removeItem(SESSION_FLAG); } catch { /* 무시 */ }
  render();
}
function viewLogin() {
  const pw = h('input', { type: 'password', 'aria-label': '검수 도구 비밀번호', placeholder: '검수 도구 비밀번호', autocomplete: 'current-password' });
  const go = () => login(pw.value);
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return h('div', { class: 'card login' },
    h('h2', {}, '🛡️ 파수꾼고래 로그인'),
    h('p', { class: 'muted' }, '검수 도구 비밀번호를 넣으면 파수꾼고래로 로그인돼요. 작품을 살펴보고 [검수 완료]를 누르면 검수 서명이 찍혀요.'),
    pw, h('button', { onclick: go }, '로그인'));
}

// ---------- 0. 검수 목록 (나눔 곳간에 올라온 작품을 살펴보고 [검수 완료]) ----------
async function loadQueue() {
  const q = state.queue;
  q.status = 'loading'; q.note = ''; render();
  const entries = [];
  try {
    const samples = await (await fetch('app/sample/market-samples.json')).json();
    for (const e of samples) entries.push({ ...e, sourceLabel: '샘플' });
  } catch { /* 샘플이 없어도 된다 */ }
  try {
    const store = { get: async () => null, set: async () => {} };
    const r = await loadMarket({ fetchFn: (u, o) => fetch(u, o), config: MARKET, storage: store });
    for (const e of r.entries) if (!entries.some((x) => x.id === e.id)) entries.push({ ...e, sourceLabel: '나눔 곳간' });
  } catch (e) {
    q.note = '나눔 곳간 시트를 불러오지 못했어요 (' + (e.code || '오류') + '). 샘플만 보여요.';
  }
  q.entries = entries; q.status = 'ok'; render();
}
async function openEntry(entry) {
  const q = state.queue;
  q.open = entry.id;
  if (q.drafts[entry.id]) return render();
  try {
    const r = await fetchEntryWorks(entry, { fetchFn: (u, o) => fetch(u, o), config: MARKET });
    q.drafts[entry.id] = r.works.map((work) => {
      const report = checkWork(work);
      return { work, report, badge: report && !report.ok ? 'shallow' : 'clear', pick: false, songs: '', signed: null, check: null, quick: entry.id };
    });
    render();
  } catch (e) {
    q.drafts[entry.id] = [];
    say(e.code === 'NETWORK' || e.code === 'HTTP' ? '이 작품 파일은 브라우저에서 바로 받을 수 없어요. 구글 드라이브에서 내려받아 [2. 검수대]에 올려 주세요.' : `작품을 읽지 못했어요 (${e.code || e.message}).`, true);
  }
}
function viewQueue() {
  const q = state.queue;
  if (q.status === 'idle') setTimeout(loadQueue, 0);
  const pending = q.entries.filter((e) => !q.done[e.id]);
  const done = q.entries.filter((e) => q.done[e.id]);
  const row = (e) => h('div', { class: 'qrow' + (q.done[e.id] ? ' done' : '') },
    h('div', {}, h('strong', {}, e.title), h('div', { class: 'muted' }, [`🐋 ${e.nickname || ''}`, e.whale, (e.kinds || []).join('·'), e.sourceLabel].filter(Boolean).join(' · '))),
    q.done[e.id] ? h('span', { class: 'ok' }, '✔ 검수 완료') : h('button', { onclick: () => openEntry(e) }, q.open === e.id ? '살펴보는 중' : '살펴보기'));
  const open = q.entries.find((e) => e.id === q.open);
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '검수 목록'),
      h('p', { class: 'muted' }, '나눔 곳간에 올라온 작품이에요. [살펴보기]로 자동 점검·실행·코드를 확인한 뒤 [검수 완료]를 누르면 검수 서명이 찍혀 인증 곳간 목록(catalog.json)에 들어가요.'),
      h('div', { class: 'row' }, h('button', { class: 'secondary', onclick: loadQueue }, '목록 새로고침')),
      q.note ? h('p', { class: 'notice' }, q.note) : null,
      q.status === 'loading' ? h('p', { class: 'muted' }, '목록을 불러오는 중이에요…') : null,
      q.status === 'ok' && !q.entries.length ? h('p', { class: 'muted' }, '검수할 작품이 아직 없어요.') : null,
      pending.length ? h('h3', {}, `검수 대기 ${pending.length}개`) : null, ...pending.map(row),
      done.length ? h('h3', {}, `검수 완료 ${done.length}개`) : null, ...done.map(row)),
    ...(open && !q.done[open.id] ? (q.drafts[open.id] || []).map(draftCard) : []),
    tokenCard(),
    state.catalogChanged ? catalogOut() : null);
}
async function finish(d) {
  await ensureSiteData();
  const res = await signForCatalog({ work: d.work, privateKey: state.reviewer.privateKey, reviewerId: state.reviewer.reviewerId, badge: d.badge, pick: d.pick, songs: parseSongs(d.songs) });
  if (!res.ok) return say(res.errors.join(' '), true);
  d.signed = res.item;
  const v = await tp.createVerifier({ rootPublicJwk: ROOT_PUBLIC_JWK, list: state.list });
  d.check = await v.verify(res.item);
  state.catalog = upsertCatalogItem(state.catalog, res.item);
  state.catalogChanged = true;
  const warn = d.check.ok ? '' : ' (주의: 지금 불러온 고래 족보로는 서명이 확인되지 않아요.)';
  try {
    const pub = await publishItem(res.item, d.work.title);
    if (d.quick) state.queue.done[d.quick] = true;
    if (pub.skipped) say(`✔ '${d.work.title}' 검수 완료! 토큰이 없어 아래 [게시하기]로 catalog.json을 직접 올려야 해요.` + warn);
    else say(`✔ '${d.work.title}' 검수 완료! 깃허브에 올렸어요. 1~2분 뒤 모두의 인증 곳간에 보여요.` + warn);
  } catch (e) {
    if (d.quick) state.queue.done[d.quick] = true;
    say(`검수 서명은 찍었지만 깃허브에 올리지 못했어요: ${e.message} 아래 [게시하기]로 직접 올릴 수 있어요.`, true);
  }
}

// ---------- 화면 ----------
const TABS = [['queue', '검수 목록'], ['make', '1. 검수 서명 만들기'], ['desk', '2. 검수대'], ['root', '3. 고래 족보 관리'], ['spout', '4. 물뿜기 집계']];
function render() {
  if (!state.session) {
    tabsEl.replaceChildren();
    panel.replaceChildren(...[state.msg ? h('p', { class: 'notice', role: 'status' }, state.msg) : null, state.err ? h('p', { class: 'notice error', role: 'alert' }, state.err) : null, viewLogin()].filter(Boolean));
    return;
  }
  tabsEl.replaceChildren(...TABS.map(([k, t]) => h('button', { role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => { state.tab = k; state.msg = ''; state.err = ''; render(); } }, t)),
    h('button', { class: 'secondary', style: 'margin-left:auto', onclick: logout }, `로그아웃 (${state.reviewer ? state.reviewer.nickname : ''})`));
  const body = state.tab === 'queue' ? viewQueue() : state.tab === 'make' ? viewMake() : state.tab === 'desk' ? viewDesk() : state.tab === 'spout' ? viewSpout() : viewRoot();
  const root = state.newRootJwk && state.tab === 'root'
    ? h('div', { class: 'card' }, h('h3', {}, '새 관리 공개키 (extension/core/rootkey.js의 ROOT_PUBLIC_JWK에 넣기)'), h('textarea', { readonly: true, 'aria-label': '관리 공개키' }, JSON.stringify(state.newRootJwk)))
    : null;
  panel.replaceChildren(...[
    state.msg ? h('p', { class: 'notice', role: 'status' }, state.msg) : null,
    state.err ? h('p', { class: 'notice error', role: 'alert' }, state.err) : null,
    body, root,
  ].filter(Boolean));
}

(async () => {
  try { state.reviewer = (await loadKey('reviewer')) || null; } catch { state.reviewer = null; }
  try { const t = await loadKey('ghtoken'); state.hasToken = !!(t && t.token); } catch { state.hasToken = false; }
  try { state.session = !!state.reviewer && sessionStorage.getItem(SESSION_FLAG) === '1'; } catch { state.session = false; }
  await ensureSiteData();
  render();
})();
