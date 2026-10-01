// 화면 컴포넌트 — 로직은 core/에서 받고, 여기서는 그리기만 한다.
import { h } from './dom.js';
import { S } from './strings.js';
import { displayBadge } from '../core/trust.js';
import { facetValues, metaOf, topTags } from '../core/filter.js';
import { DOMAINS, categoriesOf, findCategory, GROUP_TYPES, TIME_OPTIONS, AUDIENCES, timeLabel, groupLabel, audienceLabel } from '../shared/taxonomy.js';
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

function select(label, value, options, onChange, labels = {}, allLabel = S.filter.all) {
  return h('label', {}, label,
    h('select', { onchange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, allLabel),
      options.map((o) => {
        const id = typeof o === 'object' ? String(o.id) : o;
        const text = typeof o === 'object' ? o.label : labels[o] || o;
        return h('option', { value: id, selected: id === String(value || '') }, text);
      })));
}

// 찾기: 검색어·수업/업무·카테고리는 늘 보이고, 나머지는 '자세한 조건' 안에
function findBar({ entries, state, onFilter, sortSel }) {
  const Fd = S.find;
  const cat = findCategory(state.domain, state.category);
  const q = h('input', { type: 'search', placeholder: Fd.search, 'aria-label': Fd.search, value: state.query || '' });
  q.addEventListener('change', () => onFilter({ query: q.value.trim() }));
  const tags = topTags(entries);
  return h('div', { class: 'filters' },
    h('label', { class: 'wide' }, Fd.search, q),
    select(S.form.domain, state.domain, DOMAINS, (v) => onFilter({ domain: v, category: '', subcategory: '' }), {}, Fd.domainAll),
    state.domain ? select(S.form.category, state.category, categoriesOf(state.domain), (v) => onFilter({ category: v, subcategory: '' }), {}, Fd.categoryAll) : null,
    cat ? select(cat.detail ? S.form.activityType : S.form.subcategory, state.subcategory, cat.subs, (v) => onFilter({ subcategory: v }), {}, Fd.subAll) : null,
    sortSel,
    h('details', { class: 'wide', open: state.moreOpen || null, ontoggle: (e) => { state.moreOpen = e.target.open; } },
      h('summary', {}, Fd.more),
      h('div', { class: 'filters' },
        select(Fd.grade, state.grade, facetValues(entries, 'gradeLabel'), (v) => onFilter({ grade: v })),
        select(S.filter.subject, state.subject, facetValues(entries, 'subject'), (v) => onFilter({ subject: v })),
        select(Fd.audience, state.audience, AUDIENCES, (v) => onFilter({ audience: v })),
        select(Fd.group, state.groupType, GROUP_TYPES, (v) => onFilter({ groupType: v })),
        select(Fd.time, state.maxMinutes, TIME_OPTIONS.map((t) => ({ id: t.minutes, label: t.label })), (v) => onFilter({ maxMinutes: v })),
        select(S.filter.badge, state.badge, ['clear', 'shallow', 'whirlpool'], (v) => onFilter({ badge: v }), S.badge),
        h('label', { class: 'check wide' }, h('input', { type: 'checkbox', checked: state.pickOnly, onchange: (e) => onFilter({ pickOnly: e.target.checked }) }), S.filter.pickOnly),
        tags.length ? h('div', { class: 'row wide' }, h('span', { class: 'muted' }, Fd.tag),
          tags.map((t) => h('button', { class: state.tag === t ? 'chip primary' : 'chip', onclick: () => onFilter({ tag: state.tag === t ? '' : t }) }, '#' + t))) : null,
        h('button', { class: 'wide', onclick: () => onFilter({ query: '', domain: '', category: '', subcategory: '', grade: '', subject: '', audience: '', groupType: '', maxMinutes: '', badge: '', pickOnly: false, tag: '' }) }, Fd.reset))));
}

