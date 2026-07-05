#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_db.py — wiki/rpg_db.json 자기 검증기 (RPG모드_PRD.md v1.0 단일 출처)
검증 항목:
 ① §7.5 파워버짓 채점 = PRD 채점표 값과 일치 (몬스터 7종·isBoss 면제 / 도구 7종 편도 DPS / 스킬)
 ② 참조 무결성 (drops.itemId·reward.itemId·quest.target/item/to·requires·shop·jobs·skills·craft·phases)
    + 퀘스트 체인 도달성 + 별조각 순환 의존 해소(mq06 → mq07 선행)
 ③ §7.1 상한표 준수 (monster/weapon/crop/이름 길이 — 이름은 공백 제외 2~8자, isBoss는 hp·exp 면제=교사 직접 검수)
 ④ 경제 크리티컬 패스 (퀘스트 골드: 메인 460 + 사이드 120)
 ⑤ exp 총합 (퀘스트 730 = 메인 600 + 사이드 130 / expNeed 누적 1,069 / 사냥 갭 339 / 첫 렙업 온보딩)
maps 테이블·dialog 텍스트는 별도 에이전트 담당 — habitat↔maps 교차 검증은 맵 병합 후로 유예.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "..", "rpg_db.json")

errors = []
def check(cond, msg):
    if cond:
        return True
    errors.append(msg)
    return False

def section(title):
    print("\n== " + title + " ==")

with open(DB_PATH, encoding="utf-8") as f:
    db = json.load(f)

M = {m["id"]: m for m in db["monsters"]}
W = {w["id"]: w for w in db["weapons"]}
A = {a["id"]: a for a in db["armors"]}
I = {i["id"]: i for i in db["items"]}
S = {s["id"]: s for s in db["skills"]}
J = {j["id"]: j for j in db["jobs"]}
C = {c["id"]: c for c in db["crops"]}
Q = {q["id"]: q for q in db["quests"]}
N = {n["id"]: n for n in db["npcs"]}
EQUIPPABLE = set(I) | set(W) | set(A)          # drops 대상
REWARDABLE = EQUIPPABLE | set(C)               # reward.itemId 대상(crop=씨앗 지급 관례)

# ── 0. 테이블 행 수 ──────────────────────────────────────────────
section("0. 테이블 행 수")
for tbl, want in [("monsters", 8), ("weapons", 7), ("armors", 6), ("items", 9),
                  ("skills", 6), ("jobs", 3), ("crops", 6), ("quests", 10), ("npcs", 6)]:
    got = len(db[tbl])
    check(got == want, "%s: %d행 (기대 %d)" % (tbl, got, want))
    print("  %-9s %d행 %s" % (tbl, got, "OK" if got == want else "!! 기대 " + str(want)))
print("  maps      %d행 (별도 에이전트 — 빈 배열 허용)" % len(db["maps"]))
all_ids = [r["id"] for t in ("monsters","weapons","armors","items","skills","jobs","crops","quests","npcs") for r in db[t]]
check(len(all_ids) == len(set(all_ids)), "id 중복 존재: " + str(sorted({x for x in all_ids if all_ids.count(x) > 1})))

# ── ① §7.5 파워버짓 — PRD 채점표와 대조 ───────────────────────────
section("1. 파워버짓 (§7.5 채점표 대조)")
PRD_MONSTER_SCORE = {  # PRD §7.5 채점표(소수 1자리)
    "mob_jelly": 12.8, "mob_hornhop": 16.9, "mob_seedgunner": 12.2, "mob_thorn": 22.3,
    "mob_busuri": 24.8, "mob_moonowl": 20.6, "mob_shade": 31.3,
}
for m in db["monsters"]:
    if m["isBoss"]:
        print("  %-14s isBoss → 버짓 면제(교사 직접 검수)" % m["name"])
        continue
    score = m["hp"] / 10 + m["atk"] * 2 + m["speed"] / 30
    cap = 20 + m["tier"] * 15
    r1 = round(score, 1)
    exp_score = PRD_MONSTER_SCORE.get(m["id"])
    ok1 = check(exp_score is not None and abs(r1 - exp_score) < 1e-9,
                "%s 버짓 %.1f ≠ PRD 채점표 %s" % (m["name"], r1, exp_score))
    ok2 = check(score <= cap + 1e-9, "%s 버짓 %.1f > 상한 %d(티어%d)" % (m["name"], r1, cap, m["tier"]))
    print("  %-14s %5.1f ≤ %d (티어%d)  PRD표 %.1f  %s" % (m["name"], r1, cap, m["tier"], exp_score, "OK" if ok1 and ok2 else "FAIL"))

