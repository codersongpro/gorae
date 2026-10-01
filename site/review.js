// 검수 도구: 검수 서명 만들기(파수꾼) · 검수대(파수꾼) · 고래 족보 관리(대왕고래)
// 모든 일은 이 브라우저 안에서만 한다. 개인 열쇠는 꺼낼 수 없는 형태로만 보관하고 어디로도 보내지 않는다.
import { h } from './dom.js';
import * as tp from './shared/tailprint.js';
import { encryptJwk, decryptJwk, checkPassword } from './shared/keybackup.js';
import { signForCatalog, addReviewer, revokeReviewer, signList, emptyList, upsertCatalogItem } from './shared/review.js';
import { parsePack, extractPackText } from './shared/pack.js';
import { checkWork } from './shared/checker.js';
import { ROOT_PUBLIC_JWK } from './rootkey.js';
import { S } from './strings.js';
import { normalizeWork } from './shared/taxonomy.js';
import { signFeatured, MAX_FEATURED } from './shared/featured.js';
import { parseSpoutReports, applySpoutReports } from './shared/spout.js';

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
const state = { tab: 'make', reviewer: null, root: null, catalog: null, list: null, drafts: [], msg: '', err: '' };
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
      h('h2', {}, '1. 검수 서명 만들기 (혹등고래 파수꾼)'),
      h('p', { class: 'muted' }, '열쇠 한 쌍을 만들어요. 개인 열쇠는 이 브라우저에 꺼낼 수 없게 저장되고, 기기를 바꿀 때 쓸 암호 건 백업 파일을 내려받아요. 공개키 묶음은 대왕고래에게 보내 족보에 올려 달라고 하세요.'),
      me ? h('p', { class: 'ok' }, `✔ 이 브라우저에 열쇠가 있어요: ${me.nickname} (${me.reviewerId})`) : h('p', { class: 'notice' }, '아직 이 브라우저에 열쇠가 없어요.'),
      field('별명', nick), field('백업 암호', pw),
      h('button', { onclick: () => makeReviewer(nick.value, pw.value) }, me ? '새 열쇠로 바꾸기' : '검수 서명 만들기')),
    me ? h('div', { class: 'card' },
      h('h3', {}, '공개키 묶음 (대왕고래에게 전달)'),
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
  const paste = h('textarea', { placeholder: '네이버 폼 응답(꾸러미 포함)을 그대로 붙여 넣으세요', 'aria-label': '폼 응답 붙여넣기' });
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '2. 검수대'),
      h('p', { class: 'muted' }, `파수꾼: ${state.reviewer.nickname}. 응답을 붙여 넣으면 자동 점검 결과를 보여 줘요. 코드를 직접 보고 실행해 본 뒤 배지를 골라 서명하세요.`),
      paste,
      h('button', { onclick: () => loadDrafts(paste.value) }, '확인하기')),
    ...state.drafts.map(draftCard),
    state.drafts.length || state.catalog ? catalogOut() : null);
}

function loadDrafts(text) {
  const res = parsePack(extractPackText(text));
  if (!res.ok) { state.drafts = []; return say(res.errors.map((e) => e.message).join(' '), true); }
  state.drafts = res.pack.items.map((work) => {
    const report = checkWork(work);
    return { work, report, badge: report && !report.ok ? 'shallow' : 'clear', pick: false, songs: '', signed: null, check: null };
  });
  say(`작품 ${state.drafts.length}개를 읽었어요.`);
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
    h('label', { class: 'check' }, pick, '🐋 고래 픽 (찜)'),
    songs,
    h('button', { onclick: () => sign(d) }, '검수 서명 찍기'),
    d.signed ? h('div', {},
      h('p', { class: d.check && d.check.ok ? 'ok' : 'notice error' }, d.check ? (d.check.ok ? '✔ 지금 불러온 고래 족보로 서명이 확인돼요.' : `⚠ 지금 불러온 족보로는 확인되지 않아요 (대왕고래에게 족보 등록을 요청하세요): ${REASON_TEXT[d.check.reason] || d.check.reason}`) : ''),
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
    h('p', { class: 'muted' }, '내려받은 파일을 저장소의 site/catalog.json에 덮어쓰고 올리면 모두의 큰 곳간에 반영돼요.'),
    h('textarea', { readonly: true, 'aria-label': 'catalog.json' }, text),
    h('div', { class: 'row' },
      h('button', { class: 'secondary', onclick: () => copy(text) }, '복사'),
      h('button', { class: 'secondary', onclick: () => download('catalog.json', text) }, '내려받기')));
}

