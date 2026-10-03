import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWork } from '../shared/taxonomy.js';
import { createWork, validateNewWork } from '../extension/core/work.js';
import { editInput, remixInput } from '../extension/core/remix.js';
import { createPack, parsePack } from '../shared/pack.js';
import { buildClassificationText, parseClassificationText } from '../shared/market.js';
import { toolInput } from './fixtures.mjs';
test('교육 용도와 실행 형태를 별도로 저장하고 수정·꾸러미·폼에서도 보존한다', () => {
  const input = toolInput({ contentType: 'presentation', artifactType: 'link', url:'https://example.com/slides', creationMethod:['student_created'], learningMode:'self_directed', selfDirected:true, difficulty:'normal' });
  assert.equal(validateNewWork(input).ok, true);
  const w = createWork(input);
  assert.equal(w.type,'url');
  for (const v of [normalizeWork(w), editInput(w), remixInput(w), parsePack(createPack({items:[w],bundleType:'project'})).pack.items[0], parseClassificationText(buildClassificationText(w)).meta]) {
    assert.equal(v.contentType,'presentation'); assert.equal(v.artifactType,'link'); assert.equal(v.selfDirected,true); assert.equal(v.difficulty,'normal'); assert.deepEqual(v.creationMethod,['student_created']);
  }
  assert.equal(createPack({items:[w],bundleType:'project'}).bundleType,'project');
});
test('normalize는 서명된 예전 자료를 변경하지 않고 용도를 추론한다', () => {
  const old=Object.freeze({type:'html',grade:'초4',subject:'수학',category:'subject_activity',tailprint:{sig:'unchanged'}});
  assert.equal(normalizeWork(old).contentType,'interactive_activity');
  assert.equal(normalizeWork(old).gradeLabel,'초4');
  assert.equal(old.contentType,undefined);
  assert.equal(validateNewWork(toolInput({contentType:'invalid'})).ok,false);
});
