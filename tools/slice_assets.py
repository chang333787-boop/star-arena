#!/usr/bin/env python3
# ==========================================================================
# 별빛 아레나 - 학생 에셋 슬라이서  v5  (코덱스 검토 반영본 / 2026-07-01)
# ==========================================================================
#  기준 시트: reference/02_basic_motion_master.png (승인 마스터, 6행 x 5열)
#            reference/01_fixed_character_weapon_master.png (무기 아이콘)
#
#  ※ v4(256x256 고정)와는 다른 계열이다. 혼동 금지.
#  v5 핵심 변경(코덱스 검토 반영):
#   1) keep_main: bbox 겹침(6px) → "실제 픽셀 거리 + 셀 끝 도달 + 절대 크기"로 판정.
#      - 셀 오른쪽 끝까지 날아가는 발사 이펙트/발사체 제거(럭키 별·달이 종이비행기 등).
#      - 본체에서 먼(>D_NEAR) 조각 제거(부메랑·거품·타격효과·그림자 섬).
#      - 든 무기(방패·캡슐런처 등)는 본체에 가깝고 셀 끝에 안 닿는 큰 덩어리만 유지.
#      - 8% 상대기준 폐기 → 작은 무기가 잘못 삭제되지 않게 절대 크기(MIN_WEAPON) 사용.
#   2) 중심 정렬: 서 있는 프레임은 본체 하단 42%(발) 기준, 눕는 return은 본체(최대 연결요소)
#      중심 기준 → return에서 부메랑 등으로 본체가 옆으로 안 밀림.
#   3) remove_bg halo: 투명에 닿은 밝은 픽셀을 무조건 지우지 않음. 순수 배경밝기(>=222)이고
#      투명 이웃이 2개 이상인 '바깥 잔털'만 제거 → 눈꽃 흰옷/머리장식, 럭키 연노랑, 별골렘
#      하이라이트 보존. 흰 배경 찌꺼기/하단 사각형은 계속 제거.
#   4) 캐릭터별 5프레임 = 같은 캔버스 크기 + 가로중앙 + 발(하단) 기준 정렬(프레임 안 튐).
#   * index.html/star_arena.html은 바이트 동일 유지(ASSETS_ENABLED가 이미 true면 건드리지 않음).
#
#  사용:  pip install pillow ;  python tools/slice_assets.py
# ==========================================================================

import os, sys
from collections import deque
try:
    from PIL import Image
except ImportError:
    print("Pillow가 필요합니다.  pip install pillow"); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF  = os.path.join(ROOT, "reference")
CHARS = ["student_01","student_02","student_03","student_04","student_05","student_06"]
TOOLS = ["tool_01","tool_02","tool_03","tool_04","tool_05","tool_06"]
FRAMES = ["idle","move","attack","hit","return"]

MOTION = dict(top=0.142, left=0.145, right=0.999, bottom=0.996, rows=6, cols=5, inset=0.05)
MASTER = dict(top=0.07, bottom=0.999, rows=6, icon_x0=0.80, icon_x1=1.0, icon_h=0.62)

# --- keep_main 판정 상수 (코덱스 검토 반영) ---
# D_NEAR: 본체와 '실제로 맞닿은(≈터치)' 별개 덩어리만 든 무기로 유지하기 위한 거리.
#   회차3: 16→6. 모아 쿠션방패는 본체에 연결(=본체 일부)이라 무관하고, 유일하게 별개인
#   무기는 별골렘 런처(본체와 dist 2.8~3.0px). 모아 attack의 분리된 별(dist 11.4px)·기타
#   stray 효과(럭키/눈꽃 return 거품 dist≈12/17, 시고니/모아 hit dist≈14/18)는 6px 밖 → 제거.
D_NEAR      = 6    # 본체와 사실상 맞닿은 별개 덩어리만 유지(런처 3px 유지, 떨어진 별 11px 제거)
MIN_WEAPON  = 250  # 이 크기 이상이어야 별개 덩어리를 무기로 유지 (별골렘 런처 437 유지, 작은 스파클 제거)
EDGE_MARGIN = 5    # bbox 오른쪽이 셀폭-이 값 이상이면 '날아가는 발사체'로 보고 제거
MIN_SPECK   = 40   # 이보다 작은 조각은 먼지로 제거

def load(name):
    for ext in (".png",".jpg",".jpeg",".PNG",".JPG"):
        p=os.path.join(REF,name+ext)
        if os.path.exists(p): return Image.open(p).convert("RGBA")
    return None

def is_bg(r,g,b):
    mn=min(r,g,b); mx=max(r,g,b)
    if mn>=205: return True                 # 흰색/파스텔 배경 + 옅은 그림자
    if mx-mn<=20 and mn>=165: return True    # 회색 그림자류
    return False

