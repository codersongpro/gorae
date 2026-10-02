// 사이드바 진입점: core 로직과 ui 컴포넌트를 이어 준다.
import { CONFIG } from './core/config.js';
import { createChromeStorage } from './core/storage.js';
import { loadCatalog } from './core/catalog.js';
import { resolveTrustedList, buildEntries } from './core/trust.js';
import { filterEntries, sortEntries } from './core/filter.js';
import { buildRunMessage, canRun, describeExternalOpen } from './core/runner.js';
import { buildShare } from './core/share.js';
import { buildSharePackage, buildSongSubmission, validFormUrl } from './core/submit.js';
import { detectService, orderShareKinds, SERVICE_LABEL, isExamLocked } from './core/services.js';
import { buildViewerLink } from './shared/link.js';
import { putRunTicket } from './core/runtab.js';
import { seedMypod, samplesInMypod } from './core/seed.js';
import { verifyFeatured } from './shared/featured.js';
import { spoutCountsFor, spoutTotal } from './shared/spout.js';
import { pendingReport, markSent, mySpouts } from './core/spout-store.js';
import { likeNow, unlikeNow, flushPending, loadSpoutCounts } from './core/spout-sync.js';
import { spoutSendBar } from './ui/views.js';
import { checkWork } from './core/checker.js';
import { validateNewWork, createWork } from './core/work.js';
import { createStore } from './core/store.js';
import { createIdbBackend } from './core/idb-backend.js';
import { ROOT_PUBLIC_JWK } from './core/rootkey.js';
import { h } from './ui/dom.js';
import { S } from './ui/strings.js';
import { exportBundle, previewImport, importSelected } from './core/bundle.js';
import { remixInput, editInput, saveEdit } from './core/remix.js';
import { buildClassBundle, CLASS_URL } from './core/classpack.js';
import { topBar, tabsBar, catalogView, mypodView, classView, runView, importView, urlConfirmView } from './ui/views.js';
import { createView } from './ui/form.js';
import { pinView, marketView, marketRunConfirm, examLockView } from './ui/views.js';
import { MARKET, shareReady } from './core/market-config.js';
import { loadMarket, importEntry, fetchEntryWorks } from './core/market.js';
import { buildPrefillUrl } from './shared/market.js';
import { hasPin, setPin, checkPin, resetPin } from './core/pin.js';

const app = document.getElementById('app');
const storage = createChromeStorage();
const store = createStore(createIdbBackend());

const state = {
  market: { status: 'idle', entries: [], query: '', kind: '', busy: {}, done: {} },
  shareProfile: {}, marketRunOk: {}, confirmMarket: null,
  service: null, confirmUrl: null, catalog: null, mySpouts: {}, spoutWaiting: null, spoutLive: null, pendingCancels: {},
  tab: 'catalog', mode: 'baby', screen: 'main', // screen: main | create | import | run
  grade: '', subject: '', badge: '', pickOnly: false, sort: 'pick',
  source: 'network', listRejected: false, notice: '', openId: null,
  entries: [], list: null,
  create: { kind: 'create', errors: [], warnings: [], input: { artifactType: 'html', domain: '', category: '', subcategory: '', audience: [], tags: [] } }, // kind: create | edit | remix
  selected: [], packName: '', exportOut: null,
  classSelected: [], className: '', classNote: '', classOut: null,
  imp: { preview: null, errors: [], selected: [] },
};
// 새 작품 입력 기본값: 형태는 HTML, 수업/업무·카테고리는 직접 고르게 비워 둔다
const blankInput = () => ({ artifactType: 'html', domain: '', category: '', subcategory: '', audience: [], tags: [] });
const freshCreate = () => ({ kind: 'create', errors: [], warnings: [], input: blankInput() });

