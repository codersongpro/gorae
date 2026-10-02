// 새 탭 실행 화면: 사이드바가 맡겨 둔 작품을 꺼내 sandbox 페이지(격리·외부 통신 차단)에서 실행한다.
// 작품은 확장앱 저장소 안에서만 오가며, 주소에는 실행 번호만 담긴다.
import { takeRunTicket } from './core/runtab.js';
import { createChromeStorage } from './core/storage.js';
import { buildRunMessage, canRun } from './core/runner.js';
import { displayBadge } from './core/trust.js';
import { h } from './ui/dom.js';
import { S } from './ui/strings.js';

const bar = document.getElementById('bar');
const stateEl = document.getElementById('state');
const frame = document.getElementById('frame');

const ticket = await takeRunTicket(createChromeStorage(), location.hash.slice(1));
if (!ticket) {
  stateEl.textContent = S.run.ticketGone;
} else {
  const entry = { work: ticket.work, status: ticket.status };
  const ok = canRun(entry); // 사이드바에서 한 검사를 여기서도 다시 한다
  document.title = `${ticket.work.title} · 고래곳간`;
  if (!ok.ok || ok.kind !== 'html') {
    stateEl.textContent = S.run[ok.reason] || S.run.UNSUPPORTED;
  } else {
    const b = displayBadge(entry);
    bar.replaceChildren(...[
      h('h1', { class: 'run-title' }, (ticket.status && ticket.status.ok ? '🐋 ' : '🫍 ') + ticket.work.title),
      h('span', { class: `badge ${b}` }, S.badge[b]),
      h('span', { class: 'muted' }, S.run.running),
      ticket.work.referenceOnly === true ? h('span', { class: 'ref-band', role: 'note' }, S.reference.runBand) : null,
    ].filter(Boolean));
    // sandbox 페이지가 준비됐다고 알리면 작품을 보낸다 (그 iframe이 보낸 메시지만 받는다)
    window.addEventListener('message', (e) => {
      if (e.source === frame.contentWindow && e.data && e.data.type === 'gorae-sandbox-ready') frame.contentWindow.postMessage(buildRunMessage(ticket.work), '*');
    });
    frame.src = 'sandbox.html';
    frame.hidden = false;
  }
}
