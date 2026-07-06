# 온라인 긴급 점검 spec — "동기화 대기 중…" 무한 대기 수정 (P0)

| 항목 | 내용 |
|---|---|
| 상태 | **원인 확정·재현기 확보** — 이 spec을 실행하는 세션이 index.html 소유권을 가짐(HANDOFF 갱신할 것) |
| 증상 | 방 만들기 OK·방 접속 OK, 시작하면 **접속한 학생 전원 "동기화 대기 중…" 무한**. 같은 와이파이여도 동일(네트워크 무관 — Firebase 클라우드 릴레이) |
| 영향 | **온라인 3대3 전 규칙 + 온라인 협동(PVE)** 에서 **사람이 6명 미만이라 봇이 1명이라도 충원된 모든 방** = 사실상 교실의 모든 방. 1대1은 무관(양쪽 다 사람). 혼자 도전도 무관(roomRef null) |
| 진단 세션 | RPG 세션(Fable)이 **읽기 전용으로 진단만** 수행 — index.html 미수정. 증거는 아래에 전부 첨부 |

---

## 1. 근본 원인 (증거 3종)

**한 줄:** 봇 파이터의 `ammo`는 설계상 `undefined`인데(무한탄), host 상태 패킷이 `am:f.ammo`를 **무가드로 직렬화** → Firebase는 undefined가 포함된 `set()`을 **통째로 거부** → `writeHostState`의 try/catch가 그 예외를 **무음으로 삼킴** → `state`가 한 번도 안 써짐 → 게스트는 `state.fighters` 없음 = "동기화 대기 중…" 영원 표시.

- **증거 A (코드)**: `tMakeFighter` — `f.ammo = isBot?undefined:magSizeOf(f);` (심볼 검색: `isBot?undefined`). 패킷 직렬화 `tPackFighter`의 `am:f.ammo` (3대3·PVE 공용), `packFighter`의 `am:f.ammo` (1대1). 전송기 `writeHostState`는 `try{ ... .set(stateObj); }catch(e){}` — 실패가 조용히 사라짐.
- **증거 B (재현기)**: 신규 `harness_online_packets.js` — mock DB의 set/update에 **실서버식 검증(undefined/NaN/함수 거부)** 을 넣고 전 규칙 × (사람2+봇4 / 사람6+봇0) 12조합 구동. 결과: **봇 포함 6조합 전부 `state.fighters.pN.am = undefined`로 거부, 풀방 6조합 전부 정상.** (`node harness_online_packets.js`로 그대로 재현)
- **증거 C (라이브 DB 무혐의)**: 익명 인증 토큰으로 실서버 REST 테스트 — `rooms/$code/meta`·`state` 쓰기/읽기 전부 성공(규칙 문제 아님). 기존 하니스가 통과했던 이유 = mock DB가 JSON clone으로 undefined를 **조용히 떨궈서** 실서버와 달리 통과시킴.

왜 이제야 터졌나: BIG-BATCH-2 P1 "로비마감 봇대전"(빈 슬롯 봇 충원)과 P2 전 모드 온라인이 결합되면서, 교실(6인 미만)의 모든 온라인 방에 봇이 끼게 됨. am 필드는 HUD용으로 이전부터 있었지만 봇 충원 방이 실제로 만들어진 게 최근.

## 2. P0 수정 지시 (index.html — 4곳, 전부 소규모)

1) **`tPackFighter`**: `am:f.ammo` → `am:(f.ammo===undefined?-1:f.ammo)`  // -1 = 무한탄(봇). 주석 명시.
2) **`packFighter`(1대1)**: 동일 가드 적용(현재는 안 터지지만 같은 급소).
3) **`writeHostState`(OnlineManager)**: set 직전 **딥 새니타이즈** 추가 — 재귀로 `undefined→null`, `비유한수(NaN/Infinity)→0` 치환, 치환 발생 시 `console.warn("[online] state 필드 정화:", 경로)` 1회/필드종. try/catch는 유지하되 **catch에서 `console.warn("[online] state 전송 실패", e)`** 추가(무음 금지 — 이번 사고의 은폐 지점). `writeMetaStatus`·`writeInput`도 같은 새니타이즈 경유.
4) **게스트 am 소비처 가드**: 예측 발사 게이트(심볼: `myAmmoOk`)에 `mine.am<0 ||` 추가, HUD 탄창 표시는 `am>=0`일 때만(현재도 내 슬롯은 항상 사람이라 실영향 없음 — 방어적).

**금지**: `f.ammo`의 엔진 의미(undefined=무한) 변경 금지 — usesAmmo/consumeAmmo/장전 AI 전반이 undefined 판별에 의존. 수정은 **패킷 경계에서만**.

