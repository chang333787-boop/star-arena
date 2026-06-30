# reference 폴더 — 원본 디자인 시트 3장

채팅에 붙여주신 3장의 이미지를 **여기에 이 이름 그대로** 저장하세요.
(저는 채팅에 붙인 이미지의 원본 파일에는 접근할 수 없어서, 선생님이 한 번 저장해 주셔야 합니다.)

```
reference/
  01_fixed_character_weapon_master.png   ← 1번: 캐릭터+고정 도구 (아이들/공격/무기 아이콘)
  02_basic_motion_master.png             ← 2번: 기본 모션 시트 (대기/이동/공격/피격/리턴) ★1차 적용 핵심
  03_development_reference_sheet.png      ← 3번: 개발 참고(방향/발사체/피격효과/궁극기)
```

## 저장 방법
- 채팅의 각 이미지를 우클릭 → "이미지를 다른 이름으로 저장" → 위 파일명으로 이 폴더에 저장.
- PNG로 저장하세요(JPG도 동작하지만 PNG 권장).

## 저장한 뒤
프로젝트 폴더에서 한 번만 실행하면 캐릭터 5프레임 + 무기 아이콘이 자동으로 잘려 들어가고 게임에 켜집니다:
```
pip install pillow      (한 번만)
python tools/slice_assets.py
```
자세한 내용은 `../STUDENT_ASSET_INTAKE.md` 참고.
