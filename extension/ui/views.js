// 화면 컴포넌트 — 로직은 core/에서 받고, 여기서는 그리기만 한다.
import { h } from './dom.js';
import { S } from './strings.js';
import { displayBadge } from '../core/trust.js';
import { facetValues } from '../core/filter.js';
import { canRun } from '../core/runner.js';

const dateOnly = (iso) => String(iso || '').slice(0, 10);

function badgeEl(entry) {
  const b = displayBadge(entry);
  return h('span', { class: `badge ${b}` }, S.badge[b]);
}

// 검증 결과 한 줄: 통과하면 꼬리지문 확인, 아니면 이유 (서명이 아예 없으면 이유 생략 가능)
function verifyLine(entry) {
  const st = entry.status;
  if (st.ok) return h('p', { class: 'muted' }, S.tailprintOk(st.reviewer.nickname, dateOnly(st.signedAt)));
  return h('p', { class: 'muted' }, S.reason[st.reason] || st.reason);
}

function checkList(report) {
  if (!report) return null;
  if (report.ok) return h('p', { class: 'muted' }, `${S.detail.check}: ${S.detail.checkOk}`);
  return h('div', {}, h('p', { class: 'muted' }, S.detail.check),
    h('ul', { class: 'warn-list' }, report.warnings.map((w) => h('li', {}, `${w.label} — ${w.reason}`))));
}

export function tabsBar(current, onSelect) {
  return h('div', { class: 'tabs', role: 'tablist' },
    ['catalog', 'mypod', 'class'].map((k) =>
      h('button', { class: `tab ${k}`, role: 'tab', 'aria-selected': String(current === k), onclick: () => onSelect(k) },
        S.tabs[k], h('small', {}, S.tabHints[k]))));
}

export function topBar(mode, onToggle, onCreate) {
  return h('header', { class: `topbar ${mode === 'mother' ? 'mother' : ''}` },
    h('div', {}, h('h1', {}, S.appName), h('p', { class: 'muted' }, S.mode[mode])),
    h('div', { class: 'row' },
      h('button', { onclick: onCreate }, S.actions.create),
      h('button', { onclick: onToggle }, mode === 'baby' ? S.mode.toggleToMother : S.mode.toggleToBaby)));
}

function select(label, value, options, onChange) {
  return h('label', {}, label,
    h('select', { onchange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, S.filter.all),
      options.map((o) => h('option', { value: o, selected: o === value }, o))));
}

export function catalogView({ entries, visible, state, onFilter, onAdd, onRun, onToggleDetail }) {
  const sortSel = h('label', {}, S.filter.sort.label,
    h('select', { onchange: (e) => onFilter({ sort: e.target.value }) },
      ['pick', 'new', 'spout'].map((k) => h('option', { value: k, selected: state.sort === k }, S.filter.sort[k]))));
  return h('section', { class: 'section' },
    h('p', { class: 'notice' }, S.listState[state.source] + (state.listRejected ? ` · ${S.listState.listRejected}` : '')),
    h('div', { class: 'filters' },
      select(S.filter.grade, state.grade, facetValues(entries, 'grade'), (v) => onFilter({ grade: v })),
      select(S.filter.subject, state.subject, facetValues(entries, 'subject'), (v) => onFilter({ subject: v })),
      select(S.filter.badge, state.badge, ['clear', 'shallow', 'whirlpool'], (v) => onFilter({ badge: v })),
      sortSel,
      h('label', { class: 'check wide' }, h('input', { type: 'checkbox', checked: state.pickOnly, onchange: (e) => onFilter({ pickOnly: e.target.checked }) }), S.filter.pickOnly)),
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    visible.length ? visible.map((e) => workCard(e, { onAdd, onRun, onToggleDetail, open: state.openId === e.work.id })) : h('p', { class: 'muted' }, S.empty.catalog));
}

function workCard(entry, { onAdd, onRun, onToggleDetail, onRemove, open, report, extra }) {
  const w = entry.work;
  const run = canRun(entry);
  return h('article', { class: 'card' },
    h('h3', {}, w.title),
    h('div', { class: 'row' }, badgeEl(entry), entry.status.ok && entry.status.pick ? h('span', { class: 'badge shallow' }, S.pick) : null),
    h('p', { class: 'muted' }, `${w.grade} · ${w.subject} · ${w.author}`),
    verifyLine(entry),
    extra || null,
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: !run.ok && w.type === 'html', onclick: () => onRun(entry) }, S.actions.run),
      onAdd ? h('button', { onclick: () => onAdd(entry) }, S.actions.add) : null,
      onRemove ? h('button', { class: 'danger', onclick: () => onRemove(entry) }, S.actions.remove) : null,
      h('button', { onclick: () => onToggleDetail(w.id) }, open ? S.actions.close : S.actions.details)),
    !run.ok && w.type === 'html' ? h('p', { class: 'muted' }, S.run[run.reason]) : null,
    open ? h('div', { class: 'detail' },
      h('div', {}, h('p', { class: 'muted' }, S.detail.howTo), h('p', {}, w.howToUse)),
      w.promptRecipe ? h('div', {}, h('p', { class: 'muted' }, S.detail.recipe), h('pre', {}, w.promptRecipe)) : null,
      entry.status.ok && entry.status.songs.length ? entry.status.songs.map((s) => h('p', {}, `🎵 ${s.text} — ${s.author}`)) : null,
      checkList(report)) : null);
}