PRD_WEAPON_DPS = {  # PRD §7.5 채점표(편도 DPS)
    "wp_fist": 10.0, "wp_hoe": 15.0, "wp_old_boomerang": 10.0, "wp_star_dagger": 22.9,
    "wp_iron_starsword": 21.3, "wp_toy_starbow": 15.3, "wp_sparkle_boomerang": 16.7,
}
for w in db["weapons"]:
    dps = w["dmg"] / w["cd"]
    cap = 15 + w["levelReq"] * 3
    r1 = round(dps, 1)
    exp_dps = PRD_WEAPON_DPS[w["id"]]
    ok1 = check(abs(r1 - exp_dps) < 1e-9, "%s DPS %.1f ≠ PRD 채점표 %.1f" % (w["name"], r1, exp_dps))
    ok2 = check(dps <= cap + 1e-9, "%s DPS %.1f > 상한 %d(levelReq %d)" % (w["name"], r1, cap, w["levelReq"]))
    print("  %-14s %5.1f ≤ %d (Lv%d)  PRD표 %.1f  %s" % (w["name"], r1, cap, w["levelReq"], exp_dps, "OK" if ok1 and ok2 else "FAIL"))

for s in db["skills"]:  # dmgMul×100/cd ≤ 60 — 게이지·패시브 비적용(교사 검수)
    if s["type"] != "active" or not s.get("cd"):
        print("  %-14s %s → 공식 비적용(교사 검수)" % (s["name"], "게이지형" if s.get("gauge") else "패시브"))
        continue
    power = s["dmgMul"] * 100 / s["cd"]
    ok = check(power <= 60 + 1e-9, "%s 스킬버짓 %.1f > 60" % (s["name"], power))
    print("  %-14s %5.1f ≤ 60  %s" % (s["name"], power, "OK" if ok else "FAIL"))

for c in db["crops"]:  # §7.5 crop: 순이익/일 8~14 밴드 (판매 불가 작물 비적용 — 빛나무 묘목)
    if not c["sellable"]:
        print("  %-14s 판매 불가 → 밴드 비적용(mq06 방어 조명 전용)" % c["name"])
        continue
    ppd = (c["sellPrice"] / c["regrowDays"]) if c["regrowDays"] else (c["sellPrice"] - c["seedPrice"]) / c["growDays"]
    ok = check(8 - 1e-9 <= ppd <= 14 + 1e-9, "%s 순이익/일 %.2f 밴드(8~14) 이탈" % (c["name"], ppd))
    print("  %-14s 순이익/일 %5.2f ∈ [8,14]  %s" % (c["name"], ppd, "OK" if ok else "FAIL"))

# ── ② 참조 무결성 ────────────────────────────────────────────────
section("2. 참조 무결성")
refs = 0
def ref(cond, msg):
    global refs
    refs += 1
    check(cond, msg)

for m in db["monsters"]:
    for d in m["drops"]:
        ref(d["itemId"] in EQUIPPABLE, "%s drops.itemId 유령: %s" % (m["id"], d["itemId"]))
    for ph in (m["phases"] or []):
        if ph.get("summon"):
            ref(ph["summon"]["monsterId"] in M, "%s phases.summon 유령: %s" % (m["id"], ph["summon"]["monsterId"]))
for w in db["weapons"]:
    if w.get("craft"):
        ref(w["craft"]["base"] in W, "%s craft.base 유령" % w["id"])
        for mat in w["craft"]["materials"]:
            ref(mat["itemId"] in I, "%s craft 재료 유령: %s" % (w["id"], mat["itemId"]))
for q in db["quests"]:
    g = q["goal"]
    ref(q["giver"] is None or q["giver"] in N, "%s giver 유령: %s" % (q["id"], q["giver"]))
    for r in q["requires"]:
        ref(r in Q, "%s requires 유령: %s" % (q["id"], r))
    if g["type"] == "kill":       ref(g["target"] in M, "%s kill 대상 유령: %s" % (q["id"], g["target"]))
    elif g["type"] == "talk":     ref(g["target"] in N, "%s talk 대상 유령: %s" % (q["id"], g["target"]))
    elif g["type"] == "collect":  ref(g["target"] in I, "%s collect 대상 유령: %s" % (q["id"], g["target"]))
    elif g["type"] == "harvest":  ref(g["target"] in C, "%s harvest 대상 유령: %s" % (q["id"], g["target"]))
    elif g["type"] == "deliver":  # deliver는 2인자(item+to) — §6
        ref(g["item"] in (set(I) | set(C)), "%s deliver.item 유령: %s" % (q["id"], g["item"]))
        ref(g["to"] in N, "%s deliver.to 유령: %s" % (q["id"], g["to"]))
    else:
        ref(False, "%s goal.type 미정의: %s" % (q["id"], g["type"]))
    if q["reward"].get("itemId"):
        ref(q["reward"]["itemId"] in REWARDABLE, "%s reward.itemId 유령: %s" % (q["id"], q["reward"]["itemId"]))