// 목록 받기 → 족보 고르기(낮은 버전 거부) → 작품 검증
async function loadAll() {
  const res = await loadCatalog({ fetchFn: fetch, storage, config: CONFIG, resolveLocal: (p) => chrome.runtime.getURL(p) });
  const trusted = await resolveTrustedList({ candidate: res.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  state.list = trusted.list;
  state.source = res.source;
  state.listRejected = !trusted.accepted && trusted.reason === 'LIST_OLD';
  state.entries = await buildEntries({ works: res.catalog.items, list: trusted.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  // 이달의 고래자리: 대왕고래 서명이 맞을 때만 띠를 보인다
  state.featured = await verifyFeatured(res.catalog.featured, ROOT_PUBLIC_JWK, res.catalog.items);
  state.catalog = res.catalog; // 물뿜기 숫자(spouts)를 읽는다
  state.mySpouts = await mySpouts(storage);
}

const verifyWorks = (works) => buildEntries({ works, list: state.list, storage, rootJwk: ROOT_PUBLIC_JWK });

function go(patch) { Object.assign(state, patch); render(); }
const toggleDetail = (id) => go({ openId: state.openId === id ? null : id });

// 실행 창이 열리며 초점이 옮겨 가도 사이드바가 닫히지 않게 한다.
// 웨일 전용 API(whale.sidebarAction)가 있으면 사이드바를 다시 띄운다. 공식 문서로 이름을 확인하지 못해 있는 것만 조심스럽게 부른다.
function keepSidebarOpen() {
  try {
    const sa = globalThis.whale && globalThis.whale.sidebarAction;
    if (!sa) return;
    const fn = sa.show || sa.open;
    if (typeof fn === 'function') fn.call(sa);
  } catch {
    /* 지원하지 않으면 그대로 둔다 */
  }
}

// 별도 웨일 창으로 연다. 창을 열 수 없으면 새 탭으로. 반환: 열었는지 여부
// type 'popup': 고래곳간 실행 화면(주소창 없음) / 'normal': 외부 웹앱(어느 사이트인지 주소창이 보이게)
function openInWindow(url, type = 'normal') {
  if (chrome.windows && chrome.windows.create) {
    chrome.windows.create({ url, type, width: 1024, height: 768, focused: true }, () => keepSidebarOpen());
    return true;
  }
  if (chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
    return true;
  }
  return false;
}

// 실행 관문: HTML·URL 작품 모두 canRun을 통과해야 한다. URL 작품은 확인 카드를 거친 뒤에만 새 창으로 연다.
async function run(entry) {
  const w = entry.work;
  const c = canRun(entry);
  if (!c.ok) return go({ notice: S.run[c.reason], confirmUrl: null });
  if (c.kind === 'url') return go({ confirmUrl: describeExternalOpen(entry), notice: '' });
  if (entry.source === 'market' && !state.marketRunOk[w.id]) return go({ confirmMarket: entry, notice: '' });
  // HTML 작품은 별도 웨일 창에서 연다 (확장앱 실행 화면 → sandbox 페이지, 격리 방식은 같다)
  if ((chrome.windows && chrome.windows.create) || (chrome.tabs && chrome.tabs.create)) {
    const id = await putRunTicket(storage, entry);
    openInWindow(chrome.runtime.getURL('run.html#' + id), 'popup');
    return go({ notice: S.run.openedTab(w.title), confirmUrl: null });
  }
  // 탭을 열 수 없는 환경이면 예전처럼 패널 안에서 실행한다
  const view = runView({ entry, onBack: () => { window.removeEventListener('message', onReady); go({ screen: 'main' }); } });
  // sandbox 페이지가 준비되면 작품을 보낸다 (보낸 쪽이 그 iframe일 때만 응답)
  function onReady(e) {
    if (e.source !== view.frame.contentWindow || !e.data || e.data.type !== 'gorae-sandbox-ready') return;
    view.frame.contentWindow.postMessage(buildRunMessage(w), '*');
  }
  window.addEventListener('message', onReady);
  state.screen = 'run';
  app.replaceChildren(view.el);
}

const openConfirmed = () => {
  const info = state.confirmUrl;
  // 외부 웹앱도 HTML 작품처럼 별도 웨일 창으로 연다 (창을 못 열면 새 탭)
  if (info) openInWindow(info.url);
  go({ confirmUrl: null, notice: S.run.external });
};

// ----- 웨일 스페이스 공유: 붙여넣기용 글을 만들어 클립보드에 복사한다 (다른 화면을 조작하지 않음)
const viewerLinkOf = async (work) => {
  const r = await buildViewerLink(work, CONFIG.viewerUrl);
  return r.ok ? r.url : null;
};
async function shareWork(entry, kind) {
  const link = await viewerLinkOf(entry.work);
  const { text } = buildShare(kind, entry.work, { link, status: entry.status });
  await navigator.clipboard.writeText(text);
  go({ notice: link ? S.share.copied(S.share.kinds[kind]) : `${S.share.tooBig} ${S.share.tooBigCopied}` });
}
async function copyViewerLink(entry) {
  const link = await viewerLinkOf(entry.work);
  if (!link) return go({ notice: S.share.tooBig });
  await navigator.clipboard.writeText(link);
  go({ notice: S.share.linkCopied });
}

// 메인 탭 도메인만 보고 서비스를 알아본다 (주소는 저장하지 않음)
async function refreshService() {
  let service = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    service = detectService(tab && tab.url);
  } catch { /* 탭 정보를 못 읽으면 기본 순서 */ }
  if (service !== state.service) go({ service });
}
const shareProps = () => ({
  kinds: orderShareKinds(state.service),
  serviceLabel: ['class', 'teamboard', 'ubt'].includes(state.service) ? SERVICE_LABEL[state.service] : null,
  onShare: shareWork,
  onLink: copyViewerLink,
});

// ----- 큰 곳간에 공유하기: 설문 문항(1~6)에 맞춘 답과 업로드 파일을 만든다. 학생고래·교사고래 모두 쓸 수 있다
const openForm = (u) => {
  const url = validFormUrl(u);
  if (url) chrome.tabs.create({ url });
  return !!url;
};
// 의견 설문(물뿜기·고래 노래)을 글을 미리 채운 채로 연다. 반환: 열었는지 여부
const openFeedback = (text) => {
  const url = buildPrefillUrl(CONFIG.feedbackFormUrl, { text: CONFIG.feedbackEntry }, { text });
  if (url) chrome.tabs.create({ url });
  return !!url;
};

const submitProps = (allowRecommend) => ({
  allowRecommend,
  profile: state.shareProfile,
  ready: shareReady(MARKET),
  draftOf: (entry) => (state.submitDraft && state.submitDraft.workId === entry.work.id ? state.submitDraft : null),
  onPrepare: async (entry, v) => {
    const result = buildSharePackage(entry.work, { nickname: v.nickname, role: spoutRole(), privacyChecked: v.privacyChecked });
    if (!result.ok) return go({ notice: result.errors.join(' ') });
    state.shareProfile = { nickname: v.nickname.trim() }; // 다음번을 위해 닉네임만 기억
    await storage.set('shareProfile', state.shareProfile);
    go({ submitDraft: { workId: entry.work.id, nickname: v.nickname, result }, notice: '' });
  },
  onCopy: async (text) => { await navigator.clipboard.writeText(text); go({ notice: S.submit.copied }); },
  onSaveFile: (file) => saveTextFile(file.text, file.name, file.type),
  onOpenForm: (pkg) => { const url = buildPrefillUrl(MARKET.formUrl, MARKET.entry, pkg.prefill); if (url) chrome.tabs.create({ url }); },
  showSong: state.mode === 'mother', // 고래 노래(수업 활용 후기)는 교사고래만
  onSong: async (entry, v) => {
    const r = buildSongSubmission(entry.work, { text: v.text, author: v.author, privacyChecked: v.privacyChecked });
    if (!r.ok) return go({ notice: r.errors.join(' ') });
    await navigator.clipboard.writeText(r.text);
    go({ notice: openFeedback(r.text) ? S.submit.songCopied : S.submit.songNoForm });
  },
});

// ----- 나눔 곳간: 시트 목록 불러오기·가져오기
async function refreshMarket() {
  state.market = { ...state.market, status: 'loading', error: '', notice: '' };
  render();
  // 앱에 들어 있는 샘플은 시트를 못 받아도 늘 보인다 (시연용)
  let samples = [];
  try {
    samples = await (await fetch(chrome.runtime.getURL('sample/market-samples.json'))).json();
  } catch { /* 샘플이 없어도 된다 */ }
  try {
    const r = await loadMarket({ fetchFn: fetch, config: MARKET, storage });
    state.market = { ...state.market, status: 'ok', entries: [...r.entries, ...samples], source: r.source, header: r.header, missing: r.missing };
  } catch (e) {
    state.market = { ...state.market, status: samples.length ? 'ok' : 'error', error: e.code || 'NETWORK', entries: samples, notice: samples.length ? S.market.error[e.code] || S.market.error.NETWORK : '' };
  }
  render();
}

// 미리 보기: 내 곳간에 담지 않고 바로 새 창에서 연다 (내려받기·검증은 가져오기와 같다)
async function previewFromMarket(entry) {
  state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: true }, notice: '' };
  render();
  try {
    const { works } = await fetchEntryWorks(entry, { fetchFn: fetch, config: MARKET });
    const [e] = await verifyWorks([works[0]]);
    state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: false } };
    // 미리 보기는 확인창 없이 바로 새 창에서 연다. HTML은 격리된 실행 창, 웹앱은 주소창이 보이는 일반 창.
    const c = canRun(e);
    if (!c.ok) return go({ notice: S.run[c.reason] });
    if (c.kind === 'url') openInWindow(c.url, 'normal');
    else {
      state.marketRunOk[e.work.id] = true;
      await run({ ...e, source: 'market' });
    }
    state.market = { ...state.market, notice: S.market.previewed(e.work.title) }; // 나눔 곳간 화면에 안내
    return render();
  } catch (err) {
    state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: false }, notice: (S.market.error[err.code] || S.market.error.NETWORK) + (err.detail ? ` (${err.detail})` : '') };
  }
  render();
}
async function importFromMarket(entry) {
  state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: true }, notice: '' };
  render();
  const M = S.market;
  try {
    const r = await importEntry(entry, { fetchFn: fetch, config: MARKET, store });
    const msgs = [r.added.length ? M.added(r.added) : '', r.skipped.length ? M.dup(r.skipped) : '', ...r.warnings].filter(Boolean);
    state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: false }, done: r.added.length ? { ...state.market.done, [entry.id]: true } : state.market.done };
    if (r.added.length) return go({ tab: 'mypod', notice: msgs.join(' ') }); // 성공하면 내 곳간으로
    state.market.notice = msgs.join(' ');
  } catch (e) {
    state.market = { ...state.market, busy: { ...state.market.busy, [entry.id]: false }, notice: (M.error[e.code] || M.error.NETWORK) + (e.detail ? ` (${e.detail})` : '') };
  }
  render();
}

