import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShare } from '../extension/core/share.js';
const w={title:'우리 지역 조사',subject:'사회',grade:'초6',type:'html',howToUse:'자료 두 개를 비교하고 근거를 적어요.',selfDirected:true};
test('클래스에 수업·자기주도·일반 과제·발표·동료평가 안내를 만든다', () => {
  for (const [template,part] of [['lesson','학습활동'],['self_learning','자기주도학습'],['assignment','과제'],['presentation','발표'],['peer','동료평가']]) {
    const {text}=buildShare('class',w,{template});
    assert.ok(text.includes(part),template); assert.ok(text.includes(w.howToUse)); assert.ok(!text.includes('바이브코딩')); assert.ok(text.includes('검수되지 않은'));
  }
  assert.ok(buildShare('class',w,{template:'self_learning'}).text.includes('다시 공부하고 싶은 부분'));
});
