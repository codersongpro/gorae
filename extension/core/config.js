// 주소·한도 설정 (운영 배포 시 이 파일만 고친다)
export const CONFIG = {
  // GitHub Pages 주소 — 배포 전에는 접속이 안 되므로 번들된 샘플로 대신한다
  catalogUrl: 'https://codersongpro.github.io/gorae/catalog.json',
  reviewersUrl: 'https://codersongpro.github.io/gorae/reviewers.json',
  sampleCatalogPath: 'sample/catalog.json',
  sampleReviewersPath: 'sample/reviewers.json',
  // 바로 실행 뷰어 주소 (GitHub Pages로 site/를 공개한 뒤 확인)
  viewerUrl: 'https://codersongpro.github.io/gorae/viewer.html',
  fetchTimeoutMs: 4000,
  maxHtmlBytes: 1024 * 1024, // 1MB
};
