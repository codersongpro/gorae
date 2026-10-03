// 작품 분류 체계 — 최상위 영역(수업/업무) → 대표 카테고리 1개 → 하위 카테고리 1개 → 태그 여러 개
// DOM 없음. 확장앱·뷰어·검수 도구가 같은 정의를 쓴다. 선택지는 이 파일에서만 고친다.

export const DOMAINS = [
  { id: 'lesson', label: '수업' },
  { id: 'work', label: '업무' },
];

export const ARTIFACT_TYPES = [
  { id: 'html', label: 'HTML 파일', runtime: 'html' },
  { id: 'webapp', label: '웹앱 URL', runtime: 'url' },
  { id: 'exe', label: '실행형 프로그램(EXE)', runtime: 'exe-link' },
  { id: 'link', label: '자료 링크', runtime: 'url' },
  { id: 'file', label: '파일 링크 (PDF·슬라이드·이미지 등)', runtime: 'url' },
];

export const CONTENT_TYPES = [
  { id: 'interactive_activity', label: '학습활동' }, { id: 'presentation', label: '발표자료' },
  { id: 'learning_material', label: '학습자료' }, { id: 'worksheet', label: '활동지' },
  { id: 'quiz', label: '퀴즈·평가' }, { id: 'portfolio', label: '포트폴리오' },
  { id: 'teacher_tool', label: '수업·학급 도구' }, { id: 'work_tool', label: '교사 업무도구' },
  { id: 'reference', label: '참고자료' }, { id: 'other', label: '기타' },
];
export const LEARNING_MODES = [{ id: 'guided', label: '수업과 함께' }, { id: 'self_directed', label: '자기주도학습' }];
export const DIFFICULTIES = [{ id: 'easy', label: '기초' }, { id: 'normal', label: '보통' }, { id: 'challenge', label: '도전' }];
export const CREATION_METHODS = [
  { id: 'teacher_created', label: '교사 제작' }, { id: 'student_created', label: '학생 제작' },
  { id: 'ai_assisted', label: 'AI 도움' }, { id: 'vibe_coding', label: '바이브코딩' }, { id: 'remix', label: '리믹스' },
];
export const contentLabel = (id) => CONTENT_TYPES.find(x => x.id === id)?.label || '';
export const difficultyLabel = (id) => DIFFICULTIES.find(x => x.id === id)?.label || '';

const subs = (pairs) => pairs.map(([id, label]) => ({ id, label }));

