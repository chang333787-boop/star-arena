# 별빛 아레나 — 학생 캐릭터/도구 6슬롯 교체 표

내일 수업에서 학생 6명이 각각 **캐릭터 1개 + 놀이도구 1개**를 만듭니다.
처음 값은 임시(placeholder)입니다. 학생 결과물이 나오면 이 표를 채우고, `index.html`의 `// STUDENT_EDIT` 부분을 같은 내용으로 바꾸세요.
(능력치는 바꾸지 않습니다 — 밸런스 유지)

## 캐릭터 6슬롯

| 슬롯 | 캐릭터 id | 캐릭터 이름 | 역할 | 기본 도구 id | 도구 이름 | 대표색1 | 대표색2 | 특별기술 이름 | 학생/모둠 | 에셋 폴더 | 반영 | 메모 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | student_01 | 캐릭터1 | 균형형 | tool_01 | 별조각 발사기 | #5fc8ff | #ffe14d | (미정) | | assets/characters/student_01 | 미반영 | |
| 2 | student_02 | 캐릭터2 | 튼튼형 | tool_02 | 쿠션 방패 | #8fd9ff | #e6f7ff | (미정) | | assets/characters/student_02 | 미반영 | |
| 3 | student_03 | 캐릭터3 | 빠른형 | tool_04 | 종이비행기 런처 | #ffd23f | #fff3b0 | (미정) | | assets/characters/student_03 | 미반영 | |
| 4 | student_04 | 캐릭터4 | 원거리형 | tool_03 | 반짝 부메랑 | #ff7ad9 | #c98bff | (미정) | | assets/characters/student_04 | 미반영 | |
| 5 | student_05 | 캐릭터5 | 지원형 | tool_06 | 젤리 캡슐 | #5cf0c0 | #c7fff0 | (미정) | | assets/characters/student_05 | 미반영 | |
| 6 | student_06 | 캐릭터6 | 방해형/광역형 | tool_05 | 비눗방울 부채 | #b98bff | #e6d3ff | (미정) | | assets/characters/student_06 | 미반영 | |

## 도구(놀이도구) 6슬롯

| 슬롯 | 도구 id | 도구 이름 | 느낌 | 대표색 | 에셋 폴더 | 반영 | 메모 |
|---|---|---|---|---|---|---|---|
| 1 | tool_01 | 별조각 발사기 | 기본 단발 | #ffe066 | assets/weapons/tool_01 | 미반영 | |
| 2 | tool_02 | 쿠션 방패 | 크고 느리고 든든 | #b08bff | assets/weapons/tool_02 | 미반영 | |
| 3 | tool_03 | 반짝 부메랑 | 빠르고 멀리 | #ffd0a0 | assets/weapons/tool_03 | 미반영 | |
| 4 | tool_04 | 종이비행기 런처 | 가볍고 빠른 연사 | #fff7c2 | assets/weapons/tool_04 | 미반영 | |
| 5 | tool_05 | 비눗방울 부채 | 5갈래 퍼짐(근거리) | #fff0a0 | assets/weapons/tool_05 | 미반영 | |
| 6 | tool_06 | 젤리 캡슐 | 3갈래 부채꼴 | #7affd0 | assets/weapons/tool_06 | 미반영 | |

---

## 쓰는 법

1. 학생이 만든 이름/색/특별기술 이름을 위 표 빈칸에 적는다.
2. `index.html` 상단 `STUDENT_CHARACTERS` / `STUDENT_WEAPONS` 의 `// STUDENT_EDIT` 부분을 같은 값으로 바꾼다.
3. 그림(PNG)을 `에셋 폴더` 경로에 넣는다(파일 이름은 **ASSET_GUIDE.md** 참고).
4. `index.html` 의 `ASSETS_ENABLED` 를 `true` 로 바꾼다.
5. 게임 시작 화면에서 **F2** 로 “반영” 여부 확인 → 표의 `반영` 칸을 `반영`으로 갱신.

> 능력치(hpMul 등)는 균형이 맞춰져 있으니 바꾸지 않습니다.
> 그림이 없는 슬롯은 자동으로 도형(fallback)으로 나오며 게임은 정상 작동합니다.
