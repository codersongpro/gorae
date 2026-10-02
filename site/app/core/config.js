// 주소·한도 설정 (운영 배포 시 이 파일만 고친다)
export const CONFIG = {
  // GitHub Pages 주소 — 배포 전에는 접속이 안 되므로 번들된 샘플로 대신한다
  catalogUrl: 'https://codersongpro.github.io/gorae/catalog.json',
  reviewersUrl: 'https://codersongpro.github.io/gorae/reviewers.json',
  sampleCatalogPath: 'sample/catalog.json',
  sampleReviewersPath: 'sample/reviewers.json',
  // 바로 실행 뷰어 주소 (GitHub Pages로 site/를 공개한 뒤 확인)
  viewerUrl: 'https://codersongpro.github.io/gorae/viewer.html',
  // 작품 공유(나눔 곳간) 설문·시트는 core/market-config.js에 있다.
  // 물뿜기·고래 노래를 받는 의견 설문: 누르면 자동 제출, 숫자는 아래 응답 시트에서 센다
  feedbackFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScN5ZZHyI8b7widyMS6uFky2y7hFcgFmmTiVQNuDA-jbTHi8w/viewform', // '고래곳간 물뿜기' (로그인 없이 응답)
  // 물뿜기 숫자를 읽을 응답 시트 ('고래곳간 물뿜기' 설문 → 응답 → 스프레드시트 연결 → 링크가 있는 모든 사용자 뷰어)
  spoutSheetId: '1n7ShMAZkcCgxdMfxg7DTTUnZJpjbkHgHhF3_6b-T3Ug', // '고래곳간 물뿜기' 응답 시트
  spoutCsvUrl: '', // (선택) 웹에 게시한 CSV 주소
  feedbackEntry: 'entry.102027181', // 장문형 한 칸: 보고 글을 미리 채워 열면 [제출]만 누르면 된다
  fetchTimeoutMs: 4000,
  maxHtmlBytes: 1024 * 1024, // 1MB
};
