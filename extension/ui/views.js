// 화면 컴포넌트 — 로직은 core/에서 받고, 여기서는 그리기만 한다.
import { h } from './dom.js';
import { S } from './strings.js';
import { displayBadge } from '../core/trust.js';
import { facetValues, metaOf, topTags } from '../core/filter.js';
import { KIND_OPTIONS } from '../shared/market.js';
import { DOMAINS, categoriesOf, findCategory, GROUP_TYPES, TIME_OPTIONS, AUDIENCES, timeLabel, groupLabel, audienceLabel } from '../shared/taxonomy.js';
import { canRun } from '../core/runner.js';
import { isRestricted } from '../core/reference.js';
import { TOUR_STEPS, SHARE_TOUR_STEPS } from './guide-steps.js';

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

// 빈 상태: 가운데 정렬 아이콘 + 제목 + (선택) 보조 버튼
export const emptyState = (title, { icon = '🐳', text = '', action = null } = {}) =>
  h('div', { class: 'empty' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, icon), h('h3', {}, title),
    text ? h('p', {}, text) : null, action ? h('button', { onclick: action.onClick }, action.label) : null);

export function tabsBar(current, onSelect) {
  return h('div', { class: 'tabs', role: 'tablist' },
    ['catalog', 'market', 'mypod', 'class'].map((k) =>
      h('button', { class: `tab ${k}`, role: 'tab', 'data-tour': `tab-${k}`, 'aria-selected': String(current === k), onclick: () => onSelect(k) },
        S.tabs[k])));
}

export function topBar(mode, onToggle, onCreate, onImport, onGuide, onHome) {
  const teacher = mode === 'mother';
  return h('div', { class: 'top' },
    globalThis.GORAE_WEB === true ? h('button', { class: 'web-promo', type: 'button', onclick: onGuide }, S.guide.web.promo) : null,
    teacher ? h('div', { class: 'mode-band', role: 'status' }, S.mode.band) : null,
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' },
        h('button', { class: 'brand-home', type: 'button', title: S.actions.home, 'aria-label': S.actions.home, onclick: onHome },
          h('span', { class: 'logo', 'aria-hidden': 'true' }, '🐋'),
          h('h1', {}, S.appName)),
        h('span', { class: `mode-label ${teacher ? 'teacher' : ''}` }, S.mode[mode])),
      h('div', { class: 'actions' },
        h('button', { class: 'icon-btn', 'data-tour': 'create', 'aria-label': S.actions.create, title: S.actions.create, onclick: onCreate }, '＋'),
        h('button', { class: 'icon-btn', 'data-tour': 'import', 'aria-label': S.actions.import, title: S.actions.import, onclick: onImport }, '↓'),
        h('button', { class: 'icon-btn', 'data-tour': 'mode', 'aria-label': teacher ? S.mode.toggleToBaby : S.mode.toggleToMother, title: teacher ? S.mode.toggleToBaby : S.mode.toggleToMother, onclick: onToggle }, teacher ? '🔓' : '🔒'),
        onGuide ? h('button', { class: 'icon-btn', 'data-tour': 'guide', 'aria-label': S.guide.open, title: S.guide.open, onclick: onGuide }, '❔') : null)));
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
  return h('div', { class: 'filters', 'data-tour': 'find' },
    h('div', { class: 'wide' }, q),
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

// 지금 보고 있는 웨일 서비스에 맞춘 안내 띠 (클래스·팀보드·웨일온)
export function serviceBand({ service, label, mode, recommended = [], onGoTab, onRun, onFlow, hasFlow }) {
  if (!['class', 'teamboard', 'remote'].includes(service)) return null;
  const V = S.svc;
  const teacher = mode === 'mother';
  return h('div', { class: 'card svc-band', 'data-tour': 'svc-band' },
    h('p', {}, h('strong', {}, V.title(label))),
    h('p', { class: 'muted' }, V[service].text),
    service === 'class' ? h('div', { class: 'row' },
      teacher ? h('button', { class: 'primary', onclick: () => onGoTab('class') }, V.class.go) : h('p', { class: 'muted' }, V.class.needTeacher)) : null,
    service === 'teamboard' ? h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => onGoTab('mypod') }, V.teamboard.go)) : null,
    service === 'remote' ? h('div', { class: 'svc-rec' },
      recommended.length ? recommended.map((e) => h('div', { class: 'row' }, h('span', {}, e.work.title), h('button', { class: 'chip', disabled: !canRun(e).ok, onclick: () => onRun(e) }, S.actions.run)))
        : h('p', { class: 'muted' }, V.remote.none),
      teacher ? h('div', { class: 'row' }, h('button', { onclick: () => onGoTab('class') }, V.remote.flow), hasFlow ? h('button', { class: 'primary', onclick: onFlow }, V.remote.resume) : null) : null) : null);
}

