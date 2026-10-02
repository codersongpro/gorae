// 작품 등록·수정·리믹스 화면 — 형태 → 수업/업무 → 카테고리 → 하위 → (교과 상세) → 대상·태그 → 내용
// 선택이 바뀌면 다음 칸이 달라지므로 onChange로 다시 그린다. 글자 입력은 values에 바로 담는다.
import { h } from './dom.js';
import { S } from './strings.js';
import {
  ARTIFACT_TYPES, DOMAINS, categoriesOf, findCategory, SCHOOL_LEVELS, levelOf, SUBJECTS, SUBJECTS_BY_LEVEL,
  GROUP_TYPES, TIME_OPTIONS, AUDIENCES, RECOMMENDED_TAGS, normalizeTags,
} from '../shared/taxonomy.js';

const F = () => S.form;

function selectEl(label, value, options, onPick, { required = false, placeholder } = {}) {
  return h('label', { class: 'field' }, h('span', {}, label + (required ? ' *' : '')),
    h('select', { onchange: (e) => onPick(e.target.value) },
      h('option', { value: '' }, placeholder || F().choose),
      options.map((o) => h('option', { value: o.id, selected: String(o.id) === String(value) }, o.label))));
}
function textEl(label, values, key, { required = false, multiline = false, type = 'text', placeholder = '' } = {}) {
  const el = multiline
    ? h('textarea', { placeholder, oninput: (e) => { values[key] = e.target.value; } }, values[key] || '')
    : h('input', { type, placeholder, value: values[key] == null ? '' : String(values[key]), oninput: (e) => { values[key] = e.target.value; } });
  return h('label', { class: 'field' }, h('span', {}, label + (required ? ' *' : '')), el);
}
// 예 / 아니요 / 모름 (웹앱 정보)
function triEl(label, values, key) {
  const v = values[key] === true || values[key] === 'yes' ? 'yes' : values[key] === false || values[key] === 'no' ? 'no' : '';
  return h('label', { class: 'field' }, h('span', {}, label),
    h('select', { onchange: (e) => { values[key] = e.target.value; } },
      [['', F().unknown], ['yes', F().yes], ['no', F().no]].map(([id, t]) => h('option', { value: id, selected: id === v }, t))));
}
const section = (title, ...kids) => h('fieldset', { class: 'card' }, h('legend', {}, title), ...kids);