def remove_bg(im):
    """가장자리에서 '배경(밝음/회색)'으로 연결된 픽셀만 투명화. 외곽선 안쪽 하이라이트는 보존."""
    im=im.convert("RGBA"); W,H=im.size; px=im.load()
    seen=bytearray(W*H); dq=deque()
    for x in range(W):
        for y in (0,H-1):
            i=y*W+x
            if not seen[i] and is_bg(*px[x,y][:3]): seen[i]=1; dq.append((x,y))
    for y in range(H):
        for x in (0,W-1):
            i=y*W+x
            if not seen[i] and is_bg(*px[x,y][:3]): seen[i]=1; dq.append((x,y))
    while dq:
        x,y=dq.popleft(); px[x,y]=(255,255,255,0)
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<W and 0<=ny<H:
                i=ny*W+nx
                if not seen[i] and is_bg(*px[nx,ny][:3]): seen[i]=1; dq.append((nx,ny))
    # halo(바깥 잔털) 정리 — 밝은 픽셀을 무조건 지우지 않는다:
    #   순수 배경밝기(min>=222) & 투명(또는 화면밖) 이웃 2개 이상인 '바깥 잔털'만 제거.
    #   (흰옷/하이라이트는 대개 투명이웃 0~1개 → 보존)
    rm=[]
    for y in range(H):
        for x in range(W):
            r,g,b,a=px[x,y]
            if a>0 and min(r,g,b)>=222:
                tn=0
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<W and 0<=ny<H:
                        if px[nx,ny][3]==0: tn+=1
                    else: tn+=1
                if tn>=2: rm.append((x,y))
    for x,y in rm: r,g,b,a=px[x,y]; px[x,y]=(r,g,b,0)
    return im

def _components(im, athr=70):
    W,H=im.size; px=im.load(); lab=[-1]*(W*H); out=[]
    for sy in range(H):
        for sx in range(W):
            i=sy*W+sx
            if lab[i]!=-1: continue
            if px[sx,sy][3]<=athr: lab[i]=-2; continue
            dq=deque([(sx,sy)]); lab[i]=len(out); pix=[i]
            while dq:
                x,y=dq.popleft()
                for dx in (-1,0,1):
                    for dy in (-1,0,1):
                        nx,ny=x+dx,y+dy
                        if 0<=nx<W and 0<=ny<H:
                            j=ny*W+nx
                            if lab[j]==-1 and px[nx,ny][3]>athr:
                                lab[j]=lab[i]; dq.append((nx,ny)); pix.append(j)
            out.append(pix)
    out.sort(key=len, reverse=True); return out

def keep_main(im, athr_solid=115, athr_faint=45):
    """최대 연결요소(본체)만 유지 + 본체에 '가깝고 셀 끝에 안 닿는 큰' 든 무기만 추가 유지.
       떨어진 별/부메랑/종이비행기/거품/타격효과/그림자 섬, 셀 밖으로 날아가는 발사 이펙트는 제거.
       판정은 '단단한 픽셀(alpha>athr_solid)' 연결요소로 한다 → 반투명 잔다리로 무기에 붙은
       발사 이펙트(모아 방패 옆 별 등)를 무기와 분리해 제거. 유지된 덩어리의 안티에일리어싱
       가장자리(faint)만 되살려 외곽 품질 보존.
       반환: (im, body_pixels[본체 단단한 픽셀 인덱스 list])"""
    im=im.convert("RGBA"); W,H=im.size; px=im.load()
    comps=_components(im, athr_solid)   # 판정용: 단단한 픽셀만 연결
    if not comps: return im, []
    body=comps[0]
    # 본체로부터 D_NEAR 이내 거리장(8이웃/Chebyshev, D_NEAR에서 컷)
    dist=[-1]*(W*H); dq=deque()
    for idx in body: dist[idx]=0; dq.append(idx)
    while dq:
        i=dq.popleft(); d=dist[i]
        if d>=D_NEAR: continue
        x=i%W; y=i//W
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                nx,ny=x+dx,y+dy
                if 0<=nx<W and 0<=ny<H:
                    j=ny*W+nx
                    if dist[j]==-1: dist[j]=d+1; dq.append(j)
    keep=set(body)
    for comp in comps[1:]:
        n=len(comp)
        if n < MIN_SPECK: continue
        right=max(i%W for i in comp)
        if right >= W-EDGE_MARGIN: continue          # 셀 밖으로 날아가는 발사체/이펙트 → 제거
        near = any(dist[i]!=-1 for i in comp)         # 본체와 D_NEAR 이내로 실제 인접?
        if near and n >= MIN_WEAPON:                  # 가깝고 충분히 큰 덩어리 = 든 무기 → 유지
            keep.update(comp)
        # 그 외(먼 효과/작은 스파클)는 제거
    # 유지 덩어리의 안티에일리어싱 가장자리(faint: athr_faint~athr_solid)만 복원.
    #   버려진 단단한 덩어리(별 등)는 seed가 아니므로 되살아나지 않음.
    grow=deque(keep)
    while grow:
        i=grow.popleft(); x=i%W; y=i//W
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<W and 0<=ny<H:
                j=ny*W+nx
                if j not in keep:
                    a=px[nx,ny][3]
                    if athr_faint < a <= athr_solid:   # 반투명 가장자리만 흡수(단단한 별은 제외)
                        keep.add(j); grow.append(j)
    for i in range(W*H):
        if i not in keep:
            x=i%W; y=i//W; r,g,b,a=px[x,y]
            if a: px[x,y]=(r,g,b,0)
    return im, body