export function mypodView({ records, entriesById, state, onRun, onRemove, onToggleDetail }) {
  return h('section', { class: 'section' },
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    records.length ? records.map((r) => workCard(entriesById.get(r.id), {
      onRun, onRemove, onToggleDetail, open: state.openId === r.id, report: r.checkReport,
      extra: h('p', { class: 'muted' }, `출처: ${S.source[r.source] || r.source}${r.checkReport && !r.checkReport.ok ? ` · 점검 경고 ${r.checkReport.warnings.length}개` : ''}`),
    })) : h('p', { class: 'muted' }, S.empty.mypod));
}

export function classView() {
  return h('section', { class: 'section' }, h('p', { class: 'muted' }, S.empty.class));
}

export function runView({ entry, onBack, onOpenTab }) {
  const w = entry.work;
  const frame = h('iframe', { src: 'sandbox.html', title: w.title });
  return {
    frame,
    el: h('div', { class: 'runview' },
      h('div', { class: 'bar' },
        h('button', { onclick: onBack }, S.actions.back),
        h('div', {}, h('strong', {}, w.title), h('p', { class: 'muted' }, S.run.running))),
      frame),
  };
}

export function createView({ onSubmit, onCancel, errors, warnings, report, values = {} }) {
  const f = {};
  const field = (key, label, el) => h('label', { class: 'field' }, h('span', {}, label), (f[key] = el));
  const kind = h('select', { onchange: () => sync() }, h('option', { value: 'html' }, S.create.kindHtml), h('option', { value: 'url' }, S.create.kindUrl));
  const htmlWrap = h('div', { class: 'field' },
    h('span', {}, S.create.html), (f.html = h('textarea', { 'aria-label': S.create.html })),
    h('span', {}, S.create.file), (f.file = h('input', { type: 'file', accept: '.html,text/html' })));
  const urlWrap = h('div', { class: 'field', hidden: true }, h('span', {}, S.create.url), (f.url = h('input', { type: 'url', placeholder: 'https://' })));
  function sync() { htmlWrap.hidden = kind.value !== 'html'; urlWrap.hidden = kind.value !== 'url'; }
  f.file.addEventListener('change', async () => { const file = f.file.files[0]; if (file) f.html.value = await file.text(); });
  const collect = () => ({
    title: f.title.value, type: kind.value, html: f.html.value, url: f.url.value, grade: f.grade.value, subject: f.subject.value,
    standard: f.standard.value, author: f.author.value, howToUse: f.howToUse.value, promptRecipe: f.promptRecipe.value,
  });
  const root = h('section', { class: 'section' },
    h('h2', {}, S.create.title),
    h('p', { class: 'notice' }, S.create.privacyNote),
    errors && errors.length ? h('div', { class: 'notice error', role: 'alert' }, errors.map((e) => h('p', {}, e.message))) : null,
    warnings && warnings.length ? h('div', { class: 'notice' }, warnings.map((e) => h('p', {}, e.message))) : null,
    report ? h('div', { class: 'notice' }, h('p', {}, S.create.checkTitle), checkList(report)) : null,
    field('title', S.create.name, h('input', {})),
    h('label', { class: 'field' }, h('span', {}, S.create.kind), kind),
    htmlWrap, urlWrap,
    h('div', { class: 'grid2' },
      field('grade', S.create.grade, h('select', {}, h('option', { value: '' }, S.filter.all), S.grades.map((g) => h('option', { value: g }, g)))),
      field('subject', S.create.subject, h('select', {}, h('option', { value: '' }, S.filter.all), S.subjects.map((g) => h('option', { value: g }, g))))),
    field('standard', S.create.standard, h('input', {})),
    field('author', S.create.author, h('input', {})),
    field('howToUse', S.create.howTo, h('textarea', {})),
    field('promptRecipe', S.create.recipe, h('textarea', {})),
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => onSubmit(collect()) }, S.actions.save),
      h('button', { onclick: onCancel }, S.actions.back)));
  // 오류로 다시 그릴 때 입력값을 되살린다
  for (const [k, v] of Object.entries(values)) if (f[k] && f[k].type !== 'file' && v != null) f[k].value = v;
  if (values.type) { kind.value = values.type; sync(); }
  return root;
}