// ----- 물뿜기 (서버 없음, 좋아요처럼): 누르면 숫자가 바로 오르고 '고래곳간 물뿜기' 설문에 자동 제출,
// 모두의 숫자는 그 설문의 응답 시트를 읽어 센다. 다시 누르면 취소(취소 보고 제출).
const spoutRole = () => (state.mode === 'mother' ? 'teacher' : 'student');
async function refreshSpoutCounts() {
  const live = await loadSpoutCounts({ fetchFn: fetch, config: CONFIG });
  if (live) {
    state.spoutLive = live;
    render();
  }
}
const spoutProps = () => ({
  countsOf: (e) => spoutCountsFor(state.catalog, e.work.id, state.mySpouts[e.work.id], state.spoutLive, state.pendingCancels[e.work.id]),
  mineOf: (e) => state.mySpouts[e.work.id],
  onSpout: async (e) => {
    const id = e.work.id;
    if (state.mySpouts[id]) {
      const r = await unlikeNow({ storage, fetchFn: fetch, config: CONFIG, workId: id });
      if (r.pendingCancel) state.pendingCancels[id] = r.pendingCancel;
      if (!r.ok) state.notice = S.spout.cancelFailed;
    } else {
      delete state.pendingCancels[id];
      await likeNow({ storage, fetchFn: fetch, config: CONFIG, workId: id, role: spoutRole() });
    }
    state.mySpouts = await mySpouts(storage);
    render();
    setTimeout(refreshSpoutCounts, 5000); // 시트에 올라가는 데 몇 초 걸린다
  },
});
async function sendSpouts() {
  const rep = await pendingReport(storage);
  if (!rep.count) return;
  await navigator.clipboard.writeText(rep.text);
  const opened = openFeedback(rep.text); // 물뿜기는 작품 폼이 아니라 의견 설문으로, 보고 글을 미리 채워서
  go({ spoutWaiting: rep.ids, notice: opened ? S.spout.copiedOpen : S.spout.copiedNoForm });
}
async function confirmSpoutsSent() {
  await markSent(storage, state.spoutWaiting || []);
  state.mySpouts = await mySpouts(storage);
  go({ spoutWaiting: null, notice: S.spout.thanks });
}

