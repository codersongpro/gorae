# extension — 웨일 사이드바 확장앱

웨일은 `sidebar_action` 키를 씁니다 (0단계에서 `tests/probe0`로 확인). 빌드 도구 없이 이 폴더를 그대로 불러옵니다.

## 불러오기
1. `whale://extensions` → 개발자 모드 켜기
2. "압축해제된 확장 프로그램 로드" → 이 `extension` 폴더 선택
3. 사이드바에서 "고래곳간" 열기

## 폴더 규칙
- `core/` 화면과 무관한 로직 (DOM 접근 금지)
- `ui/` 화면. 색·간격은 `ui/tokens.css` 변수만, 문구는 `ui/strings.js`에만
- `shared/`, `ui/tokens.css`, `sample/` 는 **복사본**입니다. 원본(`/shared`, `/design/tokens.css`, `/site`)을 고치고 `npm run sync`로 갱신하세요.
- `core/rootkey.js` 에는 운영용 관리 **공개키**만 들어 있습니다. 개인 열쇠는 저장소 밖에 오프라인 보관하며, 교체 절차는 `docs/root-key-setup.md`를 따릅니다.
