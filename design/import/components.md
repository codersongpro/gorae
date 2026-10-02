# 공통 컴포넌트 — 고래곳간 사이드패널 (360px)

모든 값은 `tokens.import.css` 변수 기준. 괄호 안은 px.

## 줄바꿈 규칙 (전역)
- `word-break: keep-all; overflow-wrap: break-word;` — 한국어 어절 단위로만 줄바꿈.
- 제목: `text-wrap: balance`, 본문: `text-wrap: pretty`.
- 버튼·탭·칩·배지·메타 항목(학년·교과·시간)은 `white-space: nowrap`. 메타는 항목마다 span으로 감싸고 부모를 `flex-wrap`으로 두어 항목 단위로 넘어가게.
- 한 줄 고정이 필요한 곳(실행 뷰 제목, 고래자리 목록)은 말줄임(`text-overflow: ellipsis`).

## 앱 헤더 (높이 56)
🐋 이모지(24px) + "고래곳간"(18/26, 700) + 모드 라벨(12, 600, muted / 교사 모드는 teacher-band 색).
오른쪽 아이콘 버튼 3개(40×44): 만들기(+), 가져오기(↓), 모드 전환(자물쇠 / 열린 자물쇠).

## 교사고래 모드 띠 (높이 28)
`--color-teacher-band` 바탕, 흰 글자 12/600, "교사고래 모드 (교사) 켜짐". 헤더 위에 항상 고정.

## 탭 (높이 48, 4등분 grid)
큰 곳간 / 나눔 곳간 / 내 곳간 / 학급 꾸러미. 15/600, nowrap.
선택 탭만 공간색 글자 + 아래 2px 막대: catalog · market · mypod · class. 나머지는 muted.

## 작품 카드
- surface-raised, radius-lg, padding 16, shadow-sm(hover 시 shadow-md), 테두리 없음.
- 순서: 배지 줄 → 제목(17/24, 600) → 설명(14/21, 2줄 말줄임) → 메타(13, muted, `·` 없이 6px 간격 flex-wrap) → 구분선 → 행동 줄.
- 행동 줄: [🐳 물뿜기 10+] [🎤 노래 수] ··· [담기(보조)] [실행(주)]. 버튼 높이 40, 터치 영역 44.
- 소용돌이: 실행 버튼 비활성 + 아래 빨간 안내 13px. 학생고래 모드에서는 목록에서 숨김.

## 배지 (높이 22, radius-sm, 12/600, nowrap)
| 종류 | 바탕 | 글자 | 앞 표시 |
| --- | --- | --- | --- |
| 맑은 바다 | badge-clear | badge-clear-text | 6px 점 |
| 얕은 바다 | badge-shallow | badge-shallow-text | 6px 점 |
| 소용돌이 | badge-whirlpool | badge-whirlpool-text | 6px 점 |
| 고래 픽 | catalog-soft | primary | 인증 별 아이콘 13 |
| 출처(내 곳간) | mypod-soft | mypod | 없음 |
| 서명 불일치 | 없음 | danger | 경고 아이콘 14 + 이유 글자 (배지 대신) |
상세 화면은 13px 배지에 짧은 설명을 붙임: "맑은 바다 · 학생 사용 가능".

## 물뿜기 (익명 추천)
- 표시: 🐳 이모지(카드 18px, 상세·실행 뷰 20px) + "물뿜기 1+ / 10+ / 50+ / 100+" 구간.
- 누르면 글자색 muted → primary, 상세 하단 버튼 글자 "물뿜기" → "뿜었어요". 이모지는 항상 원색.
- `aria-pressed` 토글, `title="좋아요처럼 누르는 익명 추천이에요."`

## 버튼
- 주: primary 바탕, 흰 글자, 높이 48(lg) / 40(md) / 32(sm), radius 12/10/8.
- 보조: 흰 바탕 + border, 글자 text.
- 위험: 글자 danger, 바탕 없음(내 곳간 [삭제]). 확인은 토스트/대화상자로.
- 비활성: 바탕 fill, 글자 assistive. 투명도로 흐리게 하지 않음.

## 필터 칩 (높이 36, radius-md, 14/500, 가로 스크롤)
기본: 테두리 border. 선택: primary 글자 + primary 8% 바탕 + primary 45% 테두리. 드롭다운 칩은 ▾ 16px.

## 검색창 (높이 44, radius 12, fill 바탕, 테두리 없음)
돋보기 20 + placeholder "제목·주제·성취기준·#태그로 찾기".

## 하단 연계 바
"보내기" 라벨(12) + 버튼 3개(높이 44, 균등). 메인 서비스 버튼이 맨 앞, primary 9% 바탕 + primary 글자. 나머지 fill 바탕.
내 곳간에서 작품을 고르면 위에 [꾸러미로 내보내기 (n개)] 주 버튼이 생김.

## 토스트
원티드 ToastToast. 하단 연계 바 위(bottom 84) 패널 폭 −24. 2.2초 후 사라짐. 성공 = positive, 주의 = cautionary.

## 빈 상태
가운데 정렬, 아이콘 40(assistive) + 제목 16/600 + 보조 버튼 1개. 예: "조건에 맞는 작품이 없어요." [조건 지우기]

## 잠금 화면 (시험)
surface 바탕 전체, 고래 일러스트 96 + "고래가 잠수 중이에요"(22/700) + 설명 15 + 안내 칩(자물쇠 16 + 13px).

## 암호 입력 (교사고래)
제목 22/700, 점 14px × 자리수(최소 4), 오류 14 danger, 3열 키패드(높이 60, 숫자 24/600, "지우기"·"확인" 16).