async function addToMypod(entry) {
  const w = entry.work;
  const report = checkWork(w);
  const r = await store.add(w, { source: 'catalog', checkReport: report });
  const msg = !r.ok ? S.add.dup : report && !report.ok ? `${S.add.done} ${S.add.warn(report.warnings.length)}` : S.add.done;
  go({ notice: msg });
}

async function removeRecord(entry) {
  await store.remove(entry.work.id);
  go({ notice: '' });
}

async function submitCreate(input) {
  const c = state.create;
  if (c.kind === 'edit') {
    const rec = await store.get(c.targetId);
    const res = await saveEdit(store, rec, input);
    if (!res.ok) return go({ create: { ...c, errors: res.errors, warnings: res.warnings, input } });
    const msg = res.separate ? S.edit.separate : S.edit.versionUp(res.record.work.version);
    return go({ screen: 'main', tab: 'mypod', notice: msg, openId: res.record.id, create: freshCreate() });
  }
  const v = validateNewWork(input);
  if (!v.ok) return go({ create: { ...c, errors: v.errors, warnings: v.warnings, input } });
  const work = createWork(input);
  const report = checkWork(work);
  await store.add(work, { source: 'maker', checkReport: report });
  const extra = report && !report.ok ? ` ${S.add.warn(report.warnings.length)}` : '';
  const base = c.kind === 'remix' ? S.edit.remixSaved : S.create.saved;
  go({ screen: 'main', tab: 'mypod', notice: base + extra, openId: work.id, create: freshCreate() });
}

