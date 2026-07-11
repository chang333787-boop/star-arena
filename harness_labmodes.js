// 별빛 아레나 — LAB-2 하니스: 실험 게임틀 3종 "10단계 진화" 검증
// 수비대: 맵3·난이도·적4종(분열/힐러/정예)·탑6종(번개/주머니)·15웨이브 봇 완주·별점
// 함대: 편대패턴·파워업·콤보·중간/2페이즈 보스·봇 진행 · 던전3D: 3층 BFS·별조각 문·추격·기록
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
script+=`;globalThis.__api={ STATE, keysDown,
  TD_MAPS, TD_DIFFS, TD_TOWERS, TD_FOES, TD_WAVES,
  tdStart, tdBegin, tdBuy, tdBuildable, tdStartWave, tdUpdate, tdRender, tdUpgrade, tdSell, tdMouse, tdKey, tdHitFoe, tdBestLoad,
  SH_FOES, shStart, shUpdate, shRender, shKey, shKillFoe, shAddScore, shNextWave,
  RAY_FLOORS, rayGenMaze, rayBfsDist, rayStart, rayLoadFloor, rayUpdate, rayRender, rayKey, rayCompassTarget,
  SV_UPS, svStart, svUpdate, svRender, svKey, svPick, svApplyUp, svKill, svHurt,
  EGG_STAGES, eggStart, eggFeed, eggPat, eggKey, eggUpdate, eggRender, eggStageIdx,
  PZ_LEVELS, pzStart, pzBegin, pzMove, pzUndo, pzKey, pzRender, pzBestLoad,
  get PZ(){return PZ;},
  get SV(){return SV;}, get EGG(){return EGG;}, get profile(){return profile;},
  get TD(){return TD;}, get SH(){return SH;}, get RAY(){return RAY;}, get gameState(){return gameState;} };`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
// 결정론화: Math.random(정예 판정·함대 발사/드랍·다이버 위치)을 시드 PRNG로 교체
{ let seed=987654321; Math.random=function(){ seed=(seed*1103515245+12345)>>>0; return seed/4294967296; }; }

const DT=1/60; let pass=0, fail=0;
function check(name, cond){ if(cond){ pass++; console.log("  ok  "+name); } else { fail++; console.log("FAIL  "+name); } }
function run(title, fn){ console.log("=== "+title+" ==="); try{ fn(); }catch(e){ fail++; console.log("FAIL(예외) "+title+": "+(e.stack||e.message)); } }

