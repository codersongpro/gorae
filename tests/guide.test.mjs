import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOUR_STEPS, SHARE_TOUR_STEPS } from '../extension/ui/guide-steps.js';

test('따라 해보기의 모든 단계는 화면에 실제로 달린 data-tour 표식을 가리킨다', () => {
  const src = readFileSync('extension/ui/views.js', 'utf8');
  for (const st of [...TOUR_STEPS, ...SHARE_TOUR_STEPS]) {
    const key = st.target.match(/"(.+)"/)[1];
    const ok = src.includes(`'data-tour': '${key}'`) || key === 'svc-band' || src.includes('`tab-${k}`') && key.startsWith('tab-');
    assert.ok(ok, `${key} 표식이 없어요`);
    assert.ok(st.title && st.body);
  }
});

import { isReferenceOnly, isRestricted } from '../extension/core/reference.js';
import { createWork } from '../extension/core/work.js';
import { toolInput } from './fixtures.mjs';

test('참고 전용: 학생고래만 막히고 교사고래는 그대로 쓴다', () => {
  const w = { referenceOnly: true };
  assert.equal(isReferenceOnly(w), true);
  assert.equal(isRestricted(w, 'baby'), true);
  assert.equal(isRestricted(w, 'mother'), false);
  assert.equal(isRestricted({}, 'baby'), false);
});

test('참고 전용 설정은 만든 작품에 기록되고, 끄면 기록하지 않는다', () => {
  const base = toolInput({ artifactType: 'html', html: '<p>x</p>', title: 't', howToUse: 'h', author: '별', audience: ['teacher'] });
  assert.equal(createWork({ ...base, referenceOnly: true }).referenceOnly, true);
  assert.equal('referenceOnly' in createWork(base), false);
});

import { ensureDefaultPin, checkPin, setPin } from '../extension/core/pin.js';
import { createMemoryStorage } from '../extension/core/storage.js';

test('임시 기본 암호 1234는 처음 한 번만 들어가고, 직접 정한 암호를 덮지 않는다', async () => {
  const st = createMemoryStorage();
  assert.equal(await ensureDefaultPin(st), true);
  assert.equal((await checkPin(st, '1234')).ok, true);
  assert.equal(await ensureDefaultPin(st), false);
  const st2 = createMemoryStorage();
  await setPin(st2, '5678', '5678');
  assert.equal(await ensureDefaultPin(st2), false);
  assert.equal((await checkPin(st2, '1234')).ok, false);
});

import { flowLabels, buildFlowSteps, recommendForRemote, buildAssignment, totalMinutes } from '../extension/core/flow.js';

test('수업 진행: 세 작품은 도입·활동·정리, 순서는 고른 순서를 따른다', () => {
  assert.deepEqual(flowLabels(3), ['도입', '활동', '정리']);
  assert.deepEqual(flowLabels(4), ['1단계', '2단계', '3단계', '4단계']);
  const recs = ['a', 'b', 'c'].map((id) => ({ id, work: { id, title: id.toUpperCase(), estimatedMinutes: 5, type: 'html', domain: 'lesson', category: 'classroom_tool', subcategory: 'timer', audience: ['teacher'], tags: [] } }));
  const steps = buildFlowSteps(recs, ['c', 'x', 'a']);
  assert.deepEqual(steps.map((s) => [s.id, s.label]), [['c', '도입'], ['a', '활동']]);
  assert.equal(totalMinutes(steps), 10);
});

test('웨일온 추천은 10분 이하 전체·교사용 작품만', () => {
  const mk = (id, min, groupType) => ({ work: { id, title: id, estimatedMinutes: min, groupType, type: 'html', domain: 'lesson', category: 'classroom_tool', subcategory: 'timer', audience: ['teacher'], tags: [] } });
  const got = recommendForRemote([mk('long', 30, 'whole_class'), mk('solo', 5, 'individual'), mk('ok', 5, 'whole_class'), mk('t', 10, 'teacher')]);
  assert.deepEqual(got.map((e) => e.work.id), ['ok', 't']);
});

test('과제 안내문에는 제목·단계·내는 방법이 들어간다', () => {
  const t = buildAssignment({ name: '4학년 3반', works: [{ title: '도입 화면', howToUse: '읽어요', estimatedMinutes: 5 }, { title: '단어 게임', howToUse: '해요', estimatedMinutes: 10 }], teacherNote: '화이팅' });
  assert.match(t, /\[과제\] 4학년 3반/);
  assert.match(t, /도입: 도입 화면/);
  assert.match(t, /활동: 단어 게임/);
  assert.match(t, /약 15분/);
  assert.match(t, /내는 방법/);
});