export function createView({ values, mode, onChange, onSubmit, onCancel, errors, warnings, heading = S.create.title, hint }) {
  const v = values;
  const set = (patch) => onChange(patch); // 구조가 바뀌는 선택 → 다시 그림
  const cat = findCategory(v.domain, v.category);
  const level = levelOf(v.schoolLevel);
  const subjectsFor = level ? SUBJECTS_BY_LEVEL[level.id] : SUBJECTS;
  const types = ARTIFACT_TYPES.filter((a) => a.id !== 'exe' || mode === 'mother'); // EXE는 교사고래 모드에서만

  // 1. 형태
  const typeBlock = section(F().step1,
    selectEl(F().artifactType, v.artifactType, types, (x) => set({ artifactType: x }), { required: true }),
    mode !== 'mother' ? h('p', { class: 'muted' }, F().exeMotherOnly) : null);

  // 2·3. 수업/업무 → 대표 카테고리 → 하위
  const classBlock = section(F().step2,
    selectEl(F().domain, v.domain, DOMAINS, (x) => set({ domain: x, category: '', subcategory: '' }), { required: true }),
    v.domain ? selectEl(F().category, v.category, categoriesOf(v.domain), (x) => set({ category: x, subcategory: '' }), { required: true }) : null,
    cat ? selectEl(cat.detail ? F().activityType : F().subcategory, v.subcategory, cat.subs, (x) => set({ subcategory: x }), { required: true }) : null,
    h('p', { class: 'muted' }, F().oneCategory));

  // 교과 정보: 교과활동은 필수(학교급·학년·교과·주제), 다른 수업 카테고리는 선택
  const subjectFields = [
    h('div', { class: 'grid2' },
      selectEl(F().schoolLevel, v.schoolLevel, SCHOOL_LEVELS, (x) => set({ schoolLevel: x, grade: '' }), { required: cat && cat.detail }),
      selectEl(F().grade, v.grade, (level ? level.grades : []).map((g) => ({ id: g, label: `${g}학년` })), (x) => set({ grade: x }), { required: cat && cat.detail })),
    selectEl(F().subject, v.subject, subjectsFor.map((s) => ({ id: s, label: s })), (x) => set({ subject: x }), { required: cat && cat.detail }),
    cat && cat.detail ? textEl(F().topic, v, 'topic', { required: true, placeholder: F().topicPh }) : null,
    cat && cat.detail ? h('div', { class: 'grid2' }, textEl(F().area, v, 'area'), textEl(F().unit, v, 'unit')) : null,
    cat && cat.detail ? textEl(F().lessonNo, v, 'lessonNo', { placeholder: '예: 4/10' }) : null,
    textEl(F().standard, v, 'standard', { placeholder: '예: [4수01-12]' }),
  ];
  const lessonBlock = v.domain === 'lesson' && cat
    ? section(cat.detail ? F().step3detail : F().step3lesson,
      cat.detail ? subjectFields : h('details', {}, h('summary', {}, F().subjectOptional), ...subjectFields),
      h('div', { class: 'grid2' },
        selectEl(F().groupType, v.groupType, GROUP_TYPES, (x) => { v.groupType = x; }),
        selectEl(F().time, v.estimatedMinutes, TIME_OPTIONS.map((t) => ({ id: t.minutes, label: t.label })), (x) => { v.estimatedMinutes = x; })))
    : null;

  // 대상 사용자 (하나 이상)
  const aud = new Set(v.audience || []);
  const audienceBlock = section(F().audience + ' *',
    h('div', { class: 'row' }, AUDIENCES.map((a) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: aud.has(a.id), onchange: (e) => { if (e.target.checked) aud.add(a.id); else aud.delete(a.id); v.audience = [...aud]; } }),
      a.label))),
    h('p', { class: 'muted' }, F().audienceHint));

  // 기본 정보 + 태그
  const tagInput = h('input', { placeholder: F().tagPh, value: (normalizeTags(v.tags || [])).join(', '), oninput: (e) => { v.tags = e.target.value; } });
  const addTag = (t) => { v.tags = normalizeTags([...normalizeTags(v.tags || []), t]); tagInput.value = v.tags.join(', '); };
  const infoBlock = section(F().step4,
    textEl(S.create.name, v, 'title', { required: true }),
    textEl(F().description, v, 'description', { multiline: true, placeholder: F().descriptionPh }),
    textEl(S.create.howTo, v, 'howToUse', { required: true, multiline: true }),
    h('label', { class: 'field' }, h('span', {}, F().tags), tagInput),
    v.domain ? h('div', { class: 'row' }, (RECOMMENDED_TAGS[v.domain] || []).map((t) => h('button', { type: 'button', class: 'chip', onclick: () => addTag(t) }, '#' + t))) : null,
    textEl(S.create.author, v, 'author'),
    textEl(S.create.recipe, v, 'promptRecipe', { multiline: true }));

  // 형태별 입력
  let contentBlock = null;
  if (v.artifactType === 'html') {
    const file = h('input', { type: 'file', accept: '.html,text/html' });
    const ta = h('textarea', { 'aria-label': S.create.html, oninput: (e) => { v.html = e.target.value; } }, v.html || '');
    file.addEventListener('change', async () => { const f = file.files[0]; if (f) { v.html = await f.text(); ta.value = v.html; } });
    contentBlock = section(F().htmlTitle, h('p', { class: 'muted' }, F().htmlHint), h('span', { class: 'muted' }, S.create.file), file, h('span', { class: 'muted' }, S.create.html), ta);
  } else if (v.artifactType === 'webapp') {
    contentBlock = section(F().webappTitle,
      h('p', { class: 'notice error' }, F().webappWarn),
      textEl(F().webappUrl, v, 'url', { required: true, type: 'url', placeholder: 'https://' }),
      textEl(F().sourceUrl, v, 'sourceUrl', { type: 'url', placeholder: 'https://' }),
      h('div', { class: 'grid2' },
        triEl(F().loginRequired, v, 'loginRequired'), triEl(F().usesExternalApi, v, 'usesExternalApi'),
        triEl(F().mobileSupported, v, 'mobileSupported'), triEl(F().collectsPersonalInfo, v, 'collectsPersonalInfo'),
        triEl(F().needsInternet, v, 'needsInternet')));
  } else if (v.artifactType === 'exe') {
    contentBlock = section(F().exeTitle,
      h('p', { class: 'notice error' }, F().exeWarn),
      textEl(F().exeUrl, v, 'url', { required: true, type: 'url', placeholder: 'https://' }),
      textEl(F().exeSource, v, 'sourceRepo', { required: true, type: 'url', placeholder: 'https://' }),
      textEl('SHA-256', v, 'sha256', { required: true, placeholder: F().shaPh }),
      textEl(F().exeScan, v, 'scanResult', { required: true }),
      textEl(F().exeEnv, v, 'environment', { required: true, placeholder: '예: Windows 11, 인터넷 불필요' }));
  }

  return h('section', { class: 'section' },
    h('h2', {}, heading),
    hint ? h('p', { class: 'notice' }, hint) : null,
    h('p', { class: 'notice' }, S.create.privacyNote),
    errors && errors.length ? h('div', { class: 'notice error', role: 'alert' }, errors.map((e) => h('p', {}, e.message))) : null,
    warnings && warnings.length ? h('div', { class: 'notice' }, warnings.map((e) => h('p', {}, e.message))) : null,
    typeBlock, classBlock, lessonBlock, audienceBlock, infoBlock, contentBlock,
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => onSubmit(v) }, S.actions.save),
      h('button', { onclick: onCancel }, S.actions.back)));
}
