# 설계 — footprint 데이터 모델 (맵 에디터 전제조건)

> 상태: 설계 확정 대기. 구현은 이 문서 승인 후. (구현 시 `index.html` + `star_arena.html` 바이트 동일 반영 필요)
> 목적: 맵 에디터가 "칸 단위"로 배치·충돌 판정을 하게 만들되, **기존 충돌 엔진·기존 맵을 건드리지 않는다.**

## 현재 코드 실측 (근거)
- 격자: `STUDENT_CELL=56`, `STUDENT_COLS=22`, `STUDENT_ROWS=10`, `ARENA={x:24,y:70,w:1232,h:576}` (원점 24,70).
- 장애물 런타임 모델: **자유 픽셀 사각형** `{x,y,w,h,kind}` (예: `{x:580,y:298,w:120,h:120,kind:"crystal"}`).
- 충돌: `circleRectOverlap(cx,cy,r, rect)` — 원 vs 사각형, 픽셀 단위. `OBSTACLES` 배열을 순회.
- 결론: **엔진은 "사각형 리스트"만 있으면 된다.** footprint는 런타임 개념이 아니라 **저작(authoring) 개념**이어야 한다.

## 핵심 설계 원칙
**footprint(칸) = 에디터·저장 포맷 → 컴파일 시 기존 픽셀 사각형으로 변환.**
충돌 엔진은 그대로 사각형을 받는다. → **엔진 코드 0 변경, 기존 PVE/학생 맵 0 영향.** 순수 추가(additive).

## 1. footprint 테이블 (칸 단위, 규격서 1장 근거)
```js
// GAME_CONFIG/ARENA 근처에 추가
const FOOTPRINTS = {
  // kind        : {cols, rows}   // 막는 칸 수
  crystal : {cols:1, rows:1},
  box     : {cols:1, rows:1},
  rock    : {cols:1, rows:1},
  wall    : {cols:1, rows:1},   // 쿠션벽 (타일셋)
  bush    : {cols:1, rows:1},   // 수풀 (타일셋, 엄폐 — 충돌은 X일 수 있음)
  trap    : {cols:1, rows:1},   // 바닥 데칼
  heal    : {cols:1, rows:1},
  monster : {cols:1, rows:1},
  boss    : {cols:2, rows:2},
  gate    : {cols:2, rows:1},   // 몬스터 문
  core    : {cols:2, rows:2},   // 방어 수정
};
```

## 2. 칸 ↔ 픽셀 변환 헬퍼
```js
const CS = STUDENT_CELL; // 56
function cellRect(col, row, kind){
  const fp = FOOTPRINTS[kind] || {cols:1, rows:1};
  return { x: ARENA.x + col*CS, y: ARENA.y + row*CS,
           w: fp.cols*CS, h: fp.rows*CS, kind };
}
function pxToCell(x, y){ return { col: Math.round((x-ARENA.x)/CS), row: Math.round((y-ARENA.y)/CS) }; }
```

## 3. 에디터 저장 포맷 (신규 맵)
```js
// 맵 데이터에 칸 단위로 저장 → 로드 시 cellRect()로 컴파일
placements: [ {col:5, row:3, kind:"boss"}, {col:10, row:0, kind:"gate"}, ... ]
// 로드: const OBSTACLES = placements.map(p => cellRect(p.col, p.row, p.kind));
```
- 기존 `{x,y,w,h,kind}` 자유 사각형 맵은 **그대로 지원**(하위호환): 로드 시 placements 없으면 기존 배열 사용.

## 4. 에디터 배치 유효성 판정 (칸 점유)
```js
// 격자 점유 비트맵으로 "겹침·범위 밖" 판정
function canPlace(col, row, kind, occupied){
  const fp = FOOTPRINTS[kind] || {cols:1,rows:1};
  if(col<0 || row<0 || col+fp.cols>STUDENT_COLS || row+fp.rows>STUDENT_ROWS) return false;
  for(let r=row; r<row+fp.rows; r++) for(let c=col; c<col+fp.cols; c++)
    if(occupied[r][c]) return false;
  return true;
}
```

## 5. 변경 범위 / 리스크
| 항목 | 영향 |
|---|---|
| 충돌 엔진(`circleRectOverlap`, `OBSTACLES` 순회) | **변경 없음** — 여전히 사각형 받음 |
| 기존 PVE 맵(자유 픽셀 사각형) | **영향 없음** — 하위호환 유지 |
| 기존 학생 맵(문자 격자) | **영향 없음** — 별도 경로 |
| 신규 추가 | `FOOTPRINTS`, `cellRect`, `pxToCell`, `canPlace` (순수 함수/상수) |
| 파일 | `index.html` + `star_arena.html` **바이트 동일 반영 필수** |

## 6. 런타임 라우팅 (코드 실측으로 확정됨)
컴파일 시 kind별로 **다른 배열**로 보낸다. footprint(점유 칸)는 에디터 배치 판정엔 전부 쓰이지만, 런타임 역할은 다름:

| kind | 런타임 배열 | 충돌 | 근거 |
|---|---|---|---|
| crystal·box·rock·wall·gate·core·structure | `OBSTACLES` | ✅ 막음 | `circleRectOverlap(…,OBSTACLES)` |
| **bush** | `BUSHES` (별도) | ❌ 안 막음 | 엄폐/은신 전용 (`inBush`, `bushRevealDistance`) — OBSTACLES와 무관 |
| trap | `TRAPS` (별도) | ❌ (효과만) | 데미지/둔화 판정 |
| monster·boss·heal | 엔티티/픽업 | 별도 | 유닛 스폰 |

- **구조물(벽·문·코어)**은 이미 런타임에 `OBSTACLES.push({x:sd.x-def.w/2, …, kind:"structure", sid})` 되고, 파괴 시 `OBSTACLES.filter(o=>o.sid!==id)`로 제거됨(5243·5250줄). → 에디터 구조물도 이 패턴 그대로 컴파일하면 됨.
- 즉 컴파일 함수는 `cellRect()`로 사각형 만든 뒤 **kind에 따라 OBSTACLES / BUSHES / TRAPS로 분배**.

## 7. 미결 (구현 전 확인)
- 보스/문의 접지선 기준 — 그림 앵커(하단)와 footprint 사각형 정렬 방식.
- @2x 소스(112px) → 56px 렌더 스케일이 footprint와 무관하게 시각 크기만 결정하는지 확정.