export const CATEGORIES = {
  lesson: [
    { id: 'classroom_tool', label: '수업도구', subs: subs([
      ['timer', '타이머·스톱워치'], ['lucky_draw', '럭키드로우·랜덤뽑기'], ['seating', '자리배치·모둠편성'],
      ['random_order', '랜덤발표·순서정하기'], ['scoreboard', '점수판·보상'], ['quiz_game', '퀴즈·게임'],
      ['noise', '소음·집중관리'], ['qr_share', 'QR·링크·공유'], ['opinion', '토론·의견수합'],
      ['collaboration', '협업 활동'], ['presentation', '발표·시각화'], ['etc', '기타 수업도구']]) },
    { id: 'teaching_material', label: '수업자료', subs: subs([
      ['intro', '도입·동기유발'], ['slides', '설명·발표 슬라이드'], ['worksheet', '활동지·학습지'], ['wrapup', '정리·성찰'],
      ['parent', '학부모·안내 자료'], ['etc', '기타 수업자료']]) },
    // 교과활동의 하위 카테고리는 '활동 유형'을 겸한다
    { id: 'subject_activity', label: '교과 학습', detail: true, subs: subs([
      ['concept', '개념 학습'], ['practice', '연습·문제풀이'], ['game', '게임·퀴즈'], ['simulation', '시뮬레이션·탐구'],
      ['creation', '표현·창작'], ['review', '정리·복습'], ['etc', '기타 활동']]) },
    { id: 'self_learning', label: '자기주도학습', detail: true, subs: subs([
      ['today', '오늘의 학습'], ['concept', '개념 익히기'], ['practice', '연습하기'], ['review', '복습하기'],
      ['challenge', '도전 문제'], ['inquiry', '탐구하기'], ['plan', '학습 계획'], ['check', '학습 점검'],
      ['retry', '오답 다시 학습'], ['summary', '학습 결과 정리']]) },
    { id: 'presentation', label: '발표·표현', subs: subs([
      ['slides', '발표자료'], ['portfolio', '디지털 포트폴리오'], ['webpage', '웹페이지'],
      ['poster', '포스터·카드뉴스'], ['inquiry', '조사·탐구 결과'], ['project', '프로젝트 결과물'], ['etc', '기타']]) },
    { id: 'assessment', label: '평가·피드백', subs: subs([
      ['formative', '형성평가'], ['diagnostic', '진단평가'], ['performance', '수행평가'], ['self', '자기평가'],
      ['peer', '동료평가'], ['rubric', '루브릭'], ['feedback', '피드백'], ['etc', '기타 평가도구']]) },
    { id: 'project', label: '프로젝트·탐구', subs: subs([
      ['pbl', '프로젝트 학습'], ['inquiry', '탐구활동'], ['problem_solving', '문제해결'], ['maker', '메이커'],
      ['coding', '코딩'], ['ai', 'AI 활용'], ['debate', '토론·논쟁'], ['collab_project', '협업 프로젝트'], ['etc', '기타']]) },
    { id: 'creative', label: '창체·교육활동', subs: subs([
      ['autonomy', '자율활동'], ['club', '동아리'], ['career', '진로'], ['safety', '안전교육'],
      ['digital_citizenship', '디지털 시민교육'], ['environment', '환경교육'], ['life', '생활교육'],
      ['violence_prevention', '학교폭력예방'], ['democracy', '민주시민교육'], ['etc', '기타']]) },
  ],
  work: [
    { id: 'class_management', label: '학급운영', subs: subs([
      ['attendance', '출석·현황'], ['seating', '자리배치'], ['roles', '당번·역할'], ['schedule', '학급 일정'],
      ['rules', '학급 규칙'], ['counseling_log', '상담 지원'], ['event', '학급 행사'], ['life', '생활교육'],
      ['stats', '학급 통계'], ['student_status', '학생 현황'], ['etc', '기타']]) },
    { id: 'admin', label: '교무·행정', subs: subs([
      ['doc_analysis', '공문 분석'], ['doc_tasks', '공문 할 일 추출'], ['plan', '계획서 작성'], ['report', '보고서 작성'],
      ['minutes', '회의록'], ['drafting', '기안·문서 작성'], ['schedule', '일정 관리'], ['handover', '업무 인수인계'],
      ['collection', '자료 취합'], ['etc', '기타']]) },
    { id: 'records', label: '평가·기록 업무', subs: subs([
      ['grading', '성적 처리'], ['analysis', '평가 결과 분석'], ['observation', '학생 관찰 기록'], ['school_record', '생활기록부 지원'],
      ['performance_mgmt', '수행평가 관리'], ['charts', '통계·그래프'], ['materials', '평가자료 정리'], ['etc', '기타']]) },
    { id: 'communication', label: '소통', subs: subs([
      ['newsletter', '가정통신문'], ['parent_notice', '학부모 안내'], ['messaging', '문자·메신저'], ['survey', '설문'],
      ['feedback_collect', '의견 수렴'], ['counseling_support', '상담 지원'], ['notice_gen', '안내문 생성'], ['etc', '기타']]) },
    { id: 'student_life', label: '학생·생활교육', subs: subs([
      ['guidance', '생활지도'], ['counseling', '학생 상담'], ['relationship', '관계·갈등'], ['behavior', '행동 관찰'],
      ['status', '학생 현황'], ['safety', '안전 관리'], ['violence', '학교폭력 관련 지원'], ['etc', '기타']]) },
    { id: 'events', label: '행사·학교운영', subs: subs([
      ['school_event', '학교행사'], ['field_trip', '체험학습'], ['sports_day', '운동회'], ['school_trip', '수학여행'],
      ['after_school', '방과후'], ['club', '동아리'], ['contest', '교내대회'], ['ceremony', '졸업·입학 행사'], ['etc', '기타']]) },
    { id: 'resources', label: '자료·시설·예산', subs: subs([
      ['budget', '예산'], ['supplies', '물품'], ['equipment', '기자재'], ['books', '도서'], ['facilities', '시설'],
      ['inventory', '재고'], ['rental', '대여'], ['purchase', '구매·품의 지원'], ['etc', '기타']]) },
    { id: 'research', label: '연구·연수', subs: subs([
      ['research_school', '연구학교'], ['lesson_study', '수업연구'], ['plc', '전문적학습공동체'], ['training', '교원연수'],
      ['survey_analysis', '설문·분석'], ['research_report', '연구보고서'], ['slides', '발표자료'], ['etc', '기타']]) },
    { id: 'automation', label: '업무자동화', subs: subs([
      ['batch_files', '파일 일괄처리'], ['spreadsheet', '엑셀·CSV 처리'], ['convert', '문서 변환'], ['data_cleanup', '데이터 정리'],
      ['repetitive_input', '반복 입력'], ['qr', 'QR 생성'], ['rename', '파일명 변경'], ['auto_sum', '자동 집계'], ['survey_analysis', '설문 결과 정리'], ['etc', '기타 자동화']]) },
  ],
};