const startEdit = (entry) => go({ screen: 'create', create: { kind: 'edit', targetId: entry.work.id, errors: [], warnings: [], input: editInput(entry.work) } });
const startRemix = (entry) => go({ screen: 'create', create: { kind: 'remix', errors: [], warnings: [], input: remixInput(entry.work) } });

// 꾸러미 내보내기: 고른 작품을 파일/클립보드용 텍스트로 만든다
async function doExport(name) {
  if (!state.selected.length) return go({ notice: S.bundle.pickFirst, packName: name });
  if (state.selected.length > 10) return go({ notice: S.bundle.tooMany, packName: name });
  const out = exportBundle(await store.list(), state.selected, { name });
  go({ exportOut: out, packName: name, notice: '' });
}
function saveTextFile(text, fileName, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const saveFile = () => saveTextFile(state.exportOut.text, state.exportOut.fileName);

// 학급 꾸러미: 교사고래 모드에서만. 꾸러미 + 웨일 클래스 공지 문구를 함께 만든다
async function buildClass(name, note) {
  const nm = name.trim() || S.classPack.defaultName;
  const out = buildClassBundle(await store.list(), state.classSelected, { name: nm, teacherNote: note });
  if (!out.ok) return go({ className: name, classNote: note, notice: out.error === 'NONE' ? S.classPack.none : S.classPack.tooMany });
  go({ className: name, classNote: note, classOut: out, notice: '' });
}
async function copyClass(kind) {
  const o = state.classOut;
  await navigator.clipboard.writeText(kind === 'all' ? o.combined : kind === 'notice' ? o.notice : o.packText);
  go({ notice: S.classPack.copied[kind] });
}
const openClass = () => chrome.tabs.create({ url: CLASS_URL });
async function copyPack() {
  await navigator.clipboard.writeText(state.exportOut.text);
  go({ notice: S.bundle.copied });
}

async function checkImport(text) {
  const existingIds = new Set((await store.list()).map((r) => r.id));
  const res = await previewImport(text, { verifyWorks, existingIds });
  if (!res.ok) return go({ imp: { preview: null, errors: res.errors, selected: [] } });
  go({ imp: { preview: res, errors: [], selected: res.items.filter((i) => !i.duplicate).map((i) => i.work.id) } });
}
async function confirmImport() {
  const { preview, selected } = state.imp;
  if (!selected.length) return go({ imp: { ...state.imp, errors: [{ message: S.bundle.nonePicked }] } });
  const r = await importSelected(preview, selected, store);
  go({ screen: 'main', tab: 'mypod', notice: S.bundle.imported(r.added, r.skipped), imp: { preview: null, errors: [], selected: [] } });
}
const toggleIn = (arr, id, on) => (on ? [...new Set([...arr, id])] : arr.filter((x) => x !== id));

// 토스트: 알림 글을 화면 아래에 2.2초 보여 주고 지운다 (화면을 다시 그리지 않아 입력 중인 내용이 안 날아간다)
let toastTimer = null;
function showToast() {
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  const msg = state.notice;
  if (!msg) return;
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.remove(); if (state.notice === msg) state.notice = ''; }, 2200);
}

