# 온라인 WebRTC 하이브리드 전송 — 설계/구현 스펙

> 목적: 3v3(및 전 온라인 모드)의 렉·순간이동을 없앤다. 근본 원인은 넷코드가 아니라
> 전송 경로(Firebase RTDB=싱가포르 DB를 15~30Hz 게임 중계로 사용 → 왕복 150~300ms).
> 해법: 같은 와이파이에서 기기끼리 **WebRTC DataChannel 직접 연결**(왕복 5~20ms).
> **현장 게이트 통과 완료**(2026-07-07): 교사 맥북 + 학생 크롬북, 같은 와이파이, 직접 LAN 6ms
> (도구 nettest.html). 클라이언트 격리 없음 확인 → 본작업 착수.

## 설계 원칙 (안전 최우선)

1. **RTDB는 그대로 둔다(폴백 floor).** 기존 경로를 삭제하지 않는다. WebRTC는 그 위에 얹는 "더 빠른 대체 공급자".
2. **소비 코드 무변경.** 게스트 렌더/보간은 `OnlineManager.onlineState`를, 호스트 시뮬은 `OnlineManager.inputs[slot]`을 읽는다. WebRTC는 이 **같은 변수**를 더 빠르게 채운다. 보간·예측·화해·렌더·규칙엔진은 한 줄도 안 바뀐다.
3. **시퀀스(`_sq`) 중복 제거.** 호스트는 상태마다, 게스트는 입력마다 증가 seq를 찍는다. 수신측은 seq가 더 큰 것만 적용 → DC(빠름)와 RTDB(느림)가 같은 seq를 실어보내도 먼저 온 DC가 이기고 RTDB 사본은 자동 드롭. 패킷 손실 시에만 RTDB가 floor로 메꿈. **끼어들기 히칭 없음.**
4. **플래그 OFF = 100% 현행 동일.** `RTC_ENABLED=false`면 seq를 안 찍고 DC를 안 열어, 수신측 seq 가드는 `_sq===undefined`라 그냥 통과 → 지금과 바이트 동일 동작. 회귀 0. 켜고 실측 후 ON.
5. **격리 교실 자동 폴백.** DC가 타임아웃/실패로 안 열리면 그 방향은 그냥 RTDB로 흐른다(퇴행 0). TURN 없음.

## 통합 지점 (index.html, OnlineManager)

정확히 4곳. 1v1·팀(3v3/PVE) 모두 공유:
- **송신 입력** `OnlineManager.writeInput(inp)` (~L1478) — 게스트→호스트. `inputs/<key>` set.
- **송신 상태** `OnlineManager.writeHostState(st)` (~L1483) — 호스트→게스트. `state` set. (팀은 `tHostWriteState`→이걸 호출)
- **수신 입력(host)** `listenRoom` `inputsRef.on` icb (~L1439) → `self.inputs`.
- **수신 상태(guest)** `listenRoom` `stateRef.on` scb (~L1448) → `self.onlineState`.

키: 1v1 = "host"/"guest"(mySlot=null), 팀 = "p1".."p6"(mySlot). `key=mySlot||role`.

## 토폴로지 / 시그널링

- **Star**: 호스트가 허브. 게스트마다 호스트와 DC 1개(6인이면 호스트가 DC 5개, 풀메시 아님).
- **시그널링**: 기존 방 노드 재활용 → `starArenaOnline/rooms/<code>/signal/<guestSlot>/{offer,answer,hostIce[],guestIce[]}`. DB 규칙(`$roomCode` 하위 auth 허용) 그대로, 규칙 변경 불필요.
- **역할**: 게스트=offerer(DataChannel 생성+offer), 호스트=answerer(슬롯별 응답). 게스트가 방에 들어와 offer를 올리면 호스트가 그 슬롯용 RTCPeerConnection을 만들어 answer. 게스트 입장마다 자연 확장.
- **DataChannel**: `{ordered:false, maxRetransmits:0}` (실시간 상태는 최신만 중요, 재전송 대기 금지). nettest.html에서 검증된 핸드셰이크(offer/answer/trickle ICE, 원격설명 전 ICE 버퍼링) 그대로 이식.

## RTCNet 모듈 (신설, OnlineManager 뒤)

상태: `on`(플래그), `role`, `peers{slot→{pc,dc,open,remoteSet,iceBuf}}`(host), `self{...}`(guest),
`sigRef`, `stateSeq`, `lastStateSeq`, `inputSeq`, `lastInputSeq{slot→seq}`, `_unsubs[]`.

