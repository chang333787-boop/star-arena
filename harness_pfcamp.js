// 별빛 아레나 — BIG-BATCH-2 P1.5 하니스: 별빛 점프 원정 20스테이지 "실물리 클리어 검증"
// 1.5-A: 못 깨는 스테이지 출시 금지 — 휴리스틱+몬테카를로 봇이 실제 pfUpdate 물리로 전 스테이지 클리어해야 PASS
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener,localStorage:lsS,prompt:()=>"t"};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=(cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={ PF_LEVELS, pfStartLevel, pfUpdate, pfShoot, pfJumpPressed, keysDown, get PF(){return PF;} };`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }

const DT=1/60;
// 시드 난수(재현 가능)
let seed=1234567;
function rnd(){ seed=(seed*1103515245+12345)>>>0; return seed/4294967296; }

function solveLevel(lv, attempts, capSec){
  for(let at=1; at<=attempts; at++){
    api.pfStartLevel(lv);
    const PF=api.PF, p=PF.p;
    // 골 좌표
    let gc=-1, gr=-1;
    for(let r=0;r<PF.rows;r++) for(let c=0;c<PF.cols;c++) if(PF.grid[r][c]==="G"){ gc=c; gr=r; }
    const gx=(gc+0.5)*56;
    let dir=1, flipT=0, holdT=0, lastX=p.x, stuckT=0, shootT=0;
    const K=api.keysDown;
    K.clear();
    const T=(c,r)=>{ if(c<0||c>=PF.cols) return "#"; if(r<0||r>=PF.rows) return "."; return PF.grid[r][c]; };
    const solid=(ch)=>ch==="#"||ch==="i"||ch==="b";
    for(let t=0; t<capSec*60; t++){
      if(PF.cleared){ K.clear(); return {ok:true, attempt:at, time:PF.time, deaths:PF.deaths}; }
      // 방향: 기본은 골 쪽, 끼임 시 잠깐 반대로
      if(flipT>0){ flipT-=DT; }
      else dir = gx>p.x ? 1 : -1;
      K.delete("ArrowLeft"); K.delete("ArrowRight");
      K.add(dir>0?"ArrowRight":"ArrowLeft");
      const fc=Math.floor(p.x/56)+dir, fr=Math.floor((p.y-2)/56), hr=Math.floor((p.y-46)/56);
      // 점프 판단
      let wantJump=false, longHold=false;
      if(solid(T(fc,fr))||solid(T(fc,hr))){                                    // 벽 — 3칸 이상 높으면 풀홀드
        wantJump=true;
        let hgt=0; for(let rr=fr; rr>=0 && solid(T(fc,rr)); rr--) hgt++;
        if(hgt>=3) longHold=true;
      }
      {                                                                        // 가시: 픽셀 거리 기반 선제 점프(늦점프 방지)
        const cc=Math.floor(p.x/56);
        for(let d2=1; d2<=3; d2++){
          const ch=T(cc+dir*d2, fr);
          if(ch==="S"){
            const edge = dir>0 ? ((cc+d2)*56 - p.x) : (p.x - (cc-d2+1)*56);
            if(edge<90 && edge>14){ wantJump=true; longHold=true; }
            break;
          }
          if(solid(ch)) break;
        }
      }
      if(p.onGround){                                                          // 절벽(3칸 내 바닥 없음) — 풀홀드로 멀리
        let ground=false;
        for(let rr=fr+1; rr<=fr+3 && rr<PF.rows; rr++) if(solid(T(fc,rr))||T(fc,rr)==="-"){ ground=true; break; }
        if(!ground){ wantJump=true; longHold=true; }
      }
      for(const mM of PF.monsters){ if(!mM.dead && Math.abs(mM.y-p.y)<80 && (mM.x-p.x)*dir>0 && Math.abs(mM.x-p.x)<110) wantJump=true; }
      if(rnd()<0.02) wantJump=true;                                            // 몬테카를로 탐색
      if(wantJump && p.onGround && holdT<=0){ api.pfJumpPressed(); holdT=longHold?0.75:(0.12+rnd()*0.3); }   // 가시=풀홀드(수평 최대 4.3칸)
      if(holdT>0){ holdT-=DT; K.add("KeyZ"); } else K.delete("KeyZ");
      // ⭐총: 벽·몬스터 앞에서 발사
      shootT-=DT;
      if(p.gun && shootT<=0){
        let tgt=false;
        for(let d2=1;d2<=6;d2++){ const ch=T(Math.floor(p.x/56)+dir*d2, fr); if(ch==="b"){ tgt=true; break; } if(solid(ch)) break; }
        for(const mM of PF.monsters){ if(!mM.dead && Math.abs(mM.y-p.y)<60 && (mM.x-p.x)*dir>0 && Math.abs(mM.x-p.x)<400) tgt=true; }
        if(tgt){ api.pfShoot(); shootT=0.3; }
      }
      // 끼임 감지 → 반대로 잠깐 + 점프
      if(Math.abs(p.x-lastX)<1.5) stuckT+=DT; else stuckT=0;
      lastX=p.x;
      if(stuckT>1.2){ stuckT=0; flipT=0.3+rnd()*0.8; dir=-dir; if(p.onGround){ api.pfJumpPressed(); holdT=0.25+rnd()*0.2; } }
      api.pfUpdate(DT);
    }
    K.clear();
  }
  return {ok:false};
}

let fails=0;
console.log("=== 별빛 점프 원정 20스테이지 — 실물리 봇 클리어 검증 ===");
console.log("스테이지 | 판정 | 성공 시도 | 클리어 타임 | 봇 사망");
const t0=Date.now();
for(const lv of api.PF_LEVELS){
  const cap=(lv.rows[0].length>70)?180:90;
  const r=solveLevel(lv, 60, cap);
  if(r.ok) console.log("  ok  "+lv.name+"  |  시도 "+r.attempt+"  |  "+r.time.toFixed(1)+"s  |  💀"+r.deaths);
  else { console.log("FAIL  "+lv.name+" — 봇 60회 시도 실패(레벨 재설계 필요)"); fails++; }
}
console.log("검증 소요 "+((Date.now()-t0)/1000).toFixed(1)+"s");
console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
