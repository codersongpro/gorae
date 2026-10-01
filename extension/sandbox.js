// sandbox 페이지: 작품 HTML을 srcdoc iframe(allow-scripts만, allow-same-origin 없음)에서 실행한다.
// 이 페이지는 manifest sandbox + CSP(connect-src 'none')로 확장앱 권한·저장소·외부 통신이 막혀 있다.
const MAX_BYTES = 1024 * 1024;
let frame = null;

window.addEventListener('message', (e) => {
  // 부모(사이드바)가 보낸 메시지만 받는다. 작품 iframe이 보낸 메시지는 무시한다.
  if (e.source !== window.parent) return;
  const msg = e.data;
  if (!msg || msg.type !== 'gorae-run' || typeof msg.html !== 'string') return;
  if (msg.html.length > MAX_BYTES) return;
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.srcdoc = msg.html;
  document.body.appendChild(frame);
});

window.parent.postMessage({ type: 'gorae-sandbox-ready' }, '*');