- `begin()` — 방 입장(listenRoom) 직후 호출. role 따라 `_hostListen()`/`_guestStart(slot)`.
- `_guestStart(slot)` — PC+DC 생성, offer→`signal/<slot>/offer`, answer/hostIce 구독, guestIce push.
- `_hostListen()` — `signal` value 구독, 새 게스트 슬롯 offer 감지 시 `_hostAcceptGuest(slot)`.
- `_hostAcceptGuest(slot)` — 슬롯 PC 생성, ondatachannel, offer 읽고 answer, ICE 교환.
- 수신: 게스트 DC onmessage→`_onStateMsg`(seq 가드 후 `OnlineManager.onlineState` 갱신), 호스트 DC onmessage→`_onInputMsg(slot)`(seq 가드 후 `OnlineManager.inputs[slot]`).
- 송신: `sendState(st)`(열린 게스트 DC 브로드캐스트, `st._sq=++stateSeq`), `sendInput(inp,key)`(내 DC로, `inp._sq=++inputSeq`). DC 미개방이면 false 반환 → 호출부가 RTDB로.
- `reset()` — 모든 PC/DC 닫고 구독 해제(leaveRoom에서 호출).

## 송/수신 통합 방식 (2026-07-07 현행 — 가산 모델로 확정)

> ⚠️ 초기 설계는 "입력은 DC 열리면 DC만"이었으나, **half-open DataChannel**(readyState=open인데 실제로 죽어 ICE-failed 감지까지 수 초간 입력 유실) 위험 때문에 **입력도 '둘 다 보내기 + seq dedup'로 변경**. 입력 패킷은 작아 RTDB 병행 비용이 미미하고 안전이 우선.

- **writeInput(입력)**: `RTCNet.sendInput(inp,key)`(DC 열렸으면 DC로, inp._sq 부여) **+ 항상 RTDB set**. 수신측 icb가 슬롯별 seq로 dedup(DC가 먼저 적용→RTDB 사본 드롭). half-open이어도 RTDB로 안전 도달. onDisconnect emptyInput(_sq 없음)은 그대로 통과=클리어.
- **writeHostState(상태)**: `RTCNet.sendState(st)`(열린 DC 브로드캐스트, st._sq 부여) + **RTDB floor를 적응형으로**:
  - DC 없음 → RTDB 항상(유일 통로).
  - DC 있고 **모든 사람 게스트가 DC**(`RTCNet.allGuestsOpen()`) → RTDB를 `RTC_RTDB_FALLBACK_FPS`(=5Hz)로 억제(Firebase 절약). DC가 30Hz로 부드러움 담당.
  - DC 있으나 **RTDB-only 게스트가 하나라도 있음** → RTDB 15Hz(그 학생 보호). DC 죽으면 allGuestsOpen=false라 **자동 15Hz 복귀(self-healing)**.
  - 수신측 scb가 seq로 dedup → DC/RTDB 히칭 없음.
- **scb(수신 상태)**: `if(v._sq!==undefined){ if(v._sq<=RTCNet.lastStateSeq) return; RTCNet.lastStateSeq=v._sq; }` 후 기존대로.
- **icb(수신 입력)**: 슬롯별 병합+seq 가드로 변경(기존 통째 replace→merge). `_sq` 없으면(플래그 OFF/onDisconnect emptyInput) 그냥 적용(하위호환·연결끊김 클리어 유지).

## 플래그/롤아웃

- `const RTC_ENABLED = true|false` 상수. `RTCNet.on=RTC_ENABLED`.
- 1단계: 구현 + `RTC_ENABLED=false`로 회귀 검증(전 하니스 PASS·헤드리스 로드). 게임 무변경 확인.
- 2단계: `true`로 켜고 Playwright 2클라이언트 실측(방 생성/입장/매치, DC 개방·상태흐름·격리 시 폴백). 배지/로그로 DC 활성 확인.
- 3단계: 실기기 3v3 확인 → 확정.

## 검증

- 하니스: harness_online / online_rules / online_packets (mock DB) — seq 가드·merge icb 회귀 없어야. 필요 시 RTCNet mock(정적) 추가.
- 라이브: 로컬 http 서버 + Playwright 2탭(같은 머신은 host 후보로 즉시 개방=DC 경로 검증), 실기기는 교사가.
- 진행 배지: 게스트 우상단 넷 배지에 "P2P" 표기 추가(DC 활성 시) — 교사가 육안 확인.

## 리스크/주의

- DC half-open(열렸는데 죽음): ICE failed 감지 + (후속)워치독. v1은 RTDB floor가 항상 돌아 상태는 계속 옴.
- 팀 모드 슬롯 재사용/봇 인계: 게스트 DC는 슬롯 키로 관리, 끊기면 open=false→RTDB. 호스트 봇 인계 로직(tUpdateHost)은 그대로.
- `_sanitizePacket`: `_sq`(숫자) 통과. DC JSON.parse 실패는 무시.
- 미러: index.html↔star_arena.html 바이트 동일 유지(커밋 전 cp+cmp).