// ---------- C. 고래 족보 관리 (대왕고래) ----------
function viewRoot() {
  const rootPw = h('input', { type: 'password', placeholder: '뿌리 열쇠 백업 암호 (8자 이상)', autocomplete: 'new-password' });
  const lfile = h('input', { type: 'file', accept: '.keybackup,.json' });
  const lpw = h('input', { type: 'password', placeholder: '뿌리 열쇠 백업 암호', autocomplete: 'current-password' });
  const bundle = h('textarea', { placeholder: '파수꾼의 공개키 묶음을 붙여 넣으세요', 'aria-label': '공개키 묶음' });
  const revokeSel = h('select', { 'aria-label': '말소할 파수꾼' }, (state.list ? state.list.reviewers : []).map((r) => h('option', { value: r.id }, `${r.nickname} (${r.id})`)));
  const reasonSel = h('select', { 'aria-label': '말소 사유' }, [['left', '탈퇴·전근 (말소 이전 서명은 인정)'], ['lost', '열쇠 분실 (모두 무효)'], ['leaked', '열쇠 유출 (모두 무효)']].map(([v, t]) => h('option', { value: v }, t)));
  const L = state.list;
  const listText = L && L.rootSig && state.listSigned ? JSON.stringify(L, null, 2) : '';
  return h('div', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, '3. 고래 족보 관리 (대왕고래)'),
      h('p', { class: 'notice error' }, '뿌리 열쇠는 족보 서명 때만 불러오고, 백업 파일은 인터넷에 올리지 마세요. 분실에 대비해 서로 다른 장소에 2부 보관하세요.'),
      state.root ? h('p', { class: 'ok' }, '✔ 뿌리 열쇠를 불러왔어요 (이 탭을 닫으면 사라져요).') : h('p', { class: 'notice' }, '뿌리 열쇠가 불러와져 있지 않아요.'),
      h('h3', {}, '뿌리 열쇠 불러오기'), lfile, lpw,
      h('button', { onclick: async () => loadRoot(await readFile(lfile), lpw.value) }, '불러오기'),
      h('h3', {}, '처음이라면: 뿌리 열쇠 만들기'),
      rootPw,
      h('button', { class: 'secondary', onclick: () => makeRoot(rootPw.value) }, '뿌리 열쇠 만들기 + 백업 내려받기')),
    h('div', { class: 'card' },
      h('h3', {}, `현재 고래 족보 (버전 ${L ? L.version : '-'})`),
      h('button', { class: 'secondary', onclick: async () => { state.list = null; await ensureSiteData(); say('공개된 족보를 다시 불러왔어요.'); } }, '공개된 족보 불러오기'),
      L ? h('table', {}, h('tr', {}, h('th', {}, '별명'), h('th', {}, 'id'), h('th', {}, '상태')),
        L.reviewers.map((r) => { const rv = L.revoked.find((x) => x.id === r.id); return h('tr', {}, h('td', {}, r.nickname), h('td', {}, r.id), h('td', {}, rv ? `말소(${rv.reason})` : '등록')); })) : null,
      h('h3', {}, '파수꾼 추가'), bundle,
      h('button', { onclick: () => editList(() => addReviewer(state.list, JSON.parse(bundle.value))) }, '추가하고 서명'),
      h('h3', {}, '파수꾼 말소 (검수 서명 말소)'), revokeSel, reasonSel,
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

// 이달의 고래자리 선정: 큰 곳간 작품 중 골라 뿌리 열쇠로 서명 → catalog.json의 featured
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
    h('p', { class: 'muted' }, '큰 곳간 맨 위 띠에 보일 작품을 고르고 뿌리 열쇠로 서명해요. 서명이 틀리면 띠가 숨겨져요.'),
    month, title, note, ...boxes,
    h('button', { onclick: async () => {
      if (!state.root) return say('먼저 뿌리 열쇠를 불러와 주세요.', true);
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
  download('대왕고래_뿌리열쇠.keybackup', JSON.stringify(await encryptJwk(privJwk, password, { kind: 'root' })));
  state.root = { privateKey: await tp.importPrivateJwk(privJwk), publicJwk };
  state.newRootJwk = publicJwk;
  say('뿌리 열쇠를 만들었어요. 아래 공개키를 extension/core/rootkey.js에 넣고 확장앱을 다시 배포해야 해요.');
}
async function loadRoot(text, password) {
  try {
    const jwk = await decryptJwk(JSON.parse(text), password);
    state.root = { privateKey: await tp.importPrivateJwk(jwk), publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
    say('뿌리 열쇠를 불러왔어요.');
  } catch (e) {
    say(e.message === 'BAD_PASSWORD' ? '암호가 틀렸거나 파일이 손상됐어요.' : '백업 파일을 읽을 수 없어요.', true);
  }
}
async function editList(change) {
  if (!state.root) return say('먼저 뿌리 열쇠를 불러와 주세요.', true);
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

// ---------- D. 물뿜기 집계 (서버 없이: 네이버 폼 응답 → catalog.json의 spouts) ----------
function viewSpout() {
  const paste = h('textarea', { placeholder: '네이버 폼의 물뿜기 응답들을 한꺼번에 붙여 넣으세요', 'aria-label': '물뿜기 응답 붙여넣기' });
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
      h('table', {}, h('tr', {}, h('th', {}, '작품'), h('th', {}, '교사'), h('th', {}, '학생')),
        top.map(([id, c]) => h('tr', {}, h('td', {}, title(id)), h('td', {}, String(c.teacher)), h('td', {}, String(c.student)))))) : null,
    state.spoutDone ? catalogOut() : null);
}

// ---------- 화면 ----------
const TABS = [['make', '1. 검수 서명 만들기'], ['desk', '2. 검수대'], ['root', '3. 고래 족보 관리'], ['spout', '4. 물뿜기 집계']];
function render() {
  tabsEl.replaceChildren(...TABS.map(([k, t]) => h('button', { role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => { state.tab = k; state.msg = ''; state.err = ''; render(); } }, t)));
  const body = state.tab === 'make' ? viewMake() : state.tab === 'desk' ? viewDesk() : state.tab === 'spout' ? viewSpout() : viewRoot();
  const root = state.newRootJwk && state.tab === 'root'
    ? h('div', { class: 'card' }, h('h3', {}, '새 대왕고래 공개키 (extension/core/rootkey.js의 ROOT_PUBLIC_JWK에 넣기)'), h('textarea', { readonly: true, 'aria-label': '대왕고래 공개키' }, JSON.stringify(state.newRootJwk)))
    : null;
  panel.replaceChildren(...[
    state.msg ? h('p', { class: 'notice', role: 'status' }, state.msg) : null,
    state.err ? h('p', { class: 'notice error', role: 'alert' }, state.err) : null,
    body, root,
  ].filter(Boolean));
}

(async () => {
  try { state.reviewer = (await loadKey('reviewer')) || null; } catch { state.reviewer = null; }
  await ensureSiteData();
  render();
})();
