# 고래곳간 (Gorae Gotgan)
교실에서 만든 바이브코딩 작품을 안전하게 이어 쓰는 웨일 사이드패널 — NWEC 2026 출품 프로젝트

> 만들고 끝나는 바이브코딩을, 이어 쓰는 수업으로.

사람과 수업 관리(명단·과제·댓글·평가)는 웨일 클래스·팀보드·UBT가 맡고, 고래곳간은 작품의 생애주기(만들기 → 안전 점검 → 격리 실행 → 꾸러미·링크로 공유 → 검수 → 리믹스)를 맡습니다.

## 지금 되는 것
- 웨일 사이드바 확장앱(`extension/`): 큰 곳간·내 곳간·학급 꾸러미, 격리 실행, 자동 점검, 검수 서명 확인
- 꾸러미(.gorae.json) 내보내기·가져오기, 리믹스·버전 계보
- 웨일 스페이스 공유 글 복사: 클래스용 안내 / 팀보드 전시용 / UBT 평가용 / 일반
- 바로 실행 링크와 웹 뷰어(`site/viewer.html`, 모바일 지원)

## 개발·시험
```
npm run sync   # 공용 파일을 extension/·site/로 복사
npm test       # 단위 시험
```

## 시작 순서
1. docs/PRD.md 넣기 (docs/README.md 참고)
2. 이 폴더를 Claude Code로 열기
3. HANDOFF.md의 '붙여넣을 지시문'을 Claude Code에 붙여 넣기 (로직 트랙 시작)
4. 동시에 DESIGN_BRIEF.md의 요청문으로 Claude Design에서 디자인 진행
5. 디자인 결과물을 design/import/에 넣고 HANDOFF.md의 '디자인 합류' 지시문 실행

## 파일
- CLAUDE.md : Claude Code 영구 규칙
- HANDOFF.md : 이번 작업 지시 + 디자인 합류 지시
- DESIGN_BRIEF.md : Claude Design 요청문 + 토큰 계약
- design/tokens.css : 디자인 토큰 (이름 고정, 값만 교체)
