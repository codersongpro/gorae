// 나눔 곳간 운영 설정 — 구글 폼·시트를 만든 뒤 이 파일만 고친다 (docs/google-form.md 참고)
export const MARKET = {
  // 응답 시트 ID: 시트 주소의 /d/ 와 /edit 사이 값. 시트는 '링크가 있는 모든 사용자 - 뷰어'로 공유
  sheetId: '',
  // (선택) 파일 → 공유 → 웹에 게시 → CSV 로 받은 주소. 있으면 이것을 먼저 쓴다
  publishedCsvUrl: '',
  // 구글 폼 응답 주소 (https://docs.google.com/forms/d/e/.../viewform)
  formUrl: '',
  // 폼 ⋮ → '미리 채워진 링크 받기'에서 확인한 질문별 entry 번호
  entry: {
    whale: '', // 어떤 고래이신가요? (학생고래/교사고래)
    nickname: '', // 닉네임
    title: '', // 앱 제목
    description: '', // 설명
    category: '', // 분류
    address: '', // 웹앱 주소 (웹앱·EXE)
    comment: '', // 한 마디
  },
  fetchTimeoutMs: 15000,
  maxFileBytes: 2 * 1024 * 1024, // 내려받는 파일 상한 (작품 HTML은 1MB 이하)
};

export const marketReady = (m = MARKET) => !!(m.sheetId || m.publishedCsvUrl);
export const shareReady = (m = MARKET) => /^https:\/\/docs\.google\.com\/forms\//.test(m.formUrl);