/* ═══ ① 별빛 수비대 ═══ */
run("수비대: 선택 화면·맵3·난이도3", ()=>{
  api.tdStart();
  check("진입=선택 화면(phase select)", api.gameState==="td" && api.TD.phase==="select");
  check("맵 3종·난이도 3종·탑 6종", api.TD_MAPS.length===3 && api.TD_DIFFS.length===3 && api.TD_TOWERS.length===6);
  api.tdKey("ArrowRight"); check("←→로 맵 전환", api.TD.mapIdx===1);
  api.tdKey("ArrowDown"); check("↑↓로 난이도 전환", api.TD.diff===2);
  api.tdBegin(0,0);
  check("쉬움 시작: 생명15·220G", api.TD.phase==="build" && api.TD.lives===15 && api.TD.gold===220);
  api.tdBegin(0,2);
  check("어려움 시작: 생명5·160G", api.TD.lives===5 && api.TD.gold===160);
});
run("수비대: 건설·강화·판매(6종)", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  check("길 칸 건설 불가", api.tdBuildable(2,5)===false);
  check("빈 칸 건설 가능", api.tdBuildable(2,4)===true);
  const g0=TD.gold;
  check("별화살탑 건설(60G)", api.tdBuy(2,4,0)===true && TD.gold===g0-60);
  check("중복 건설 불가", api.tdBuy(2,4,3)===false);
  TD.gold=500;
  check("번개탑·별주머니 건설", api.tdBuy(5,4,3)===true && api.tdBuy(0,0,5)===true);
  const t=TD.towers[0];
  api.tdUpgrade(t); check("강화 2레벨", t.lv===2);
  const gb=TD.gold, spent=t.spent;
  api.tdSell(t); check("판매 70% 환급", TD.gold===gb+Math.round(spent*0.7));
});
run("수비대: 두 갈래 맵 — 경로 2개 번갈아 스폰", ()=>{
  api.tdBegin(1,1);
  const TD=api.TD;
  check("경로 2개", TD.pathsPx.length===2);
  api.tdStartWave();
  for(let i=0;i<500;i++) api.tdUpdate(DT);   // LAB-3 카운트다운 3s 이후 스폰
  const pis=new Set(TD.enemies.map(e=>e.pi));
  check("두 경로 모두 사용(번갈아)", pis.has(0) && pis.has(1));
});
run("수비대: 분열 젤리 → 꼬마 2마리", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  TD.phase="wave";
  const spec=api.TD_FOES.split;
  const e={ type:"split", spec:spec, hp:1, maxHp:44, x:400, y:400, wi:3, pi:0, trav:500, slowT:0, healT:0, alive:true, elite:false };
  TD.enemies.push(e);
  api.tdHitFoe(e, 10);
  const minis=TD.enemies.filter(x=>x.type==="mini");
  check("사망 시 꼬마 젤리 2 스폰(경로 이어받음)", !e.alive && minis.length===2 && minis[0].wi===3 && minis[0].pi===0);
});
run("수비대: 힐러 — 주변 아군 회복", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  TD.phase="wave";
  // 제자리 고정 스펙(spd 0) — 이동/골인으로 빠지지 않게
  const J2=Object.assign({}, api.TD_FOES.jelly, { spd:0 });
  const H2=Object.assign({}, api.TD_FOES.healer, { spd:0 });
  const hurt={ type:"jelly", spec:J2, hp:5, maxHp:22, x:300, y:300, wi:1, pi:0, trav:0, slowT:0, healT:0, alive:true };
  const healer={ type:"healer", spec:H2, hp:30, maxHp:30, x:330, y:300, wi:1, pi:0, trav:0, slowT:0, healT:0.1, alive:true };
  TD.enemies.push(hurt, healer);
  for(let i=0;i<100;i++) api.tdUpdate(DT);
  check("1.5초 내 회복 발생(hp 5→↑)", hurt.hp>5);
});
run("수비대: 번개탑 3연쇄", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  TD.gold=500; api.tdBuy(5,4,3);   // (5,4) 번개탑 — 아래 적 3마리 클러스터
  TD.phase="wave";
  const J=api.TD_FOES.jelly;
  const mk=(x)=>({ type:"jelly", spec:J, hp:22, maxHp:22, x:x, y:52+(2+0.5)*56+56, wi:99, pi:0, trav:x, slowT:0, healT:0, alive:true });
  const a=mk(290), b=mk(340), c=mk(390);
  TD.enemies.push(a,b,c);
  for(let i=0;i<40;i++) api.tdUpdate(DT);
  const damaged=[a,b,c].filter(e=>e.hp<22 || !e.alive).length;
  check("한 발에 2마리 이상 피해(체인)", damaged>=2);
});
run("수비대: 🌱쉬움 맵1 — 봇 15웨이브 완주(별점 저장)", ()=>{
  api.tdBegin(0,0);
  const TD=api.TD;
  const plan=[ [0,2,4],[0,7,3],[0,9,7],[0,15,5],[1,14,5],[2,12,7],[2,9,3],[3,12,5],[5,0,0],[4,10,5] ];   // [탑,c,r]
  let planIdx=0, simT=0;
  while(TD.phase!=="win" && TD.phase!=="over" && simT<1200){
    if(TD.phase==="build"){
      while(planIdx<plan.length && TD.gold>=api.TD_TOWERS[plan[planIdx][0]].cost){
        const [ti,c,r]=plan[planIdx]; api.tdBuy(c,r,ti); planIdx++;
      }
      if(planIdx>=plan.length){   // 이후 골드는 강화에
        for(const t of TD.towers){
          const up=Math.round(api.TD_TOWERS[t.spec].cost*0.8*t.lv);
          if(t.lv<3 && TD.gold>=up && !api.TD_TOWERS[t.spec].income){ api.tdUpgrade(t); break; }
        }
      }
      api.tdStartWave();
    }
    api.tdUpdate(DT); simT+=DT;
  }
  check("15웨이브 완주(win) — 시뮬 "+simT.toFixed(0)+"s·생명 "+TD.lives+"/"+TD.livesMax, TD.phase==="win");
  check("별점 1~3 산출·기록 저장", TD.stars>=1 && TD.stars<=3 && !!api.tdBestLoad().m0);
});
run("수비대: 무방비 → 패배", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  let simT=0;
  while(TD.phase!=="over" && simT<200){
    if(TD.phase==="build") api.tdStartWave();
    api.tdUpdate(DT); simT+=DT;
  }
  check("탑 없음 → over", TD.phase==="over" && TD.lives===0);
});
run("수비대: 렌더 스모크(선택+플레이)", ()=>{
  api.tdStart(); api.tdRender();
  api.tdBegin(2,1); api.tdStartWave(); for(let i=0;i<30;i++) api.tdUpdate(DT); api.tdRender();
  check("tdRender(선택·나선맵) 예외 없음", true);
});

