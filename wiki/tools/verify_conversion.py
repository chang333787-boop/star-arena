#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⭐→절대치 변환표 전수 검산 스크립트 (RPG-0 게이트)
==================================================
단일 출처: RPG모드_PRD.md §7.5 (파워버짓·변환표)
정본 문서: wiki/변환표_밸런스.md (이 스크립트의 출력을 수록)

검산 항목
  [1] 몬스터  — ⭐예산 7(각 스탯 1~5, 합≤7) 전 조합이 티어1 버짓(≤35) 통과
  [2] 도구    — ⭐예산 6/7/8(입수 시기 Lv1/3/5) 전 조합이 DPS 버짓(≤15+levelReq×3) 통과
  [3] 스킬    — ⭐예산 6 전 조합이 위력 버짓(dmgMul×100/cd ≤ 60) 통과
  [4] 기본 콘텐츠 교차 검산 — PRD §7.5 채점표 값과 재계산 일치(몬스터 7·도구 7·스킬 3)
  [5] 상한표 정합 — 변환표가 만드는 절대치가 §7.1 상한표 범위 안

종료 코드: 0 = 전 항목 PASS / 1 = 실패 존재
실행: python3 wiki/tools/verify_conversion.py
추후 harness_rpg.js 에 같은 검산을 이식해 게이트로 고정한다(§7.5).
"""

import sys

FAIL = []


def check(cond, msg):
    if not cond:
        FAIL.append(msg)
    return cond


# ────────────────────────────────────────────────────────────
# [1] 몬스터 변환표 (PRD 부록 확정치)
# ────────────────────────────────────────────────────────────
MON_HP  = {1: 12, 2: 25, 3: 45, 4: 80, 5: 130}
MON_ATK = {1: 2,  2: 4,  3: 6,  4: 9,  5: 13}
MON_SPD = {1: 40, 2: 70, 3: 110, 4: 160, 5: 220}
MON_STAR_BUDGET = 7          # 체력⭐+공격⭐+빠르기⭐ ≤ 7
TIER1_CAP = 20 + 1 * 15      # 티어1(들판) 버짓 상한 = 35


def mon_budget(hp, atk, spd):
    """PRD §7.5: hp/10 + atk×2 + speed/30"""
    return hp / 10 + atk * 2 + spd / 30


def verify_monsters():
    rows, worst = [], (None, -1.0)
    for h in range(1, 6):
        for a in range(1, 6):
            for s in range(1, 6):
                if h + a + s > MON_STAR_BUDGET:
                    continue
                hp, atk, spd = MON_HP[h], MON_ATK[a], MON_SPD[s]
                b = mon_budget(hp, atk, spd)
                ok = b <= TIER1_CAP
                check(ok, f"[몬스터] ⭐({h},{a},{s}) 버짓 {b:.1f} > {TIER1_CAP}")
                # 상한표: hp 5~500 · atk 1~25
                check(5 <= hp <= 500, f"[몬스터] hp {hp} 상한표(5~500) 이탈")
                check(1 <= atk <= 25, f"[몬스터] atk {atk} 상한표(1~25) 이탈")
                rows.append((h, a, s, hp, atk, spd, b, ok))
                if b > worst[1]:
                    worst = ((h, a, s), b)
    # PRD 명시값 고정: 최대 28.5 = ⭐(1,5,1)
    check(abs(worst[1] - 28.5) < 0.05,
          f"[몬스터] 전수 최대 버짓 {worst[1]:.2f} ≠ PRD 명시 28.5")
    check(worst[0] == (1, 5, 1),
          f"[몬스터] 최대 버짓 조합 {worst[0]} ≠ PRD 명시 (1,5,1)")
    check(len(rows) == 35, f"[몬스터] 합법 조합 수 {len(rows)} ≠ 35(수학적 기대값)")
    return rows, worst


# ────────────────────────────────────────────────────────────
# [2] 도구 변환표 (RPG-0 신규 도출 — 같은 역산 원칙)
# ────────────────────────────────────────────────────────────
WPN_DMG = {1: 4, 2: 7, 3: 10, 4: 14, 5: 18}                 # 세기⭐ → 피해
WPN_CD  = {1: 1.20, 2: 0.95, 3: 0.75, 4: 0.60, 5: 0.50}     # 빠르기⭐ → 공속(초, ⭐↑=빠름)
WPN_OPTIONS = {1: 6, 3: 7, 5: 8}                             # 입수 시기 levelReq → ⭐예산


def wpn_cap(level_req):
    """PRD §7.5: 편도 DPS ≤ 15 + levelReq×3"""
    return 15 + level_req * 3


def verify_weapons():
    rows = []
    worst_by_opt = {}
    for lv, budget in WPN_OPTIONS.items():
        cap, worst = wpn_cap(lv), (None, -1.0)
        for d in range(1, 6):
            for s in range(1, 6):
                if d + s > budget:
                    continue
                dmg, cd = WPN_DMG[d], WPN_CD[s]
                dps = dmg / cd
                ok = dps <= cap
                check(ok, f"[도구] Lv{lv}(예산{budget}) ⭐({d},{s}) DPS {dps:.1f} > {cap}")
                # 상한표: dmg 1~30 · cd 0.35~2.0
                check(1 <= dmg <= 30, f"[도구] dmg {dmg} 상한표(1~30) 이탈")
                check(0.35 <= cd <= 2.0, f"[도구] cd {cd} 상한표(0.35~2.0) 이탈")
                rows.append((lv, budget, d, s, dmg, cd, dps, cap, ok))
                if dps > worst[1]:
                    worst = ((d, s), dps)
        worst_by_opt[lv] = worst
    return rows, worst_by_opt


# ────────────────────────────────────────────────────────────
# [3] 스킬 변환표 (RPG-0 신규 도출 — 같은 역산 원칙)
# ────────────────────────────────────────────────────────────
SKL_MUL = {1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5, 5: 1.9}          # 세기⭐ → dmgMul
SKL_CD  = {1: 10.0, 2: 8.0, 3: 6.0, 4: 4.5, 5: 3.0}         # 기다림⭐ → cd(초, ⭐↑=짧음)
SKL_STAR_BUDGET = 6
SKL_CAP = 60                                                 # PRD §7.5: dmgMul×100/cd ≤ 60


def skl_power(mul, cd):
    return mul * 100 / cd


def verify_skills():
    rows, worst = [], (None, -1.0)
    for p in range(1, 6):
        for w in range(1, 6):
            if p + w > SKL_STAR_BUDGET:
                continue
            mul, cd = SKL_MUL[p], SKL_CD[w]
            v = skl_power(mul, cd)
            ok = v <= SKL_CAP
            check(ok, f"[스킬] ⭐({p},{w}) 위력 {v:.1f} > {SKL_CAP}")
            rows.append((p, w, mul, cd, v, ok))
            if v > worst[1]:
                worst = ((p, w), v)
    check(len(rows) == 15, f"[스킬] 합법 조합 수 {len(rows)} ≠ 15")
    return rows, worst


# ────────────────────────────────────────────────────────────
# [4] 기본 콘텐츠 교차 검산 (PRD §4.3·§4.4·§4.5 ↔ §7.5 채점표)
# ────────────────────────────────────────────────────────────
DEFAULT_MONSTERS = [
    # (이름, hp, atk, 이속(가변은 시간가중 평균), 티어, PRD 채점표 값)
    ("그림자 젤리",  15, 4, 100, 1, 12.8),
    ("뿔깡총",       26, 6, 70,  1, 16.9),   # 0↔240 시간가중 평균 ≈70
    ("씨앗총사",     22, 5, 0,   1, 12.2),
    ("가시딱지",     60, 7, 70,  1, 22.3),
    ("부슬이",       38, 8, 150, 2, 24.8),
    ("달빛 부엉이",  48, 6, 115, 2, 20.6),
    ("그늘 조각",   110, 8, 130, 2, 31.3),
    # 보스 뭉게대왕: isBoss=버짓 면제(교사 직접 검수) — 검산 대상 제외
]

DEFAULT_WEAPONS = [
    # (이름, dmg(편도), cd, levelReq, PRD 채점표 DPS)
    ("맨손",         5, 0.50, 1, 10.0),
    ("호미",         9, 0.60, 1, 15.0),
    ("낡은 부메랑",  7, 0.70, 3, 10.0),
    ("별조각 단검",  8, 0.35, 3, 22.9),
    ("무쇠 별검",   16, 0.75, 5, 21.3),
    ("장난감 별활", 13, 0.85, 6, 15.3),
    ("반짝 부메랑", 10, 0.60, 9, 16.7),
]

DEFAULT_SKILLS = [
    # (이름, dmgMul, cd) — 게이지형(반짝 질주)·패시브는 공식 비적용
    ("빙글 베기",       1.2, 5.0),
    ("별똥별 내리치기", 2.0, 8.0),
    ("세갈래 던지기",   0.7, 7.0),
]


def verify_defaults():
    out = []
    for name, hp, atk, spd, tier, prd in DEFAULT_MONSTERS:
        b = mon_budget(hp, atk, spd)
        cap = 20 + tier * 15
        check(abs(round(b, 1) - prd) < 0.05, f"[기본몬스터] {name} 재계산 {b:.1f} ≠ PRD {prd}")
        check(b <= cap, f"[기본몬스터] {name} 버짓 {b:.1f} > 티어{tier} 상한 {cap}")
        out.append(("몬스터", name, f"{b:.1f}", f"≤{cap}", prd))
    for name, dmg, cd, lv, prd in DEFAULT_WEAPONS:
        dps = dmg / cd
        cap = wpn_cap(lv)
        check(abs(round(dps, 1) - prd) < 0.05, f"[기본도구] {name} 재계산 {dps:.1f} ≠ PRD {prd}")
        check(dps <= cap, f"[기본도구] {name} DPS {dps:.1f} > 상한 {cap}")
        out.append(("도구", name, f"{dps:.1f}", f"≤{cap}", prd))
    for name, mul, cd in DEFAULT_SKILLS:
        v = skl_power(mul, cd)
        check(v <= SKL_CAP, f"[기본스킬] {name} 위력 {v:.1f} > {SKL_CAP}")
        out.append(("스킬", name, f"{v:.1f}", f"≤{SKL_CAP}", "—"))
    return out


# ────────────────────────────────────────────────────────────
# 출력 (마크다운 표 — 변환표_밸런스.md 수록용)
# ────────────────────────────────────────────────────────────
def main():
    mon_rows, mon_worst = verify_monsters()
    wpn_rows, wpn_worst = verify_weapons()
    skl_rows, skl_worst = verify_skills()
    defaults = verify_defaults()

    print("## [1] 몬스터 전수 검산 — ⭐예산 7 · 티어1 상한 35")
    print(f"조합 수 {len(mon_rows)} · 최대 버짓 {mon_worst[1]:.1f} ⭐{mon_worst[0]} · 여유 {TIER1_CAP - mon_worst[1]:.1f}\n")
    print("| 체력⭐ | 공격⭐ | 빠르기⭐ | HP | 공격 | 이속 | 버짓 | 판정 |")
    print("|---|---|---|---|---|---|---|---|")
    for h, a, s, hp, atk, spd, b, ok in mon_rows:
        print(f"| {h} | {a} | {s} | {hp} | {atk} | {spd} | {b:.1f} | {'✅' if ok else '❌'} |")

    print("\n## [2] 도구 전수 검산 — 입수 시기별 ⭐예산 6/7/8")
    for lv, (combo, dps) in wpn_worst.items():
        print(f"- Lv{lv}(예산 {WPN_OPTIONS[lv]}): 최대 DPS {dps:.1f} ⭐{combo} ≤ 상한 {wpn_cap(lv)} · 여유 {wpn_cap(lv) - dps:.1f}")
    print("\n| 입수 시기 | ⭐예산 | 세기⭐ | 빠르기⭐ | 피해 | 공속(s) | DPS | 상한 | 판정 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for lv, budget, d, s, dmg, cd, dps, cap, ok in wpn_rows:
        print(f"| Lv{lv} | {budget} | {d} | {s} | {dmg} | {cd:.2f} | {dps:.1f} | ≤{cap} | {'✅' if ok else '❌'} |")

    print("\n## [3] 스킬 전수 검산 — ⭐예산 6 · 위력 상한 60")
    print(f"조합 수 {len(skl_rows)} · 최대 위력 {skl_worst[1]:.1f} ⭐{skl_worst[0]} · 여유 {SKL_CAP - skl_worst[1]:.1f}\n")
    print("| 세기⭐ | 기다림⭐ | 배수 | 재사용(s) | 위력 | 판정 |")
    print("|---|---|---|---|---|---|")
    for p, w, mul, cd, v, ok in skl_rows:
        print(f"| {p} | {w} | ×{mul} | {cd:.1f} | {v:.1f} | {'✅' if ok else '❌'} |")

    print("\n## [4] 기본 콘텐츠 교차 검산 (PRD §7.5 채점표 일치 여부)")
    print("| 분류 | 이름 | 재계산 | 상한 | PRD 채점표 |")
    print("|---|---|---|---|---|")
    for kind, name, v, cap, prd in defaults:
        print(f"| {kind} | {name} | {v} | {cap} | {prd} |")

    print()
    if FAIL:
        print(f"❌ FAIL {len(FAIL)}건")
        for m in FAIL:
            print(" -", m)
        sys.exit(1)
    total = len(mon_rows) + len(wpn_rows) + len(skl_rows) + len(defaults)
    print(f"✅ ALL PASS — 검사 {total}건(몬스터 {len(mon_rows)} · 도구 {len(wpn_rows)} · 스킬 {len(skl_rows)} · 기본 콘텐츠 {len(defaults)}) · 실패 0")
    sys.exit(0)


if __name__ == "__main__":
    main()
