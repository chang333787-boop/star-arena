[작업명] LOBBY-REDESIGN-1 — 시작 화면(로비) 정보구조 개편 · 붐빔 제거

목표:
로비(시작 화면)가 너무 붐빈다. 정보구조(IA)를 3층으로 정리하고, 설정을 적용되는 모드 밑으로 스코프하고, 배경을 정돈해 "혼자/함께"가 한눈에 읽히는 화면으로 재설계한다. 기존 게임플레이·저장·테스트는 하나도 깨지 않는다.

현재 상태:
- 로비 = `drawStartScreen()` (index.html ~3671), 상태 `STATE.START`.
- 모든 화면이 `<canvas id="game">` 하나에 그려짐(DOM UI 없음). 조작 키보드 전용(마우스/터치 핸들러 없음).
- 논리 좌표 1280×720 고정(`LOGW`/`LOGH`), 창에 균등 스케일.
- 중앙 메뉴 9행 평면 나열: 0바로시작 1온라인센터 2캐릭터(설정) 3캠페인 4난이도(설정) 5맵(설정) 6대전방식(설정) 7로그아웃 8교사용.
- 좌측 "내 정보" 패널 / 우측 "내 캐릭터" 패널 / 배경 = 실제 게임 맵(selectedMapId)을 62% 딤 렌더(=가시·바위·격자의 정체).
- 상점(SHOP)·프로필(PROFILE)·수집(COLLECTION)·교사용(ADMIN)은 이미 별도 STATE로 존재.

사용자 의도:
- "혼자 할래 / 친구랑 할래"가 첫 질문으로 명확히 읽히게.
- 설정(맵·난이도·대전방식)이 "어느 모드에 적용되는지" 헷갈리지 않게 = 해당 모드 밑에만.
- 프로필·상점 같은 메타는 플레이 모드와 다른 "층"에 둔다.
- 미완성/공사판 문구·중복·잡동사니 제거로 상용 수준의 깔끔함.

이번 작업 범위:
A. 3층 IA 적용 — ①껍데기(상단바: 프로필칩·골드·설정) ②섹션(홈·상점·수집 진입) ③플레이(홈 안: 혼자/함께).
B. 중앙 메뉴 재구성 — 혼자(캠페인·빠른대전)/함께(온라인) 그룹핑 + 설정을 모드 밑으로 스코프.
C. 온라인 센터(`drawOnlineMenu`) 스코프 수정 — 전역 맵 셀렉터를 PvP(1v1·3v3) 밑으로, 협동PVE엔 맵 없음.
D. 배경 정돈 — 로비 배경에 실제 게임 맵 렌더 금지, 잔잔한 별밤만.
E. 정리 — 2대1 제거, 중앙 캐릭터 행 제거(우측 패널이 담당), 로그아웃·교사용 강등(설정으로), "규칙" 셀렉터 자리 심기(지금은 섬멸전 1개), 미완성 문구 숨김.

이번 작업에서 하지 않을 것:
- 마우스/터치 입력 추가 (별도 작업)
- "봇 캐릭터전"·규칙(점령전·색칠전)의 실제 게임플레이 구현 (후속 spec)
- 캐릭터/무기/스탯 밸런스 변경
- 온라인 네트워크 로직·Firebase 스키마 변경
- 새 STATE 생성 (기존 SHOP/PROFILE/COLLECTION/ADMIN 재사용)
- footprint·y-sort·오토타일 등 게임플레이 코드 (다른 트랙)

금지:
- `index.html`과 `star_arena.html`의 바이트 동일 깨기
- 키보드 네비게이션 무력화 (↑↓/←→/Enter/Esc + 단축키)
- harness_*.js가 참조하는 전역 심볼 이름/시그니처 변경·삭제
- `startGame()`·캠페인·온라인의 설정 소비 배선 끊기
- `saveProfile()`/localStorage 저장 흐름 변경
- 게임플레이 로직(전투·충돌·맵) 리팩토링

허용:
- `drawStartScreen`·`drawLobbyMenu`·`drawLobbyInfoCard`·`drawCharacterCard`·`drawOnlineMenu`·`drawTitle`·배경 함수 수정
- 메뉴 entries 재구성 + `MENU_ROWS`·`VALUE_ROWS`·`changeMenuValue`·`activateMenuRow` 인덱스 매핑 일관 갱신
- `MODES`에서 2대1 제거, "규칙" 리스트/cycle 추가
- 상단바/설정 화면 신규 그리기 함수 추가
- CSS 없음(캔버스) — 좌표/폰트/색 상수 추가
- 하니스/Playwright 테스트, 문서 작성
- client-only main push + Pages live 확인

중단 조건 (아래 해당 시 멈추고 보고):
- 메뉴 인덱스 재매핑이 게임플레이 진입(startGame/캠페인/온라인) 배선과 충돌해 끊길 위험
- harness_*.js가 참조하는 전역을 건드려야만 개편이 되는 상황
- `star_arena.html` 동기화가 자동으로 안 맞음(수동 반영 필요 판단)
- 배경 정돈이 플레이 화면의 맵 렌더까지 영향 줌
- 기존 STATE(상점/프로필/수집/교사용) 연결이 예상과 다름

━━━━━━━━━━━━━━━━
0. 기준 상태 확인
━━━━━━━━━━━━━━━━
- git status --short
- git branch --show-current
- git fetch origin && git rev-parse origin/main
- git log --oneline -20
확인:
- main 최신, 추적 파일 미커밋 변경은 에셋/문서만(index.html 변경 0)
- `diff -q index.html star_arena.html` → 바이트 동일