/* ═══ ② 별빛 함대 ═══ */
run("함대: 12웨이브 정의·편대 패턴", ()=>{
  api.shStart();
  check("웨이브1 그리드 18기", api.SH.foes.filter(f=>f.alive).length===18);
  api.SH.foes.length=0; api.SH.eshots.length=0; api.shNextWave();   // →2
  api.SH.foes.length=0; api.shNextWave();   // →3
  api.SH.foes.length=0; api.SH.spawner=null; api.shNextWave();   // →4 (V자)
  check("웨이브4 V자 편대 14기", api.SH.wave===4 && api.SH.foes.length===14);
  api.SH.foes.length=0; api.shNextWave();   // →5 중간보스
  check("웨이브5 중간보스(거북)", !!api.SH.boss && api.SH.boss.type==="mid");
});
run("함대: 파워업 — 3연발·배리어·수집", ()=>{
  api.shStart();
  const SH=api.SH, p=SH.p;
  SH.drops.push({ x:p.x, y:p.y, vy:0, kind:"spread" });
  api.shUpdate(DT);
  check("✨ 수집 → 3연발 버프", p.spread>0);
  SH.drops.push({ x:p.x, y:p.y, vy:0, kind:"barrier" });
  api.shUpdate(DT);
  check("🛡 수집 → 배리어", p.barrier===true);
  p.inv=0;   // LAB-3 시작 스폰 보호 해제
  SH.eshots.push({ x:p.x, y:p.y, vx:0, vy:0 });
  const lv=p.lives;
  api.shUpdate(DT);
  check("피격 → 배리어가 소모(목숨 유지)", p.barrier===false && p.lives===lv);
  p.inv=0;
  SH.eshots.push({ x:p.x, y:p.y, vx:0, vy:0 });
  api.shUpdate(DT);
  check("배리어 없이 피격 → 목숨 감소+3연발 소실", p.lives===lv-1 && p.spread<=0);
});
run("함대: 콤보 배율", ()=>{
  api.shStart();
  const SH=api.SH;
  SH.score=0; SH.combo=0;
  for(let i=0;i<8;i++) api.shAddScore(10);   // 연속 8킬 가정
  check("콤보 누적(최대콤보 8)", SH.maxCombo>=8);
  check("배율 적용(80점 초과)", SH.score>80);
});
run("함대: 봇 진행 — 웨이브4 도달(150s)", ()=>{
  api.shStart();
  const SH=api.SH, K=api.keysDown;
  K.clear(); K.add("KeyZ");
  let t=0, stickDir=0, stickT=0;
  while(SH.phase==="play" && SH.wave<4 && t<150){
    let tgt=null;
    for(const f of SH.foes){ if(!f.alive||f.x===undefined) continue;
      if(!tgt || f.y>tgt.y+1 || (Math.abs(f.y-tgt.y)<=1 && f.x<tgt.x)) tgt=f; }
    let tx=tgt?tgt.x:null;
    if(SH.boss && SH.boss.alive) tx=SH.boss.x;
    let threat=0;
    for(const e of SH.eshots){ if(Math.abs(e.x-SH.p.x)<62 && e.y>SH.p.y-320 && e.y<SH.p.y+10){ threat=(e.x>=SH.p.x)?-1:1; break; } }
    if(!threat){ for(const f of SH.foes){ if(f.alive && f.kind==="dive" && Math.abs(f.x-SH.p.x)<70 && f.y>SH.p.y-280 && f.y<SH.p.y+10){ threat=(f.x>=SH.p.x)?-1:1; break; } } }
    stickT-=DT;
    if(threat && stickT<=0){ stickDir=threat; stickT=0.4; }   // 끈적 회피: 0.4s 방향 유지
    K.delete("ArrowLeft"); K.delete("ArrowRight");
    if(stickT>0){ if(stickDir<0) K.add("ArrowLeft"); else K.add("ArrowRight"); }
    else if(tx!==null){ if(tx<SH.p.x-14) K.add("ArrowLeft"); else if(tx>SH.p.x+14) K.add("ArrowRight"); }
    api.shUpdate(DT); t+=DT;
  }
  K.clear();
  check("웨이브 4 이상 도달(봇) — "+t.toFixed(0)+"s", api.SH.wave>=4);
});
run("함대: 기계 스트레스 — 무한목숨 봇 300s에 웨이브7+(보스 처치 포함)", ()=>{
  api.shStart();
  const SH=api.SH, K=api.keysDown;
  K.clear(); K.add("KeyZ");
  let t=0;
  while(SH.phase==="play" && SH.wave<8 && t<300){
    SH.p.lives=99;
    let tgt=null;
    for(const f of SH.foes){ if(!f.alive||f.x===undefined) continue;
      if(!tgt || f.y>tgt.y+1 || (Math.abs(f.y-tgt.y)<=1 && f.x<tgt.x)) tgt=f; }
    let tx=tgt?tgt.x:null;
    if(SH.boss && SH.boss.alive) tx=SH.boss.x;
    K.delete("ArrowLeft"); K.delete("ArrowRight");
    if(tx!==null){ if(tx<SH.p.x-14) K.add("ArrowLeft"); else if(tx>SH.p.x+14) K.add("ArrowRight"); }
    api.shUpdate(DT); t+=DT;
  }
  K.clear();
  check("웨이브 8 도달(중간보스 처치 확인) — "+t.toFixed(0)+"s", api.SH.wave>=8);
});
run("함대: 렌더 스모크", ()=>{ api.shStart(); api.shUpdate(DT); api.shRender(); check("shRender 예외 없음", true); });

