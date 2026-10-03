import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECTS, findCategory, findSub } from '../shared/taxonomy.js';
test('일반 교육 분류: 전 교과·자기주도·발표·학급·업무를 찾는다', () => {
  for (const s of ['국어','수학','사회','과학','영어','도덕','음악','미술','체육','실과','정보','제2외국어','통합교과','융합·STEAM','기타']) assert.ok(SUBJECTS.includes(s), s);
  for (const [d,c,s] of [['lesson','self_learning','practice'],['lesson','presentation','portfolio'],['work','class_management','event'],['work','research','plc'],['work','automation','survey_analysis']]) assert.ok(findSub(d,c,s), `${d}/${c}/${s}`);
  assert.equal(findCategory('lesson','subject_activity').label, '교과 학습');
});