━━━━━━━━━━━━━━━━
1. 현재 로비/온라인/설정 코드 조사
━━━━━━━━━━━━━━━━
검색: drawStartScreen · drawLobbyMenu · drawLobbyInfoCard · drawCharacterCard · drawOnlineMenu · MENU_ROWS · VALUE_ROWS · changeMenuValue · activateMenuRow · MODES · MAPS · DIFFICULTIES · ONLINE_MODES · selectedMapId · selectedModeId · selectedDifficultyId · STATE · dimScreen · drawBackground · saveProfile
확인:
1. 중앙 메뉴 entries 배열 구조와 행 인덱스↔핸들러 매핑
2. `MENU_ROWS`/`VALUE_ROWS`가 행 구성에 어떻게 묶였나
3. 설정 3종을 각각 어느 모드가 소비하나(startGame/캠페인/온라인)
4. 배경이 로비에서 맵을 렌더하는 경로(dimScreen + drawBackground)
5. 상점/프로필/수집/교사용 STATE 진입 방법
6. 온라인 센터의 전역 맵 셀렉터 위치·소비처
7. harness_*.js가 참조하는 전역 목록(MAPS,getMap,STATE,ARENA,startGame,gameState,profile,selectedMapId 등)

━━━━━━━━━━━━━━━━
2. 3층 IA 구현 (범위 A·B·E)
━━━━━━━━━━━━━━━━
목표 레이아웃:
  ①껍데기(상단바): [👤프로필칩 이름·Lv] · [💰골드] · [⚙설정] · 온라인상태
  ②섹션 진입: 🏠홈 · 🛒상점 · 📖수집  (상점/수집/프로필 = 기존 STATE로 이동)
  ③플레이(중앙):
     혼자 하기
       ⭐ 캠페인 도전   20스테이지(몬스터전)     └ 난이도
       ▶ 빠른 대전     단판                     └ 규칙 · 팀 · 맵 · 난이도
     친구와
       🌐 온라인 센터 →
규칙(관통): 설정은 적용되는 모드 밑에만. 캠페인=난이도만, 빠른대전=규칙·팀·맵·난이도.
정리: 2대1 제거, 캐릭터 행 제거(우측 패널·C키 유지), 로그아웃·교사용 → 설정으로.
주의: entries 바꾸면 `MENU_ROWS`·`VALUE_ROWS`·핸들러 인덱스 동시 갱신(중단조건 참고).

━━━━━━━━━━━━━━━━
3. 온라인 센터 스코프 수정 (범위 C)
━━━━━━━━━━━━━━━━
- 전역 맵 셀렉터 제거 → 온라인 1v1·3v3(PvP) 밑으로 스코프.
- 1~6인 협동 PVE엔 맵 라인 없음(스테이지 고정). "PVE는 스테이지 맵" 변명 힌트 제거.
- 그룹: 온라인 대전(1v1·3v3) / 온라인 협동(PVE).

━━━━━━━━━━━━━━━━
4. 배경 정돈 (범위 D)
━━━━━━━━━━━━━━━━
- 로비에서 실제 게임 맵 오브젝트(가시·바위·수풀·격자) 렌더 중단.
- 잔잔한 별밤(starfield)만. 플레이 화면의 맵 렌더는 그대로(건드리지 말 것).

━━━━━━━━━━━━━━━━
5. 테스트
━━━━━━━━━━━━━━━━
- node --check index.html 대상 아님(스크립트 eval), 대신 하니스로 회귀 확인:
  node harness_studentmaps.js · node harness_pve.js (통과 유지)
- 브라우저: index.html 로비 육안 — 붐빔 사라짐 / 3층 보임 / 설정이 올바른 모드 밑 / 키보드로 전 항목·전 화면(캠페인·빠른대전·온라인·상점·수집·프로필·설정) 진입.
- `diff -q index.html star_arena.html` → 여전히 바이트 동일.
- console error 0.

━━━━━━━━━━━━━━━━
6. 버전/캐시
━━━━━━━━━━━━━━━━
- 이 프로젝트는 별도 cachebuster 없음(단일 index.html + Pages). 필요 시 상단 버전 주석/타이틀 버전만 bump.
- PATCHNOTES.md에 개편 한 줄 추가.

━━━━━━━━━━━━━━━━
7. 문서
━━━━━━━━━━━━━━━━
docs 또는 루트에 `로비개편_결과_YYYYMMDD.md`:
1. 개편 배경(붐빔·스코프 혼란)
2. 3층 IA 결과
3. 온라인 센터 수정
4. 배경 정돈
5. 인덱스 재매핑 내역
6. 테스트 결과
7. 후속: 마우스/터치 입력, 봇 캐릭터전, 규칙(점령전·색칠전) 게임플레이

━━━━━━━━━━━━━━━━
8. commit / main / live
━━━━━━━━━━━━━━━━
조건: client-only · 게임플레이 로직 변경 0 · 바이트 동일 유지 · 하니스 통과.
- `star_arena.html`도 동일 반영 후 commit
- commit: "Lobby IA redesign — 3-layer shell/sections/play, scoped settings"
- main push → Pages live 확인

최종 보고:
1. 새 로비 구조(3층) 스샷/설명
2. 설정 스코프(모드별) 결과
3. 온라인 센터 수정 결과
4. 배경 정돈 결과
5. 인덱스 재매핑 내역(MENU_ROWS/VALUE_ROWS/핸들러)
6. 수정 파일 목록
7. index.html ↔ star_arena.html 바이트 동일 여부
8. 하니스/테스트 결과
9. 게임플레이 배선(startGame/캠페인/온라인/saveProfile) 회귀 여부
10. 최종 판정:
   - LOBBY_REDESIGN_1_LIVE_PASS
   - LOBBY_REDESIGN_1_NEEDS_FIX
   - CHANGES_REQUIRED