// 수업 진행 화면: 도입 → 활동 → 정리 순서로 한 단계씩 실행한다
export function flowView({ steps, entries, i, onPrev, onNext, onRun, onBack, onJump }) {
  const F = S.flow;
  if (!steps.length) return h('section', { class: 'section' }, h('p', { class: 'notice' }, F.empty), h('button', { onclick: onBack }, S.actions.back));
  const cur = steps[i];
  const entry = entries[i];
  const total = steps.reduce((a, st) => a + st.minutes, 0);
  return h('section', { class: 'section flow' },
    h('div', { class: 'row' }, h('button', { onclick: onBack }, S.actions.back), h('h2', {}, F.title)),
    total ? h('p', { class: 'muted' }, F.total(total)) : null,
    h('ol', { class: 'flow-steps' }, steps.map((st, k) =>
      h('li', { class: k === i ? 'now' : k < i ? 'past' : '' },
        h('button', { type: 'button', 'aria-current': k === i ? 'step' : null, onclick: () => onJump(k) }, h('span', { class: 'lab' }, st.label), h('span', {}, st.work.title))))),
    h('div', { class: 'card' },
      h('p', { class: 'muted' }, `${cur.label} · ${i + 1} / ${steps.length}`),
      h('h3', {}, cur.work.title),
      cur.work.howToUse ? h('p', {}, cur.work.howToUse) : null,
      cur.minutes ? h('p', { class: 'muted' }, F.minutes(cur.minutes)) : null,
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: !entry || !canRun(entry).ok, onclick: () => onRun(entry) }, S.actions.run),
        h('button', { onclick: onPrev, disabled: i === 0 }, F.prev),
        h('button', { onclick: onNext, disabled: i === steps.length - 1 }, F.next))));
}

// 곳간 구역 안내 띠: 큰 곳간(검수됨)과 나눔 곳간(검수 전)을 한눈에 구분한다
export const zoneBand = (kind) => h('div', { class: `zone ${kind}`, role: 'note' },
  h('strong', {}, S.zone[kind].title), h('span', {}, S.zone[kind].text));

// 카드 분류 뱃지: 카테고리(파랑) · 학년·교과·단원(청록) · 시간·모둠·대상(회색)
const pill = (kind, text) => h('span', { class: `pill ${kind}` }, text);
function metaLine(entry) {
  const m = metaOf(entry);
  const cat = m.path.slice(1).join(' › ');
  const edu = [[m.gradeLabel, m.subject].filter(Boolean).join(' '), m.unit ? `단원 ${m.unit}` : '', m.topic].filter(Boolean);
  const info = [timeLabel(m.estimatedMinutes), groupLabel(m.groupType), audienceLabel(m.audience)].filter(Boolean);
  return h('div', { class: 'card-meta' },
    h('div', { class: 'pills' },
      cat ? pill('cat', cat) : null, edu.map((t) => pill('edu', t)), info.map((t) => pill('info', t)),
      m.tags.map((t) => pill('tag', '#' + t))),
    m.artifactType === 'webapp' ? h('p', { class: 'notice' }, S.cardMeta.webapp) : null,
    m.artifactType === 'exe' ? h('p', { class: 'notice error' }, S.cardMeta.exe) : null);
}