export const SCHOOL_LEVELS = [
  { id: 'elementary', label: '초등', prefix: '초', grades: ['1', '2', '3', '4', '5', '6'] },
  { id: 'middle', label: '중학교', prefix: '중', grades: ['1', '2', '3'] },
  { id: 'high', label: '고등학교', prefix: '고', grades: ['1', '2', '3'] },
];

export const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '도덕', '음악', '미술', '체육', '실과', '정보', '제2외국어', '통합교과', '융합·STEAM', '기타'];
// 학교급별 교과 선택지 (추후 조정할 수 있게 분리해 둔다)
export const SUBJECTS_BY_LEVEL = {
  elementary: SUBJECTS.filter((s) => !['정보', '제2외국어'].includes(s)),
  middle: SUBJECTS.filter((s) => s !== '실과'),
  high: SUBJECTS.filter((s) => s !== '실과'),
};

export const GROUP_TYPES = [
  { id: 'individual', label: '개인' }, { id: 'pair', label: '짝' }, { id: 'group', label: '모둠' },
  { id: 'whole_class', label: '전체학급' }, { id: 'teacher', label: '교사용' },
];

// 예상 시간 — 화면은 이름표, 저장은 분(숫자)
export const TIME_OPTIONS = [
  { minutes: 5, label: '5분 이하' }, { minutes: 10, label: '10분' }, { minutes: 20, label: '20분' },
  { minutes: 40, label: '40분' }, { minutes: 45, label: '한 차시' }, { minutes: 90, label: '여러 차시' },
];

export const AUDIENCES = [
  { id: 'teacher', label: '교사' }, { id: 'student', label: '학생' }, { id: 'admin', label: '관리자' }, { id: 'parent', label: '학부모' },
];

export const RECOMMENDED_TAGS = {
  lesson: ['게임', '퀴즈', '연습', '탐구', '발표', '토론', '협업', '형성평가', '개별활동', '모둠활동', '전체활동', '프로젝트', 'AI', '코딩'],
  work: ['자동화', '공문', '문서작성', '데이터분석', '설문', '학급운영', '반복업무', '통계', '업무경감'],
};

// ---------- 찾기 도우미 ----------
export const categoriesOf = (domain) => CATEGORIES[domain] || [];
export const findCategory = (domain, id) => categoriesOf(domain).find((c) => c.id === id) || null;
export const findSub = (domain, catId, subId) => {
  const c = findCategory(domain, catId);
  return c ? c.subs.find((s) => s.id === subId) || null : null;
};
export const levelOf = (id) => SCHOOL_LEVELS.find((l) => l.id === id) || null;
export const gradeLabel = (level, grade) => {
  const l = levelOf(level);
  return l && grade ? `${l.prefix}${grade}` : '';
};
export const timeLabel = (minutes) => {
  if (!minutes) return '';
  const t = TIME_OPTIONS.find((o) => o.minutes === minutes);
  return t ? t.label : `${minutes}분`;
};
export const groupLabel = (id) => (GROUP_TYPES.find((g) => g.id === id) || {}).label || '';
export const audienceLabel = (arr) => (arr || []).map((a) => (AUDIENCES.find((x) => x.id === a) || {}).label || a).join(' + ');

