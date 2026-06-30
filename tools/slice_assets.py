#!/usr/bin/env python3
# 별빛 아레나 — 학생 에셋 자동 슬라이서
# reference/ 의 3장 시트를 잘라서 assets/ 아래 캐릭터 5프레임 + 무기 아이콘 PNG로 저장하고,
# index.html / star_arena.html 의 ASSETS_ENABLED 를 true 로 켭니다.
#
# 사용법:
#   pip install pillow
#   python tools/slice_assets.py
#
# 주의: 그리드 좌표는 시트 레이아웃 기준 "추정값"입니다. 결과가 어긋나면 아래 상수(TOP/LEFT 등)를
#       조금 조정해서 다시 실행하세요. 발사체(projectile)/적중효과(effect_hit)는 시트 구조가 복잡해
#       이 스크립트는 만들지 않습니다(없으면 게임이 색 원형 발사체로 fallback). 필요하면 직접 잘라 넣으세요.

import os, sys
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow가 필요합니다.  pip install pillow  후 다시 실행하세요.")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF  = os.path.join(ROOT, "reference")
CHARS = ["student_01","student_02","student_03","student_04","student_05","student_06"]
TOOLS = ["tool_01","tool_02","tool_03","tool_04","tool_05","tool_06"]
FRAMES = ["idle","move","attack","hit","return"]

# ── 그리드 추정값(0~1 비율). 어긋나면 여기를 조정 ──
# 02_basic_motion_master.png : 6행(캐릭터) x 5열(대기/이동/공격/피격/리턴)
MOTION = dict(top=0.135, left=0.155, right=1.0, bottom=1.0, rows=6, cols=5)
# 01_fixed_character_weapon_master.png : 6행, 마지막 열이 무기 아이콘
MASTER = dict(top=0.065, bottom=1.0, rows=6, icon_x0=0.785, icon_x1=1.0)

def load(name):
    for ext in (".png",".jpg",".jpeg",".PNG",".JPG"):
        p=os.path.join(REF,name+ext)
        if os.path.exists(p): return Image.open(p).convert("RGBA")
    return None

def remove_bg(im):
    """네 모서리에서 flood-fill로 배경(연한 단색)을 투명 처리."""
    im=im.convert("RGBA")
    w,h=im.size
    for cx,cy in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]:
        try: ImageDraw.floodfill(im,(cx,cy),(0,0,0,0),thresh=42)
        except Exception: pass
    return im

def autocrop(im, pad=8):
    bbox=im.getbbox()
    if not bbox: return im
    l,t,r,b=bbox
    l=max(0,l-pad); t=max(0,t-pad); r=min(im.size[0],r+pad); b=min(im.size[1],b+pad)
    return im.crop((l,t,r,b))

def cell(im, x0,y0,x1,y1, inset=0.06):
    """비율 좌표로 셀을 잘라 배경 제거 + 여백 정리."""
    W,H=im.size
    iw=(x1-x0)*inset; ih=(y1-y0)*inset
    box=(int((x0+iw)*W), int((y0+ih)*H), int((x1-iw)*W), int((y1-ih)*H))
    return autocrop(remove_bg(im.crop(box)))

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path); print("  +", os.path.relpath(path, ROOT))

made=0
# 1) 캐릭터 5프레임 (이미지 2)
motion=load("02_basic_motion_master")
if motion is None:
    print("! reference/02_basic_motion_master.png 가 없습니다. (캐릭터 모션 생략)")
else:
    g=MOTION; W=g["right"]-g["left"]; H=g["bottom"]-g["top"]
    cw=W/g["cols"]; rh=H/g["rows"]
    for ri,cid in enumerate(CHARS):
        for ci,fr in enumerate(FRAMES):
            x0=g["left"]+ci*cw; y0=g["top"]+ri*rh
            img=cell(motion, x0,y0, x0+cw, y0+rh)
            save(img, os.path.join(ROOT,"assets","characters",cid,fr+".png")); made+=1

# 2) 무기 아이콘 (이미지 1 마지막 열)
master=load("01_fixed_character_weapon_master")
if master is None:
    print("! reference/01_fixed_character_weapon_master.png 가 없습니다. (무기 아이콘 생략)")
else:
    g=MASTER; H=g["bottom"]-g["top"]; rh=H/g["rows"]
    for ri,tid in enumerate(TOOLS):
        y0=g["top"]+ri*rh
        img=cell(master, g["icon_x0"], y0, g["icon_x1"], y0+rh)
        save(img, os.path.join(ROOT,"assets","weapons",tid,"icon.png")); made+=1

# 3) 이미지를 실제로 만들었을 때만 ASSETS_ENABLED 켜기(빈 상태로 켜서 404 나는 것 방지)
def enable(path):
    if not os.path.exists(path): return
    s=open(path,encoding="utf-8").read()
    n=s.replace("let ASSETS_ENABLED = false;","let ASSETS_ENABLED = true;")
    if n!=s: open(path,"w",encoding="utf-8").write(n); print("  ASSETS_ENABLED=true →", os.path.basename(path))
if made>0:
    for f in ("index.html","star_arena.html"):
        enable(os.path.join(ROOT,f))
else:
    print("\n생성된 이미지가 없어 ASSETS_ENABLED는 그대로 둡니다. reference/ 에 시트를 먼저 저장하세요.")

print("\n완료: %d개 이미지 생성." % made)
print("게임을 열어 F2(에셋 확인)로 상태를 보고, 어긋나면 이 파일 상단 MOTION/MASTER 좌표를 조정해 다시 실행하세요.")
print("발사체/적중효과(projectile/effect_hit)는 없으면 색 원형으로 자동 fallback 됩니다.")
