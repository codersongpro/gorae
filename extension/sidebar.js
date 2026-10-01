// 사이드바 진입점: core 로직과 ui 컴포넌트를 이어 준다.
import { CONFIG } from './core/config.js';
import { createChromeStorage } from './core/storage.js';
import { loadCatalog } from './core/catalog.js';
import { resolveTrustedList, buildEntries } from './core/trust.js';
import { filterEntries, sortEntries } from './core/filter.js';
import { buildRunMessage, canRun, describeExternalOpen } from './core/runner.js';
import { buildShare } from './core/share.js';
import { buildWorkSubmission, buildSongSubmission, validFormUrl } from './core/submit.js';
import { detectService, orderShareKinds, SERVICE_LABEL } from './core/services.js';
import { buildViewerLink } from './shared/link.js';
import { checkHtml } from './core/checker.js';
import { validateNewWork, createWork } from './core/work.js';
import { createStore } from './core/store.js';
import { createIdbBackend } from './core/idb-backend.js';
import { ROOT_PUBLIC_JWK } from './core/rootkey.js';
import { h } from './ui/dom.js';
import { S } from './ui/strings.js';
import { exportBundle, previewImport, importSelected } from './core/bundle.js';
import { remixInput, editInput, saveEdit } from './core/remix.js';
import { buildClassBundle, CLASS_URL } from './core/classpack.js';
import { topBar, tabsBar, catalogView, mypodView, classView, runView, createView, importView, urlConfirmView } from './ui/views.js';

const app = document.getElementById('app');
const storage = createChromeStorage();
const store = createStore(createIdbBackend());

const state = {
  service: null, confirmUrl: null,
  tab: 'catalog', mode: 'baby', screen: 'main', // screen: main | create | import | run
  grade: '', subject: '', badge: '', pickOnly: false, sort: 'pick',
  source: 'network', listRejected: false, notice: '', openId: null,
  entries: [], list: null,
  create: { kind: 'create', errors: [], warnings: [] }, // kind: create | edit | remix
  selected: [], packName: '', exportOut: null,
  classSelected: [], className: '', classNote: '', classOut: null,
  imp: { preview: null, errors: [], selected: [] },
};
const freshCreate = () => ({ kind: 'create', errors: [], warnings: [] });

// 목록 받기 → 족보 고르기(낮은 버전 거부) → 작품 검증
async function loadAll() {
  const res = await loadCatalog({ fetchFn: fetch, storage, config: CONFIG, resolveLocal: (p) => chrome.runtime.getURL(p) });
  const trusted = await resolveTrustedList({ candidate: res.list, storage, rootJwk: ROOT_PUBLIC_JWK });
  state.list = trusted.list;
  state.source = res.source;
  state.listRejected = !trusted.accepted && trusted.reason === 'LIST_OLD';
  state.entries = await buildEntries({ works: res.catalog.items, list: trusted.list, storage, rootJwk: ROOT_PUBLIC_JWK });
}

const verifyWorks = (works) => buildEntries({ works, list: state.list, storage, rootJwk: ROOT_PUBLIC_JWK });

function go(patch) { Object.assign(state, patch); render(); }
const toggleDetail = (id) => go({ openId: state.openId === id ? null : id });