// ---------- 태그 정규화 ----------
// 비슷한 말을 하나로 모은다 (검색 품질 유지). 필요하면 여기에 추가한다.
export const TAG_SYNONYMS = {
  '모둠': '모둠활동', '모둠 활동': '모둠활동', '그룹활동': '모둠활동', '조별활동': '모둠활동',
  '개인활동': '개별활동', '개별 활동': '개별활동', '전체 활동': '전체활동',
  '인공지능': 'AI', 'ai': 'AI', '에이아이': 'AI',
  '퀴즈게임': '퀴즈', '게임형': '게임',
  '코딩교육': '코딩', '프로그래밍': '코딩',
  '자동 화': '자동화', '업무자동화': '자동화',
  '데이터 분석': '데이터분석', '문서 작성': '문서작성', '반복 업무': '반복업무', '업무 경감': '업무경감',
  '형성 평가': '형성평가',
};
export const MAX_TAGS = 10;
export const MAX_TAG_CHARS = 20;

export function normalizeTag(raw) {
  let t = String(raw || '').normalize('NFC').replace(/^#+/, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/^[\x00-\x7F]+$/.test(t)) t = t.toLowerCase();
  t = TAG_SYNONYMS[t] || TAG_SYNONYMS[t.replace(/\s/g, '')] || t;
  return [...t].slice(0, MAX_TAG_CHARS).join('');
}

// "분수, #게임 모둠" 같은 입력이나 배열을 받아 중복 없는 태그 배열로
export function normalizeTags(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,#\n]/);
  const out = [];
  for (const raw of list) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_TAGS);
}

// ---------- 예전 작품 호환 ----------
// 저장된(서명된) 작품 카드는 절대 고치지 않는다(고치면 검수 서명이 깨진다).
// 대신 화면·검색에 쓸 분류 정보를 이 함수로 만들어 쓴다.
function parseLegacyGrade(g) {
  const m = /^(초|중|고)\s*(\d)$/.exec(String(g || '').trim());
  if (!m) return null;
  return { schoolLevel: { 초: 'elementary', 중: 'middle', 고: 'high' }[m[1]], grade: m[2] };
}
const TYPE_TO_ARTIFACT = { html: 'html', url: 'webapp', 'exe-link': 'exe' };
const validId = (choices, value) => choices.some(x => x.id === value);
function inferContent(w, domain, category) {
  if (w.referenceOnly) return 'reference';
  if (domain === 'work') return 'work_tool';
  if (category === 'presentation' || w.subcategory === 'slides') return w.subcategory === 'portfolio' ? 'portfolio' : 'presentation';
  if (w.subcategory === 'worksheet') return 'worksheet';
  if (category === 'assessment') return 'quiz';
  if (category === 'classroom_tool') return 'teacher_tool';
  if (category === 'teaching_material') return 'learning_material';
  return 'interactive_activity';
}

