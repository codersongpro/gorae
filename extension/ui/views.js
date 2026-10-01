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

// 검증 결과 한 줄: 통과하면 검수 서명 확인, 아니면 이유 (서명이 아예 없으면 이유 생략 가능)
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

export function topBar(mode, onToggle, onCreate, onImport) {
  return h('header', { class: `topbar ${mode === 'mother' ? 'mother' : ''}` },
    h('div', {}, h('h1', {}, S.appName), h('p', { class: 'muted' }, S.mode[mode])),
    h('div', { class: 'row' },
      h('button', { onclick: onCreate }, S.actions.create),
      h('button', { onclick: onImport }, S.actions.import),
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

function workCard(entry, { onAdd, onRun, onToggleDetail, onRemove, onEdit, onRemix, selectBox, open, report, extra }) {
  const w = entry.work;
  const run = canRun(entry);
  return h('article', { class: 'card' },
    selectBox || null,
    h('h3', {}, w.title),
    h('div', { class: 'row' }, badgeEl(entry), entry.status.ok && entry.status.pick ? h('span', { class: 'badge shallow' }, S.pick) : null),
    h('p', { class: 'muted' }, `${w.grade} · ${w.subject} · ${w.author}`),
    verifyLine(entry),
    extra || null,
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: !run.ok && w.type === 'html', onclick: () => onRun(entry) }, S.actions.run),
      onAdd ? h('button', { onclick: () => onAdd(entry) }, S.actions.add) : null,
      onEdit ? h('button', { onclick: () => onEdit(entry) }, S.actions.edit) : null,
      onRemix ? h('button', { onclick: () => onRemix(entry) }, S.actions.remix) : null,
      onRemove ? h('button', { class: 'danger', onclick: () => onRemove(entry) }, S.actions.remove) : null,
      h('button', { onclick: () => onToggleDetail(w.id) }, open ? S.actions.close : S.actions.details)),
    !run.ok && w.type === 'html' ? h('p', { class: 'muted' }, S.run[run.reason]) : null,
    open ? h('div', { class: 'detail' },
      h('div', {}, h('p', { class: 'muted' }, S.detail.howTo), h('p', {}, w.howToUse)),
      w.promptRecipe ? h('div', {}, h('p', { class: 'muted' }, S.detail.recipe), h('pre', {}, w.promptRecipe)) : null,
      entry.status.ok && entry.status.songs.length ? entry.status.songs.map((s) => h('p', {}, `🎵 ${s.text} — ${s.author}`)) : null,
      checkList(report)) : null);
}

export function mypodView({ records, entriesById, state, onRun, onRemove, onToggleDetail, onEdit, onRemix, onSelect, onExport, exportOut, onSaveFile, onCopy }) {
  const nameInput = h('input', { 'aria-label': S.bundle.packName, placeholder: S.bundle.packName, value: state.packName || '' });
  return h('section', { class: 'section' },
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    records.length ? h('div', { class: 'card' },
      h('p', {}, S.bundle.exportTitle),
      nameInput,
      h('button', { onclick: () => onExport(nameInput.value) }, S.bundle.exportBtn),
      exportOut ? h('div', { class: 'detail' }, h('p', {}, S.bundle.madeN(exportOut.count, exportOut.fileName)),
        h('div', { class: 'row' }, h('button', { onclick: onSaveFile }, S.bundle.saveFile), h('button', { onclick: onCopy }, S.bundle.copy))) : null) : null,
    records.length ? records.map((r) => {
      const w = r.work;
      const tags = [`출처: ${S.source[r.source] || r.source}`, `버전 ${w.version}`];
      if (w.remixOf) tags.push(`${S.edit.remixOfLabel}: ${w.remixOf}`);
      if (w.editedFrom) tags.push(`${S.edit.editedFrom} (원본 ${w.editedFrom})`);
      if (r.checkReport && !r.checkReport.ok) tags.push(`점검 경고 ${r.checkReport.warnings.length}개`);
      return workCard(entriesById.get(r.id), {
        onRun, onRemove, onToggleDetail, onEdit, onRemix, open: state.openId === r.id, report: r.checkReport,
        selectBox: h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: (state.selected || []).includes(r.id), onchange: (e) => onSelect(r.id, e.target.checked) }), '꾸러미에 담기'),
        extra: h('p', { class: 'muted' }, tags.join(' · ')),
      });
    }) : h('p', { class: 'muted' }, S.empty.mypod));
}