// 실행 관문: HTML·URL 작품 모두 canRun을 통과해야 한다. URL 작품은 확인 카드를 거친 뒤에만 새 탭으로 연다.
async function run(entry) {
  const w = entry.work;
  const c = canRun(entry);
  if (!c.ok) return go({ notice: S.run[c.reason], confirmUrl: null });
  if (c.kind === 'url') return go({ confirmUrl: describeExternalOpen(entry), notice: '' });
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
  if (info) chrome.tabs.create({ url: info.url });
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

// ----- 큰 곳간에 보내기: 어미고래 모드에서만. 글을 복사하고 네이버 폼을 연다
async function sendToForm(result) {
  if (!result.ok) return go({ notice: result.errors.join(' ') });
  await navigator.clipboard.writeText(result.text);
  const url = validFormUrl(CONFIG.formUrl);
  if (url) chrome.tabs.create({ url });
  const long = result.length > 3000 ? ' ' + S.submit.longWarn(result.length) : '';
  go({ notice: (url ? S.submit.copiedOpen : S.submit.copiedNoForm) + long });
}
const submitProps = (allowRecommend) =>
  state.mode === 'mother'
    ? {
        allowRecommend,
        onRecommend: (entry, v) => sendToForm(buildWorkSubmission(entry.work, { author: v.author, privacyChecked: v.privacyChecked })),
        onSong: (entry, v) => sendToForm(buildSongSubmission(entry.work, { text: v.text, author: v.author, privacyChecked: v.privacyChecked })),
      }
    : null; // 아기고래 모드에서는 메뉴 자체를 만들지 않는다

async function addToMypod(entry) {
  const w = entry.work;
  const report = w.type === 'html' ? checkHtml(w.html) : null;
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
  const report = work.type === 'html' ? checkHtml(work.html) : null;
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
function saveTextFile(text, fileName) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const saveFile = () => saveTextFile(state.exportOut.text, state.exportOut.fileName);

// 학급 꾸러미: 어미고래 모드에서만. 꾸러미 + 웨일 클래스 공지 문구를 함께 만든다
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

async function render() {
  if (state.screen === 'run') return;
  if (state.screen === 'create') {
    const k = state.create.kind;
    return app.replaceChildren(createView({
      onSubmit: submitCreate,
      onCancel: () => go({ screen: 'main', create: freshCreate() }),
      errors: state.create.errors, warnings: state.create.warnings, values: state.create.input || {},
      heading: k === 'edit' ? S.edit.titleEdit : k === 'remix' ? S.edit.titleRemix : S.create.title,
      hint: k === 'remix' ? S.edit.remixHint : null,
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
    const visible = sortEntries(filterEntries(state.entries, state), state.sort);
    body = catalogView({
      entries: state.entries, visible, state,
      onFilter: (p) => go({ ...p, notice: '' }), onAdd: addToMypod, onRun: run, onToggleDetail: toggleDetail,
      onRemix: startRemix, share: shareProps(), submit: submitProps(false),
    });
  } else if (state.tab === 'mypod') {
    const records = await store.list();
    const entries = await verifyWorks(records.map((r) => r.work));
    body = mypodView({
      records, entriesById: new Map(entries.map((e) => [e.work.id, e])), state,
      onRun: run, onRemove: removeRecord, onToggleDetail: toggleDetail,
      onEdit: startEdit, onRemix: startRemix,
      onSelect: (id, on) => { state.selected = toggleIn(state.selected, id, on); },
      onExport: doExport, exportOut: state.exportOut, onSaveFile: saveFile, onCopy: copyPack,
      share: shareProps(), submit: submitProps(true),
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
      const mode = state.mode === 'baby' ? 'mother' : 'baby';
      await storage.set('mode', mode);
      go({ mode, notice: mode === 'mother' ? S.mode.devNote : '' });
    }, () => go({ screen: 'create', create: freshCreate() }), () => go({ screen: 'import' })),
    tabsBar(state.tab, (tab) => go({ tab, notice: '', openId: null, confirmUrl: null })),
    // replaceChildren는 null을 글자 "null"로 넣으므로 없는 요소는 빼고 넘긴다
    ...[state.confirmUrl ? urlConfirmView({ info: state.confirmUrl, onOpen: openConfirmed, onCancel: () => go({ confirmUrl: null }) }) : null, body].filter(Boolean),
  );
}

state.mode = (await storage.get('mode')) || 'baby';
try {
  await loadAll();
  render();
  // 메인 탭이 바뀌면 서비스에 맞는 공유 버튼 순서를 갱신한다
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(refreshService);
    chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === 'complete') refreshService(); });
  }
  refreshService();
} catch (e) {
  app.replaceChildren(h('p', { class: 'notice error' }, `목록을 불러오지 못했어요: ${e.message}`));
}