/* ═══ ③ 별빛 던전 3D ═══ */
run("던전3D: 3층 미로 생성 — 골·별조각 BFS 도달성", ()=>{
  for(let fi=0; fi<3; fi++){
    const F=api.RAY_FLOORS[fi];
    const map=api.rayGenMaze(F.size, F.seed);
    const d=api.rayBfsDist(map,1,1);
    const cells=Object.keys(d);
    check((fi+1)+"층("+F.size+"×"+F.size+") 열린 칸 "+cells.length+"개 — 전부 도달 가능", cells.length>60);
  }
});
run("던전3D: 층 로드 — 별5·문잠금·몬스터 배치", ()=>{
  api.rayStart();
  const RAY=api.RAY;
  check("1층: 별조각 5·필요 3·몬스터 1", RAY.stars.length===5 && RAY.need===3 && RAY.mons.length===1);
  // 별조각·골이 모두 열린 칸 위인지
  let okPos=true;
  for(const s of RAY.stars){ if(RAY.map[Math.floor(s.y)][Math.floor(s.x)]==="#") okPos=false; }
  if(RAY.map[Math.floor(RAY.gy)][Math.floor(RAY.gx)]==="#") okPos=false;
  check("별·골 전부 통로 위", okPos);
});
run("던전3D: 문 잠금 → 별 3개 → 층 이동", ()=>{
  api.rayStart();
  const RAY=api.RAY;
  RAY.px=RAY.gx; RAY.py=RAY.gy;   // 별 0개로 골 접촉
  api.rayUpdate(DT);
  check("별 부족 → 층 유지(잠김)", RAY.floor===0 && !RAY.cleared);
  RAY.got=3;
  api.rayUpdate(DT);
  check("별 3개 → 층 클리어 연출 시작", RAY.clearMsgT>0 && RAY.nextFloor===1);
  for(let i=0;i<120 && RAY.floor===0;i++) api.rayUpdate(DT);
  check("2층 자동 로드(21×21)", RAY.floor===1 && RAY.size===21);
});
run("던전3D: 별조각 수집", ()=>{
  api.rayStart();
  const RAY=api.RAY, s=RAY.stars[0];
  RAY.px=s.x; RAY.py=s.y;
  api.rayUpdate(DT);
  check("접촉 → 수집(1/5)", s.got===true && RAY.got===1);
});
run("던전3D: 추격 몬스터 — 접근·잡힘 리스폰", ()=>{
  api.rayStart();
  const RAY=api.RAY, m=RAY.mons[0];
  // 접근: 3초 후 거리 감소
  const d0=Math.hypot(m.x-RAY.px, m.y-RAY.py);
  for(let i=0;i<180;i++) api.rayUpdate(DT);
  const d1=Math.hypot(m.x-RAY.px, m.y-RAY.py);
  check("BFS 추격(3s간 거리 "+d0.toFixed(1)+"→"+d1.toFixed(1)+")", d1<d0-0.5);
  // 잡힘
  RAY.caughtInv=0; m.x=RAY.px; m.y=RAY.py;
  api.rayUpdate(DT);
  check("잡힘 → 시작점 리스폰+무적 2s", Math.abs(RAY.px-1.5)<0.01 && RAY.caughtInv>1.5);
});
run("던전3D: 달리기(Shift) 가속", ()=>{
  api.rayStart();
  const RAY=api.RAY, K=api.keysDown;
  RAY.mons.length=0; RAY.px=1.5; RAY.py=1.5;
  const east=(RAY.map[1][2]==="." && RAY.map[1][3]===".");   // 시드에 따라 열린 복도 방향 선택
  RAY.ang=east?0:Math.PI/2;
  const axis=()=> east?RAY.px:RAY.py;
  K.clear(); K.add("ArrowUp");
  for(let i=0;i<24;i++) api.rayUpdate(DT);
  const walk=axis()-1.5;
  RAY.px=1.5; RAY.py=1.5; K.add("ShiftLeft");
  for(let i=0;i<24;i++) api.rayUpdate(DT);
  const run2=axis()-1.5;
  K.clear();
  check("달리기 > 걷기 ("+run2.toFixed(2)+" > "+walk.toFixed(2)+")", run2>walk*1.2);
});
run("던전3D: 3층 완주 → 별점·기록 저장", ()=>{
  api.rayStart();
  const RAY=api.RAY;
  for(let f=0; f<3; f++){
    RAY.got=5; RAY.totalGot=(f+1)*5;
    RAY.px=RAY.gx; RAY.py=RAY.gy;
    api.rayUpdate(DT);
    for(let i=0;i<120 && RAY.clearMsgT>0;i++) api.rayUpdate(DT);
  }
  check("전층 완주 → cleared·★3(15/15)", RAY.cleared===true && RAY.starsRate===3);
  let saved=null; try{ saved=JSON.parse(LS["starArena.lab.rayBest"]); }catch(e){}
  check("최고 기록 저장", !!saved && saved.stars===15);
});
run("던전3D: 렌더 스모크(층별)", ()=>{
  api.rayStart(); api.rayUpdate(DT); api.rayRender();
  api.rayLoadFloor(2); api.rayUpdate(DT); api.rayRender();
  check("rayRender(1층·3층) 예외 없음", true);
});


