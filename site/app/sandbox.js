// sandbox 페이지: 작품 HTML을 srcdoc iframe(allow-scripts만, allow-same-origin 없음)에서 실행한다.
// 이 페이지는 manifest sandbox + CSP(connect-src 'none')로 확장앱 권한·저장소·외부 통신이 막혀 있다.
const MAX_BYTES = 1024 * 1024;
let frame = null;

// 웹 버전에는 확장앱 manifest의 sandbox 정책이 없으므로, 작품 자신에게도 외부 통신 차단 정책을 직접 건다.
// (확장앱 안에서는 이미 같은 정책이 적용되어 있어 겹쳐도 해가 없다)
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
function withCsp(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + meta + html.slice(head.index + head[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return html.slice(0, doctype[0].length) + meta + html.slice(doctype[0].length);
  return meta + html;
}

window.addEventListener('message', (e) => {
  // 부모(사이드바)가 보낸 메시지만 받는다. 작품 iframe이 보낸 메시지는 무시한다.
  if (e.source !== window.parent) return;
  const msg = e.data;
  if (!msg || msg.type !== 'gorae-run' || typeof msg.html !== 'string') return;
  if (msg.html.length > MAX_BYTES) return;
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('csp', CSP);
  frame.srcdoc = withCsp(msg.html);
  document.body.appendChild(frame);
});

window.parent.postMessage({ type: 'gorae-sandbox-ready' }, '*');