export function normalizeWork(w) {
  const legacy = !w.domain;
  const lg = parseLegacyGrade(w.grade);
  const schoolLevel = w.schoolLevel || (lg && lg.schoolLevel) || '';
  const grade = lg ? lg.grade : w.grade || '';
  const domain = w.domain || 'lesson';
  const category = w.category || (w.subject ? 'subject_activity' : '');
  const audience = Array.isArray(w.audience) ? w.audience : w.audience ? [w.audience] : [];
  const meta = {
    legacy,
    domain,
    artifactType: w.artifactType || TYPE_TO_ARTIFACT[w.type] || 'html',
    contentType: validId(CONTENT_TYPES, w.contentType) ? w.contentType : inferContent(w, domain, category),
    learningMode: validId(LEARNING_MODES, w.learningMode) ? w.learningMode : (category === 'self_learning' || w.selfDirected === true ? 'self_directed' : 'guided'),
    selfDirected: w.selfDirected === true,
    difficulty: validId(DIFFICULTIES, w.difficulty) ? w.difficulty : '',
    creationMethod: Array.isArray(w.creationMethod) ? [...new Set(w.creationMethod.filter(v => validId(CREATION_METHODS, v)))] : [],
    category,
    subcategory: w.subcategory || '',
    schoolLevel,
    grade,
    gradeLabel: gradeLabel(schoolLevel, grade),
    subject: w.subject || '',
    area: w.area || '',
    unit: w.unit || '',
    lessonNo: w.lessonNo || '',
    topic: w.topic || '',
    standard: w.standard || '',
    estimatedMinutes: Number(w.estimatedMinutes || w.minutes) || 0,
    groupType: w.groupType || '',
    audience,
    tags: normalizeTags(w.tags || []),
    description: w.description || '',
  };
  const d = DOMAINS.find((x) => x.id === domain);
  const c = findCategory(domain, category);
  const s = findSub(domain, category, meta.subcategory);
  meta.path = [d && d.label, c ? c.label : '분류 없음(예전 작품)', s && s.label].filter(Boolean);
  return meta;
}

// ---------- 등록할 때 분류 검사 ----------
// 반환: [{ code, message }]
export function validateClassification(input) {
  const errors = [];
  const e = (code, message) => errors.push({ code, message });
  if (!DOMAINS.some((d) => d.id === input.domain)) e('DOMAIN', '수업 / 업무 중 하나를 골라 주세요.');
  if (!ARTIFACT_TYPES.some((a) => a.id === input.artifactType)) e('ARTIFACT', '자료의 실행 형태를 골라 주세요.');
  if (input.contentType && !validId(CONTENT_TYPES, input.contentType)) e('CONTENT_TYPE', '교육적 자료 유형이 올바르지 않아요.');
  if (input.learningMode && !validId(LEARNING_MODES, input.learningMode)) e('LEARNING_MODE', '학습 방식이 올바르지 않아요.');
  if (input.difficulty && !validId(DIFFICULTIES, input.difficulty)) e('DIFFICULTY', '난이도가 올바르지 않아요.');
  if (input.selfDirected !== undefined && typeof input.selfDirected !== 'boolean') e('SELF_DIRECTED', '혼자 학습 가능 여부를 확인해 주세요.');
  if (input.creationMethod !== undefined && (!Array.isArray(input.creationMethod) || !input.creationMethod.every(v => validId(CREATION_METHODS, v)))) e('CREATION_METHOD', '제작 방식이 올바르지 않아요.');
  const cat = findCategory(input.domain, input.category);
  if (!cat) e('CATEGORY', '대표 카테고리를 하나 골라 주세요.');
  else if (!findSub(input.domain, input.category, input.subcategory)) e('SUBCATEGORY', '하위 카테고리를 하나 골라 주세요.');
  const aud = Array.isArray(input.audience) ? input.audience : [];
  if (!aud.length || !aud.every((a) => AUDIENCES.some((x) => x.id === a))) e('AUDIENCE', '대상 사용자를 하나 이상 골라 주세요.');
  if (cat && cat.detail) {
    // 교과활동: 학교급·학년·교과·주제는 필수, 영역·단원·차시·성취기준은 선택
    const lv = levelOf(input.schoolLevel);
    if (!lv) e('SCHOOL_LEVEL', '학교급을 골라 주세요.');
    else if (!lv.grades.includes(String(input.grade))) e('GRADE', '학년을 골라 주세요.');
    if (!input.subject) e('SUBJECT', '교과를 골라 주세요.');
    if (!input.topic || !String(input.topic).trim()) e('TOPIC', '주제를 적어 주세요.');
  }
  if (input.groupType && !GROUP_TYPES.some((g) => g.id === input.groupType)) e('GROUP', '활동 형태가 올바르지 않아요.');
  const min = Number(input.estimatedMinutes);
  if (input.estimatedMinutes !== undefined && input.estimatedMinutes !== '' && !(min > 0 && min <= 600)) e('MINUTES', '예상 시간이 올바르지 않아요.');
  return errors;
}
