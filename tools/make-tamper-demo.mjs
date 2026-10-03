// 시연 E(안전성): 검수된 작품의 코드를 한 줄 바꾼 꾸러미를 만든다. 고래곳간 ＋ → 가져오기로 열면
// 맑은 바다 배지가 사라지고 '얕은 바다' + "서명 뒤 내용이 바뀌었습니다."가 보여야 한다.
// 사용: node tools/make-tamper-demo.mjs [작품 id]  →  output/demo/ 에 원본·변조본 꾸러미 2개
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPack, serializePack } from '../shared/pack.js';

const id = process.argv[2] || 'sample-fraction-pizza';
const catalog = JSON.parse(await readFile(new URL('../site/catalog.json', import.meta.url), 'utf8'));
const work = catalog.items.find((w) => w.id === id);
if (!work || !work.tailprint) throw new Error('검수 서명이 있는 작품 id를 주세요: ' + id);
// 서명은 그대로 두고 작품 내용만 바꾼다 (누군가 파일을 열어 코드를 고친 상황)
const tampered = { ...work, html: work.html.replace(/<title>([^<]*)<\/title>/i, '<title>$1 (몰래 고침)</title>') + '\n<!-- 서명 뒤에 바꾼 줄 -->' };
const out = new URL('../output/demo/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL(`${id}.원본.gorae.json`, out), serializePack(createPack({ name: `${work.title} (원본)`, items: [work] })));
await writeFile(new URL(`${id}.변조.gorae.json`, out), serializePack(createPack({ name: `${work.title} (변조 시연)`, items: [tampered] })));
console.log('output/demo/ 에 원본·변조 꾸러미를 만들었어요:', id);
