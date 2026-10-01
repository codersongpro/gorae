// sandbox 페이지 안에서 격리·CSP·WebCrypto 검사 후 부모에 보고
const r = {};
r['④ sandbox 페이지 로드'] = '통과';
r['⑤ chrome.* 접근'] = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) ? '실패(접근됨)' : '통과(차단)';
try { document.cookie; r['⑥ document.cookie'] = '실패(읽힘)'; } catch (e) { r['⑥ document.cookie'] = '통과(차단)'; }
try { parent.document.title; r['⑦ parent.document'] = '실패(접근됨)'; } catch (e) { r['⑦ parent.document'] = '통과(차단)'; }
const tasks = [];
tasks.push(fetch('https://example.com/', { mode: 'no-cors' })
  .then(() => { r['⑧ 외부 fetch'] = '실패(나갔음)'; })
  .catch(() => { r['⑧ 외부 fetch'] = '통과(CSP 차단)'; }));
tasks.push(crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  .then(() => { r['⑨ WebCrypto ECDSA(sandbox)'] = '통과'; })
  .catch(e => { r['⑨ WebCrypto ECDSA(sandbox)'] = '실패 ' + e; }));
// 작품용 srcdoc iframe 동작 확인
tasks.push(new Promise(res => {
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.srcdoc = '<script>parent.postMessage("srcdoc-ok","*")<\/script>';
  const t = setTimeout(() => { r['⑩ srcdoc iframe 실행'] = '실패(응답 없음)'; res(); }, 1500);
  window.addEventListener('message', e => { if (e.data === 'srcdoc-ok') { clearTimeout(t); r['⑩ srcdoc iframe 실행'] = '통과'; res(); } });
  document.body.appendChild(f);
}));
Promise.all(tasks).then(() => parent.postMessage({ probe: 1, results: r }, '*'));
