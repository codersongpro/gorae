import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const src=(await readFile('site/viewer.js','utf8')).replace(/^import .*;\r?\n/gm,'').replace('main();','globalThis.done = main();');
async function view(search,st) {
  class Node { constructor(tag='div'){this.tag=tag;this.children=[];} setAttribute(k,v){this[k]=v;} addEventListener(){} append(n){this.children.push(n);} replaceChildren(...n){this.children=n;} }
  const nodes=Object.fromEntries(['status','tagline','info','stage'].map(id=>[id,new Node()]));
  const work={id:'x',title:'x',type:'html',html:'<p>x</p>'};
  const context=vm.createContext({Node,URL,console,location:{search,hash:'#g1.x'},document:{getElementById:id=>nodes[id],createElement:t=>new Node(t),createTextNode:t=>String(t)},localStorage:{getItem:()=>0,setItem:()=>{}},fetch:async()=>({ok:true,json:async()=>({})}),readViewerQuery:()=>search?'x':null,readCatalogWork:()=>({ok:true,work}),readViewerFragment:async()=>({ok:true,work}),createVerifier:async()=>({listResult:{ok:true,version:1},verify:async()=>st}),ROOT_PUBLIC_JWK:{},normalizeWork:()=>({path:[],tags:[]}),S:{tagline:'x',badge:{clear:'clear',shallow:'shallow'},reason:{},run:{WHIRLPOOL:'blocked',running:'run'},detail:{howTo:'use'},tailprintOk:()=>''}});
  vm.runInContext(src,context); await context.done; return nodes;
}
test('인증 짧은 링크: 모든 검수 실패는 실행 버튼 없이 차단', async () => {
  for(const reason of ['CONTENT_CHANGED','LIST_INVALID','REVIEWER_REVOKED','NO_TAILPRINT','BAD_SIGNATURE']) {
    const n=await view('?id=x',{ok:false,reason}); assert.ok(!n.stage.children.some(c=>c.tag==='button'),reason);
  }
  const n=await view('?id=x',{ok:true,badge:'whirlpool',reviewer:{nickname:'x'}}); assert.ok(!n.stage.children.some(c=>c.tag==='button'));
});
test('개인 g1 링크는 기존 미검수 경고와 실행 정책을 유지',async()=>{const n=await view('',{ok:false,reason:'NO_TAILPRINT'});assert.ok(n.stage.children.some(c=>c.tag==='button'));});
