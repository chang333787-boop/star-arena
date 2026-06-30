# 학생 에셋 적용 (1차) — STUDENT_ASSET_INTAKE

## ✅ 실제 적용 결과 (2026-06-30, v1.14)
- **캐릭터 6명 × 5프레임 = 30개 PNG 생성 완료** (idle/move/attack/hit/return), `ASSETS_ENABLED=true`.
- **무기 아이콘 6개 생성 완료** (icon.png). 발사체/적중효과(projectile/effect_hit)는 **미적용 → 색 원형 fallback**.
- reference 3장(`reference/`)에서 `tools/slice_assets.py`로 자동 컷 + 배경 투명화. 행/열 좌표와 여백을 보정해 옆칸 침범·이름글자 제거.
- 검증: 럭키/달이/시고니/눈꽃/모아/별골렘 각 행 정확, attack에 고정 도구 보임, 모아 다리·별골렘 형태 유지 확인. 하네스 4종 PASS.
- 남은 제한: 발사체/적중효과 미적용, 온라인 hit 프레임 미표시, 일부 프레임 우측에 아주 작은 잔여 스파클이 남을 수 있음(추후 미세조정). 다시 자르려면 `python tools/slice_assets.py` (상단 MOTION/MASTER 좌표 조정 가능).

---


이번 적용은 **idle / move / attack / hit / return 5프레임** 방식입니다. (방향별 세부 모션은 추후 고도화)
캐릭터와 도구는 **고정 매칭**이며, reference 시트의 이름/외형/무기 모양을 **재해석하지 않습니다.**

## 고정 매칭 (reference 01번 기준)
| 슬롯 | 캐릭터 | 도구 |
|---|---|---|
| student_01 | 럭키 | tool_01 별조각 발사기 |
| student_02 | 달이 | tool_02 종이비행기 런처 |
| student_03 | 시고니 | tool_03 반짝 부메랑 |
| student_04 | 눈꽃 | tool_04 비눗방울 부채 |
| student_05 | 모아 | tool_05 쿠션 방패 |
| student_06 | 별골렘 | tool_06 젤리 캡슐 |

> 코드의 `defaultWeaponId`가 위 매칭과 일치하도록 맞췄고, 캐릭터/도구 **이름**도 reference로 바꿨습니다.
> ⚠ 능력치(숫자)는 각 슬롯값을 **그대로 유지**(밸런스 불변)했습니다. 그래서 일부 도구는 이름과 동작이 살짝 다를 수 있어요(예: 비눗방울 부채가 현재 단발). 원하면 능력치 재조정은 별도로 요청하세요.

## 필요한 파일 (각 캐릭터 5개 + 각 도구 3개)
```
assets/characters/student_01/  idle.png  move.png  attack.png  hit.png  return.png
assets/characters/student_02/  (동일)
... student_06 까지
assets/weapons/tool_01/        icon.png  projectile.png  effect_hit.png
... tool_06 까지
```
- **idle/move/attack/hit/return** = reference **02_basic_motion_master.png** 의 대기/이동/공격/피격/리턴 칸.
- **attack** 은 반드시 그 캐릭터가 자기 고정 도구를 든 모습이어야 합니다(시트가 이미 그렇게 되어 있음).
- **icon** = 01번(또는 03번)의 무기 아이콘, **projectile/effect_hit** = 03번 발사체/피격효과 영역.
- 배경은 가능하면 투명(슬라이서가 모서리 배경을 자동 투명 처리).

## 적용 방법 (한 번에)
1. 채팅의 3장을 `reference/` 에 정확한 이름으로 저장 (reference/README.md 참고)
2. 프로젝트 폴더에서:
   ```
   pip install pillow
   python tools/slice_assets.py
   ```
   → 캐릭터 30장 + 무기 아이콘 6장 자동 생성 + `ASSETS_ENABLED=true` 자동 설정.
3. 게임을 열고 **F2(에셋 확인)** 로 캐릭터별 대기/이동/공격/피격/리턴 · 도구 아이콘/발사체/적중효과 상태를 확인.
4. 위치가 어긋나면 `tools/slice_assets.py` 상단의 `MOTION`/`MASTER` 비율값을 조금 바꿔 다시 실행.

> **발사체/적중효과**(projectile/effect_hit)는 시트 구조가 복잡해 슬라이서가 자동 생성하지 않습니다. 없으면 게임이 **색 원형 발사체로 자동 fallback** 합니다. 필요하면 03번 시트에서 직접 잘라 해당 폴더에 넣으세요.

## 렌더링 동작
- 평상시 idle / 이동 중 move / 공격 직후 attack / 피격 직후 hit / 리턴·탈락 return.
- 왼쪽을 보면 스프라이트를 좌우 반전(공격 방향이 자연스럽게).
- 무기 아이콘은 선택/카드 UI, 발사체는 탄환 그림에 사용.
- **이미지가 없거나 로드 실패하면 기존 Canvas 도형/원형으로 fallback** (게임은 멈추지 않음).
- 온라인(1v1/3v3/PVE)에서도 같은 규칙으로 표시됩니다(이미지는 전송하지 않고 캐릭터/도구 id로 각 클라이언트가 그림).

## 코드를 직접 손으로 켜려면
`tools/slice_assets.py` 없이 PNG만 직접 넣었다면, `index.html`(과 `star_arena.html`) 상단의
`let ASSETS_ENABLED = false;` 를 `true` 로 바꾸면 됩니다.