async function render() {
  // 시험 잠금: 학생고래 모드에서 메인 탭이 UBT면 다른 화면을 모두 가린다 (벗어나면 refreshService가 다시 그림)
  if (isExamLocked(state.service, state.mode)) return app.replaceChildren(examLockView());
  if (state.screen === 'run') return;
  if (state.screen === 'create') {
    const k = state.create.kind;
    return app.replaceChildren(createView({
      onSubmit: submitCreate,
      onCancel: () => go({ screen: 'main', create: freshCreate() }),
      errors: state.create.errors, warnings: state.create.warnings, values: state.create.input || blankInput(), mode: state.mode,
      onChange: (patch) => { Object.assign(state.create.input, patch); render(); },
      heading: k === 'edit' ? S.edit.titleEdit : k === 'remix' ? S.edit.titleRemix : S.create.title,
      hint: k === 'remix' ? S.edit.remixHint : null,
    }));
  }
  if (state.screen === 'pin') {
    const P = S.pin;
    const toMother = async () => { await storage.set('mode', 'mother'); go({ screen: 'main', mode: 'mother', notice: S.mode.on }); };
    return app.replaceChildren(pinView({
      hasPin: state.pin.has, error: state.pin.error, askReset: state.pin.askReset,
      onSet: async (a, b) => { const r = await setPin(storage, a, b); return r.ok ? toMother() : go({ pin: { ...state.pin, error: P[r.error] } }); },
      onEnter: async (a) => {
        const r = await checkPin(storage, a);
        if (r.ok) return toMother();
        const error = r.error === 'LOCKED' ? P.LOCKED(Math.ceil(r.waitMs / 1000)) : r.error === 'WRONG' ? P.WRONG(r.left) : P.FORMAT;
        go({ pin: { ...state.pin, error } });
      },
      onCancel: () => go({ screen: 'main' }),
      onForgot: () => go({ pin: { ...state.pin, askReset: true } }),
      onReset: async () => { await resetPin(storage); go({ mode: 'baby', pin: { has: false, error: P.resetDone, askReset: false } }); },
    }));
  }
  if (state.screen === 'import') {
    return app.replaceChildren(importView({
      preview: state.imp.preview, errors: state.imp.errors, selected: state.imp.selected,
      onCheck: checkImport,
      onToggle: (id, on) => { state.imp.selected = toggleIn(state.imp.selected, id, on); },
      onConfirm: confirmImport,
      onCancel: () => go({ screen: 'main', imp: { preview: null, errors: [], selected: [] } }),
    }));
  }
  let body;
  if (state.tab === 'catalog') {
    const totals = Object.fromEntries(state.entries.map((e) => [e.work.id, spoutTotal(spoutCountsFor(state.catalog, e.work.id, state.mySpouts[e.work.id], state.spoutLive, state.pendingCancels[e.work.id]))]));
    const visible = sortEntries(filterEntries(state.entries, state), state.sort, totals);
    const pending = Object.values(state.mySpouts).filter((v) => !v.sent).length;
    body = catalogView({
      entries: state.entries, visible, state,
      onFilter: (p) => go({ ...p, notice: '' }), onAdd: addToMypod, onRun: run, onToggleDetail: toggleDetail,
      onRemix: startRemix, share: shareProps(), submit: submitProps(false),
      spout: spoutProps(),
      sendBar: spoutSendBar({ pending, waiting: state.spoutWaiting, onSend: sendSpouts, onSent: confirmSpoutsSent }),
    });
  } else if (state.tab === 'market') {
    if (state.market.status === 'idle') setTimeout(refreshMarket, 0); // 탭에 들어오면 자동으로 불러온다
    body = marketView({
      m: state.market, onRefresh: refreshMarket, onImport: importFromMarket, onPreview: previewFromMarket,
      spout: spoutProps(), web: globalThis.GORAE_WEB === true,
      sendBar: spoutSendBar({ pending: Object.values(state.mySpouts).filter((v) => !v.sent).length, waiting: state.spoutWaiting, onSend: sendSpouts, onSent: confirmSpoutsSent }),
      onFilter: (p) => { state.market = { ...state.market, ...p }; render(); },
    });
  } else if (state.tab === 'mypod') {
    const all = await store.list();
    const entries = await verifyWorks(all.map((r) => r.work));
    // 내 곳간 찾기: 큰 곳간과 같은 검색 규칙(제목·주제·성취기준·태그·분류)
    const hit = state.mypodQuery ? new Set(filterEntries(entries, { query: state.mypodQuery }).map((e) => e.work.id)) : null;
    const records = hit ? all.filter((r) => hit.has(r.id)) : all;
    body = mypodView({
      records, entriesById: new Map(entries.map((e) => [e.work.id, { ...e, source: (records.find((r) => r.id === e.work.id) || {}).source }])), state,
      onRun: run, onRemove: removeRecord, onToggleDetail: toggleDetail,
      onEdit: startEdit, onRemix: startRemix,
      onSelect: (id, on) => { state.selected = toggleIn(state.selected, id, on); },
      onExport: doExport, exportOut: state.exportOut, onSaveFile: saveFile, onCopy: copyPack,
      share: shareProps(), submit: submitProps(true),
      onSearch: (q) => go({ mypodQuery: q }), total: all.length,
    });
  } else {
    body = classView({
      mode: state.mode, records: state.mode === 'mother' ? await store.list() : [], state,
      onSelect: (id, on) => { state.classSelected = toggleIn(state.classSelected, id, on); },
      onBuild: buildClass, out: state.classOut, onCopy: copyClass,
      onSaveFile: () => saveTextFile(state.classOut.packText, state.classOut.fileName), onOpenClass: openClass,
    });
  }
  app.replaceChildren(
    topBar(state.mode, async () => {
      // 학생고래로는 바로, 교사고래로는 암호를 거쳐서 바꾼다
      if (state.mode === 'mother') {
        await storage.set('mode', 'baby');
        return go({ mode: 'baby', notice: '', classOut: null });
      }
      go({ screen: 'pin', pin: { has: await hasPin(storage), error: '', askReset: false } });
    }, () => go({ screen: 'create', create: freshCreate() }), () => go({ screen: 'import' })),
    tabsBar(state.tab, (tab) => go({ tab, notice: '', openId: null, confirmUrl: null })),
    // replaceChildren는 null을 글자 "null"로 넣으므로 없는 요소는 빼고 넘긴다
    ...[
      state.confirmUrl ? urlConfirmView({ info: state.confirmUrl, onOpen: openConfirmed, onCancel: () => go({ confirmUrl: null }) }) : null,
      state.confirmMarket ? marketRunConfirm({ title: state.confirmMarket.work.title, onCancel: () => go({ confirmMarket: null }), onRun: () => { const e = state.confirmMarket; state.marketRunOk[e.work.id] = true; state.confirmMarket = null; run(e); } }) : null,
      body,
    ].filter(Boolean),
  );
  showToast();
}