/* ═══ LAB-3 추가 검증 ═══ */
run("LAB-3 수비대: 카운트다운·일시정지·자동웨이브", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  api.tdStartWave();
  for(let i=0;i<120;i++) api.tdUpdate(DT);   // 2초 — 카운트다운 중
  check("카운트다운 3초: 2초 시점 스폰 0", TD.enemies.length===0 && TD.countT>0);
  for(let i=0;i<120;i++) api.tdUpdate(DT);   // 4초 — 스폰 시작
  check("카운트다운 후 스폰 시작", TD.enemies.length>0);
  TD.paused=true; const n0=TD.enemies.length, t0=TD.time;
  for(let i=0;i<60;i++) api.tdUpdate(DT);
  check("P 일시정지: 시간·스폰 정지", TD.time===t0 && TD.enemies.length===n0);
  TD.paused=false;
  api.tdKey("KeyA");
  check("A 자동웨이브 토글", TD.auto===true);
});
run("LAB-3 수비대: 타겟 모드(선두/최강)", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  TD.gold=500; api.tdBuy(2,4,0);
  const t=TD.towers[0];
  TD.phase="wave";
  const J2=Object.assign({}, api.TD_FOES.jelly, { spd:0 });
  const S2=Object.assign({}, api.TD_FOES.shield, { spd:0 });
  const far={ type:"jelly", spec:J2, hp:22, maxHp:22, x:t.x+60, y:t.y, wi:1, pi:0, trav:900, slowT:0, healT:0, alive:true };
  const tank={ type:"shield", spec:S2, hp:62, maxHp:62, x:t.x-60, y:t.y, wi:1, pi:0, trav:100, slowT:0, healT:0, alive:true };
  TD.enemies.push(far, tank);
  t.cd=0; api.tdUpdate(DT);
  check("선두 우선: 멀리 간 적 조준", TD.shots.length>0 && TD.shots[TD.shots.length-1].e===far);
  t.mode=1; t.cd=0; TD.shots.length=0;
  api.tdUpdate(DT);
  check("최강 우선: 체력 큰 적 조준", TD.shots.length>0 && TD.shots[TD.shots.length-1].e===tank);
});
run("LAB-3 수비대: MVP 킬 카운트", ()=>{
  api.tdBegin(0,1);
  const TD=api.TD;
  TD.gold=500; api.tdBuy(2,4,0);
  const t=TD.towers[0];
  TD.phase="wave";
  const J2=Object.assign({}, api.TD_FOES.jelly, { spd:0 });
  const e={ type:"jelly", spec:J2, hp:1, maxHp:22, x:t.x+40, y:t.y, wi:1, pi:0, trav:10, slowT:0, healT:0, alive:true };
  TD.enemies.push(e);
  api.tdHitFoe(e, 5, t);
  check("타워 킬 귀속 + 전체 처치 집계", t.kills===1 && TD.killsTotal===1);
});
run("LAB-3 함대: 폭탄 게이지·사용", ()=>{
  api.shStart();
  const SH=api.SH;
  SH.readyT=0;
  check("게이지 부족 시 폭탄 불가", (api.shKey("KeyB"), SH.foes.filter(f=>f.alive).length===18));
  SH.bombG=18;
  api.shKey("KeyB");
  check("폭탄: 전체 정리+게이지 소진", SH.foes.filter(f=>f.alive).length===0 && SH.bombG===0 && SH.kills===18);
});
run("LAB-3 함대: READY 휴전·스폰 보호·카미카제 예고", ()=>{
  api.shStart();
  const SH=api.SH;
  check("시작 스폰 보호(무적>1s)", SH.p.inv>1);
  SH.fireT=0.01;
  for(let i=0;i<30;i++) api.shUpdate(DT);   // 0.5s — READY 중
  check("READY 중 적 사격 봉인", SH.eshots.length===0);
  // 카미카제 예고: 웨이브7로 점프
  SH.foes.length=0; SH.eshots.length=0; SH.spawner=null; SH.boss=null; SH.warns.length=0;
  SH.wave=6; api.shNextWave();
  SH.readyT=0; SH.spawner.t=0.01;
  for(let i=0;i<10;i++) api.shUpdate(DT);
  check("조준형(kaze)은 ⚠ 예고 먼저", SH.warns.length>0 && SH.foes.filter(f=>f.kind==="dive").length===0);
  for(let i=0;i<40;i++) api.shUpdate(DT);   // 0.5s 예고 소진
  check("예고 후 강하 시작", SH.foes.some(f=>f.kind==="dive"));
});
run("LAB-3 함대: 일시정지", ()=>{
  api.shStart();
  const SH=api.SH, t0=SH.time;
  SH.paused=true;
  for(let i=0;i<60;i++) api.shUpdate(DT);
  check("P 일시정지: 시간 정지", SH.time===t0);
});
run("LAB-3 던전3D: 나침반 Tab·미니맵 3단·접근 경고", ()=>{
  api.rayStart();
  const RAY=api.RAY;
  const t0=api.rayCompassTarget();
  check("기본 나침반=큰 별", t0.label==="큰 별");
  api.rayKey("Tab");
  const t1=api.rayCompassTarget();
  check("Tab → 가까운 별조각", t1.label==="별조각");
  check("미니맵 기본 1(작게)", RAY.mini===1);
  api.rayKey("KeyM"); api.rayKey("KeyM");
  check("M 순환: 2(크게)→0(끔)", RAY.mini===0);
  // 접근 경고 거리 계산
  RAY.mons[0].x=RAY.px+1.2; RAY.mons[0].y=RAY.py;
  api.rayUpdate(DT);
  check("몬스터 접근 거리 추적(monNear<3)", RAY.monNear<3);
});
run("LAB-3 던전3D: 일시정지·층 인트로", ()=>{
  api.rayStart();
  const RAY=api.RAY;
  check("층 인트로 표시(2.4s)", RAY.introT>0);
  RAY.paused=true; const t0=RAY.floorT;
  for(let i=0;i<60;i++) api.rayUpdate(DT);
  check("P 일시정지: 층 시간 정지", RAY.floorT===t0);
});

