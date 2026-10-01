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
