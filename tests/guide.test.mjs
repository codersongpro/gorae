import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOUR_STEPS } from '../extension/ui/guide-steps.js';

test('따라 해보기의 모든 단계는 화면에 실제로 달린 data-tour 표식을 가리킨다', () => {
  const src = readFileSync('extension/ui/views.js', 'utf8');
  for (const st of TOUR_STEPS) {
    const key = st.target.match(/"(.+)"/)[1];
    const ok = src.includes(`'data-tour': '${key}'`) || src.includes('`tab-${k}`') && key.startsWith('tab-');
    assert.ok(ok, `${key} 표식이 없어요`);
    assert.ok(st.title && st.body);
  }
});