state.mode = (await storage.get('mode')) || 'baby';
state.shareProfile = (await storage.get('shareProfile')) || {};
// 암호가 없는 기기(예전 임시 전환을 쓴 기기 포함)는 학생고래 모드로 시작한다
if (state.mode === 'mother' && !(await hasPin(storage))) state.mode = 'baby';
// 시연용 샘플: 처음 실행하면 내 곳간에 한 번 담고, 학급 꾸러미는 그 샘플들을 미리 골라 둔다
try {
  const sample = await (await fetch(chrome.runtime.getURL('sample/mypod-samples.json'))).json();
  await seedMypod({ storage, store, samples: sample.works });
  state.classSelected = await samplesInMypod(store, sample.works);
  if (state.classSelected.length) state.className = sample.className;
} catch { /* 샘플이 없어도 된다 */ }
try {
  await loadAll();
  render();
  // 물뿜기: 보내지 못한 것을 다시 보내고, 응답 시트에서 모두의 숫자를 읽는다
  flushPending({ storage, fetchFn: fetch, config: CONFIG }).then(async () => { state.mySpouts = await mySpouts(storage); refreshSpoutCounts(); });
  // 메인 탭이 바뀌면 서비스에 맞는 공유 버튼 순서를 갱신한다
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(refreshService);
    chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === 'complete') refreshService(); });
  }
  refreshService();
} catch (e) {
  app.replaceChildren(h('p', { class: 'notice error' }, `목록을 불러오지 못했어요: ${e.message}`));
}
