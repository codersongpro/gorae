import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
async function activity(file) {
  const html=await readFile(new URL('../samples/more/'+file,import.meta.url),'utf8');
  class El {
    constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.textContent='';this.disabled=false;this.hidden=false;}
    set textContent(value){this._text=value;this.children=[];}
    get textContent(){return this._text;}
    append(...xs){this.children.push(...xs);if(this.tag==='select'&&this.children.length===1&&xs[0])this.value=String(xs[0].value);}
    replaceChildren(...xs){this.children=[];this.append(...xs);}
    setAttribute(k,v){this[k]=v;}
    click(){if(!this.disabled)this.onclick?.();}
    set innerHTML(v){this.markup=v;this.children=[];}
  }
  const nodes={};
  for(const m of html.matchAll(/<(input|textarea|select|button|div|p|h2|svg|tbody|progress)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const el=nodes[m[3]]=new El(m[1]);el.value=/\bvalue="([^"]*)"/.exec(m[2])?.[1]||'';el.disabled=/\bdisabled\b/.test(m[2]);el.hidden=/\bhidden\b/.test(m[2]);
    if(m[1]==='select'){const end=html.indexOf('</select>',m.index);const options=html.slice(m.index,end);el.value=/<option[^>]*selected[^>]*>([^<]+)/.exec(options)?.[1]||/<option[^>]*value="([^"]*)"/.exec(options)?.[1]||/<option[^>]*>([^<]+)/.exec(options)?.[1]||'';}
    if(m[1]==='textarea')el.value=html.slice(m.index+m[0].length,html.indexOf('</textarea>',m.index));
  }
  const context=vm.createContext({document:{getElementById:id=>nodes[id],createElement:t=>new El(t),createTextNode:t=>String(t),body:{classList:{add(){},remove(){}}}},console});
  for(const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(s[1],context);
  return nodes;
}
test('분수: 오답 해설은 다음 문제 전 유지되며 중복 정답 집계 없이 재학습한다',async()=>{
 const n=await activity('fraction.html');n.answers.children[2].click();assert.match(n.feedback.textContent,/정답은 </);assert.match(n.question.textContent,/1 \/ 6/);n.answers.children[0].click();assert.match(n.score.textContent,/처음 정답 0\/6/);
 const answers=[2,2,2,1,0];for(const a of answers){n.next.click();n.answers.children[a].click();}n.next.click();assert.equal(n.retry.hidden,false);n.retry.click();assert.match(n.question.textContent,/1 \/ 1/);n.answers.children[0].click();n.next.click();assert.match(n.score.textContent,/다시 볼 문제 0개/);
});
test('구구단: 빈 답은 진행되지 않고 오답의 반복 덧셈 해설을 유지한다',async()=>{
 const n=await activity('times.html');n.check.click();assert.match(n.feedback.textContent,/먼저 입력/);assert.equal(n.next.disabled,true);
 n.answer.value='-1';n.check.click();assert.match(n.feedback.textContent,/정답은/);assert.ok(n.feedback.textContent.includes(' + '));assert.match(n.q.textContent,/1\/10/);
});
test('물의 상태: 경계 온도에서 단일 상태로 단정하지 않으며 관찰 기록을 지울 수 있다',async()=>{
 const n=await activity('water-states.html');n.temp.value='0';n.temp.oninput();assert.match(n.state.textContent,/공존/);n.record.click();assert.equal(n.records.children.length,1);n.clear.click();assert.equal(n.records.children.length,0);
});
test('CSV: 따옴표·쉼표·줄바꿈·빈칸 처리와 잘못된 입력 후 이전 결과 제거',async()=>{
 const n=await activity('csv-summary.html');n.csv.value='문항,의견\n찬성,"좋아요, 네"\n찬성,"두\n줄"\n반대,\n,없음';n.parse.click();assert.match(n.result.value,/총 응답 4건/);assert.match(n.result.value,/찬성\t2\t50.0%/);assert.match(n.result.value,/\(빈칸\)\t1/);
 n.csv.value='문항,의견\n찬성,"닫히지 않음';n.parse.click();assert.match(n.message.textContent,/따옴표/);assert.equal(n.result.value,'');assert.equal(n.summary.children.length,0);
});
test('인구 자료: 중복 연도는 거부하고 가상 데이터 변화량을 계산한다',async()=>{
 const n=await activity('population.html');assert.match(n.finding.textContent,/400명 감소/);n.data.value='2020,100\n2020,200';n.draw.click();assert.match(n.error.textContent,/중복/);assert.equal(n.rows.children.length,0);
});
test('공문: 관련 문서의 과거 날짜를 업무 기한으로 추출하지 않고 직접 보완·대조한다',async()=>{
 const n=await activity('admin-doctasks.html');assert.ok(!n.result.value.includes('학교안전과-1234'));assert.match(n.result.value,/2026. 10. 15.\(목\)/);assert.match(n.result.value,/원문 대조: 미확인/);
 const before=n.out.children.length;n.add.click();assert.equal(n.out.children.length,before+1);
 const row=n.out.children.at(-1);row.children[1].children[0].value='누락된 결과표 확인';row.children[1].children[0].oninput();assert.match(n.result.value,/누락된 결과표 확인/);
 const checked=row.children[4].children[0];checked.checked=true;checked.onchange();assert.match(n.result.value,/원문 대조: 완료/);
});
