// 시연용 샘플 작품 배치 — 큰 곳간(검수됨) · 나눔 곳간(모두가 올린, 미검수) · 내 곳간(처음 실행 때 담김) · 학급 꾸러미(내 곳간 샘플을 미리 선택)
// tools/build-sample.mjs가 같은 폴더의 .html을 읽어 site/catalog.json, extension/sample/*.json을 만든다.
const lesson = (o) => ({ type: 'html', artifactType: 'html', domain: 'lesson', version: 1, ...o });

// 큰 곳간에 더할 작품 (검수 서명: badge)
export const catalogExtras = [
  lesson({
    file: 'clock.html', id: 'sample-clock', title: '시계 읽기 연습', category: 'subject_activity', subcategory: 'practice', badge: 'clear',
    schoolLevel: 'elementary', grade: '2', subject: '수학', area: '측정', unit: '시각과 시간', topic: '몇 시 몇 분 읽기', standard: '[2수03-03]',
    estimatedMinutes: 10, groupType: 'individual', audience: ['student'], tags: ['연습', '퀴즈', '개별활동'],
    description: '바늘 시계를 보고 몇 시 몇 분인지 고르는 연습이에요.', howToUse: '시계를 보고 알맞은 시각을 누르세요. 맞히면 다음 문제가 나와요.',
    author: '숲속 고래 · 초등', promptRecipe: '2학년 시각 읽기 연습 앱을 만들어 줘. SVG 아날로그 시계, 5분 단위 무작위 문제, 4지선다, 점수.',
    addedAt: '2026-09-29T00:00:00Z',
  }),
  lesson({
    file: 'word-match.html', id: 'sample-word-match', title: '영어 단어 짝 맞추기', category: 'subject_activity', subcategory: 'game', badge: 'clear',
    schoolLevel: 'elementary', grade: '5', subject: '영어', topic: '생활 속 낱말', estimatedMinutes: 10, groupType: 'pair',
    audience: ['student'], tags: ['게임', '모둠활동'],
    description: '영어 단어와 우리말 뜻 카드를 뒤집어 짝을 찾아요.', howToUse: '카드 두 장을 차례로 눌러 짝을 맞춰요. 짝과 번갈아 해도 좋아요.',
    author: '별빛 고래 · 초등', promptRecipe: '영어 단어와 뜻을 짝 맞추는 메모리 카드 게임을 만들어 줘. 8쌍, 시도 횟수 표시.',
    addedAt: '2026-09-28T00:00:00Z',
  }),
  {
    file: 'minutes.html', id: 'sample-minutes', title: '회의록 정리기', type: 'html', artifactType: 'html', domain: 'work', category: 'admin', subcategory: 'minutes', badge: 'shallow',
    audience: ['teacher'], tags: ['문서작성', '업무경감'], version: 1,
    description: '회의 메모를 붙여 넣으면 논의·결정·할 일로 나눠 정리해요.', howToUse: '메모를 한 줄씩 적고 "결정:" "할 일:"로 시작하면 따로 모아요. [정리하기]를 누르세요.',
    author: '물결 고래 · 중등', promptRecipe: '회의 메모를 논의/결정/할 일로 나눠 회의록 형식으로 정리하는 도구를 만들어 줘. 외부 전송 없이.',
    addedAt: '2026-09-15T00:00:00Z',
  },
];

