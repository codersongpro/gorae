// 작품 고래 아이콘(SVG): 검수된 작품은 물을 뿜는 파란 고래 + 확인 표시, 검수 전 작품은 점선 윤곽만 있는 회색 고래.
// 이모지는 기기마다 모양이 달라 헷갈려서, 두 가지 그림만 쓴다. 색은 CSS(currentColor)로 입힌다.
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

const BODY = 'M2 19c0-5.5 5.2-10 12-10 4.6 0 8.2 2 10.3 4.8L30 11l-1.2 7.2c.2.4.2.9 0 1.3L30 27l-5.6-3.4C22 25.4 18.4 27 14 27 7.2 27 2 24 2 19z';

// verified: true → 검수됨, false → 검수 전
export function whaleIcon(verified, label) {
  const svg = el('svg', { viewBox: '0 0 32 32', class: `wi ${verified ? 'ok' : 'no'}`, role: 'img', 'aria-label': label, focusable: 'false' });
  if (verified) {
    svg.append(el('path', { d: BODY, fill: 'currentColor' }));
    svg.append(el('path', { d: 'M13 7.5V4M9.5 5.5 11 7M16.5 5.5 15 7', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round' }));
    svg.append(el('circle', { cx: '9', cy: '17', r: '1.4', fill: '#fff' }));
    svg.append(el('circle', { cx: '25', cy: '24', r: '6', class: 'wi-badge' }));
    svg.append(el('path', { d: 'M22.2 24.2l2 2 3.6-3.8', fill: 'none', stroke: '#fff', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  } else {
    svg.append(el('path', { d: BODY, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-dasharray': '3 2.4', 'stroke-linejoin': 'round' }));
    svg.append(el('circle', { cx: '9', cy: '17', r: '1.4', fill: 'currentColor' }));
  }
  return svg;
}
