// 따라 해보기 단계 — target은 화면 요소의 data-tour 값. tab은 그 단계를 보여 줄 곳간 탭.
const step = (target, tab, title, body) => ({ target: `[data-tour="${target}"]`, tab, title, body });

export const TOUR_STEPS = [
  step('tab-catalog', 'catalog', '공유 곳간', '인증 곳간(검수 완료)과 나눔 곳간(검수 전)을 오가요. 처음엔 인증 곳간에서 골라 보세요.'),
  step('find', 'catalog', '작품 찾기', '검색어나 학교급·분류로 좁혀요. 더 자세한 조건은 [필터]에 있어요.'),
  step('badge', 'catalog', '배지와 고래 픽', '맑은 바다는 검수 완료, ★ 고래 픽은 특히 추천하는 작품이에요.'),
  step('spout', 'catalog', '물뿜기', '마음에 들면 🐋를 눌러 응원해요. 다시 누르면 취소돼요.'),
  step('details', 'catalog', '제목의 ▶ (자세히)', '▶를 누르면 설명과 사용 방법이 펼쳐져요. 리믹스·공유는 ⋯ 메뉴에 있어요.'),
  step('run', 'catalog', '실행', '별도 창에서 격리해 실행해요.'),
  step('seg-market', 'market', '나눔 곳간', '누구나 올린 검수 전 작품이에요. 미리 보기로 먼저 열어 보세요.'),
  step('tab-mypod', 'mypod', '내 곳간', '내 기기에만 저장돼요. 작품을 체크하면 [공유·꾸러미] 바가 떠요.'),
  step('create', 'catalog', '추가 (만들기·가져오기)', '＋에서 작품을 만들거나 꾸러미·링크를 가져와요.'),
  step('mode', 'catalog', '교사고래 모드', '암호를 넣어 교사고래로 바꿔요. 학생 앞에서는 꺼 두세요.'),
  step('guide', 'catalog', '사용 방법', '설명과 따라 해보기를 다시 볼 수 있어요.'),
];

// 웨일 사이드바 설치 따라 해보기 — 사용 방법 화면의 설치 목록(inst-1~5)을 한 단계씩 짚는다
const inst = (n, title, body) => ({ target: `[data-tour="inst-${n}"]`, screen: 'guide', title, body });
export const INSTALL_TOUR_STEPS = [
  inst(1, '1. 파일 내려받기', '[확장앱 ZIP 받기]로 받아 압축을 풀어요.'),
  inst(2, '2. 확장 프로그램 관리 열기', '[주소 복사] 후 웨일 주소창에 붙여 넣어요.'),
  inst(3, '3. 개발자 모드 켜기', '[개발자 모드]를 켜요.'),
  inst(4, '4. 폴더 불러오기', '[압축해제된 확장 프로그램을 로드합니다]로 extension 폴더를 골라요.'),
  inst(5, '5. 사이드바에서 열기', '사이드바의 고래 아이콘을 누르면 끝!'),
];
