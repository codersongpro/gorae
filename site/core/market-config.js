// 나눔 곳간 운영 설정 — 구글 폼·시트를 만든 뒤 이 파일만 고친다 (docs/google-form.md 참고)
export const MARKET = {
  // 원응답은 비공개. 운영자 확인을 거친 별도 공개목록 CSV만 연결한다.
  environment: 'production',
  allowRawSheetFallback: false,
  // 고정된 나눔 곳간 파일 ID. 운영에서는 이 ID로 원응답을 직접 요청하지 않는다.
  sheetId: '1sHBcqZcP4cSFyzTUqC1Gj_QK7feCrYKz09EyACaNjj8',
  // 같은 고정 파일의 공개목록 탭만 웹에 게시한 CSV 주소 (원응답 CSV 금지)
  publishedCsvUrl: '',
  // 구글 폼 응답 주소 (https://docs.google.com/forms/d/e/.../viewform)
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdJG1NXqySDXBPpKIkSrOxFLH9gR9WyA8ZR7ONVuncGrR5uVg/viewform',
  // 폼 ⋮ → '미리 채워진 링크 받기'에서 확인한 질문별 entry 번호
  // 폼 '고래곳간 자료공유': 1 닉네임 · 2 앱 제목 · 3 앱 종류(복수) · 4 설명 · 5 자료 종류 → 섹션2 웹 앱 주소 / 섹션3 파일
  entry: {
    nickname: 'entry.1531111128', // 1. 제작하신 분의 닉네임
    title: 'entry.2111207561', // 2. 제작한 앱의 제목
    kind: 'entry.173551723', // 3. 제작한 앱의 종류 (교무행정·수업자료·학생관리·기타)
    description: 'entry.1858341623', // 4. 도구에 대한 설명
    format: 'entry.1451003129', // 5. 만드신 자료의 종류 (HTML 파일 / 배포한 웹 앱)
    address: 'entry.221892626', // 섹션 2. 배포하신 웹 앱 주소
  },
  fetchTimeoutMs: 15000,
  maxFileBytes: 2 * 1024 * 1024, // 내려받는 파일 상한 (작품 HTML은 1MB 이하)
};

export const marketReady = (m = MARKET) => !!(m.publishedCsvUrl || (m.environment === 'development' && m.allowRawSheetFallback === true && m.sheetId));
export const shareReady = (m = MARKET) => /^https:\/\/docs\.google\.com\/forms\//.test(m.formUrl);
