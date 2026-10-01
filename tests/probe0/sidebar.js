// 사이드바(확장앱 페이지) 쪽 검사 + sandbox 결과 수신
const out = document.getElementById('out');
const lines = {};
const show = () => { out.textContent = Object.entries(lines).map(([k, v]) => k + ': ' + v).join('\n'); };
lines['② 사이드바 실행'] = '통과 (chrome.runtime.id=' + (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : '없음') + ')';
crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  .then(() => { lines['③ WebCrypto ECDSA(사이드바)'] = '통과'; show(); })
  .catch(e => { lines['③ WebCrypto ECDSA(사이드바)'] = '실패 ' + e; show(); });
window.addEventListener('message', e => {
  if (e.data && e.data.probe) { Object.assign(lines, e.data.results); show(); }
});
show();