for n in db["npcs"]:
    for entry in n["shop"]:
        ref(entry["itemRef"] in REWARDABLE, "%s shop 유령: %s" % (n["id"], entry["itemRef"]))
        if entry.get("reqQuest"):
            ref(entry["reqQuest"] in Q, "%s shop.reqQuest 유령: %s" % (n["id"], entry["reqQuest"]))
for j in db["jobs"]:
    for sk in j["grantSkills"]:
        ref(sk in S, "%s grantSkills 유령: %s" % (j["id"], sk))
    ref(j["parent"] is None or j["parent"] in J, "%s parent 유령" % j["id"])
    ref(j["reqQuest"] is None or j["reqQuest"] in Q, "%s reqQuest 유령" % j["id"])
    if j.get("trial"):
        ref(j["trial"]["target"] in M, "%s trial 대상 유령: %s" % (j["id"], j["trial"]["target"]))
for s in db["skills"]:
    by, v = s["acquire"]["by"], s["acquire"]["value"]
    if by == "level":   ref(isinstance(v, int) and 1 <= v <= 10, "%s acquire.level 이상: %s" % (s["id"], v))
    elif by == "quest": ref(v in Q, "%s acquire.quest 유령: %s" % (s["id"], v))
    elif by == "job":   ref(v in J, "%s acquire.job 유령: %s" % (s["id"], v))
    else:               ref(False, "%s acquire.by 미정의: %s" % (s["id"], by))
for c in db["crops"]:
    ref(c["reqQuest"] is None or c["reqQuest"] in Q, "%s reqQuest 유령" % c["id"])
print("  참조 %d건 검사" % refs)

# 퀘스트 체인 도달성 (T1 데이터 완주 시뮬의 축소판)
reachable, frontier = set(), [q["id"] for q in db["quests"] if not q["requires"]]
while frontier:
    reachable.update(frontier)
    frontier = [q["id"] for q in db["quests"]
                if q["id"] not in reachable and all(r in reachable for r in q["requires"])]
check(reachable == set(Q), "도달 불가 퀘스트: " + str(sorted(set(Q) - reachable)))
print("  퀘스트 체인 도달성: %d/%d" % (len(reachable), len(Q)))

# 별조각 순환 의존 해소 — 재료 지급 퀘스트(mq06)가 mq07의 (전이적) 선행인지
anc, stack = set(), list(Q["mq07"]["requires"])
while stack:
    r = stack.pop()
    if r not in anc:
        anc.add(r); stack.extend(Q[r]["requires"])
starpiece_givers = {q["id"] for q in db["quests"] if q["reward"].get("itemId") == "it_starpiece"}
check(bool(starpiece_givers & anc), "별조각 순환 의존: 재료 지급 퀘스트가 mq07 선행 체인에 없음")
print("  별조각 경로: %s → mq07 선행 체인 내 OK" % sorted(starpiece_givers))

# ── ③ 상한표 (§7.1 — 이름은 공백 제외 2~8자, 대사·설명 줄당 40자) ──
section("3. 상한표")
for m in db["monsters"]:
    if not m["isBoss"]:  # isBoss = 교사 직접 검수(버짓·상한 면제) — §7.5
        check(5 <= m["hp"] <= 500, "%s hp 상한 위반: %d" % (m["name"], m["hp"]))
        check(1 <= m["exp"] <= 30, "%s exp 상한 위반: %d" % (m["name"], m["exp"]))
    check(1 <= m["atk"] <= 25, "%s atk 상한 위반: %d" % (m["name"], m["atk"]))
    check(m["gold"][0] <= m["gold"][1] <= m["exp"], "%s gold max(%d) > exp(%d)" % (m["name"], m["gold"][1], m["exp"]))
    for d in m["drops"]:
        check(d["chance"] <= 0.5, "%s drop chance %.2f > 0.5" % (m["name"], d["chance"]))
