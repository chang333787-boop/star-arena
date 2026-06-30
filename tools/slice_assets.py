#!/usr/bin/env python3
# 별빛 아레나 - 학생 에셋 슬라이서 (v2: 배경 깔끔 제거 + 프레임 정렬)
#  - reference/02_basic_motion_master.png 에서 캐릭터 6명 x 5프레임(idle/move/attack/hit/return)
#  - reference/01_fixed_character_weapon_master.png 에서 무기 아이콘 6개
#  - 배경 제거: 밝기/회색 경계 플러드(셀 중앙 흰배경/발밑 그림자까지) + 최대 연결요소만 보존
#    (흩어진 효과 조각/옆칸 침범/그림자 섬 제거. 든 무기는 캐릭터와 연결돼 유지. 던지는 발사체는 제외=깔끔)
#  - 캐릭터별 5프레임을 같은 캔버스 크기 + 가로중앙 + 발(하단) 기준으로 정렬 -> 프레임 전환 시 안 튐
#  - 마지막에 ASSETS_ENABLED=true 로 켬(이미지 생성됐을 때만)
#
# 사용:  pip install pillow ;  python tools/slice_assets.py
# 그리드가 어긋나면 아래 MOTION/MASTER 비율을 조정 후 재실행.

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

# 02 motion sheet(1672x941): 6행 x 5열
MOTION = dict(top=0.142, left=0.145, right=0.999, bottom=0.996, rows=6, cols=5, inset=0.05)
# 01 master(1491x1055): 마지막 열 = 무기 아이콘(아래 이름글자 제외)
MASTER = dict(top=0.07, bottom=0.999, rows=6, icon_x0=0.80, icon_x1=1.0, icon_h=0.62)

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
    """가장자리에서 시작해 '배경(밝음/회색)'으로 연결된 픽셀만 투명화. 외곽선 안쪽(하이라이트)은 보존."""
    im=im.convert("RGBA"); W,H=im.size; px=im.load()
    seen=bytearray(W*H); dq=deque()
    def bg(x,y):
        r,g,b,a=px[x,y]; return is_bg(r,g,b)
    for x in range(W):
        for y in (0,H-1):
            i=y*W+x
            if not seen[i] and bg(x,y): seen[i]=1; dq.append((x,y))
    for y in range(H):
        for x in (0,W-1):
            i=y*W+x
            if not seen[i] and bg(x,y): seen[i]=1; dq.append((x,y))
    while dq:
        x,y=dq.popleft(); px[x,y]=(255,255,255,0)
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<W and 0<=ny<H:
                i=ny*W+nx
                if not seen[i] and bg(nx,ny): seen[i]=1; dq.append((nx,ny))
    # 가장자리 옅은 잔털(halo) 정리: 투명에 접한 밝은 픽셀 한 겹 제거
    px2=im.load()
    rm=[]
    for y in range(H):
        for x in range(W):
            r,g,b,a=px2[x,y]
            if a>0 and min(r,g,b)>=200:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<W and 0<=ny<H and px2[nx,ny][3]==0: rm.append((x,y)); break
    for x,y in rm: r,g,b,a=px2[x,y]; px2[x,y]=(r,g,b,0)
    return im