// 카드 한 줄 분류: 수업 › 교과활동 › 연습 · 초4 수학 · 10분 · 개인 · 교사+학생
function metaLine(entry) {
  const m = metaOf(entry);
  const bits = [m.path.join(' › '), [m.gradeLabel, m.subject].filter(Boolean).join(' '), m.topic, timeLabel(m.estimatedMinutes), groupLabel(m.groupType), audienceLabel(m.audience)].filter(Boolean);
  return h('div', {},
    h('p', { class: 'muted' }, bits.join(' · ')),
    m.tags.length ? h('p', { class: 'muted' }, m.tags.map((t) => '#' + t).join(' ')) : null,
    m.artifactType === 'webapp' ? h('p', { class: 'notice' }, S.cardMeta.webapp) : null,
    m.artifactType === 'exe' ? h('p', { class: 'notice error' }, S.cardMeta.exe) : null);
}

// 이달의 고래자리 띠: 서명이 맞을 때만, 학생고래 모드에서는 맑은 바다 작품만
function featuredBand(entries, state, onRun) {
  const f = state.featured;
  if (!f || !f.ok || !f.items.length) return null;
  const byId = new Map(entries.map((e) => [e.work.id, e]));
  const shown = f.items.map((id) => byId.get(id)).filter((e) => e && (state.mode !== 'baby' || displayBadge(e) === 'clear'));
  if (!shown.length) return null;
  return h('div', { class: 'card featured' },
    h('p', {}, h('strong', {}, `🌟 ${f.title || S.featured.title}`), ' ', h('span', { class: 'muted' }, S.featured.hint)),
    f.note ? h('p', { class: 'muted' }, f.note) : null,
    shown.map((e) => h('div', { class: 'row' }, h('span', {}, e.work.title), h('button', { class: 'chip', disabled: !canRun(e).ok, onclick: () => onRun(e) }, S.actions.run))));
}

export function catalogView({ entries, visible, state, onFilter, onAdd, onRun, onToggleDetail, onRemix, share, submit, spout, sendBar }) {
  const sortSel = h('label', {}, S.filter.sort.label,
    h('select', { onchange: (e) => onFilter({ sort: e.target.value }) },
      ['pick', 'new', 'spout'].map((k) => h('option', { value: k, selected: state.sort === k }, S.filter.sort[k]))));
  return h('section', { class: 'section' },
    featuredBand(entries, state, onRun),
    sendBar || null,
    h('p', { class: 'muted' }, S.tagline),
    h('p', { class: 'notice' }, S.listState[state.source] + (state.listRejected ? ` · ${S.listState.listRejected}` : '')),
    findBar({ entries, state, onFilter, sortSel }),
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    visible.length ? visible.map((e) => workCard(e, { onAdd, onRun, onToggleDetail, onRemix, share, submit, spout, open: state.openId === e.work.id })) : h('p', { class: 'muted' }, S.empty.catalog));
}

function workCard(entry, { onAdd, onRun, onToggleDetail, onRemove, onEdit, onRemix, selectBox, open, report, extra, share, submit, spout }) {
  const w = entry.work;
  const run = canRun(entry);
  return h('article', { class: 'card' },
    selectBox || null,
    h('h3', {}, w.title),
    h('div', { class: 'row' }, badgeEl(entry), entry.status.ok && entry.status.pick ? h('span', { class: 'badge shallow' }, S.pick) : null),
    metaLine(entry),
    w.author ? h('p', { class: 'muted' }, w.author) : null,
    verifyLine(entry),
    w.remixOf ? h('p', { class: 'muted' }, '🔄 ' + S.lineage(w.remixOfTitle || w.remixOf)) : null,
    spout ? spoutRow(entry, spout) : null,
    extra || null,
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: !run.ok, onclick: () => onRun(entry) }, S.actions.run),
      onAdd ? h('button', { onclick: () => onAdd(entry) }, S.actions.add) : null,
      onEdit ? h('button', { onclick: () => onEdit(entry) }, S.actions.edit) : null,
      onRemix ? h('button', { onclick: () => onRemix(entry) }, S.actions.remix) : null,
      onRemove ? h('button', { class: 'danger', onclick: () => onRemove(entry) }, S.actions.remove) : null,
      h('button', { onclick: () => onToggleDetail(w.id) }, open ? S.actions.close : S.actions.details)),
    !run.ok ? h('p', { class: 'muted' }, S.run[run.reason]) : null,
    open ? h('div', { class: 'detail' },
      metaOf(entry).description ? h('p', {}, metaOf(entry).description) : null,
      metaOf(entry).standard ? h('p', { class: 'muted' }, `성취기준: ${metaOf(entry).standard}`) : null,
      h('div', {}, h('p', { class: 'muted' }, S.detail.howTo), h('p', {}, w.howToUse)),
      w.promptRecipe ? h('div', {}, h('p', { class: 'muted' }, S.detail.recipe), h('pre', {}, w.promptRecipe)) : null,
      entry.status.ok && entry.status.songs.length ? entry.status.songs.map((s) => h('p', {}, `🎵 ${s.text} — ${s.author}`)) : null,
      checkList(report),
      share ? sharePanel(entry, share) : null,
      submit ? submitPanel(entry, submit) : null) : null);
}

