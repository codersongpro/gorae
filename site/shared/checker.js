// 자동 점검 (기기 안에서 실행). 걸린 항목마다 { code, label, reason } 반환.
const PII_WORDS = /이름|성명|전화|연락처|휴대폰|주민|주소|이메일|\b(?:name|fullname|username|phone|tel|mobile|ssn|address|email)\b/i;

const RULES = [
  {
    code: 'NETWORK',
    label: '외부 전송',
    reason: 'fetch·XMLHttpRequest·WebSocket·sendBeacon 등 바깥으로 데이터를 보낼 수 있는 코드가 있어요.',
    test: (h) => /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(h) || /<form[^>]*\baction\s*=\s*["']?\s*https?:/i.test(h),
  },
  {
    code: 'SECRET',
    label: '비밀값 노출',
    reason: 'API 키나 비밀번호처럼 보이는 문자열이 들어 있어요.',
    test: (h) => /sk-[A-Za-z0-9_-]{20,}/.test(h) || /AIza[0-9A-Za-z_-]{30,}/.test(h) || /(password|passwd|비밀번호)\s*[:=]\s*["'][^"']+["']/i.test(h),
  },
  {
    code: 'PII_INPUT',
    label: '개인정보 입력란',
    reason: '이름·전화번호·주소 등을 입력받는 칸이 있어요.',
    test: (h) => {
      const inputs = h.match(/<(?:input|textarea)\b[^>]*>/gi) || [];
      return inputs.some(
        (t) =>
          /\btype\s*=\s*["']?(?:tel|email)\b/i.test(t) ||
          [...t.matchAll(/\b(?:id|name|placeholder|autocomplete|aria-label)\s*=\s*["']([^"']*)["']/gi)].some((m) => PII_WORDS.test(m[1])),
      );
    },
  },
  {
    code: 'EXT_SCRIPT',
    label: '외부 스크립트',
    reason: '허용 목록에 없는 바깥 스크립트를 불러와요.',
    test: (h) => /<script\b[^>]*\bsrc\s*=\s*["']?\s*(?!data:)/i.test(h),
  },
  {
    code: 'DANGEROUS',
    label: '위험 동작',
    reason: 'eval·쿠키 접근·다운로드 유도 같은 위험한 동작이 있어요.',
    test: (h) =>
      /\beval\s*\(|new\s+Function\s*\(|document\.cookie/.test(h) ||
      /<a\b[^>]*\bdownload\b/i.test(h) ||
      /href\s*=\s*["'][^"']*\.(?:exe|msi|bat|scr|zip)(?:["'?#])/i.test(h),
  },
];

export function checkHtml(html) {
  const text = String(html || '');
  const warnings = RULES.filter((r) => r.test(text)).map(({ code, label, reason }) => ({ code, label, reason }));
  return { ok: warnings.length === 0, warnings };
}

// 작성자 표시가 실명처럼 보이는지 (2~4글자 한글만)
export const looksLikeRealName = (author) => /^[가-힣]{2,4}$/.test(String(author || '').split('·')[0].trim());

// 웹앱(URL) 점검: 코드를 볼 수 없으므로 등록자가 밝힌 정보로 경고한다. 외부 웹앱은 늘 격리 밖이다.
export function checkWebapp(w) {
  const warnings = [{ code: 'EXTERNAL_WEBAPP', label: '외부 웹앱', reason: '외부 웹앱이에요. 고래곳간 밖에서 실행되어 격리 실행·외부 통신 차단이 적용되지 않아요.' }];
  if (w.loginRequired === true) warnings.push({ code: 'LOGIN', label: '로그인 필요', reason: '로그인해야 쓸 수 있어요. 학생 계정·개인정보가 필요한지 확인하세요.' });
  if (w.usesExternalApi === true) warnings.push({ code: 'EXT_API', label: '외부 API 사용', reason: '입력한 내용이 다른 서비스로 전송될 수 있어요.' });
  if (w.collectsPersonalInfo === true) warnings.push({ code: 'PII_INPUT', label: '개인정보 입력', reason: '이름·연락처 등 개인정보를 입력받아요.' });
  if (!w.sourceUrl) warnings.push({ code: 'NO_SOURCE', label: '소스 비공개', reason: '소스코드 주소가 없어 내용을 확인하기 어려워요.' });
  return { ok: false, warnings };
}

// EXE 점검: 가장 높은 위험 등급. 필수 정보가 빠지면 함께 알려 준다 (서명 조건은 shared/review.js의 validateExeItem)
export function checkExe(w) {
  const warnings = [{ code: 'EXE_HIGH_RISK', label: '실행형 프로그램', reason: '내 컴퓨터에서 직접 실행되는 프로그램이에요. 검수 서명과 SHA-256 확인 없이 설치하지 마세요.' }];
  const missing = [];
  if (!/^https:\/\//i.test(w.url || '')) missing.push('다운로드 링크(https)');
  if (!/^https:\/\//i.test(w.sourceRepo || '')) missing.push('소스 저장소');
  if (!/^[0-9a-f]{64}$/i.test(w.sha256 || '')) missing.push('SHA-256');
  if (!w.scanResult) missing.push('검사 결과');
  if (!w.environment) missing.push('실행 환경');
  if (missing.length) warnings.push({ code: 'EXE_MISSING', label: '필수 정보 누락', reason: `빠진 항목: ${missing.join(', ')}` });
  return { ok: false, warnings };
}

// 작품 형태에 맞는 점검을 고른다
export function checkWork(w) {
  if (w.type === 'html') return checkHtml(w.html);
  if (w.type === 'url') return checkWebapp(w);
  if (w.type === 'exe-link') return checkExe(w);
  return { ok: false, warnings: [{ code: 'UNKNOWN_TYPE', label: '알 수 없는 형태', reason: '지원하지 않는 작품 형태예요.' }] };
}