def keep_main(im, athr=70):
    """최대 연결요소(캐릭터)만 보존. 흩어진 효과/옆칸/그림자 섬 제거. 든 무기는 연결돼 유지."""
    im=im.convert("RGBA"); W,H=im.size; px=im.load()
    lab=[-1]*(W*H); comps=[]
    for sy in range(H):
        for sx in range(W):
            i=sy*W+sx
            if lab[i]!=-1: continue
            if px[sx,sy][3]<=athr: lab[i]=-2; continue
            dq=deque([(sx,sy)]); lab[i]=len(comps); pix=[i]
            while dq:
                x,y=dq.popleft()
                for dx in (-1,0,1):
                    for dy in (-1,0,1):
                        nx,ny=x+dx,y+dy
                        if 0<=nx<W and 0<=ny<H:
                            j=ny*W+nx
                            if lab[j]==-1 and px[nx,ny][3]>athr:
                                lab[j]=lab[i]; dq.append((nx,ny)); pix.append(j)
            comps.append(pix)
    if not comps: return im
    comps.sort(key=len, reverse=True)
    keep=set(comps[0])
    big=comps[0]; xs=[(p%W) for p in big]; ys=[(p//W) for p in big]
    lx0,lx1,ly0,ly1=min(xs),max(xs),min(ys),max(ys)
    for comp in comps[1:]:
        if len(comp) < max(60, len(big)*0.08): continue
        cx=[(p%W) for p in comp]; cy=[(p//W) for p in comp]
        # 캐릭터 몸통과 맞닿거나 겹치는 큰 덩어리(든 무기 등)는 함께 보존
        if min(cx)<=lx1+6 and max(cx)>=lx0-6 and min(cy)<=ly1+6 and max(cy)>=ly0-6:
            keep.update(comp)
    for i in range(W*H):
        if i not in keep:
            x=i%W; y=i//W; r,g,b,a=px[x,y]
            if a: px[x,y]=(r,g,b,0)
    return im

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

def strong_cx(im, athr=160, frac=0.42):
    # 하반신(발/다리) 중심으로 가로 기준을 잡는다 → 무기를 들거나 휘둘러도 서 있는 위치가 안 튐.
    a=im.split()[3]; px=a.load(); W,H=im.size
    y0=int(H*(1-frac)); sx=0; n=0
    for y in range(y0,H):
        for x in range(W):
            if px[x,y]>=athr: sx+=x; n+=1
    if n>=6: return sx/n
    sx=0; n=0
    for y in range(H):
        for x in range(W):
            if px[x,y]>=athr: sx+=x; n+=1
    return (sx/n) if n else W/2

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
        cleaned=[]  # (content_image, cx_in_content, w, h)
        for ci,fr in enumerate(FRAMES):
            x0=g["left"]+ci*cw; y0=g["top"]+ri*rh
            cell=crop_ratio(motion, x0+cw*ins, y0+rh*ins, x0+cw*(1-ins), y0+rh*(1-ins))
            cell=remove_bg(cell); cell=keep_main(cell)
            bb=content_bbox(cell)
            if not bb: cleaned.append((Image.new("RGBA",(10,10),(0,0,0,0)),5,10,10)); continue
            c=cell.crop(bb); cx=strong_cx(c)
            cleaned.append((c,cx,c.size[0],c.size[1]))
        # 공통 캔버스(좌우 대칭: cx가 항상 중앙, 발=하단 정렬)
        halfL=max(cx for (_,cx,_,_) in cleaned)
        halfR=max((w-cx) for (_,cx,w,_) in cleaned)
        half=max(halfL,halfR)
        padX=12; padTop=12; padBot=8
        canW=int(2*(half+padX)); canH=int(max(h for (_,_,_,h) in cleaned)+padTop+padBot)
        for (img,cx,w,h),fr in zip(cleaned,FRAMES):
            canvas=Image.new("RGBA",(canW,canH),(0,0,0,0))
            ox=int(round(canW/2-cx)); oy=int(canH-padBot-h)
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
        cell=remove_bg(cell); cell=keep_main(cell)
        bb=content_bbox(cell)
        if bb: cell=cell.crop(bb)
        save(cell, os.path.join(ROOT,"assets","weapons",tid,"icon.png")); made+=1

def enable(path):
    if not os.path.exists(path): return
    s=open(path,encoding="utf-8").read(); n=s.replace("let ASSETS_ENABLED = false;","let ASSETS_ENABLED = true;")
    if n!=s: open(path,"w",encoding="utf-8").write(n); print("  ASSETS_ENABLED=true ->", os.path.basename(path))
if made>0:
    for f in ("index.html","star_arena.html"): enable(os.path.join(ROOT,f))
print("\n완료: %d개 이미지." % made)