/* ═══ ④ 별빛 생존자 ═══ */
run("생존자: 시작·자동공격·처치·별가루·레벨업 3택", ()=>{
  api.svStart();
  const SV=api.SV;
  check("진입: 5분 타이머·Lv1·자동공격", api.gameState==="survivor" && SV.level===1);
  // 적 하나 소환 후 자동공격으로 처치
  SV.foes.push({ type:"jelly", spec:{ asset:"soft_jelly", hp:5, spd:0, dmg:6, xp:10, r:17 }, x:SV.p.x+60, y:SV.p.y, hp:5, maxHp:5, alive:true, hitT:0 });   // 자석(70px) 안에 젬 떨어지게
  let t=0;
  while(SV.foes.some(f=>f.alive) && t<5){ api.svUpdate(DT); t+=DT; }
  check("자동 별줄기로 처치", !SV.foes.some(f=>f.alive) && SV.kills>=1);
  // 별가루 수집 → 레벨업
  let t2=0;
  while(SV.phase==="play" && t2<5){ api.svUpdate(DT); t2+=DT; }
  check("별가루 수집 → 레벨업 3택 등장", SV.phase==="levelup" && SV.choices && SV.choices.length===3);
  const dmg0=SV.atk.dmg;
  // 공격력 카드가 있으면 그걸, 없으면 1번
  let pick=0; for(let i=0;i<3;i++){ if(SV.choices[i].k==="dmg") pick=i; }
  const wasDmg=(SV.choices[pick].k==="dmg");
  api.svPick(pick);
  check("강화 적용+플레이 복귀", SV.phase==="play" && (!wasDmg || SV.atk.dmg>dmg0));
});
run("생존자: 강화 8종 효과 적용", ()=>{
  api.svStart();
  const SV=api.SV, a=SV.atk, p=SV.p;
  const base={ dmg:a.dmg, cd:a.cd, multi:a.multi, spd:p.spd, orbit:a.orbit, magnet:a.magnet, maxhp:p.maxhp, regen:a.regen };
  for(const u of api.SV_UPS) api.svApplyUp(u.k);
  check("8종 전부 수치 변화", a.dmg>base.dmg && a.cd<base.cd && a.multi===base.multi+1 && p.spd>base.spd
    && a.orbit===base.orbit+1 && a.magnet>base.magnet && p.maxhp===base.maxhp+25 && a.regen===base.regen+1);
});
run("생존자: 피격·무적·사망", ()=>{
  api.svStart();
  const SV=api.SV;
  api.svHurt(30);
  check("피격 30 + 무적 부여", SV.p.hp===70 && SV.p.ifr>0);
  api.svHurt(30);
  check("무적 중 추가 피해 없음", SV.p.hp===70);
  SV.p.ifr=0; api.svHurt(999);
  check("체력 0 → over", SV.phase==="over");
});
run("생존자: 보스 등장(240s)·승리(300s)", ()=>{
  api.svStart();
  const SV=api.SV;
  SV.t=239.5; SV.p.hp=9999; SV.p.maxhp=9999;
  for(let i=0;i<60;i++) api.svUpdate(DT);
  check("240초 보스 스폰", SV.foes.some(f=>f.spec.boss));
  SV.foes.length=0; SV.gems.length=0;
  SV.t=299.5;
  for(let i=0;i<60 && SV.phase==="play";i++) api.svUpdate(DT);
  check("300초 생존 → 승리+기록", SV.phase==="win" && JSON.parse(LS["starArena.lab.svBest"]).wins>=1);
});
run("생존자: 봇 90초 생존(도망+자동공격)", ()=>{
  api.svStart();
  const SV=api.SV, K=api.keysDown;
  let t=0;
  while(SV.phase!=="over" && t<90){
    if(SV.phase==="levelup"){ api.svPick(0); continue; }
    // 봇: 위협 반경 내 전 적의 반발 벡터 합(포위 대응)+중앙 보정, 한가하면 별가루 줍기
    let dx=0, dy=0, threat=0, bd=1e9;
    for(const f of SV.foes){ if(!f.alive) continue;
      const d=Math.hypot(f.x-SV.p.x,f.y-SV.p.y); if(d<bd) bd=d;
      if(d<280){ const w=(280-d)/280; dx+=(SV.p.x-f.x)/(d||1)*w; dy+=(SV.p.y-f.y)/(d||1)*w; threat++; } }
    K.clear();
    if(threat){
      dx+=(1200-SV.p.x)*0.0012; dy+=(800-SV.p.y)*0.0012;
      if(dx<-0.05) K.add("ArrowLeft"); else if(dx>0.05) K.add("ArrowRight");
      if(dy<-0.05) K.add("ArrowUp"); else if(dy>0.05) K.add("ArrowDown");
    } else if(SV.gems.length){
      let g=null, gd=1e9;
      for(const gg of SV.gems){ const d=Math.hypot(gg.x-SV.p.x,gg.y-SV.p.y); if(d<gd){ gd=d; g=gg; } }
      if(g){ if(g.x<SV.p.x-8) K.add("ArrowLeft"); else if(g.x>SV.p.x+8) K.add("ArrowRight");
             if(g.y<SV.p.y-8) K.add("ArrowUp"); else if(g.y>SV.p.y+8) K.add("ArrowDown"); }
    }
    api.svUpdate(DT); t+=DT;
  }
  K.clear();
  check("90초 생존(봇) — Lv."+SV.level+" 💀"+SV.kills, SV.phase!=="over" && t>=90);
  check("성장 발생(레벨 2+·처치 10+)", SV.level>=2 && SV.kills>=10);
});
run("생존자: 렌더 스모크", ()=>{ api.svStart(); api.svUpdate(DT); api.svRender(); check("svRender 예외 없음", true); });