export function classView({ mode, records, state, onSelect, onBuild, out, onCopy, onSaveFile, onOpenClass }) {
  const C = S.classPack;
  if (mode !== 'mother') return h('section', { class: 'section' }, h('p', { class: 'notice' }, C.needMother));
  if (!records.length) return h('section', { class: 'section' }, h('p', { class: 'muted' }, C.empty));
  const nameInput = h('input', { 'aria-label': C.name, placeholder: C.name, value: state.className || '' });
  const noteInput = h('textarea', { 'aria-label': C.note, placeholder: C.note }, state.classNote || '');
  return h('section', { class: 'section' },
    h('h2', {}, C.title),
    h('p', { class: 'muted' }, C.steps),
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    h('p', {}, C.pick),
    records.map((r) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: (state.classSelected || []).includes(r.id), onchange: (e) => onSelect(r.id, e.target.checked) }),
      `${r.work.title} (${[r.work.grade, r.work.subject].filter(Boolean).join('·')})`)),
    nameInput, noteInput,
    h('button', { class: 'primary', onclick: () => onBuild(nameInput.value, noteInput.value) }, C.build),
    out ? h('div', { class: 'card' },
      h('p', {}, C.madeN(out.count)),
      h('p', { class: 'muted' }, C.guide),
      out.tooLong ? h('p', { class: 'notice error' }, C.tooLong) : null,
      h('button', { class: 'primary', onclick: () => onCopy('all') }, C.copyAll),
      h('div', { class: 'row' },
        h('button', { onclick: () => onCopy('notice') }, C.copyNotice),
        h('button', { onclick: () => onCopy('pack') }, C.copyPack),
        h('button', { onclick: onSaveFile }, C.saveFile)),
      h('button', { onclick: onOpenClass }, C.openClass)) : null);
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

export function createView({ onSubmit, onCancel, errors, warnings, report, values = {}, heading = S.create.title, hint }) {
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
    remixOf: values.remixOf,
  });
  const root = h('section', { class: 'section' },
    h('h2', {}, heading),
    hint ? h('p', { class: 'notice' }, hint) : null,
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

export function importView({ preview, errors, onCheck, onToggle, selected, onConfirm, onCancel }) {
  const text = h('textarea', { 'aria-label': S.bundle.pasteLabel, placeholder: S.bundle.pasteLabel });
  const file = h('input', { type: 'file', accept: '.json,application/json' });
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) text.value = await f.text(); });
  return h('section', { class: 'section' },
    h('h2', {}, S.bundle.importTitle),
    h('p', { class: 'muted' }, S.bundle.importHint),
    file, text,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => onCheck(text.value) }, S.bundle.check), h('button', { onclick: onCancel }, S.actions.back)),
    errors && errors.length ? h('div', { class: 'notice error', role: 'alert' }, errors.map((e) => h('p', {}, e.index === undefined ? e.message : `${e.index + 1}번째 작품: ${e.message}`))) : null,
    preview ? h('div', { class: 'section' },
      h('h3', {}, S.bundle.previewTitle(preview.name, preview.items.length)),
      h('p', { class: 'muted' }, S.bundle.pickWorks),
      preview.items.map((it) => {
        const entry = { work: it.work, status: it.status };
        return h('article', { class: 'card' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', disabled: it.duplicate, checked: selected.includes(it.work.id), onchange: (e) => onToggle(it.work.id, e.target.checked) }), h('strong', {}, it.work.title)),
          badgeEl(entry),
          h('p', { class: 'muted' }, `${it.work.grade || ''} · ${it.work.subject || ''} · ${it.work.author || ''}`),
          it.status.ok ? verifyLine(entry) : h('p', { class: 'muted' }, `${S.reason[it.status.reason] || it.status.reason} → ${S.bundle.notVerified}`),
          it.duplicate ? h('p', { class: 'muted' }, S.bundle.dup) : null,
          checkList(it.report));
      }),
      h('button', { class: 'primary', onclick: onConfirm }, S.bundle.confirm)) : null);
}
