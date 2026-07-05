# database.rules.json 확장 초안 — RPG-5 (P2 학급 개방 · T2 클라우드 미러)

| 항목 | 내용 |
|---|---|
| 단일 출처 | `RPG모드_PRD.md` v1.0.1 §1.2(교사 게이트)·§7.2(등록 3계층)·§7.3(세이브) |
| 상태 | **초안** — RPG-0 산출물. 실제 `database.rules.json` 수정·`firebase deploy`는 **RPG-5에서 메인 세션이 수행**(이 문서는 파일을 건드리지 않는다) |
| 현행 실측 | `/Users/dobuk/star-arena/database.rules.json` (2026-07-05 기준) — 아래 §1 |
| 보안 수준 | 기존과 동일한 **"수업용 간이 보호"**(auth != null) — 보안 강화는 챕터 1 비목표(§0.3), 코드 주석 선언 유지 |

---

## 1. 현행 rules 실측 요약

```
rules
├─ .read/.write: false                     ← 기본 전면 거부
├─ starArenaOnline/
│   ├─ rooms/$roomCode                     ← 온라인 방 (auth != null R/W)
│   └─ editorMaps/$classCode               ← 맵공방 클라우드 (auth != null R/W) ※BIG-BATCH-2 Phase 3
└─ classes/$classCode/students/$studentId  ← 계정 동기 (auth != null R/W)
     ├─ 필드별 .validate (id·name·pinHash·level·exp·gold …)
     └─ "$other": { ".validate": true }    ← ★ profile.rpg 서브트리는 여기로 통과
```

**PRD 대비 실측 메모**: PRD §1.2는 "현행 rules는 classes/*/students와 rooms만 허용"이라 기술하나, 실제 파일에는 BIG-BATCH-2 Phase 3에서 추가된 `starArenaOnline/editorMaps/$classCode`가 이미 존재한다(PRD 기술이 한 단계 구식). 결론 — **flags·rpgContent는 여전히 미허용이므로 확장 필수** — 는 그대로 유효하다.

### RPG가 rules 변경 **없이** 되는 것 / 안 되는 것