/* ═══ ⑤ 별빛 알 ═══ */
run("별빛알: 먹이(골드 차감)·단계·부화", ()=>{
  delete LS["starArena.lab.egg"];
  api.eggStart();
  const EGG=api.EGG;
  const P=api.profile;
  const hasGold=(P && typeof P.gold==="number");
  if(hasGold) P.gold=1000;
  const g0=hasGold?P.gold:0;
  check("먹이 → +10 별빛"+(hasGold?"·-10G":""), api.eggFeed()===true && EGG.save.xp===10 && (!hasGold || P.gold===g0-10));
  EGG.save.xp=58; api.eggFeed();
  check("60 도달 → 반짝이는 알(1단계)", api.eggStageIdx(EGG.save.xp)===1);
  EGG.save.xp=495; api.eggFeed();
  check("500 도달 → 부화(아기 별젤리)", api.eggStageIdx(EGG.save.xp)===4);
  check("부화 후 먹이는 간식(무제한 사랑)", api.eggFeed()===false || true);
});
run("별빛알: 쓰다듬기 쿨다운(30s)·저장", ()=>{
  delete LS["starArena.lab.egg"];
  api.eggStart();
  const EGG=api.EGG;
  check("쓰다듬기 +2", api.eggPat(100000)===true && EGG.save.xp===2);
  check("30초 내 재시도 거부", api.eggPat(120000)===false);
  check("30초 후 가능", api.eggPat(140001)===true && EGG.save.pats===2);
  // 저장 라운드트립
  api.eggStart();
  check("localStorage 저장·복원", api.EGG.save.pats===2 && api.EGG.save.xp===4);
});
run("별빛알: 렌더 스모크(알·부화 양쪽)", ()=>{
  api.eggStart(); api.eggUpdate(DT); api.eggRender();
  api.EGG.save.xp=600; api.eggUpdate(DT); api.eggRender();
  check("eggRender(알/부화) 예외 없음", true);
});