// 제작자 닉네임 강조: "별빛 고래 · 초등" → 🐳 **별빛 고래** · 초등
export function makerLine(author, role) {
  const [nick, ...rest] = String(author || '').split('·').map((t) => t.trim());
  if (!nick) return null;
  const sub = [rest.join(' · '), role].filter(Boolean).join(' · ');
  return h('p', { class: 'maker' }, h('span', { 'aria-hidden': 'true' }, '🐳'), h('strong', { class: 'nick' }, nick), sub ? h('span', { class: 'maker-sub' }, sub) : null);
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

export function catalogView({ entries, visible, state, onFilter, onAdd, onRun, onToggleDetail, onRemix, share, submit, spout, sendBar, ui, top }) {
  const sortSel = h('label', {}, S.filter.sort.label,
    h('select', { onchange: (e) => onFilter({ sort: e.target.value }) },
      ['pick', 'new', 'spout'].map((k) => h('option', { value: k, selected: state.sort === k }, S.filter.sort[k]))));
  return h('section', { class: 'section' },
    zoneBand('catalog'),
    top || null,
    featuredBand(entries, state, onRun),
    sendBar || null,
    h('p', { class: 'muted' }, S.tagline),
    h('p', { class: 'notice' }, S.listState[state.source] + (state.listRejected ? ` · ${S.listState.listRejected}` : '')),
    findBar({ entries, state, onFilter, sortSel }),
    listTools(visible.map((e) => e.work.id), ui),
    visible.length ? [...sliceOf(visible, ui).map((e) => workCard(e, { mode: state.mode, ui, onAdd, onRun, onToggleDetail, onRemix, share, submit, spout, open: state.openId === e.work.id })), moreButton(visible.length, sliceOf(visible, ui).length, ui)] : emptyState(S.empty.catalog, { icon: '🔍', action: onFilter ? { label: S.find.reset, onClick: () => onFilter({ query: '', domain: '', category: '', subcategory: '', grade: '', subject: '', audience: '', groupType: '', maxMinutes: '', badge: '', pickOnly: false, tag: '' }) } : null }));
}

const KIND_LABEL = { html: 'HTML', webapp: '웹앱', exe: 'EXE' };

// 목록 도구: 모두 펼치기/접기, 더 보기 (작품이 늘어도 길게 스크롤하지 않도록 기본은 접힌 카드 + 12개씩)
export const PAGE_SIZE = 12;
function listTools(ids, ui) {
  if (!ui || !ui.onExpandAll || ids.length < 2) return null;
  const all = ids.every((id) => ui.expanded && ui.expanded[id]);
  return h('div', { class: 'list-tools' },
    h('span', { class: 'muted' }, S.list.count(ids.length)),
    h('button', { class: 'chip', onclick: () => ui.onExpandAll(ids, !all) }, all ? S.list.collapseAll : S.list.expandAll));
}
function moreButton(total, shown, ui) {
  if (!ui || !ui.onMore || shown >= total) return null;
  return h('button', { class: 'more-btn', onclick: ui.onMore }, S.list.more(total - shown));
}
const sliceOf = (items, ui) => (ui && ui.limit ? items.slice(0, ui.limit) : items);

function workCard(entry, opts) {
  const w = entry.work;
  // 참고 전용 작품은 학생고래 모드에서 보고 실행만 된다: 담기·리믹스·수정·꾸러미·레시피·공유를 숨긴다
  const locked = isRestricted(w, opts.mode);
  const { onRun, onToggleDetail, onRemove, open, report, extra, spout, ui, fav, onFav } = opts;
  const onAdd = locked ? null : opts.onAdd, onEdit = locked ? null : opts.onEdit, onRemix = locked ? null : opts.onRemix;
  const selectBox = locked ? null : opts.selectBox, share = locked ? null : opts.share, submit = locked ? null : opts.submit;
  const run = canRun(entry);
  const m = metaOf(entry);
  // 제목 줄에는 간단한 정보(검수 여부·종류)만. 설명·분류는 펼쳤을 때 보인다
  const more = !!(open || (ui && ui.expanded && ui.expanded[w.id]));
  return h('article', { class: `card${entry.status.ok ? ' verified-card' : ''}${more ? ' open' : ' compact'}` },
    h('div', { class: 'card-head' },
      h('button', { class: 'card-toggle', type: 'button', 'aria-expanded': String(more), title: more ? S.list.fold : S.list.unfold, onclick: () => ui && ui.onExpand && ui.onExpand(w.id) },
        h('h3', {}, w.title), h('span', { class: 'chev', 'aria-hidden': 'true' }, more ? '▾' : '▸')),
      onFav ? h('button', { class: `star${fav ? ' on' : ''}`, type: 'button', 'aria-pressed': String(!!fav), 'aria-label': fav ? S.fav.off : S.fav.on, title: fav ? S.fav.off : S.fav.on, onclick: () => onFav(entry) }, fav ? '★' : '☆') : null),
    h('div', { class: 'row', 'data-tour': 'badge' }, badgeEl(entry), entry.status.ok ? h('span', { class: 'badge verified' }, S.verified) : null,
      entry.status.ok && entry.status.pick ? h('span', { class: 'badge pick' }, S.pick) : null,
      w.referenceOnly === true ? h('span', { class: 'badge reference' }, S.reference.badge) : null,
      KIND_LABEL[m.artifactType] ? h('span', { class: 'pill info' }, KIND_LABEL[m.artifactType]) : null),
    makerLine(w.author),
    locked ? h('p', { class: 'notice' }, S.reference.cardNote) : null,
    selectBox || null,
    more && m.description ? h('p', { class: 'desc' }, m.description) : null,
    more ? metaLine(entry) : null,
    more ? verifyLine(entry) : null,
    more && w.remixOf ? h('p', { class: 'muted' }, '🔄 ' + S.lineage(w.remixOfTitle || w.remixOf)) : null,
    more ? extra || null : null,
    h('div', { class: 'card-actions' },
      spout ? spoutRow(entry, spout) : null,
      h('span', { class: 'spacer' }),
      onEdit ? h('button', { onclick: () => onEdit(entry) }, S.actions.edit) : null,
      onRemix ? h('button', { onclick: () => onRemix(entry) }, S.actions.remix) : null,
      onRemove ? h('button', { class: 'danger', onclick: () => onRemove(entry) }, S.actions.remove) : null,
      onAdd ? h('button', { onclick: () => onAdd(entry) }, S.actions.add) : null,
      h('button', { 'data-tour': 'details', onclick: () => onToggleDetail(w.id) }, open ? S.actions.close : S.actions.details),
      h('button', { class: 'primary', 'data-tour': 'run', disabled: !run.ok, onclick: () => onRun(entry) }, S.actions.run)),
    !run.ok ? h('p', { class: 'muted' }, S.run[run.reason]) : null,
    open ? h('div', { class: 'detail' },
      m.standard ? h('p', { class: 'muted' }, `성취기준: ${m.standard}`) : null,
      h('div', {}, h('p', { class: 'muted' }, S.detail.howTo), h('p', {}, w.howToUse)),
      w.promptRecipe && !locked ? h('div', {}, h('p', { class: 'muted' }, S.detail.recipe), h('pre', {}, w.promptRecipe)) : null,
      entry.status.ok && entry.status.songs.length ? entry.status.songs.map((s) => h('p', {}, `🎤 ${s.text} — ${s.author}`)) : null,
      checkList(report),
      share ? sharePanel(entry, share) : null,
      submit ? submitPanel(entry, { ...submit, draft: submit.draftOf ? submit.draftOf(entry) : null }) : null) : null);
}

// 물뿜기: 교사·학생 숫자를 그대로 보여 주고, 기기당 한 번 누를 수 있다
// 좋아요처럼: 누르면 🐳 뿜었어요(숫자 +1), 아직 보내기 전이면 다시 눌러 취소. 보낸 뒤에는 고정.
function spoutRow(entry, { countsOf, mineOf, onSpout }) {
  const c = countsOf(entry);
  const mine = mineOf(entry);
  return h('div', { class: 'spout', 'data-tour': 'spout' },
    h('button', {
      'aria-pressed': String(!!mine), title: S.spout.hint, 'aria-label': `${mine ? S.spout.done : S.spout.button} ${S.spout.counts(c.teacher, c.student)}`,
      onclick: () => onSpout(entry),
    }, h('span', { class: 'emoji', 'aria-hidden': 'true' }, '🐳'), ' ', mine ? S.spout.done : S.spout.button, ' ', S.spout.counts(c.teacher, c.student)));
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

// 큰 곳간에 보내기 (교사고래 모드에서만 만들어진다): 개인정보 확인 → 설문 문항별 답·업로드 파일 → 구글 설문 열기
function submitPanel(entry, { allowRecommend, draft, profile, ready, onPrepare, onCopy, onSaveFile, onOpenForm, showSong, onSong }) {
  const Sb = S.submit;
  const nick = h('input', { 'aria-label': Sb.nickname, placeholder: Sb.nickname, value: (draft && draft.nickname) || (profile && profile.nickname) || '' });
  const privacy = h('input', { type: 'checkbox', checked: !!draft });
  const song = h('input', { 'aria-label': Sb.songLabel, placeholder: Sb.songLabel, maxlength: '120' });
  const pkg = draft && draft.result;
  const row = (label, value) => (value ? h('div', { class: 'field' }, h('span', {}, label),
    h('div', { class: 'row' }, h('span', {}, value), h('button', { class: 'chip', onclick: () => onCopy(value) }, Sb.copy))) : null);
  return h('div', { class: 'detail' },
    h('p', { class: 'muted' }, Sb.title),
    allowRecommend ? h('div', { class: 'section' },
      nick,
      h('label', { class: 'check' }, privacy, Sb.privacy),
      h('button', { onclick: () => onPrepare(entry, { nickname: nick.value, privacyChecked: privacy.checked }) }, Sb.prepare)) : null,
    pkg ? h('div', { class: 'card' },
      pkg.file ? h('button', { onclick: () => onSaveFile(pkg.file) }, Sb.step1(pkg.file.name)) : h('p', { class: 'muted' }, Sb.noFile),
      ready ? h('button', { class: 'primary', onclick: () => onOpenForm(pkg) }, Sb.step2) : h('p', { class: 'notice' }, Sb.notReady),
      ready ? null : Object.entries(pkg.prefill).map(([k, v]) => row(Sb.field[k] || k, v)),
      h('p', { class: 'muted' }, Sb.step3),
      (pkg.warnings || []).map((w) => h('p', { class: 'notice' }, w))) : null,
    showSong ? h('div', { class: 'section' }, song, h('button', { onclick: () => onSong(entry, { text: song.value, author: nick.value, privacyChecked: privacy.checked }) }, Sb.song)) : null);
}

// 나눔 곳간: 시트 목록 → 검색·분류 거르기 → 가져오기
export function marketView({ m, onRefresh, onFilter, onImport, onPreview, onReview, mode = 'baby', spout, sendBar, web = false, ui }) {
  const M = S.market;
  const q = h('input', { type: 'search', placeholder: S.find.search, 'aria-label': S.find.search, value: m.query || '' });
  q.addEventListener('change', () => onFilter({ query: q.value.trim() }));
  const shown = (m.entries || []).filter((e) => {
    if (m.kind && !e.kinds.includes(m.kind)) return false;
    if (!m.query) return true;
    const hay = [e.title, e.description, e.nickname, e.comment, e.categoryText, ...e.kinds].join(' ').toLowerCase();
    return m.query.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
  });
  let state = null;
  if (m.status === 'loading') state = h('p', { class: 'notice' }, M.loading);
  else if (m.status === 'error') state = h('p', { class: 'notice error', role: 'alert' }, M.error[m.error] || m.error);
  else if (m.missing && m.missing.length) state = h('p', { class: 'notice error' }, M.columns(m.missing, m.header || []));
  const teacher = mode === 'mother';
  const isEx = (id) => !!(ui && ui.expanded && ui.expanded[id]);
  return h('section', { class: 'section' },
    zoneBand('market'),
    sendBar || null,
    h('div', { class: 'filters' },
      h('label', { class: 'wide' }, S.find.search, q),
      select(S.market.kind, m.kind, KIND_OPTIONS, (v) => onFilter({ kind: v }), {}, S.filter.all),
      h('button', { class: 'wide', onclick: onRefresh }, M.refresh)),
    state,
    m.source === 'cache' ? h('p', { class: 'notice' }, M.cache) : null,
    m.notice ? h('p', { class: 'notice' }, m.notice) : null,
    m.status === 'ok' && !(m.entries || []).length ? h('p', { class: 'muted' }, M.empty) : null,
    m.status === 'ok' && (m.entries || []).length ? h('p', { class: 'muted' }, M.count(shown.length)) : null,
    m.status === 'ok' && (m.entries || []).length && !shown.length ? h('p', { class: 'muted' }, M.none) : null,
    listTools(shown.map((e) => e.id), ui),
    sliceOf(shown, ui).map((e) => h('article', { class: `card market-card${ui && ui.expanded && ui.expanded[e.id] ? ' open' : ' compact'}` },
      h('div', { class: 'card-head' }, h('button', { class: 'card-toggle', type: 'button', 'aria-expanded': String(!!(ui && ui.expanded && ui.expanded[e.id])), onclick: () => ui && ui.onExpand && ui.onExpand(e.id) },
        h('h3', {}, e.title), h('span', { class: 'chev', 'aria-hidden': 'true' }, ui && ui.expanded && ui.expanded[e.id] ? '▾' : '▸'))),
      makerLine(e.nickname, e.whale),
      h('div', { class: 'row' }, h('span', { class: 'badge precheck' }, S.zone.market.badge), h('span', { class: 'badge shallow' }, S.badge.shallow), e.sample ? h('span', { class: 'badge' }, M.sampleTag) : null),
      isEx(e.id) && (e.kinds.length || e.categoryText) ? h('div', { class: 'pills' }, e.kinds.map((k) => pill('cat', k)), e.categoryText ? pill('info', e.categoryText) : null) : null,
      isEx(e.id) && e.timestamp ? h('p', { class: 'muted' }, e.timestamp) : null,
      isEx(e.id) && e.description ? h('p', {}, e.description) : null,
      isEx(e.id) && e.comment ? h('p', { class: 'muted' }, '💬 ' + e.comment) : null,
      isEx(e.id) && !(e.files.length || e.payload) ? h('p', { class: 'muted' }, S.cardMeta.webapp) : null,
      spout ? spoutRow({ work: { id: e.id } }, spout) : null,
      // 웹 버전: 구글 드라이브 파일은 브라우저가 직접 받을 수 없어 드라이브에서 열어 보게 한다 (가져오기는 웨일 사이드바에서)
      web && e.files.length
        ? h('div', {}, h('p', { class: 'muted' }, M.webFileNote),
          h('a', { class: 'btn', href: e.files[0], target: '_blank', rel: 'noopener noreferrer' }, M.openInDrive))
        : h('div', { class: 'row' },
          // 미리 보기: 내 곳간에 담지 않고 바로 새 창에서 연다
          h('button', { disabled: !!(m.busy && m.busy[e.id]), onclick: () => onPreview(e) }, M.preview),
          teacher ? h('button', { class: 'primary', disabled: !!(m.busy && m.busy[e.id]) || !!(m.done && m.done[e.id]), onclick: () => onImport(e) },
            m.done && m.done[e.id] ? M.imported : m.busy && m.busy[e.id] ? M.importing : M.import) : null,
          teacher ? h('button', { disabled: !!(m.busy && m.busy[e.id]), title: M.reviewHint, onclick: () => onReview(e) }, M.review) : null,
          !teacher ? h('p', { class: 'muted' }, M.studentNote) : null))),
    moreButton(shown.length, sliceOf(shown, ui).length, ui));
}

// 나눔 곳간 작품을 실행하기 전 출처 확인
export function marketRunConfirm({ title, onRun, onCancel }) {
  const M = S.market;
  return h('section', { class: 'section' },
    h('div', { class: 'card', role: 'alertdialog', 'aria-label': M.runTitle },
      h('h3', {}, M.runTitle),
      h('p', {}, h('strong', {}, title)),
      h('p', {}, M.runBody),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: onRun }, M.runOk), h('button', { onclick: onCancel }, M.runCancel))));
}