// 물뿜기: 교사·학생 숫자를 그대로 보여 주고, 기기당 한 번 누를 수 있다
function spoutRow(entry, { countsOf, mineOf, onSpout }) {
  const c = countsOf(entry);
  const mine = mineOf(entry);
  return h('div', { class: 'row' },
    h('span', { 'aria-label': S.spout.hint, title: S.spout.hint }, S.spout.counts(c.teacher, c.student)),
    h('button', { class: 'chip', disabled: !!mine, onclick: () => onSpout(entry) }, mine ? S.spout.done : S.spout.button));
}

// 보내지 않은 물뿜기 띠
export function spoutSendBar({ pending, waiting, onSend, onSent }) {
  if (!pending && !waiting) return null;
  return h('div', { class: 'notice' },
    h('p', {}, S.spout.pending(pending)),
    h('div', { class: 'row' },
      h('button', { onclick: onSend }, S.spout.send),
      waiting ? h('button', { class: 'primary', onclick: onSent }, S.spout.sent) : null));
}

// 큰 곳간에 보내기 (교사고래 모드에서만 만들어진다): 개인정보 확인 → 복사 + 네이버 폼 열기
function submitPanel(entry, { allowRecommend, onRecommend, onSong }) {
  // 보내는 사람(교사) 자신의 별명을 쓴다. 작품 작성자 별명을 미리 채우지 않는다.
  const author = h('input', { 'aria-label': S.submit.author, placeholder: S.submit.author });
  const privacy = h('input', { type: 'checkbox' });
  const song = h('input', { 'aria-label': S.submit.songLabel, placeholder: S.submit.songLabel, maxlength: '120' });
  const vals = () => ({ author: author.value, privacyChecked: privacy.checked, text: song.value });
  return h('div', { class: 'detail' },
    h('p', { class: 'muted' }, S.submit.title),
    author,
    h('label', { class: 'check' }, privacy, S.submit.privacy),
    allowRecommend ? h('button', { onclick: () => onRecommend(entry, vals()) }, S.submit.recommend) : null,
    song,
    h('button', { onclick: () => onSong(entry, vals()) }, S.submit.song),
    h('p', { class: 'muted' }, S.submit.how));
}

// 웨일 스페이스 공유 버튼 묶음: 지금 화면의 서비스에 맞는 버튼이 맨 앞에 온다
function sharePanel(entry, { kinds, serviceLabel, onShare, onLink }) {
  return h('div', { class: 'detail' },
    h('p', { class: 'muted' }, S.share.title),
    serviceLabel ? h('p', { class: 'notice' }, S.share.nowOn(serviceLabel)) : null,
    h('div', { class: 'row' },
      kinds.map((k, i) => h('button', { class: i === 0 && serviceLabel ? 'primary' : '', onclick: () => onShare(entry, k) }, S.share.kinds[k])),
      h('button', { onclick: () => onLink(entry) }, S.share.link)),
    h('p', { class: 'muted' }, S.share.hint));
}