// 나눔 곳간 샘플 (시트 목록과 함께 보이는 앱 안 샘플, 미검수)
export const marketSamples = [
  { file: 'typing.html', nickname: '키보드 고래', whale: '교사고래', kinds: ['수업자료'], timestamp: '2026. 10. 1',
    work: lesson({ id: 'share-typing', title: '한 줄 타자 연습', category: 'subject_activity', subcategory: 'practice', schoolLevel: 'elementary', grade: '4', subject: '정보', topic: '바른 타자 습관',
      estimatedMinutes: 10, groupType: 'individual', audience: ['student'], tags: ['연습', '코딩'], description: '문장을 따라 치면 정확도와 분당 타수를 알려 줘요.',
      howToUse: '위 문장을 따라 치고 엔터를 누르세요.', promptRecipe: '한 줄 문장을 따라 치면 정확도와 분당 타수를 보여 주는 타자 연습 앱을 만들어 줘.', addedAt: '2026-10-01T00:00:00Z' }) },
  { file: 'mood.html', nickname: '햇살 고래', whale: '교사고래', kinds: ['학생관리'], timestamp: '2026. 9. 30',
    work: lesson({ id: 'share-mood', title: '오늘의 마음 날씨', category: 'creative', subcategory: 'life', estimatedMinutes: 5, groupType: 'whole_class', audience: ['teacher', 'student'],
      tags: ['생활교육', '전체활동'], description: '아침 조회 때 마음을 날씨로 고르면 반 전체 날씨가 모여요. 이름은 남지 않아요.',
      howToUse: '학생이 차례로 나와 날씨를 눌러요.', promptRecipe: '아침 감정 체크인을 날씨 이모지로 고르고 모아 보는 화면을 만들어 줘. 이름 저장 없이.', addedAt: '2026-09-30T00:00:00Z' }) },
  { file: 'bingo.html', nickname: '파란 고래', whale: '학생고래', kinds: ['수업자료'], timestamp: '2026. 9. 29',
    work: lesson({ id: 'share-bingo', title: '곱셈 빙고', category: 'subject_activity', subcategory: 'game', schoolLevel: 'elementary', grade: '3', subject: '수학', topic: '곱셈구구',
      estimatedMinutes: 10, groupType: 'individual', audience: ['student'], tags: ['게임', '퀴즈'], description: '문제의 답을 빙고판에서 찾아 한 줄을 채우면 빙고!',
      howToUse: '위 곱셈 문제의 답을 빙고판에서 찾아 누르세요.', promptRecipe: '곱셈구구 답을 4x4 빙고판에서 찾는 게임을 만들어 줘.', addedAt: '2026-09-29T00:00:00Z' }) },
];

// 내 곳간 샘플 (처음 실행 때 한 번 담김, 직접 만든 작품처럼)
export const mypodSamples = [
  { file: 'intro-card.html', work: lesson({ id: 'my-sample-intro', title: '나를 소개하는 카드', category: 'creative', subcategory: 'autonomy', schoolLevel: 'elementary', grade: '6', subject: '국어', topic: '자기소개',
      estimatedMinutes: 20, groupType: 'individual', audience: ['student'], tags: ['발표', '개별활동'], description: '별명·좋아하는 것·꿈으로 나만의 소개 카드를 만들어요.',
      howToUse: '얼굴을 눌러 바꾸고 글을 고쳐 카드를 완성해요.', author: '파도타는 고래 · 초등', promptRecipe: '자기소개 카드를 만들어 줘. 이모지 얼굴 바꾸기, 좋아하는 것·꿈·한마디 칸. 실명 대신 별명.', addedAt: '2026-09-26T00:00:00Z' }) },
  { file: 'roulette.html', work: lesson({ id: 'my-sample-roulette', title: '발표자 룰렛', category: 'classroom_tool', subcategory: 'random_order', estimatedMinutes: 5, groupType: 'whole_class', audience: ['teacher'],
      tags: ['랜덤', '발표'], description: '럭키드로우를 리믹스해서 돌림판으로 발표자를 정해요.', howToUse: '칸을 적고 [돌리기!]를 누르세요.', author: '노을 고래 · 초등',
      promptRecipe: '교실용 랜덤 뽑기 도구를 만들어 줘. … (럭키드로우 레시피에서) 결과를 돌림판 애니메이션으로 바꿔 줘.', remixOf: 'tool-lucky-draw', remixOfTitle: '럭키드로우', version: 2, addedAt: '2026-09-27T00:00:00Z' }) },
  { file: 'dictation.html', work: lesson({ id: 'my-sample-dictation', title: '받아쓰기 연습장', category: 'subject_activity', subcategory: 'practice', schoolLevel: 'elementary', grade: '2', subject: '국어', topic: '받아쓰기',
      estimatedMinutes: 10, groupType: 'individual', audience: ['student'], tags: ['연습', '개별활동'], description: '선생님이 읽어 준 문장을 받아쓰면 틀린 글자를 보여 줘요.',
      howToUse: '받아 쓴 뒤 [확인]을 누르세요.', author: '노을 고래 · 초등', promptRecipe: '받아쓰기 연습 앱을 만들어 줘. 정답 문장과 비교해 틀린 글자를 빨갛게 표시.', addedAt: '2026-09-28T00:00:00Z' }) },
];

export const CLASS_SAMPLE_NAME = '2학년 국어·수학 시간 (샘플)';
