// 샘플 목록의 작품으로 바로 실행 링크를 만들어 출력한다 (뷰어 시험용). 사용: node tools/make-demo-link.mjs [id] [뷰어주소]
import { readFile } from 'node:fs/promises';
import { buildViewerLink } from '../shared/link.js';

const id = process.argv[2] || 'sample-fraction-pizza';
const viewer = process.argv[3] || 'http://127.0.0.1:8765/site/viewer.html';
const catalog = JSON.parse(await readFile(new URL('../site/catalog.json', import.meta.url), 'utf8'));
const work = catalog.items.find((w) => w.id === id);
if (!work) throw new Error('작품을 찾을 수 없어요: ' + id);
const r = await buildViewerLink(work, viewer);
console.log(r.ok ? r.url : '링크 불가: ' + r.reason);