def content_bbox(im, athr=40):
    a=im.split()[3]; px=a.load(); W,H=im.size
    x0,y0,x1,y1=W,H,-1,-1
    for y in range(H):
        for x in range(W):
            if px[x,y]>athr:
                if x<x0:x0=x
                if x>x1:x1=x
                if y<y0:y0=y
                if y>y1:y1=y
    if x1<0: return None
    return (x0,y0,x1+1,y1+1)

def body_cx(body_pixels, W, ox, lower_frac=None):
    """본체 픽셀들의 가로 중심(크롭 좌표계). lower_frac 지정 시 하단 그 비율만(발 기준)."""
    if not body_pixels: return None
    ys=[i//W for i in body_pixels]
    if lower_frac:
        y0=min(ys); y1=max(ys); cut=y1-(y1-y0)*lower_frac
        sel=[(i%W) for i in body_pixels if (i//W)>=cut]
        if len(sel)>=6: return sum(sel)/len(sel)-ox
    xs=[i%W for i in body_pixels]
    return sum(xs)/len(xs)-ox

def crop_ratio(im, x0,y0,x1,y1):
    W,H=im.size
    return im.crop((int(x0*W),int(y0*H),int(x1*W),int(y1*H)))

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path); print("  +", os.path.relpath(path, ROOT))

made=0
motion=load("02_basic_motion_master")
if motion is None:
    print("! reference/02_basic_motion_master.png 없음 (캐릭터 생략)")
else:
    g=MOTION; gW=g["right"]-g["left"]; gH=g["bottom"]-g["top"]; cw=gW/g["cols"]; rh=gH/g["rows"]; ins=g["inset"]
    for ri,cid in enumerate(CHARS):
        cleaned=[]  # (content_image, cx, w, h)
        for ci,fr in enumerate(FRAMES):
            x0=g["left"]+ci*cw; y0=g["top"]+ri*rh
            cell=crop_ratio(motion, x0+cw*ins, y0+rh*ins, x0+cw*(1-ins), y0+rh*(1-ins))
            cell=remove_bg(cell)
            cell, body = keep_main(cell)
            Wc=cell.size[0]
            bb=content_bbox(cell)
            if not bb:
                cleaned.append((Image.new("RGBA",(10,10),(0,0,0,0)),5,10,10)); continue
            c=cell.crop(bb)
            is_return = (fr=="return")
            cx = body_cx(body, Wc, bb[0], lower_frac=(None if is_return else 0.42))
            if cx is None: cx=c.size[0]/2
            cx=max(0.0, min(float(c.size[0]), cx))
            cleaned.append((c,cx,c.size[0],c.size[1]))
        # 공통 캔버스(좌우 대칭: cx가 항상 중앙, 발=하단 정렬)
        half=max(max(cx for (_,cx,_,_) in cleaned), max((w-cx) for (_,cx,w,_) in cleaned))
        padX=12; padTop=12; padBot=8
        canW=int(2*(half+padX)); canH=int(max(h for (_,_,_,h) in cleaned)+padTop+padBot)
        for (img,cx,w,h),fr in zip(cleaned,FRAMES):
            canvas=Image.new("RGBA",(canW,canH),(0,0,0,0))
            ox=int(round(canW/2-cx)); oy=int(canH-padBot-h)
            ox=max(0,min(ox,canW-w)); oy=max(0,min(oy,canH-h))
            canvas.alpha_composite(img,(ox,oy))
            save(canvas, os.path.join(ROOT,"assets","characters",cid,fr+".png")); made+=1

master=load("01_fixed_character_weapon_master")
if master is None:
    print("! reference/01_fixed_character_weapon_master.png 없음 (무기 아이콘 생략)")
else:
    g=MASTER; H=g["bottom"]-g["top"]; rh=H/g["rows"]
    for ri,tid in enumerate(TOOLS):
        y0=g["top"]+ri*rh
        cell=crop_ratio(master, g["icon_x0"], y0+rh*0.04, g["icon_x1"], y0+rh*g["icon_h"])
        cell=remove_bg(cell); cell,_=keep_main(cell)
        bb=content_bbox(cell)
        if bb: cell=cell.crop(bb)
        save(cell, os.path.join(ROOT,"assets","weapons",tid,"icon.png")); made+=1

def enable(path):
    if not os.path.exists(path): return
    s=open(path,encoding="utf-8").read(); n=s.replace("let ASSETS_ENABLED = false;","let ASSETS_ENABLED = true;")
    if n!=s: open(path,"w",encoding="utf-8").write(n); print("  ASSETS_ENABLED=true ->", os.path.basename(path))
if made>0:
    for f in ("index.html","star_arena.html"): enable(os.path.join(ROOT,f))
print("\n완료: %d개 이미지. (slice_assets v5)" % made)
