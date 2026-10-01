// 주소·한도 설정 (운영 배포 시 이 파일만 고친다)
export const CONFIG = {
  // GitHub Pages 주소 — 배포 전에는 접속이 안 되므로 번들된 샘플로 대신한다
  catalogUrl: 'https://codersongpro.github.io/gorae/catalog.json',
  reviewersUrl: 'https://codersongpro.github.io/gorae/reviewers.json',
  sampleCatalogPath: 'sample/catalog.json',
  sampleReviewersPath: 'sample/reviewers.json',
  fetchTimeoutMs: 4000,
  maxHtmlBytes: 1024 * 1024, // 1MB
};