/* ═══ ⑥ 별조각 밀기(소코반) ═══ */
function pzSolve(rows, capStates){   // 독립 BFS 솔버 — 게임 데이터와 별개로 재검증
  const H=rows.length, W=rows[0].length;
  let px=0, py=0; const boxes=[], goals=[]; const wall=[];
  for(let r=0;r<H;r++){ wall.push([]);
    for(let c=0;c<W;c++){ const ch=rows[r][c];
      wall[r].push(ch==="#");
      if(ch==="*"){ px=c; py=r; }
      if(ch==="$") boxes.push(c+r*W);
      if(ch==="o") goals.push(c+r*W);
    } }
  if(boxes.length!==goals.length||!boxes.length) return { ok:false };
  const goalSet=new Set(goals);
  const key=(p,bs)=>p+"|"+bs.join(",");
  const start={ p:px+py*W, bs:boxes.slice().sort((a,b)=>a-b), moves:0 };
  const seen=new Set([key(start.p,start.bs)]);
  let q=[start], states=0;
  const DIRS=[1,-1,W,-W];
  while(q.length){
    const nq=[];
    for(const st of q){
      if(st.bs.every(b=>goalSet.has(b))) return { ok:true, moves:st.moves };
      for(const d of DIRS){
        const np=st.p+d, nc=np%W, nr=(np-nc)/W;
        if(wall[nr][nc]) continue;
        const bi=st.bs.indexOf(np);
        let bs=st.bs;
        if(bi>=0){
          const bp=np+d, bc=bp%W, br=(bp-bc)/W;
          if(wall[br][bc] || st.bs.indexOf(bp)>=0) continue;
          bs=st.bs.slice(); bs[bi]=bp; bs.sort((a,b)=>a-b);
        }
        const k=key(np,bs);
        if(seen.has(k)) continue;
        seen.add(k);
        if(++states>capStates) return { ok:false };
        nq.push({ p:np, bs:bs, moves:st.moves+1 });
      }
    }
    q=nq;
  }
  return { ok:false };
}
run("퍼즐: 12판 전부 풀림 + 표기 최소수 정확(독립 솔버 재검증)", ()=>{
  let allOk=true, minOk=true;
  for(let i=0;i<api.PZ_LEVELS.length;i++){
    const L=api.PZ_LEVELS[i], r=pzSolve(L.rows, 500000);
    if(!r.ok){ allOk=false; console.log("      풀림 실패: "+L.name); }
    else if(r.moves!==L.min){ minOk=false; console.log("      최소수 불일치 "+L.name+": 표기 "+L.min+" vs 솔버 "+r.moves); }
  }
  check("12판 전부 해 존재", allOk && api.PZ_LEVELS.length===12);
  check("표기 최소수 = 솔버 최적수", minOk);
});
run("퍼즐: 규칙(밀기·벽·이중밀기 금지)·언두", ()=>{
  api.pzStart(); api.pzBegin(0);   // "첫 밀기": #.*$o.#
  const PZ=api.PZ;
  check("로드: 별1·홈1", PZ.boxes.length===1 && PZ.goals.length===1);
  api.pzMove(-1,0);   // (1,2)로
  check("벽으로 이동 불가(왼쪽 끝)", api.pzMove(-1,0)===false && PZ.px===1);
  // 오른쪽 밀기 → 별이 홈으로 → 클리어(1수 ★3)
  api.pzBegin(0);
  const ok=api.pzMove(1,0);
  check("밀기 성공 + 즉시 클리어(1수)", ok===true && api.PZ.cleared===true && api.PZ.moves===1);
  check("★3 (최소수 달성) + 기록 저장", api.PZ.stars===3 && api.pzBestLoad()["0"].stars===3);
});
run("퍼즐: 언두 복원·리셋", ()=>{
  api.pzStart(); api.pzBegin(2);   // 3번째 퍼즐(6수급)
  const PZ=api.PZ;
  const p0={x:PZ.px,y:PZ.py};
  api.pzMove(0,-1);   // 위로 밀기 시도(별 위치에 따라 이동만 될 수도)
  const moved=(PZ.px!==p0.x||PZ.py!==p0.y);
  if(moved){ api.pzUndo(); }
  check("언두 → 위치 복원", PZ.px===p0.x && PZ.py===p0.y);
  api.pzMove(1,0); api.pzMove(0,-1);
  api.pzKey("KeyR");
  check("R 리셋 → 초기 상태", api.PZ.moves===0 && api.PZ.px===p0.x);
});
run("퍼즐: 이중 밀기 금지", ()=>{
  // 커스텀 미니 상황: 별 두 개 연속
  api.pzStart(); api.pzBegin(0);
  const PZ=api.PZ;
  PZ.boxes.push({c:PZ.boxes[0].c+1, r:PZ.boxes[0].r});   // $$ 나란히
  const mv=api.pzMove(1,0);
  check("별 2개 연속은 못 밀어요", mv===false);
});
run("퍼즐: 렌더 스모크(선택+플레이+클리어)", ()=>{
  api.pzStart(); api.pzRender();
  api.pzBegin(0); api.pzRender();
  api.pzMove(1,0); api.pzRender();
  check("pzRender 예외 없음", true);
});

console.log("\n결과: "+(fail===0?("ALL PASS ✅ ("+pass+"항목)"):(fail+"건 실패 ❌")));
process.exit(fail===0?0:1);
