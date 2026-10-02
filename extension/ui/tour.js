// 따라 해보기(iorad 스타일): 화면의 버튼을 순서대로 밝게 비추고 설명을 띄운다. 로직과 무관한 순수 화면 도구.
// steps: [{ target: '[data-tour=...]', title, body, ...앱이 쓰는 값(tab·screen·detail 등) }]
// prepare(step): 그 단계에 필요한 화면으로 이동시킨다 (앱이 넘겨 줌). 대상이 화면에 없으면 그 단계는 건너뛴다.
import { h } from './dom.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(selector, ms = 1800) {
  const end = Date.now() + ms;
  for (;;) {
    const el = document.querySelector(selector);
    if (el && el.getClientRects().length) return el;
    if (Date.now() > end) return null;
    await sleep(60);
  }
}

// t: { next, prev, done, quit, stepOf(n,total), label }
export function startTour({ steps, prepare, onEnd, t }) {
  const hole = h('div', { class: 'tour-hole', 'aria-hidden': 'true' });
  const tip = h('div', { class: 'tour-tip', role: 'dialog', 'aria-live': 'polite', 'aria-label': t.label });
  const root = h('div', { class: 'tour-root' }, hole, tip);
  document.body.append(root);
  let i = -1;
  let closed = false;

  const targetNow = () => (i >= 0 && steps[i] ? document.querySelector(steps[i].target) : null);

  function place() {
    const el = targetNow();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const th = tip.offsetHeight;
    const tw = tip.offsetWidth;
    const below = r.bottom + 12 + th < window.innerHeight;
    const top = below ? r.bottom + 12 : Math.max(8, r.top - 12 - th);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    Object.assign(tip.style, { top: `${top}px`, left: `${left}px` });
  }

  async function show(n, dir = 1) {
    if (closed) return;
    if (n >= steps.length) return end(true);
    if (n < 0) n = 0;
    i = n;
    const st = steps[i];
    hole.style.opacity = '0';
    if (prepare) await prepare(st);
    const el = await waitFor(st.target);
    if (!el) return show(i + dir, dir); // 화면에 없으면(예: 교사고래 모드가 아닐 때) 건너뜀
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const last = i === steps.length - 1;
    tip.replaceChildren(
      h('p', { class: 'tour-step' }, t.stepOf(i + 1, steps.length)),
      h('h3', {}, st.title),
      h('p', {}, st.body),
      h('div', { class: 'tour-actions' },
        h('button', { onclick: () => show(i - 1, -1), disabled: i === 0 }, t.prev),
        h('button', { class: 'primary', onclick: () => show(i + 1, 1), 'data-autofocus': '' }, last ? t.done : t.next),
        h('button', { class: 'quit', onclick: () => end(false) }, t.quit)));
    hole.style.opacity = '1';
    requestAnimationFrame(() => { place(); const b = tip.querySelector('[data-autofocus]'); if (b) b.focus({ preventScroll: true }); });
  }

  function end(done) {
    if (closed) return;
    closed = true;
    root.remove();
    mo.disconnect();
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey, true);
    if (onEnd) onEnd(done);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); end(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1, -1); }
  }
  // 화면이 다시 그려져도(대상이 새 요소로 바뀌어도) 따라가서 비춘다
  let raf = 0;
  const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); });
  const app = document.getElementById('app');
  if (app) mo.observe(app, { childList: true, subtree: true });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  show(0, 1);
  return { end: () => end(false) };
}