## 3. 재발 방지 (하니스 강화 — 필수)

- `harness_online_rules.js`·`harness_online.js`의 mock `set()/update()`에 `harness_online_packets.js`의 `fbValidate`(undefined/NaN/함수 거부)를 이식 — **mock이 실서버보다 관대해서 생긴 사각지대 제거.**
- `harness_online_rules.js`에 케이스 추가: **"사람 2명+봇 4" 방에서 tStartMatch→30틱→tHostWriteState가 예외 없이 성공 + state.fighters 6슬롯 존재 + 게스트 뷰(tGuestApplyRule) 정상**.
- PVE(`onlinePve6`)도 봇 충원 케이스 1개 추가(같은 tPackFighter 경로 확인).
- 주의: 엄격 검증을 켜면 **다른 잠재 독성 필드가 추가로 드러날 수 있음**(pve.upg 등) — 발견 시 전부 같은 방식(패킷 경계 가드)으로 수정하고 케이스로 고정.

## 4. 온라인 렉 점검 결과 (진단 세션 코드 리뷰 — P1, 별도 커밋 권장)

| # | 항목 | 현황 | 판정·권장 |
|---|---|---|---|
| 1 | 입력 브로드캐스트 중복 | 전원이 `players` 루트를 value 구독 → **한 명이 입력을 쓸 때마다 6인 전원에게 players 전체(전원 input 포함) 재전송**. 입력은 변화 시+0.75s keepalive라 이동 난전 시 초당 수십 회 | **최대 렉 요인.** 개선안: `inputs/$slot` 별도 노드로 분리, **host만 inputs 구독**, players에는 로스터(연결/캐릭/팀/ready)만 남기고 변화 드물게. 게스트 다운링크 대폭 감소. 프로토콜 변경이므로 별도 커밋+양방향 호환 불필요(같은 버전 배포) |
| 2 | state 스냅샷 | 15Hz(T_STATE_FPS) 전체 스냅샷, 탄환 상한 80(T_MAX_BULLETS) | 수용 가능. 6인 난전 시 탄 80×~30B가 최대 비대 요인 — **게스트 렌더 기준 상한 40 재검토**(1대1은 이미 40) |
| 3 | 페인트 동기화 | 풀그리드 RLE(델타 아님) — v1.42에서 인지된 사항 | 90초 매치라 수용 — 여유 있으면 20틱당 1회 풀 + 나머지 델타 |
| 4 | 게스트 규칙 디코드 | PERF-2에서 60Hz→패킷 단위로 이미 최적화 | 완료 상태 ✓ |
| 5 | 입력 keepalive | 변화 시 즉시+0.75s | 양호 ✓ |
| 6 | onDisconnect 정리 | connected/lastSeen/input 정리 ✓, host 끊김=방 종료 ✓ | 양호 ✓ |
| 7 | 리전 | asia-southeast1 (RTT ~80-120ms 국내) | 반응 지연의 바닥값 — 구조 개선 대상 아님(참고) |

## 5. 검증 절차 (완료 기준)

1. `node harness_online_packets.js` → **12조합 전부 "패킷 정상"** (수정 전엔 6조합 💥).
2. 강화된 `harness_online_rules.js`(봇 방 케이스 포함) + `harness_online.js` PASS.
3. 기존 하니스 전종 PASS + `cp index.html star_arena.html` 바이트 동일.
4. **실기기 검증(필수)**: 기기 2대(또는 브라우저 2탭·다른 프로필)로 라이브 사이트에서 — 3대3 방 생성 → 1명만 접속 → 시작 → **게스트 화면이 2초 내 동기화**(파이터·타이머 표시) → 규칙 1개(칠하기 권장 — RLE 경로 포함) 실플레이 1판.
5. 브라우저 콘솔에 "[online] state 전송 실패" 경고 0건.
6. PATCHNOTES(v1.45) + 본 spec 하단에 결과 기록 + HANDOFF 갱신(소유권·완료).

## 6. 커밋 규칙
- P0(버그 수정+하니스 강화) 1커밋 → 실기기 검증 → P1(렉 개선, 선택) 별도 커밋. 메시지에 "온라인긴급" 접두.

