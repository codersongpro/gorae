// 바로 실행 뷰어: 작품을 찾아 검수 서명을 확인하고 격리해서 실행한다. 작품은 allow-same-origin 없는 iframe에서만 실행한다.
//   viewer.html?id=작품id  → 인증 곳간(catalog.json)에서 찾는 짧은 링크
//   viewer.html#g1.…       → 작품을 압축해 # 뒤에 담은 링크 (# 뒤는 서버로 전송되지 않는다)
import { readViewerFragment, readViewerQuery, readCatalogWork } from './shared/link.js';
import { createVerifier } from './shared/tailprint.js';
import { ROOT_PUBLIC_JWK } from './rootkey.js';
import { S } from './strings.js';
import { normalizeWork } from './shared/taxonomy.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
$('tagline').textContent = S.tagline;

// 작품 안에서 바깥으로 나가는 통신을 막는 정책 (sandbox 페이지의 정책과 같은 뜻)
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

// 족보 버전은 이 브라우저에 기억해 오래된 족보를 거부한다 (저장소를 못 쓰면 0으로 본다)
const lastSeen = () => { try { return Number(localStorage.getItem('gorae.lastListVersion')) || 0; } catch { return 0; } };
const remember = (v) => { try { localStorage.setItem('gorae.lastListVersion', String(v)); } catch { /* 무시 */ } };

async function verify(work) {
  try {
    const res = await fetch('reviewers.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const verifier = await createVerifier({ rootPublicJwk: ROOT_PUBLIC_JWK, list: await res.json(), lastSeenVersion: lastSeen() });
    if (verifier.listResult.ok) remember(verifier.listResult.version);
    return await verifier.verify(work);
  } catch {
    return { ok: false, reason: 'LIST_INVALID' };
  }
}

function runHtml(work, whirlpool) {
  const stage = $('stage');
  const btn = el('button', { onclick: () => {
    const frame = el('iframe', { title: work.title, sandbox: 'allow-scripts' }); // allow-same-origin 없음
    frame.setAttribute('csp', CSP);
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}">${work.html}`;
    stage.replaceChildren(frame);
    btn.remove();
  } }, '▶ 실행');
  if (whirlpool) stage.replaceChildren(el('p', { class: 'notice error' }, S.run.WHIRLPOOL));
  else stage.replaceChildren(btn, el('p', { class: 'muted' }, S.run.running));
  stage.hidden = false;
}

function runUrl(work, whirlpool, verified) {
  const stage = $('stage');
  let u = null;
  try { u = new URL(work.url); } catch { /* 아래에서 처리 */ }
  if (whirlpool) stage.replaceChildren(el('p', { class: 'notice error' }, S.run.WHIRLPOOL));
  else if (!u || u.protocol !== 'https:') stage.replaceChildren(el('p', { class: 'notice error' }, S.run.NOT_HTTPS));
  else stage.replaceChildren(
    el('div', { class: 'card' },
      el('p', {}, S.run.confirmHost(u.hostname)),
      verified ? null : el('p', { class: 'notice error' }, S.run.confirmUnverified),
      el('a', { class: 'btn', href: u.href, target: '_blank', rel: 'noopener noreferrer' }, S.run.confirmOpen)));
  stage.hidden = false;
}

// 짧은 링크: 인증 곳간 목록에서 작품을 찾는다
async function fromCatalog(id) {
  let catalog;
  try {
    const res = await fetch('catalog.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    catalog = await res.json();
  } catch {
    return { ok: false, message: '인증 곳간 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' };
  }
  const r = readCatalogWork(catalog, id);
  if (r.ok) return r;
  return { ok: false, message: r.reason === 'NOT_FOUND' ? '인증 곳간에서 이 작품을 찾을 수 없어요. 목록에서 내려갔거나 주소가 잘못됐어요.' : '인증 곳간의 작품 정보가 올바르지 않아 열 수 없어요.' };
}

async function main() {
  const id = readViewerQuery(location.search);
  let parsed;
  if (id) parsed = await fromCatalog(id);
  else {
    parsed = await readViewerFragment(location.hash);
    if (!parsed.ok) parsed.message = parsed.reason === 'NO_DATA' ? '이 주소에는 작품이 들어 있지 않아요.' : '링크가 깨졌거나 올바르지 않아요. 보내 준 사람에게 다시 요청해 주세요.';
  }
  if (!parsed.ok) {
    status.className = 'notice error';
    status.textContent = parsed.message;
    return;
  }
  const work = parsed.work;
  const meta = normalizeWork(work); // 예전 작품도 같은 모양으로
  const st = await verify(work);
  // 인증 목록의 짧은 링크는 검증 성공만 실행 허용. 개인 #g1 링크의 경고 정책은 유지한다.
  if (id && !st.ok) {
    status.className = 'notice error';
    status.textContent = `검수 서명을 확인하지 못해 실행을 차단했어요. ${S.reason[st.reason] || st.reason}`;
    $('stage').replaceChildren();
    $('stage').hidden = true;
    return;
  }
  const badge = st.ok ? st.badge : 'shallow';
  const whirlpool = st.ok && st.badge === 'whirlpool';

  const info = $('info');
  info.replaceChildren(...[
    el('h1', {}, work.title),
    el('div', { class: 'row' },
      el('span', { class: `badge ${badge}` }, S.badge[badge]),
      st.ok && st.pick ? el('span', { class: 'badge shallow' }, S.pick) : null),
    el('p', { class: 'muted' }, meta.path.join(' › ')),
    el('p', { class: 'muted' }, [meta.gradeLabel, meta.subject, meta.topic, work.author].filter(Boolean).join(' · ')),
    meta.artifactType === 'webapp' ? el('p', { class: 'notice' }, '🌐 외부 웹앱입니다') : null,
    meta.tags.length ? el('p', { class: 'muted' }, meta.tags.map((t) => '#' + t).join(' ')) : null,
    el('p', { class: st.ok ? 'muted' : 'notice' }, st.ok ? S.tailprintOk(st.reviewer.nickname, String(st.signedAt).slice(0, 10)) : (S.reason[st.reason] || st.reason)),
    st.ok ? null : el('p', { class: 'muted' }, '🟡 아직 검수되지 않은 작품으로 표시해요. 교사가 먼저 확인한 뒤 사용해 주세요.'),
    work.remixOf ? el('p', { class: 'muted' }, '🔄 ' + S.lineage(work.remixOfTitle || work.remixOf)) : null,
    meta.description ? el('p', {}, meta.description) : null,
    meta.standard ? el('p', {}, `성취기준: ${meta.standard}`) : null,
    el('p', {}, el('strong', {}, S.detail.howTo + ': '), work.howToUse || ''),
    work.promptRecipe ? el('div', {}, el('p', { class: 'muted' }, S.detail.recipe), el('pre', {}, work.promptRecipe)) : null,
  ].filter(Boolean)); // replaceChildren는 null을 글자 "null"로 넣으므로 걸러 낸다
  info.hidden = false;
  status.hidden = true;
  document.title = `${work.title} · 고래곳간`;

  if (work.type === 'html') runHtml(work, whirlpool);
  else runUrl(work, whirlpool, st.ok);
}
main();
