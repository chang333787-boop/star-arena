#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RPG_DB 주입기 — wiki/rpg_db.json + rpg_maps.json + 대사_챕터1.json → index.html의 const RPG_DB 블록 교체.
   T3 승격 파이프라인(RPG모드_PRD §7.2)에서도 이 스크립트를 재사용한다.
   사용: python3 wiki/tools/inject_db.py   (저장소 루트에서)"""
import json, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db   = json.load(open(os.path.join(ROOT, "wiki/rpg_db.json"), encoding="utf-8"))
mp   = json.load(open(os.path.join(ROOT, "wiki/rpg_maps.json"), encoding="utf-8"))
dg   = json.load(open(os.path.join(ROOT, "wiki/대사_챕터1.json"), encoding="utf-8"))

# ── 1) legend → 엔진 형식(solid 문자열) ──
legend = mp["_legend"]
solid = "".join(ch for ch, v in legend.items() if not v.get("passable", True))
eng_legend = {"solid": solid, "soil": "f", "spawn": "*"}

# ── 1.5) 맵↔DB 몬스터 id 통일: 맵 제작 에이전트(mon_*)와 DB 에이전트(mob_*)의 명명 차이 리매핑 ──
MON_REMAP = {"mon_jelly": "mob_jelly", "mon_hopper": "mob_hornhop", "mon_seedgunner": "mob_seedgunner",
             "mon_thornback": "mob_thorn", "mon_drizzler": "mob_busuri", "mon_moonowl": "mob_moonowl",
             "mon_shadeshard": "mob_shade", "mon_cloudking": "mob_boss_munge"}
mob_ids = {mo["id"] for mo in db["monsters"]}
for m_ in mp["maps"]:
    for s in m_.get("monsters", []):
        s["monsterId"] = MON_REMAP.get(s["monsterId"], s["monsterId"])
        if s["monsterId"] not in mob_ids:
            print(f"맵 {m_['id']} 몬스터 유령 참조: {s['monsterId']}"); sys.exit(1)

# ── 2) 맵 변환: 포탈 {tx,ty,to:{mapId,tx,ty}} → {at:[c,r],to,tx,ty} · 특수문자 → objects[] ──
OBJ_CHARS = {"b": "bed", "c": "chest", "G": "board", "D": "cellar", "V": "vein",
             "W": "well", "A": "anvil", "t": "camp", "e": "egg"}
maps_out = []
for m in mp["maps"]:
    rec = {"id": m["id"], "name": m["name"], "theme": m.get("theme", "grass"),
           "rows": m["rows"],
           "portals": [{"at": [p["tx"], p["ty"]], "to": p["to"]["mapId"],
                        "tx": p["to"]["tx"], "ty": p["to"]["ty"]} for p in m.get("portals", [])],
           "npcs": m.get("npcs", []), "monsters": m.get("monsters", []),
           # soil을 [c,r] 배열로 정규화(맵 생성기는 {tx,ty} 객체 — 엔진은 soil[i][0/1] 배열 접근)
           "soil": [([s["tx"], s["ty"]] if isinstance(s, dict) else s) for s in m.get("soil", [])]}
    objs, seen_bed = [], set()
    explicit = m.get("objects", [])                  # 명시 오브젝트(loot 보물상자 등) — 같은 좌표의 문자 파생을 대체
    expl_at = {(o["tx"], o["ty"]) for o in explicit}
    for r, row in enumerate(m["rows"]):
        for c, ch in enumerate(row):
            if ch in OBJ_CHARS:
                if (c, r) in expl_at: continue
                t = OBJ_CHARS[ch]
                if t == "bed":                       # 붙은 침대(bb)는 1개로 합침
                    key = (m["id"],)
                    if key in seen_bed: continue
                    seen_bed.add(key)
                objs.append({"type": t, "tx": c, "ty": r})
    rec["objects"] = objs + explicit
    maps_out.append(rec)

# ── 3) NPC 표시 속성(emoji/color) 기본값 ──
NPC_FACE = {"npc_onbyeol": ("👴", "#e8c07a"), "npc_momo": ("🛍️", "#ffa8c5"),
            "npc_bolt": ("🤖", "#9aa7b8"), "npc_leaf": ("🌱", "#8fdba0"),
            "npc_meonbyeol": ("🌒", "#b39ddb"), "npc_pico": ("📓", "#ffd93d")}
for n in db["npcs"]:
    face = NPC_FACE.get(n["id"])
    if face: n.setdefault("emoji", face[0]); n.setdefault("color", face[1])

# ── 4) 대사 키 재매핑: "momo" → "npc_momo" ──
npc_ids = {n["id"] for n in db["npcs"]}
dlg_npcs = {}
for k, v in dg.get("npcs", {}).items():
    full = "npc_" + k if ("npc_" + k) in npc_ids else k
    dlg_npcs[full] = v
dialogs = {"npcs": dlg_npcs, "quests": dg.get("quests", {}), "tutorial": dg.get("tutorial", []),
           "boss": dg.get("boss", {}), "ending": dg.get("ending", []), "system": dg.get("system", {})}

# ── 5) 최종 RPG_DB 조립 + 참조 사전 검증(유령 id) ──
out = {k: db[k] for k in ["monsters", "weapons", "armors", "items", "skills", "jobs", "crops", "npcs", "quests"]}
out["dailies"] = db.get("dailies", [])   # POLISH-2: 일일 의뢰 템플릿(day 시드 추첨)
out["maps"] = maps_out
out["legend"] = eng_legend
out["dialogs"] = dialogs

def item_any(iid):
    if not iid: return True
    if iid.startswith("seed_"):
        return any(c["id"] == iid[5:] for c in out["crops"])
    return any(any(r["id"] == iid for r in out[t]) for t in ["items", "weapons", "armors", "crops"])

errs = []
for n in out["npcs"]:
    for s in n.get("shop", []):
        ref = s["itemRef"] if isinstance(s, dict) else s
        if not item_any(ref): errs.append(f"npc {n['id']} shop 유령 참조: {ref}")
for m in out["maps"]:
    for p in m["portals"]:
        if not any(x["id"] == p["to"] for x in out["maps"]): errs.append(f"map {m['id']} 포탈 유령: {p['to']}")
    for n in m["npcs"]:
        if not any(x["id"] == n["npcId"] for x in out["npcs"]): errs.append(f"map {m['id']} NPC 유령: {n['npcId']}")
for mo in out["monsters"]:
    for d in mo.get("drops", []):
        if not item_any(d.get("itemId")): errs.append(f"monster {mo['id']} 드랍 유령: {d.get('itemId')}")
if errs:
    print("유령 참조 발견 — 주입 중단:"); [print("  -", e) for e in errs]; sys.exit(1)

# ── 6) index.html의 RPG_DB 블록 교체 ──
path = os.path.join(ROOT, "index.html")
src = open(path, encoding="utf-8").read().split("\n")
start = end = None
for i, ln in enumerate(src):
    if ln.startswith("const RPG_DB="): start = i
    if start is not None and ln.startswith("let RPG_DB_LIVE=null;"): end = i; break
if start is None or end is None:
    print("RPG_DB 블록 앵커를 못 찾음"); sys.exit(1)
blob = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
newline = "const RPG_DB=" + blob + ";   /* RPG-0 산출물 주입: wiki/rpg_db.json+rpg_maps.json+대사_챕터1.json — 재주입: python3 wiki/tools/inject_db.py */"
src[start:end] = [newline]
open(path, "w", encoding="utf-8").write("\n".join(src))
print(f"주입 완료: RPG_DB {len(blob)/1024:.1f}KB · 맵 {len(maps_out)} · 몬스터 {len(out['monsters'])} · 대사 NPC {len(dlg_npcs)}")
print("솔리드 legend:", solid)
