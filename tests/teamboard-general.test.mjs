import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShare, buildAssessmentText } from '../extension/core/share.js';
const w={title:'우리 지역 인구 변화',contentType:'presentation',type:'url',url:'https://example.com/report',howToUse:'표를 비교해 변화의 이유를 설명해요.'};
test('팀보드 발표·탐구결과·전시·피드백·개선은 코딩과 리믹스를 전제하지 않는다', () => {
  for(const [template,label] of [['presentation','발표자료'],['learning_result','학습 결과'],['inquiry','탐구 결과'],['exhibition','작품 전시'],['feedback','피드백 요청'],['improvement','개선 아이디어']]) {
    const {text}=buildShare('teamboard',w,{template}); assert.ok(text.includes(label),template); assert.ok(text.includes('팀보드 댓글')); assert.ok(!text.includes('바이브코딩')); assert.ok(!text.includes('리믹스해 보세요'));
  }
  const text=buildAssessmentText(w).text; assert.ok(!text.includes('프롬프트 레시피')); assert.ok(!text.includes('리믹스 여부'));
});
