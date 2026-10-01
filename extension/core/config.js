// 주소·한도 설정 (운영 배포 시 이 파일만 고친다)
export const CONFIG = {
  // GitHub Pages 주소 — 배포 전에는 접속이 안 되므로 번들된 샘플로 대신한다
  catalogUrl: 'https://codersongpro.github.io/gorae/catalog.json',
  reviewersUrl: 'https://codersongpro.github.io/gorae/reviewers.json',
  sampleCatalogPath: 'sample/catalog.json',
  sampleReviewersPath: 'sample/reviewers.json',
  // 바로 실행 뷰어 주소 (GitHub Pages로 site/를 공개한 뒤 확인)
  viewerUrl: 'https://codersongpro.github.io/gorae/viewer.html',
  // 작품 공유 설문(구글 설문) 주소. 설문을 만든 뒤 https 주소를 넣는다. (네이버 폼은 파일 업로드 제한으로 쓰지 않음)
  formUrl: '',
  // 고래 노래·물뿜기를 받는 의견 설문 (아직 없음 — 만들면 https 주소를 넣는다)
  feedbackFormUrl: '',
  fetchTimeoutMs: 4000,
  maxHtmlBytes: 1024 * 1024, // 1MB
};
