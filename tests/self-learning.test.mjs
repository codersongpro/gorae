import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEntries } from '../extension/core/filter.js';
const entry = (id, extra={}) => ({work:{id,title:'분수의 크기 비교',domain:'lesson',category:'self_learning',subcategory:'practice',schoolLevel:'elementary',grade:'4',subject:'수학',estimatedMinutes:10,groupType:'individual',selfDirected:true,...extra},status:{ok:true,badge:'clear'}});
test('혼자 공부하기와 시간·교과·학년 검색을 함께 적용한다', () => {
  const all=[entry('yes'),entry('teacher',{category:'subject_activity',selfDirected:false}),entry('long',{estimatedMinutes:40}),entry('science',{subject:'과학'})];
  assert.deepEqual(filterEntries(all,{selfDirected:true,grade:'초4',subject:'수학',maxMinutes:10}).map(e=>e.work.id),['yes']);
  assert.deepEqual(filterEntries(all,{query:'초4 수학 분수 10분 혼자 공부하기'}).map(e=>e.work.id),['yes']);
  assert.deepEqual(filterEntries(all,{query:'혼자 공부할 수 있는 과학 활동'}).map(e=>e.work.id),['science']);
  assert.deepEqual(filterEntries(all,{query:'10분 복습 자료'}).map(e=>e.work.id),[]);
});
