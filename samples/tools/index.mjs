// 고래곳간 기본 수업도구 — 개인정보·외부 통신·저장소 없이 격리 실행에서 바로 동작하도록 만든 HTML 작품들
// tools/build-sample.mjs가 이 목록과 같은 폴더의 .html 파일을 읽어 큰 곳간 목록에 넣고 검수 서명을 찍는다.
const base = {
  type: 'html',
  artifactType: 'html',
  domain: 'lesson',
  category: 'classroom_tool',
  author: '고래곳간 · 기본 도구',
  version: 1,
  addedAt: '2026-10-01T03:00:00Z',
};

export const tools = [
  {
    file: 'lucky-draw.html', id: 'tool-lucky-draw', title: '럭키 뽑기', subcategory: 'lucky_draw',
    audience: ['teacher'], groupType: 'whole_class', estimatedMinutes: 5, tags: ['랜덤', '뽑기', '전체활동'],
    description: '목록에서 무작위로 뽑아요. 뽑힌 항목 빼기, 여러 개 한 번에 뽑기가 돼요.',
    howToUse: '번호나 별명을 한 줄에 하나씩 적고 [뽑기!]를 누르세요. 전자칠판에 띄우면 크게 보여요.',
    promptRecipe: '교실용 랜덤 뽑기 도구를 만들어 줘. 목록은 한 줄에 하나, 뽑힌 항목 제외 옵션, 여러 개 뽑기, 결과를 크게 보여 주는 애니메이션. 외부 통신과 저장소는 쓰지 마.',
  },
  {
    file: 'groups.html', id: 'tool-groups', title: '모둠 편성기', subcategory: 'seating',
    audience: ['teacher'], groupType: 'group', estimatedMinutes: 5, tags: ['모둠활동', '랜덤', '자리배치'],
    description: '모둠 수나 모둠당 인원을 정하면 고르게 무작위로 나눠 줘요.',
    howToUse: '번호나 별명을 적고 모둠 수(또는 인원)를 정한 뒤 [편성하기]를 누르세요. 다시 누르면 새로 섞여요.',
    promptRecipe: '목록을 받아 모둠 수 또는 모둠당 인원 기준으로 고르게 무작위 편성하는 도구를 만들어 줘. 결과는 모둠 카드로 보여 줘.',
  },
  {
    file: 'order.html', id: 'tool-order', title: '발표 순서 정하기', subcategory: 'random_order',
    audience: ['teacher'], groupType: 'whole_class', estimatedMinutes: 5, tags: ['발표', '랜덤', '전체활동'],
    description: '발표 순서를 섞고, [다음]을 누를 때마다 지금 발표할 차례를 크게 보여 줘요.',
    howToUse: '모둠이나 번호를 적고 [순서 섞기] → [다음 발표!]를 누르세요.',
    promptRecipe: '발표 순서를 무작위로 섞고 다음 버튼으로 현재 발표자를 크게 보여 주는 도구를 만들어 줘. 끝난 순서는 회색으로.',
  },
  {
    file: 'scoreboard.html', id: 'tool-scoreboard', title: '모둠 점수판', subcategory: 'scoreboard',
    audience: ['teacher'], groupType: 'group', estimatedMinutes: 45, tags: ['점수', '보상', '모둠활동', '게임'],
    description: '모둠별 점수를 크게 보여 주고, 1등 모둠을 표시해요.',
    howToUse: '모둠 수를 정하고 [점수판 만들기]. 모둠 이름을 눌러 바꿀 수 있고 +1·+5·−1 버튼으로 점수를 줘요.',
    promptRecipe: '모둠 수를 정하면 점수 카드가 생기는 점수판을 만들어 줘. +1, +5, −1 버튼, 모둠 이름 수정, 1등 강조.',
  },
  {
    file: 'signal.html', id: 'tool-signal', title: '집중 신호등', subcategory: 'noise',
    audience: ['teacher'], groupType: 'whole_class', estimatedMinutes: 45, tags: ['집중', '생활지도', '전체활동'],
    description: '초록·노랑·빨강 화면으로 지금 말할 수 있는 크기를 알려 줘요. 마이크는 쓰지 않아요.',
    howToUse: '버튼(또는 키보드 1·2·3)으로 색을 바꾸세요. 안내 문구를 직접 적을 수도 있어요.',
    promptRecipe: '교실 소음 관리용 신호등 화면을 만들어 줘. 초록/노랑/빨강 버튼과 1,2,3 단축키, 큰 안내 문구, 문구 직접 입력.',
  },
  {
    file: 'vote.html', id: 'tool-vote', title: '찬반 의견 모으기', subcategory: 'opinion',
    audience: ['teacher', 'student'], groupType: 'whole_class', estimatedMinutes: 10, tags: ['토론', '투표', '전체활동'],
    description: '질문을 띄우고 찬성·반대·모르겠어요를 눌러 바로 결과 막대로 보여 줘요. 결과 가리기도 돼요.',
    howToUse: '질문을 고쳐 쓰고, 학생이 나와서 버튼을 누르거나 손든 수를 교사가 눌러 세요.',
    promptRecipe: '토론 수업용 찬반 투표판을 만들어 줘. 질문 입력, 찬성/반대/모르겠어요 큰 버튼, 비율 막대, 한 표 취소, 결과 가리기.',
  },
  {
    file: 'ox-quiz.html', id: 'tool-ox-quiz', title: 'OX 퀴즈 판', subcategory: 'quiz_game',
    audience: ['teacher'], groupType: 'whole_class', estimatedMinutes: 10, tags: ['퀴즈', '게임', '형성평가'],
    description: '문제를 한 장씩 크게 보여 주고 정답(⭕/❌)을 공개해요.',
    howToUse: '[문제 바꾸기]에서 "문제 | O" 형식으로 적고 [문제 적용]. 학생이 O·X를 고르면 [정답 보기]를 누르세요.',
    promptRecipe: '전자칠판용 OX 퀴즈 판을 만들어 줘. "문제 | O" 형식으로 문제 입력, 이전/다음, 정답 공개.',
  },
].map((t) => ({ ...base, ...t }));
