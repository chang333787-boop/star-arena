#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_maps.py — wiki/rpg_maps.json 무결성 검증기
   근거: RPG모드_PRD.md §2(맵 목록·크기) · §7.1(map 스키마) · §7.4⑤(플레이 가능성)
   검사: ①row 길이/줄수 ②legend 문자 전수 ③포탈(앵커 문자·목적지 통행·역방향 짝·재워프 방지)
        ④전 맵 연결 그래프 도달성(rpg_village 기준) ⑤스폰·NPC·몬스터·soil 좌표 통행+맵 내 도달성
        ⑥soil/N/m/* 문자와 데이터 배열 완전 일치 ⑦NPC id 유일성 ⑧마을 밭 12칸
   사용: python3 verify_maps.py [경로]  (기본: ../rpg_maps.json)"""
import json, os, sys
from collections import deque

# PRD §2 확정 크기 (단일 출처)
EXPECTED_SIZE = {
    "rpg_village": (36, 16),
    "rpg_home":    (22, 10),
    "rpg_store":   (22, 10),
    "rpg_smith":   (22, 10),
    "rpg_chief":   (22, 10),
    "rpg_field1":  (36, 16),
    "rpg_field2":  (48, 22),
    "rpg_den1":    (22, 10),
    "rpg_den2":    (22, 10),
    "rpg_den3":    (22, 10),
}
PORTAL_CHARS = set("123456789")

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "rpg_maps.json")
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    legend = doc["_legend"]
    maps = {m["id"]: m for m in doc["maps"]}
    errs = []
    def err(s): errs.append(s)
    def ok(s): print("  PASS " + s)

    # ── ① 맵 목록·크기·row 정확성 ──────────────────────────────
    print("[1] 맵 목록·크기·row 길이/줄수")
    for mid, (w, h) in EXPECTED_SIZE.items():
        if mid not in maps:
            err(f"{mid}: 맵 누락"); continue
        m = maps[mid]
        if (m.get("w"), m.get("h")) != (w, h):
            err(f"{mid}: 선언 크기 {m.get('w')}x{m.get('h')} != PRD {w}x{h}")
        if len(m["rows"]) != h:
            err(f"{mid}: 줄수 {len(m['rows'])} != {h}")
        for i, row in enumerate(m["rows"]):
            if len(row) != w:
                err(f"{mid}: row[{i}] 길이 {len(row)} != {w}")
    for mid in maps:
        if mid not in EXPECTED_SIZE:
            err(f"{mid}: PRD §2에 없는 맵")
    if not errs: ok(f"{len(EXPECTED_SIZE)}개 맵 전부 크기·row 정확")

    # ── ② legend 문자 전수 ────────────────────────────────────
    print("[2] legend 문자 전수")
    n0 = len(errs)
    for mid, m in maps.items():
        for y, row in enumerate(m["rows"]):
            for x, ch in enumerate(row):
                if ch not in legend:
                    err(f"{mid}: ({x},{y}) 미정의 문자 '{ch}'")
    if len(errs) == n0: ok("전 타일이 _legend에 정의됨")

    def passable(m, x, y):
        if not (0 <= x < m["w"] and 0 <= y < m["h"]): return False
        return bool(legend[m["rows"][y][x]]["passable"])

    def tile(m, x, y):
        return m["rows"][y][x]

    # ── ③ 포탈 ────────────────────────────────────────────────
    print("[3] 포탈: 앵커 문자·목적지 통행·역방향 짝·재워프 방지")
    n0 = len(errs)
    for mid, m in maps.items():
        anchors = {(x, y) for y, row in enumerate(m["rows"])
                   for x, ch in enumerate(row) if ch in PORTAL_CHARS}
        declared = {(p["tx"], p["ty"]) for p in m["portals"]}
        for (x, y) in anchors - declared:
            err(f"{mid}: 앵커 '{tile(m,x,y)}'({x},{y})에 portals[] 항목 없음")
        for p in m["portals"]:
            sx, sy = p["tx"], p["ty"]
            if (sx, sy) not in anchors:
                err(f"{mid}: portals[] ({sx},{sy})가 rows의 포탈 앵커 문자가 아님")
            dst = p["to"]; dmid = dst["mapId"]
            if dmid not in maps:
                err(f"{mid}: 포탈({sx},{sy}) 목적지 맵 '{dmid}' 없음"); continue
            dm = maps[dmid]; dx, dy = dst["tx"], dst["ty"]
            if not passable(dm, dx, dy):
                err(f"{mid}: 포탈({sx},{sy}) → {dmid}({dx},{dy}) 통행 불가")
            if tile(dm, dx, dy) in PORTAL_CHARS:
                err(f"{mid}: 포탈({sx},{sy}) 도착 칸이 포탈 앵커(즉시 재워프 위험)")
            if not any(q["to"]["mapId"] == mid for q in dm["portals"]):
                err(f"{mid}: {dmid}에 역방향 포탈({dmid}→{mid}) 없음")
    if len(errs) == n0: ok("전 포탈 앵커·목적지·역방향 짝 정합")

    # ── ④ 전 맵 연결 그래프 도달성 ─────────────────────────────
    print("[4] 전 맵 연결 그래프 (기점 rpg_village)")
    n0 = len(errs)
    seen = set(); q = deque(["rpg_village"])
    while q:
        cur = q.popleft()
        if cur in seen or cur not in maps: continue
        seen.add(cur)
        for p in maps[cur]["portals"]:
            q.append(p["to"]["mapId"])
    unreachable = set(maps) - seen
    if unreachable:
        err("도달 불가 맵: " + ", ".join(sorted(unreachable)))
    if len(errs) == n0: ok(f"10/10 맵 도달 가능 (경로: 마을→들판→숲길→요새 1·2·3)")

    # ── ⑤ 맵 내 도달성 + 좌표 통행 ─────────────────────────────
    print("[5] 스폰·NPC·몬스터·soil 좌표 통행 + 맵 내 도달성(flood-fill)")
    n0 = len(errs)
    for mid, m in maps.items():
        anchors = [(x, y) for y, row in enumerate(m["rows"])
                   for x, ch in enumerate(row) if ch in PORTAL_CHARS]
        spawns = [(x, y) for y, row in enumerate(m["rows"])
                  for x, ch in enumerate(row) if ch == "*"]
        entries = anchors + spawns
        if not entries:
            err(f"{mid}: 진입점(포탈/스폰) 없음"); continue
        reach = set(); dq = deque([entries[0]])
        while dq:
            x, y = dq.popleft()
            if (x, y) in reach or not passable(m, x, y): continue
            reach.add((x, y))
            dq.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
        def need(x, y, what):
            if not passable(m, x, y):
                err(f"{mid}: {what}({x},{y}) 통행 불가 타일")
            elif (x, y) not in reach:
                err(f"{mid}: {what}({x},{y}) 진입점에서 도달 불가")
        for (x, y) in entries: need(x, y, "포탈/스폰")
        for n in m["npcs"]: need(n["tx"], n["ty"], f"NPC {n['npcId']}")
        for mo in m["monsters"]: need(mo["tx"], mo["ty"], f"몬스터 {mo['monsterId']}")
        for s in m["soil"]: need(s["tx"], s["ty"], "밭")
    if len(errs) == n0: ok("전 좌표 통행 가능 + 진입점에서 도달 가능")

    # ── ⑥ 문자↔데이터 완전 일치 ────────────────────────────────
    print("[6] rows 문자(N/m/f/*) ↔ npcs/monsters/soil 배열 완전 일치")
    n0 = len(errs)
    star_total = 0
    for mid, m in maps.items():
        chars = {"N": set(), "m": set(), "f": set(), "*": set()}
        for y, row in enumerate(m["rows"]):
            for x, ch in enumerate(row):
                if ch in chars: chars[ch].add((x, y))
        star_total += len(chars["*"])
        if chars["*"] and mid != "rpg_village":
            err(f"{mid}: 플레이어 스폰(*)은 rpg_village 전용")
        for key, arr, label in (
            ("N", {(n["tx"], n["ty"]) for n in m["npcs"]}, "npcs"),
            ("m", {(mo["tx"], mo["ty"]) for mo in m["monsters"]}, "monsters"),
            ("f", {(s["tx"], s["ty"]) for s in m["soil"]}, "soil"),
        ):
            if chars[key] != arr:
                err(f"{mid}: '{key}' 문자 {sorted(chars[key])} != {label}[] {sorted(arr)}")
    if star_total != 1:
        err(f"플레이어 스폰(*) 총 {star_total}개 (정확히 1개여야 함)")
    if len(errs) == n0: ok("N/m/f/* 문자와 데이터 배열이 1:1 일치, 스폰 1개")

    # ── ⑦ NPC id 유일성·6인 ───────────────────────────────────
    print("[7] NPC id 유일성 · 6인(§3.3)")
    n0 = len(errs)
    ids = [n["npcId"] for m in maps.values() for n in m["npcs"]]
    if len(ids) != len(set(ids)):
        err("NPC id 중복: " + str(sorted(ids)))
    expect_npc = {"npc_onbyeol", "npc_momo", "npc_bolt", "npc_leaf", "npc_meonbyeol", "npc_pico"}
    if set(ids) != expect_npc:
        err(f"NPC 구성 {sorted(set(ids))} != PRD 6인 {sorted(expect_npc)}")
    if len(errs) == n0: ok("NPC 6인(온별·모모·볼트·리프·먼별·피코) 유일 배치")

    # ── ⑧ 마을 밭 12칸(3×4) ───────────────────────────────────
    print("[8] 시고니 밭 3×4=12칸(§2·§5.2)")
    n0 = len(errs)
    v = maps.get("rpg_village")
    if v and len(v["soil"]) != 12:
        err(f"rpg_village 밭 {len(v['soil'])}칸 != 12")
    if len(errs) == n0: ok("마을 밭 12칸 정확")

    # ── 결과 ──────────────────────────────────────────────────
    print()
    if errs:
        print(f"FAIL — {len(errs)}건")
        for e in errs: print("  ✗ " + e)
        sys.exit(1)
    total_tiles = sum(m["w"] * m["h"] for m in maps.values())
    total_portals = sum(len(m["portals"]) for m in maps.values())
    total_mon = sum(len(m["monsters"]) for m in maps.values())
    print(f"ALL PASS — 맵 10장 · 총 {total_tiles}칸 · 포탈 {total_portals} · 몬스터 스폰 {total_mon} · NPC 6")

if __name__ == "__main__":
    main()