---
## 실행 결과 (2026-07-06, 실행 세션 — v1.45 / 커밋 1a8538c)
- P0 수정 4곳 완료: tPackFighter·packFighter `am:-1` 가드 / writeHostState·writeMetaStatus·writeInput 딥 새니타이즈(undefined 제거·NaN→0·ServerValue 통과) + 실패 시 console.warn / myAmmoOk `am<0` + HUD am<0=∞ 처리. f.ammo 엔진 의미는 무변경(패킷 경계만).
- 검증: ① harness_online_packets **12/12 패킷 정상**(수정 전 6조합 💥 재확인) ② mock 엄격화 이식 + 봇 충원 방(tdm/paint/tag)·PVE 1인 케이스 추가 — ALL PASS ③ 전 하니스 20종 PASS·바이트 동일 ④ **실기기(라이브 2클라이언트)**: 사람2+봇4 칠하기 방 — 게스트 동기화 **85ms**, 5초 실플레이(RLE 페인트 수신), "[online] 전송 실패" 경고 **0건** ⑤ 배포 확인(빌드 built·마커 검출).
- 엄격 검증에서 추가 독성 필드 발견 없음(pve.upg 포함 통과).
- P1(렉 개선 — inputs 노드 분리 등)은 미착수: 별도 커밋 권장대로 후속 배치로 남김.

---

## P1 실행 결과 (2026-07-06, Fable — v1.50)
- **#1 입력 브로드캐스트 중복(최대 렉 요인) — 완료**: `rooms/*/inputs/$slot` 분리 노드로 이동, **host만 inputs 구독**(게스트 다운링크에서 입력 팬아웃 소멸). players는 로스터만. onDisconnect 입력 비우기도 inputs로 이동. 라이브 REST 왕복으로 규칙 통과 확인(rooms/$roomCode 하위 전체 허용이라 규칙 배포 불필요).
- **+입력 20Hz 캐핑**: 아날로그(이동/조준) 변화는 1/20s 최소 간격, **버튼(공격/기술/궁/장전/픽) 변화는 즉시**(edge 유실 0) — 조준 중 ~60Hz 쓰기가 최대 20Hz로.
- **#2 스냅샷 비대 — 완료**: 패킷 탄 상한 80→**최신 48발**(시뮬 80 유지, 최악 6.8KB→4.4KB). 좌표는 기존에 이미 정수화 확인.
- **#3 페인트 RLE — 완료**: 그리드 **변화 시에만** 전송(+15틱마다 안전 리프레시), 게스트는 g 생략 패킷에서 이전 그리드 유지.
- **+순간이동 체감 직접 수정(신규)**: ①게스트 원격 표시를 '최신 1개 지수 lerp' → **스냅샷 페어 보간**(도착 시계·렌더 지연 120ms·1.4패킷 소폭 외삽 후 홀드, 워밍업은 기존 lerp 폴백) ②자기 캐릭터 **70px 하드스냅 → 연속 화해**(6px 데드존, 초당 4~9배율 흡수, 220px+만 즉시).
- **+진단**: 게스트 HUD state 신선도 배지(🟢<150ms/🟡<400ms/🔴 지연 표기) + 2s 정체 시 long-poll 폴백 의심 콘솔 경고 — "내 와이파이 탓?"을 교실에서 즉석 판별.
- 검증: harness_online_rules §9 신설(14 체크 — inputs 왕복·캐핑 시그니처·페어 보간·연속 화해·탄 48·RLE 조건) + 전 하니스 무회귀 + harness_campaign 주입 경로 갱신. mock은 지연 시뮬 불가 — **최종 체감은 실기기 3v3 측정 필요**(§4 비고 유지).

## P1b 실행 결과 (2026-07-06, Fable — v1.51 잔여 3건)
- **호스트 탭 숨김 = 방 전체 정지(신규 발견)**: rAF 단일 루프라 방장이 탭만 바꿔도 시뮬·state 쓰기 전면 중단(게스트 전원 고무줄) — 숨김 중에만 Web Worker 타이머(백그라운드 스로틀 제외)로 호스트 시뮬 30Hz 유지(render 생략, CSP 불가 시 setInterval+서브스텝 폴백). 게스트 탭 숨김 시엔 빈 입력 1회 즉시 전송(유령 이동 방지).
- **재접속 복귀 불가(신규 발견)**: onDisconnect가 connected=false를 쏘면 영구 false(재-set 없음) + 3v3 봇 인계가 단방향(isBot 복귀 없음) — .info/connected 재연결 시 setPresence 재호출(재무장 포함) + isBot 역전이(players 레코드 isBot===false인 사람 슬롯만). 새로고침 후 같은 방 재입장(C안)은 uid 검증 transaction이 필요해 백로그.
- **PVE 적 스냅(신규 발견)**: 게스트 화면에서 적 최대 40마리가 15Hz마다 점프(tEnemiesView가 죽은 변수) — 파이터와 같은 onlineInterpTarget 페어 보간 적용(사망 즉시 제거·hp는 최신 스냅샷).
- 검증: harness_online_rules §10 신설(6체크: 봇 인계 왕복·원봇 무해·적 보간·시체 잔상 0) — 전 하니스 무회귀.