| 구분 | 경로 | 판정 |
|---|---|---|
| ✅ 세이브 동기(`profile.rpg`) | `classes/$classCode/students/$studentId/rpg` | **변경 불요** — `$other` validate true로 통과(PRD §7.3 #3 실측 확인과 일치). `_teacher` 의사 계정도 같은 경로(공통 요건 `hasChildren(['id','pinHash','lastUpdated'])`만 충족하면 됨 — 기존 pushCloudOrPending 파이프라인이 충족) |
| ❌ P2 개방 플래그 | `classes/$classCode/flags/rpgOpen`·`chapterMax` | 미정의 경로 → 루트 `false` 상속 → **전면 거부. 확장 필요** |
| ❌ T2 클라우드 미러 | `starArenaOnline/rpgContent/$classCode` | 동일하게 **전면 거부. 확장 필요** |

---

## 2. 제안 diff (2개 노드 추가 — 기존 노드 무변경)

### 2.1 `classes/$classCode/flags` — P2/P3 교사 게이트 (§1.2)

`students`의 **형제 노드**로 추가(기존 students 블록은 바이트 무변경):

```json
"classes": {
  "$classCode": {
    "flags": {
      ".read": "auth != null",
      ".write": "auth != null",
      "rpgOpen":    { ".validate": "newData.isBoolean()" },
      "chapterMax": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 20" },
      "$other":     { ".validate": false }
    },
    "students": { "…기존 그대로…": {} }
  }
}
```

- `rpgOpen`(boolean): P2 학급 개방 스위치. 미개방 시 로비에 `🔒 선생님이 열어주면 시작!` 잠금 행 노출.
- `chapterMax`(number 1~20): P3 챕터 게이트 — 개인 플레이는 공용 월드 진행 챕터까지(스포일러 통제).
- `$other: false`로 잠가 두고, 향후 플래그(예: 도감 8탭 개방)는 **rules에 명시 추가**하는 방식으로 확장 — flags 노드는 좁게 유지(오타 필드로 인한 쓰레기 유입 방지).
- 읽기는 학생 클라이언트 부팅 시 필요하므로 `auth != null`(기존 익명 auth 흐름과 동일). 쓰기도 동급 — "교사만 쓰기"는 현행 인증 체계(계정·PIN이 DB 밖 간이 구조)로는 강제 불가, 간이 보호 선언과 일치.

### 2.2 `starArenaOnline/rpgContent/$classCode` — T2 위키 콘텐츠 미러 (§7.2)

`editorMaps` 선례를 따르되, 로컬 스토어 `starArena.rpgContent.v1`의 `{pending, approved}` 형태를 최상위에서 고정:

```json
"starArenaOnline": {
  "rpgContent": {
    "$classCode": {
      ".read": "auth != null",
      "pending": {
        "$contentId": {
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['id','type','data','updatedAt'])",
          "id":        { ".validate": "newData.isString() && newData.val() == $contentId && newData.val().length <= 40" },
          "type":      { ".validate": "newData.isString() && newData.val().matches(/^(monsters|weapons|armors|items|skills|jobs|crops|npcs|quests|maps)$/)" },
          "data":      { ".validate": "newData.isString() && newData.val().length <= 16384" },
          "owner":     { ".validate": "newData.isString() && newData.val().length <= 20" },
          "updatedAt": { ".validate": "newData.isNumber()" },
          "$other":    { ".validate": true }
        }
      },
      "approved": {
        "$contentId": {
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['id','type','data','updatedAt'])",
          "id":        { ".validate": "newData.isString() && newData.val() == $contentId && newData.val().length <= 40" },
          "type":      { ".validate": "newData.isString() && newData.val().matches(/^(monsters|weapons|armors|items|skills|jobs|crops|npcs|quests|maps)$/)" },
          "data":      { ".validate": "newData.isString() && newData.val().length <= 16384" },
          "owner":     { ".validate": "newData.isString() && newData.val().length <= 20" },
          "updatedAt": { ".validate": "newData.isNumber()" },
          "$other":    { ".validate": true }
        }
      },
      "$other": { ".validate": false }
    }
  }
}
```

설계 결정과 근거:

| 결정 | 근거 |
|---|---|
| 경로 키 = **classCode** | PRD §7.2 명시("경로 키는 classCode로 통일" — editorMaps의 `$classCode` 변수명과 정렬) |
| `data`는 **JSON 직렬화 문자열**(≤16KB) | 콘텐츠 1건 스키마(10테이블 각기 다름)를 rules로 전부 강제하는 것은 과잉·유지비 폭탄. 진짜 검증은 클라이언트 `validateRpgContent`(제출 시+부팅 병합 시 재검사 — §7.4)가 담당하고, rules는 **형태·크기 가드**만. 16KB는 최대 항목(maps rows 24×12+메타)의 4배 여유 |
| `id == $contentId` 강제 | `stu_<type>_<n>` 영구 id(§7.1)와 노드 키의 불일치 원천 차단 |
| `owner` = 별명/이니셜 ≤20자 | 개인정보 기본값(§8.4): 클라우드 미러는 공개 산출물 — 실명 금지는 승인 패널이 1차, 길이 제한이 최후 가드 |
| pending에도 학생 쓰기 허용 | 제출 흐름이 "학생 기기 → pending"(A컴 제출→B컴 교사 승인 E2E — RPG-5 게이트). approved 쓰기도 auth 동급(간이 보호 한계 — 교사 전용 강제는 후속 보안 과제) |
| 항목별 노드(맵 1키 1맵 선례) | 전체 목록 1키 방식 대비 동시 제출 충돌(마지막 쓰기 승리로 남의 제출 소실)을 구조적으로 회피 |
| `$other: true` (항목 내부) | status·approvedAt·wikiId(M-07) 등 RPG-4 구현 재량 필드 여지 |

### 2.3 변경하지 않는 것

- `rooms` · `editorMaps` · `classes/$classCode/students` — **바이트 무변경**(기존 온라인·맵공방·계정 동기 무회귀가 RPG-5 게이트).
- `profile.rpg` 세이브 — §1 표대로 rules 무관(이미 통과).
- 삭제/이관 없음 — 순수 추가 diff이므로 롤백 = 이전 파일 복원 1회.

---

## 3. 적용 절차 (RPG-5 — 메인 세션 전용 체크리스트)

1. `cp database.rules.json database.rules.BACKUP.json` (백업 관례 파일 실재 — 갱신).
2. §2 diff를 `database.rules.json`에 반영(순수 추가 — 기존 노드 diff 0 확인: `git diff`에서 추가 줄만).
3. 문법·규칙 검증: JSON parse + `firebase deploy --only database` 사전 dry(또는 MCP `firebase_validate_security_rules`).
4. `firebase deploy --only database` — **deploy 없이는 클라이언트가 전면 거부됨**(§1.2 명시 리스크).
5. 스모크(RPG-5 AC): ① A컴 학생 제출 → `rpgContent/{classCode}/pending`에 생성 ② B컴 교사 승인 → approved 이동 → A·B 부팅 병합 반영 ③ `flags/rpgOpen` 토글 → 로비 행 잠금/개방 전환 ④ 기존 rooms 온라인전·editorMaps 제출·계정 로그인 왕복 무회귀 ⑤ 검증 실패 케이스(16KB 초과 data·미등록 type)가 거부되는지 음성 테스트.
6. 실패 시 롤백: BACKUP 복원 → 재deploy.

## 4. 남는 과제 (rules 밖 — RPG-4/5 구현부 몫)

- pending 정리 정책(승인/온실 이동 후 pending 삭제)은 클라이언트 로직 — rules는 삭제(`newData.exists() == false`)를 auth로 허용(추가 규칙 불요, `.write`가 삭제 포함).
- 학년 교체 아카이브(§8.5)는 `disabled` 플래그 방식 — approved 항목 내부 `$other: true`로 수용, rules 변경 불요.
- 교사 전용 쓰기 강제(approved·flags)는 Firebase Auth 커스텀 클레임 필요 — 챕터 1 비목표(§0.3 보안 강화 제외)와 일치하므로 **의도적 보류**를 코드 주석으로 선언.