// 웨일 스페이스 공유 버튼 묶음: 지금 화면의 서비스에 맞는 버튼이 맨 앞에 온다
function sharePanel(entry, { kinds, serviceLabel, onShare, onLink }) {
  return h('div', { class: 'detail' },
    h('p', { class: 'muted' }, S.share.title),
    serviceLabel ? h('p', { class: 'notice' }, S.share.nowOn(serviceLabel)) : null,
    h('div', { class: 'row', 'data-tour': 'share-kinds' },
      kinds.map((k, i) => h('button', { class: i === 0 && serviceLabel ? 'primary' : '', onclick: () => onShare(entry, k) }, S.share.kinds[k])),
      h('button', { 'data-tour': 'share-link', onclick: () => onLink(entry) }, S.share.link)),
    h('p', { class: 'muted' }, S.share.hint));
}

export function mypodView({ records, entriesById, state, onRun, onRemove, onToggleDetail, onEdit, onRemix, onSelect, onExport, exportOut, onSaveFile, onCopy, share, submit, onSearch, total, ui, onFav, onFavOnly, top, onTeamboard }) {
  const q = h('input', { type: 'search', placeholder: S.find.search, 'aria-label': S.find.search, value: state.mypodQuery || '' });
  q.addEventListener('change', () => onSearch(q.value.trim()));
  const nameInput = h('input', { 'aria-label': S.bundle.packName, placeholder: S.bundle.packName, value: state.packName || '' });
  return h('section', { class: 'section' },
    top || null,
    total ? h('label', { class: 'field' }, h('span', {}, S.find.search), q) : null,
    state.mypodQuery ? h('p', { class: 'muted' }, S.find.found(records.length, total)) : null,
    total ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!state.favOnly, onchange: (e) => onFavOnly(e.target.checked) }), S.fav.only) : null,
    listTools(records.map((r) => r.id), ui),
    records.length ? h('div', { class: 'card' },
      h('p', {}, S.bundle.exportTitle),
      nameInput,
      h('button', { onclick: () => onExport(nameInput.value) }, S.bundle.exportBtn),
      h('button', { 'data-tour': 'teamboard-cards', title: S.svc.teamboard.cardsHint, onclick: onTeamboard }, S.svc.teamboard.cards),
      exportOut ? h('div', { class: 'detail' }, h('p', {}, S.bundle.madeN(exportOut.count, exportOut.fileName)),
        h('div', { class: 'row' }, h('button', { onclick: onSaveFile }, S.bundle.saveFile), h('button', { onclick: onCopy }, S.bundle.copy))) : null) : null,
    records.length ? [...sliceOf(records, ui).map((r) => {
      const w = r.work;
      const tags = [`출처: ${S.source[r.source] || r.source}`, `버전 ${w.version}`];
      if (r.sample) tags.unshift(S.market.sampleTag);
      if (w.editedFrom) tags.push(`${S.edit.editedFrom} (원본 ${w.editedFrom})`);
      if (r.checkReport && !r.checkReport.ok) tags.push(`점검 경고 ${r.checkReport.warnings.length}개`);
      return workCard(entriesById.get(r.id), {
        mode: state.mode, ui, fav: !!r.favorite, onFav, onRun, onRemove, onToggleDetail, onEdit, onRemix, share, submit, open: state.openId === r.id, report: r.checkReport,
        selectBox: h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: (state.selected || []).includes(r.id), onchange: (e) => onSelect(r.id, e.target.checked) }), '꾸러미에 담기'),
        extra: h('p', { class: 'muted' }, tags.join(' · ')),
      });
    }), moreButton(records.length, sliceOf(records, ui).length, ui)] : state.mypodQuery ? null : emptyState(S.empty.mypodTitle, { icon: '🐳', text: S.empty.mypod }));
}