for w in db["weapons"]:
    check(1 <= w["dmg"] <= 30, "%s dmg 상한 위반: %d" % (w["name"], w["dmg"]))
    check(0.35 <= w["cd"] <= 2.0, "%s cd 상한 위반: %.2f" % (w["name"], w["cd"]))
for c in db["crops"]:
    if c["sellable"]:
        check(c["sellPrice"] <= c["seedPrice"] * 3, "%s sellPrice > seedPrice×3" % c["name"])
for tbl in ("monsters", "weapons", "armors", "items", "skills", "jobs", "crops", "npcs"):
    for r in db[tbl]:
        L = len(r["name"].replace(" ", ""))
        check(2 <= L <= 8, "%s 이름 길이 위반(공백 제외 %d자): %s" % (tbl, L, r["name"]))
for n in db["npcs"]:
    check(len(n["speechTic"]) <= 40, "%s speechTic 40자 초과" % n["id"])
for i in db["items"]:
    check(len(i["desc"]) <= 40, "%s desc 40자 초과" % i["id"])
print("  monster hp/atk/exp/gold≤exp/chance≤0.5 · weapon dmg/cd · crop 가격 · 이름 2~8자(공백 제외) · 문구 40자 검사 완료")

# ── ④ 경제 크리티컬 패스 (§3.1 보상 열 = 단일 출처) ────────────────
section("4. 경제 크리티컬 패스")
main_ids = ["mq0%d" % i for i in range(1, 8)]
side_ids = ["sq01", "sq02", "sq03"]
main_gold = sum(Q[q]["reward"]["gold"] for q in main_ids)
side_gold = sum(Q[q]["reward"]["gold"] for q in side_ids)
check(main_gold == 460, "메인 퀘스트 골드 %d ≠ 460" % main_gold)
check(side_gold == 120, "사이드 퀘스트 골드 %d ≠ 120" % side_gold)
print("  메인 골드 %d (=460)  사이드 골드 %d (=120)  합계 %d" % (main_gold, side_gold, main_gold + side_gold))

# ── ⑤ exp 총합·레벨 곡선 (§4.2) ──────────────────────────────────
section("5. exp 총합·레벨 곡선")
main_exp = sum(Q[q]["reward"]["exp"] for q in main_ids)
side_exp = sum(Q[q]["reward"]["exp"] for q in side_ids)
check(main_exp == 600, "메인 exp %d ≠ 600" % main_exp)
check(side_exp == 130, "사이드 exp %d ≠ 130" % side_exp)
check(main_exp + side_exp == 730, "퀘스트 exp 합 %d ≠ 730" % (main_exp + side_exp))
need = [round(20 * 1.42 ** i) for i in range(9)]   # Lv1→10
check(need == [20, 28, 40, 57, 81, 115, 164, 233, 331], "expNeed 수열 불일치: %s" % need)
total_need = sum(need)
check(total_need == 1069, "expNeed 누적 %d ≠ 1069" % total_need)
hunt_gap = total_need - (main_exp + side_exp)
check(hunt_gap == 339, "사냥 갭 %d ≠ 339 (§4.2)" % hunt_gap)
check(Q["mq01"]["reward"]["exp"] + M["mob_jelly"]["exp"] >= need[0],
      "첫 렙업 온보딩 실패: mq01+젤리1킬 < %d" % need[0])
print("  퀘스트 exp: 메인 %d + 사이드 %d = %d (=730)" % (main_exp, side_exp, main_exp + side_exp))
print("  expNeed %s → 누적 %d (=1,069) · 사냥 갭 %d (=339 ≈ 40~55킬)" % (need, total_need, hunt_gap))
print("  첫 렙업 온보딩: mq01 %d + 젤리 %d = %d ≥ %d OK" %
      (Q["mq01"]["reward"]["exp"], M["mob_jelly"]["exp"],
       Q["mq01"]["reward"]["exp"] + M["mob_jelly"]["exp"], need[0]))

# ── 결과 ─────────────────────────────────────────────────────────
print("\n" + "=" * 56)
if errors:
    print("FAIL — %d건" % len(errors))
    for e in errors:
        print("  ✗ " + e)
    sys.exit(1)
print("PASS — rpg_db.json 전 항목 검증 통과 (①버짓 채점표 일치 ②참조 무결성 ③상한표 ④경제 460+120 ⑤exp 730/1069)")
sys.exit(0)