export function mypodView({ records, entriesById, state, onRun, onRemove, onToggleDetail, onEdit, onRemix, onSelect, onExport, exportOut, onSaveFile, onCopy, share, submit, onSearch, total }) {
  const q = h('input', { type: 'search', placeholder: S.find.search, 'aria-label': S.find.search, value: state.mypodQuery || '' });
  q.addEventListener('change', () => onSearch(q.value.trim()));
  const nameInput = h('input', { 'aria-label': S.bundle.packName, placeholder: S.bundle.packName, value: state.packName || '' });
  return h('section', { class: 'section' },
    state.notice ? h('p', { class: 'notice' }, state.notice) : null,
    total ? h('label', { class: 'field' }, h('span', {}, S.find.search), q) : null,
    state.mypodQuery ? h('p', { class: 'muted' }, S.find.found(records.length, total)) : null,
    records.length ? h('div', { class: 'card' },
      h('p', {}, S.bundle.exportTitle),
      nameInput,
      h('button', { onclick: () => onExport(nameInput.value) }, S.bundle.exportBtn),
      exportOut ? h('div', { class: 'detail' }, h('p', {}, S.bundle.madeN(exportOut.count, exportOut.fileName)),
        h('div', { class: 'row' }, h('button', { onclick: onSaveFile }, S.bundle.saveFile), h('button', { onclick: onCopy }, S.bundle.copy))) : null) : null,
    records.length ? records.map((r) => {
      const w = r.work;
      const tags = [`출처: ${S.source[r.source] || r.source}`, `버전 ${w.version}`];
      if (w.editedFrom) tags.push(`${S.edit.editedFrom} (원본 ${w.editedFrom})`);
      if (r.checkReport && !r.checkReport.ok) tags.push(`점검 경고 ${r.checkReport.warnings.length}개`);
      return workCard(entriesById.get(r.id), {
        onRun, onRemove, onToggleDetail, onEdit, onRemix, share, submit, open: state.openId === r.id, report: r.checkReport,
        selectBox: h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: (state.selected || []).includes(r.id), onchange: (e) => onSelect(r.id, e.target.checked) }), '꾸러미에 담기'),
        extra: h('p', { class: 'muted' }, tags.join(' · ')),
      });
    }) : state.mypodQuery ? null : h('p', { class: 'muted' }, S.empty.mypod));
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

// 외부 사이트(URL 작품)를 열기 전 확인 카드 — 사용자가 [새 탭에서 열기]를 눌러야 열린다
export function urlConfirmView({ info, onOpen, onCancel }) {
  return h('section', { class: 'section' },
    h('div', { class: 'card', role: 'alertdialog', 'aria-label': S.run.confirmTitle },
      h('h3', {}, S.run.confirmTitle),
      h('p', {}, S.run.confirmHost(info.host)),
      info.verified ? null : h('p', { class: 'notice error' }, S.run.confirmUnverified),
      h('p', { class: 'muted' }, info.url),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: onOpen }, S.run.confirmOpen),
        h('button', { onclick: onCancel }, S.run.confirmCancel))));
}

// 교사고래 암호 화면: 처음이면 정하기, 아니면 넣기
export function pinView({ hasPin, error, askReset, onSet, onEnter, onCancel, onForgot, onReset }) {
  const P = S.pin;
  const pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-label': P.pin, placeholder: P.pin, maxlength: '8' });
  const again = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-label': P.confirm, placeholder: P.confirm, maxlength: '8' });
  const submit = () => (hasPin ? onEnter(pin.value) : onSet(pin.value, again.value));
  pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  again.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  setTimeout(() => pin.focus(), 0);
  return h('section', { class: 'section' },
    h('div', { class: 'card' },
      h('h2', {}, hasPin ? P.enterTitle : P.setTitle),
      h('p', { class: 'muted' }, hasPin ? P.enterHint : P.setHint),
      error ? h('p', { class: 'notice error', role: 'alert' }, error) : null,
      pin, hasPin ? null : again,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: submit }, P.ok), h('button', { onclick: onCancel }, P.cancel)),
      hasPin && !askReset ? h('button', { onclick: onForgot }, P.forgot) : null,
      askReset ? h('div', { class: 'notice' }, h('p', {}, P.forgotConfirm), h('button', { class: 'danger', onclick: onReset }, P.reset)) : null));
}
