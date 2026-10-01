// 사이드바 진입점: core 로직과 ui 컴포넌트를 이어 준다.
import { CONFIG } from './core/config.js';
import { createChromeStorage } from './core/storage.js';
import { loadCatalog } from './core/catalog.js';
import { resolveTrustedList, buildEntries } from './core/trust.js';
import { filterEntries, sortEntries } from './core/filter.js';
import { buildRunMessage, canRun } from './core/runner.js';
import { checkHtml } from './core/checker.js';
import { validateNewWork, createWork } from './core/work.js';
import { createStore } from './core/store.js';
import { createIdbBackend } from './core/idb-backend.js';
import { ROOT_PUBLIC_JWK } from './core/rootkey.js';
import { h } from './ui/dom.js';
import { S } from './ui/strings.js';
import { topBar, tabsBar, catalogView, mypodView, classView, runView, createView } from './ui/views.js';

const app = document.getElementById('app');
const storage = createChromeStorage();
const store = createStore(createIdbBackend());

const state = {
  tab: 'catalog', mode: 'baby', screen: 'main', // screen: main | create | run
  grade: '', subject: '', badge: '', pickOnly: false, sort: 'pick',
  source: 'network', listRejected: false, notice: '', openId: null,
  entries: [], list: null,
  create: { errors: [], warnings: [] },
};

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

async function run(entry) {
  const w = entry.work;
  if (w.type === 'url') {
    try { if (new URL(w.url).protocol === 'https:') chrome.tabs.create({ url: w.url }); } catch { /* 잘못된 주소는 무시 */ }
    return go({ notice: S.run.external });
  }
  if (!canRun(entry).ok) return;
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
  const v = validateNewWork(input);
  if (!v.ok) return go({ create: { errors: v.errors, warnings: v.warnings, input } });
  const work = createWork(input);
  const report = work.type === 'html' ? checkHtml(work.html) : null;
  await store.add(work, { source: 'maker', checkReport: report });
  const extra = report && !report.ok ? ` ${S.add.warn(report.warnings.length)}` : '';
  go({ screen: 'main', tab: 'mypod', notice: S.create.saved + extra, openId: work.id, create: { errors: [], warnings: [] } });
}

async function render() {
  if (state.screen === 'run') return;
  if (state.screen === 'create') {
    return app.replaceChildren(createView({
      onSubmit: submitCreate,
      onCancel: () => go({ screen: 'main', create: { errors: [], warnings: [] } }),
      errors: state.create.errors, warnings: state.create.warnings, values: state.create.input || {},
    }));
  }
  let body;
  if (state.tab === 'catalog') {
    const visible = sortEntries(filterEntries(state.entries, state), state.sort);
    body = catalogView({
      entries: state.entries, visible, state,
      onFilter: (p) => go({ ...p, notice: '' }), onAdd: addToMypod, onRun: run, onToggleDetail: toggleDetail,
    });
  } else if (state.tab === 'mypod') {
    const records = await store.list();
    const entries = await verifyWorks(records.map((r) => r.work));
    body = mypodView({
      records, entriesById: new Map(entries.map((e) => [e.work.id, e])), state,
      onRun: run, onRemove: removeRecord, onToggleDetail: toggleDetail,
    });
  } else {
    body = classView();
  }
  app.replaceChildren(
    topBar(state.mode, async () => {
      const mode = state.mode === 'baby' ? 'mother' : 'baby';
      await storage.set('mode', mode);
      go({ mode, notice: mode === 'mother' ? S.mode.devNote : '' });
    }, () => go({ screen: 'create' })),
    tabsBar(state.tab, (tab) => go({ tab, notice: '', openId: null })),
    body,
  );
}

state.mode = (await storage.get('mode')) || 'baby';
try {
  await loadAll();
  render();
} catch (e) {
  app.replaceChildren(h('p', { class: 'notice error' }, `목록을 불러오지 못했어요: ${e.message}`));
}
