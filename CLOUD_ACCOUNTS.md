# 별빛 아레나 — 학생 계정 클라우드 동기화 (v1.17 후보)

교사 PC에서 만든 학생 계정을 Firebase Realtime Database에 저장해, 학생이 **다른 크롬북에서도 같은 ID/PIN·진행도**로 로그인할 수 있게 한다. 로컬(localStorage)은 오프라인 캐시로 유지되고, 온라인이면 **클라우드가 기준 데이터**다.

## Firebase 경로 구조
```
classes/
  {classCode}/                # 현재 ADMIN_CONFIG.classCode = "star-class"
    students/
      {studentId}/
        id, name, pinHash,               # 원문 PIN 저장 안 함(hashPin 결과만)
        level, exp, gold,
        wins, losses, draws, totalPlays, totalKills, bossKills,
        selectedCharacterId, selectedWeaponId, selectedDifficultyId, selectedMapId, selectedModeId,
        unlockedCharacters[], unlockedWeapons[],
        createdAt, lastLoginAt, lastUpdated, isActive
```
- 온라인 대전은 기존대로 `starArenaOnline/rooms/...`를 사용(변경 없음). 익명 인증(anonymous) 공유.

## 동작 요약
- **저장 계층**: `AccountStore`(loadLocalAccounts/saveLocalAccounts/loadCloudStudent/loadCloudAccounts/saveCloudStudent/deleteCloudStudent/syncAccounts/markPending/flushPending) + 기존 로컬 함수 유지.
- **로그인**: `studentLoginCloud(id,pin,cb)` — 클라우드 조회 → 기존 `hashPin(id,pin)`과 `pinHash` 비교 → 성공 시 로컬 캐시 저장 후 바인딩. 계정없음/PIN오류/연결실패 메시지 분리.
- **진행도 저장**: `saveProfile()`가 로컬 저장 후 `pushCloudOrPending()`으로 클라우드에 반영(`lastUpdated` 갱신). 저장은 **transaction**으로 처리해 **오래된 로컬이 최신 클라우드를 덮어쓰지 않음**(최신 `lastUpdated` 우선).
- **교사 관리**: 생성/PIN재설정/초기화/삭제가 로컬+클라우드에 반영. 중복 ID는 클라우드 기준 검사. 클라우드 저장 실패 시 성공으로 표시하지 않고 오류/pending 안내. 교사 패널 `S` = 클라우드 새로고침.

## 기존 로컬 계정 마이그레이션 (교사 패널 `M`)
1. 로컬 계정 수와 **신규 업로드 / 덮어쓰기(로컬이 최신) / 건너뜀(클라우드가 최신)** 목록을 먼저 보여주고 확인받음.
2. 확인 시 원본 계정을 `starArena.accounts.backup.v1`로 **백업 후** 업로드(원본 즉시 삭제 안 함).
3. 결과를 업로드/건너뜀/실패 수로 보고.

## 오프라인 동작
- 마지막으로 성공적으로 받은 계정을 localStorage에 캐시. 오프라인이면 **이 기기에 캐시된 계정만** 로그인 가능(로그인 화면·교사 패널에 상태 표시).
- 오프라인 중 진행도/변경은 `_pendingSync`로 표시. **재연결(.info/connected 복구) 시 flushPending**으로 `lastUpdated` 비교 후 동기화 → 골드·전적 중복 지급 없음.

## 보안 한계 (정직한 안내 — "완전 보안" 아님)
- 정적 GitHub Pages + 클라이언트 `hashPin`은 **수업용 간이 보호**이지 진짜 보안이 아니다. 코드/DB를 보면 우회 가능.
- 익명 인증(anonymous)만으로는 **교사/학생 권한을 규칙에서 안전하게 구분할 수 없다.** 규칙은 "인증된 사용자만 접근"까지만 강제하므로, 인증된 아무 사용자나 다른 학생 데이터를 읽거나 바꿀 수 있다(수업 신뢰 환경 가정).
- 원문 PIN은 Firebase·localStorage·로그에 **절대 저장/출력하지 않는다**(pinHash만).
- 진짜 보안이 필요하면: Firebase **Auth(실제 계정) + custom claims(teacher)** 기반 규칙으로 교사만 쓰기 허용하도록 재설계해야 한다.

## Firebase Database Rules (배포는 사용자 확인 후)
- 규칙 파일: `database.rules.json` (인증된 사용자만 `classes/*/students/*` 및 `starArenaOnline` 접근 + 필드 타입 검증).
- **주의**: 배포하면 현재 규칙(테스트 모드 등)을 대체한다. 온라인 대전(`starArenaOnline`)도 포함돼 있어야 대전이 안 끊긴다(포함됨).
- 배포 방법(사용자가 직접):
  - 콘솔: Firebase Console → Realtime Database → 규칙 → `database.rules.json` 내용 붙여넣기 → 게시.
  - CLI: `firebase deploy --only database` (firebase.json에 `"database": {"rules": "database.rules.json"}` 필요).
- **이 작업에서는 규칙을 배포하지 않았다.**
