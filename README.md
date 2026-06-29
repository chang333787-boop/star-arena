# 별빛 아레나 (Star Arena) — 확장판

크롬북 Chrome에서 **인터넷 없이 바로 실행**되는 1인용 대 컴퓨터 아레나 슈팅 게임입니다.
외부 라이브러리·이미지·사운드 없이 순수 HTML/Canvas 한 파일(`index.html`)로 만들었습니다.

학생 피드백을 반영해 캐릭터·무기·맵·난이도·모드, 닉네임/프로필/골드 저장, 보스전까지 넣었습니다.

---

## 바로 하기 (학생용)

- **온라인 링크**: GitHub Pages 주소로 접속하면 설치 없이 바로 플레이됩니다.
- **파일로 하기**: `index.html`(또는 `star_arena.html`)을 더블클릭하면 브라우저에서 바로 실행됩니다.
- 키보드가 있는 크롬북/PC에서 하세요. (마우스·터치 조작은 없습니다)

## 조작 방법

- **방향키** : 이동 (두 개를 같이 누르면 대각선)
- **Z** : 기본 공격 (누르고 있으면 연속 발사)
- **X** : 궁극기 (게이지가 가득 찼을 때)
- **P** : 일시 정지 / 다시 시작
- **Enter** : 선택 · 시작 / **R** : 결과 화면에서 즉시 다시 시작 / **Esc** : 뒤로/시작 화면

### 시작 화면 메뉴
- **↑ ↓** : 항목 이동, **← →** : 값 바꾸기, **Enter** : 실행
- 단축키 : `C` 캐릭터 · `W` 무기 · `D` 난이도 · `M` 맵 · `T` 모드 · `N` 닉네임 · `S` 상점 · `O` 온라인

---

## 새로 추가된 기능

- **캐릭터 20명** (처음 3명: 루미·볼트·노바 무료, 나머지는 골드로 상점에서 해금)
- **캐릭터별 궁극기 3종**
  - 루미형(`burst`) : 주변 원형 폭발 + 밀쳐내기
  - 볼트형(`dash`) : 바라보는 방향으로 돌진하며 닿는 적에게 피해
  - 노바형(`triple`) : 5발을 부채꼴로 발사
- **무기 10종** (처음 1개 무료, 무기마다 발사 수·피해·속도·사거리·연사가 다름)
- **맵 3종** : 별빛 훈련장 / 수정 동굴 / 은하 정원
- **난이도 3단계** : 쉬움 / 보통 / 어려움
- **모드 3종** : 1대1 / 2대1(아군 1명) / 3대3(아군 2명) — 모두 컴퓨터(로컬 AI)와 대결
- **보스전** : 적을 5번 쓰러뜨리면 강한 "보스 크롬" 등장 (1대1·2대1에서)
- **닉네임 / 프로필 / 골드 저장** : 브라우저에 자동 저장(`localStorage`), 다음에 와도 유지
- **상점 / 수집** : 골드로 캐릭터·무기 해금
- **승리 보상** : 승리/처치/보스/난이도/모드에 따라 골드 획득, 일정 확률로 새 무기 획득

### 닉네임 / 프로필 / 골드 저장
- 시작 화면에서 `N`(또는 닉네임 변경 항목 Enter)으로 닉네임을 정합니다(2~10글자).
- 골드, 승/패, 플레이 수, 처치 수, 보스 처치 수, 보유 캐릭터/무기가 자동 저장됩니다.
- 저장 위치 키: `starArena.profile.v2`

### 온라인 1대1 대전 (베타)
친구와 인터넷으로 1대1 대결을 할 수 있습니다. Firebase 설정이 있어야 켜지고,
설정이 없으면 자동으로 꺼져 로컬(컴퓨터 AI) 모드만 정상 작동합니다.

> **현재 상태:** `index.html`의 `FIREBASE_CONFIG`가 **class-rpg(`class-rpg-6f409`) 프로젝트로 설정되어 있습니다.**
> 온라인이 실제로 동작하려면 그 Firebase 콘솔에서 ① **Authentication → 익명(Anonymous) 로그인 사용**,
> ② **Realtime Database 규칙**에 아래 `starArenaOnline` 규칙 추가, ③ **Authentication → 설정 → 승인된 도메인**에
> `chang333787-boop.github.io` 추가가 되어 있어야 합니다. (셋 다 콘솔에서 직접 설정)

플레이 방법(설정을 넣은 뒤):
1. 시작 화면에서 **O** 키 → 온라인 메뉴
2. 한 명이 **방 만들기** → 4글자 방 코드가 표시됨
3. 다른 한 명이 **방 코드로 입장** → 코드 입력
4. 방장이 **Enter** 로 시작 → 두 사람의 온라인 1대1 시작
5. **방향키 이동 · Z 공격** (베타에서는 궁극기 비활성). **Esc** 로 방 나가기
- 90초 동안 더 많이 쓰러뜨린 쪽이 승리. 상대가 나가면 "연결 끊김" 표시 후 종료됩니다.
- 베타에서는 맵은 **별빛 훈련장**만, **골드 보상은 없습니다**.