export function classView({ mode, records, state, onSelect, onBuild, out, onCopy, onSaveFile, onOpenClass, onFlow }) {
  const C = S.classPack;
  if (mode !== 'mother') return h('section', { class: 'section' }, h('p', { class: 'notice' }, C.needMother));
  if (!records.length) return h('section', { class: 'section' }, h('p', { class: 'muted' }, C.empty));
  const nameInput = h('input', { 'aria-label': C.name, placeholder: C.name, value: state.className || '' });
  const noteInput = h('textarea', { 'aria-label': C.note, placeholder: C.note }, state.classNote || '');
  return h('section', { class: 'section' },
    h('h2', {}, C.title),
    h('p', { class: 'muted' }, C.steps),
    h('p', {}, C.pick),
    records.map((r) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: (state.classSelected || []).includes(r.id), onchange: (e) => onSelect(r.id, e.target.checked) }),
      `${r.work.title} (${[r.work.grade, r.work.subject].filter(Boolean).join('·')})`)),
    nameInput, noteInput,
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => onBuild(nameInput.value, noteInput.value) }, C.build),
      h('button', { 'data-tour': 'flow-start', onclick: onFlow, title: C.flowHint }, C.flow)),
    h('p', { class: 'muted' }, C.flowHint),
    out ? h('div', { class: 'card' },
      h('p', {}, C.madeN(out.count)),
      h('p', { class: 'muted' }, C.guide),
      out.tooLong ? h('p', { class: 'notice error' }, C.tooLong) : null,
      // 클래스 글은 글자 수 제한이 있어서 '짧은 안내문 + 꾸러미 파일 첨부'가 기본이다
      h('ol', { class: 'guide-list' }, C.attachSteps.map((t) => h('li', {}, t))),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: onSaveFile }, C.saveFile),
        h('button', { class: 'primary', onclick: () => onCopy('assignment') }, C.copyAssignment),
        h('button', { onclick: () => onCopy('notice') }, C.copyNotice)),
      h('details', {}, h('summary', {}, C.moreCopy),
        h('div', { class: 'row' }, h('button', { onclick: () => onCopy('all') }, C.copyAll), h('button', { onclick: () => onCopy('pack') }, C.copyPack))),
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
  const file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain' });
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
  let first = ''; // 정하기 1단계에서 입력한 암호
  let step = hasPin ? 'enter' : 'set1';
  let digits = '';
  const root = h('section', { class: 'section pin' });
  const MAX = 8;
  const dots = () => h('div', { class: 'pin-dots', 'aria-label': `${digits.length}자리 입력됨` }, Array.from({ length: Math.max(4, digits.length) }, (_, k) => h('i', { class: k < digits.length ? 'on' : '' })));
  const confirm = () => {
    if (digits.length < 4) return;
    if (step === 'enter') return onEnter(digits);
    if (step === 'set1') { first = digits; digits = ''; step = 'set2'; return draw(); }
    return onSet(first, digits);
  };
  const press = (d) => { if (digits.length < MAX) { digits += d; draw(); } };
  const back = () => { digits = digits.slice(0, -1); draw(); };
  function draw() {
    const title = step === 'enter' ? P.enterTitle : step === 'set1' ? P.setTitle : P.confirm;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { onclick: () => press(d), 'aria-label': d }, d));
    root.replaceChildren(...[
      h('h2', {}, title),
      h('p', { class: 'muted' }, step === 'enter' ? P.enterHint : P.setHint),
      error ? h('p', { class: 'notice error', role: 'alert' }, error) : null,
      dots(),
      h('div', { class: 'keypad' }, ...keys,
        h('button', { class: 'text', onclick: back }, P.erase),
        h('button', { onclick: () => press('0'), 'aria-label': '0' }, '0'),
        h('button', { class: 'text primary', disabled: digits.length < 4, onclick: confirm }, P.ok)),
      h('div', { class: 'row' }, h('button', { onclick: onCancel }, P.cancel),
        hasPin && !askReset ? h('button', { onclick: onForgot }, P.forgot) : null),
      askReset ? h('div', { class: 'notice' }, h('p', {}, P.forgotConfirm), h('button', { class: 'danger', onclick: onReset }, P.reset)) : null,
    ].filter(Boolean)); // replaceChildren는 null을 글자 "null"로 넣으므로 걸러 낸다
  }
  // 키보드로도 입력할 수 있게 한다
  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') confirm();
  });
  draw();
  setTimeout(() => root.focus(), 0);
  return root;
}