#### Firebase 설정 방법 (선생님/관리자용)
1. https://console.firebase.google.com 에서 프로젝트 생성
2. **Realtime Database** 만들기(지역 선택) → 데이터베이스 URL 확인
3. **Authentication → 로그인 방법 → 익명(Anonymous)** 사용 설정
4. 프로젝트 설정 → 웹 앱 추가 → 설정값 복사
5. `index.html` 상단의 `const FIREBASE_CONFIG = null;` 을 아래처럼 교체:
```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://...firebasedatabase.app",  // 필수
  projectId: "...",
  appId: "..."
};
```
(Firebase SDK는 인터넷에서 자동으로 불러옵니다. 온라인 기능은 인터넷이 필요합니다.)

#### Realtime Database 보안 규칙 (테스트용)
```json
{
  "rules": {
    "starArenaOnline": {
      "rooms": {
        "$roomCode": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```
- ⚠️ 위는 **수업용 베타 규칙**입니다(로그인한 사용자면 누구나 방을 읽고 쓸 수 있음).
- 실제 공개 서비스로 쓰려면 방장/참가자만 수정할 수 있도록 규칙을 강화하세요.
- **Firebase 설정을 넣지 않으면** 온라인은 비활성화되고 로컬 게임만 작동합니다.

> 데이터 구조: `starArenaOnline/rooms/{방코드}` 아래 `meta`(상태/참가자/캐릭터), `players`(host·guest 입력), `state`(호스트가 계산해 쓰는 위치/체력/점수/탄환). 호스트가 권한을 갖고 계산하며, 참가자는 자기 입력만 씁니다.

---

## 학생들이 바꿔볼 수 있는 곳

`index.html` 맨 위 **★ 학생들이 바꿔볼 수 있는 설정 구역 ★** 안에 모아 두었습니다.
숫자나 데이터만 바꿔도 게임이 달라집니다.

- `GAME_CONFIG` : 시간·체력·속도·공격력·궁극기 등 기본 수치
- `DIFFICULTIES` : 난이도별 적 강함
- `REWARD_CONFIG` : 골드 보상
- `CHARACTERS` : 캐릭터 20명 (색·능력치·궁극기 종류·해금 비용)
- `WEAPONS` : 무기 10종 (피해·연사·발사 수 등)
- `MAPS` : 맵 3종 (장애물·풀숲·시작 위치)
- `MODES` : 1대1/2대1/3대3 설정

### 캐릭터 추가하기
`CHARACTERS` 배열에 새 항목을 추가하세요. `id`는 겹치지 않게, `superType`은 `"burst"`/`"dash"`/`"triple"` 중 하나로.
```js
{ id:"myhero", name:"내영웅", desc:"설명", color:"#33ff99", subColor:"#ffffff",
  hpMul:1.0, speedMul:1.0, damageMul:1.0, bulletSpeedMul:1.0,
  superType:"burst", superName:"필살기 이름", unlockCost:500, unlockedByDefault:false }
```

### 무기 추가하기
`WEAPONS` 배열에 추가하세요. `spreadCount`는 한 번에 나가는 탄 수, `spreadAngleDeg`는 퍼지는 각도입니다.
```js
{ id:"myweapon", name:"내무기", desc:"설명", color:"#ffcc00",
  damageMul:1.0, cooldownMul:1.0, bulletSpeedMul:1.0, rangeMul:1.0, bulletRadiusMul:1.0,
  spreadCount:3, spreadAngleDeg:20, unlockCost:300, unlockedByDefault:false }
```

### 맵 추가하기
`MAPS` 배열에 추가하세요. 좌표는 1280×720 기준이며, 시작 위치는 장애물과 겹치지 않게 두세요.
```js
{ id:"mymap", name:"내맵", desc:"설명", floorColor:"#223", strokeColor:"#56a",
  playerSpawn:{x:120,y:560}, enemySpawn:{x:1160,y:150},
  obstacles:[ { x:580,y:300,w:120,h:120, kind:"crystal" } ],   // kind: crystal/box/rock
  bushes:[ { x:430,y:90,w:150,h:90 } ] }
```

---

## GitHub Pages로 실행/배포하기

- 이 저장소는 `main` 브랜치 루트의 `index.html`을 그대로 GitHub Pages로 서비스합니다.
- 게임을 고친 뒤 반영하려면:
  ```
  git add .
  git commit -m "수정 내용"
  git push
  ```
  약 1분 뒤 Pages 주소에 자동 반영됩니다.
- `index.html`과 `star_arena.html`은 같은 내용입니다(파일 앱에서 바로 여는 용도로 둘 다 둠).

---

만든 도구: HTML + Canvas + JavaScript (한 파일). 즐겁게 플레이하세요! ✨