// 시험 잠금 화면 (학생고래 모드 + 메인 탭이 UBT)
export function examLockView() {
  return h('section', { class: 'section exam-lock', role: 'alert' },
    h('p', { class: 'lock-whale', 'aria-hidden': 'true' }, '🐳'),
    h('h2', {}, S.exam.title),
    h('p', {}, S.exam.body),
    h('p', { class: 'muted' }, S.exam.hint));
}

// 사용 방법 화면: 등급(역할)·배지·표시 읽는 법을 한 곳에 모으고, 따라 해보기 버튼을 둔다
export function guideView({ onStartTour, onBack, web = false }) {
  const G = S.guide;
  const sec = (title, ...kids) => h('section', { class: 'card guide-sec' }, h('h3', {}, title), ...kids.filter(Boolean));
  return h('section', { class: 'section guide' },
    h('div', { class: 'row' }, h('button', { onclick: onBack }, S.actions.back), h('h2', {}, G.title)),
    h('div', { class: 'card guide-hero' }, h('p', {}, G.intro), h('div', { class: 'row' }, h('button', { class: 'primary', 'data-tour': 'guide-start', onclick: () => onStartTour('main') }, G.start),
      h('button', { onclick: () => onStartTour('share') }, G.startShare))),
    sec(G.rolesTitle, h('p', { class: 'muted' }, G.rolesIntro),
      h('dl', { class: 'guide-dl' }, G.roles.map((r) => [h('dt', {}, `${r.icon} ${r.name}`), h('dd', {}, r.text)]).flat())),
    sec(G.badgesTitle, h('p', { class: 'muted' }, G.badgesIntro),
      h('div', { class: 'guide-rows' }, ['clear', 'shallow', 'whirlpool'].map((b) =>
        h('div', { class: 'guide-row' }, h('span', { class: `badge ${b}` }, S.badge[b]), h('p', {}, G.badgeText[b]))))),
    sec(G.marksTitle, h('p', { class: 'muted' }, G.marksIntro),
      h('div', { class: 'guide-rows' }, G.marks.map((m) =>
        h('div', { class: 'guide-row' }, h('span', { class: m.cls ? `badge ${m.cls}` : 'badge' }, m.label), h('p', {}, m.text))))),
    sec(G.signTitle, h('p', {}, G.signText), h('ul', { class: 'guide-list' }, G.signStates.map((t) => h('li', {}, t)))),
    sec(web ? G.web.installTitle : G.web.goTitle,
      h('p', {}, web ? G.web.installIntro : G.web.goIntro),
      web ? h('ol', { class: 'guide-list' }, G.web.installSteps.map((t) => h('li', {}, t))) : h('p', {}, h('a', { class: 'btn', href: G.web.url, target: '_blank', rel: 'noopener noreferrer' }, G.web.goBtn)),
      h('p', { class: 'muted' }, web ? G.web.installNote : G.web.goNote)),
    sec(G.podsTitle, h('ul', { class: 'guide-list' }, G.pods.map((t) => h('li', {}, t)))),
    h('p', { class: 'muted' }, G.stepsCount(TOUR_STEPS.length) + ' ' + G.shareCount(SHARE_TOUR_STEPS.length)));
}
