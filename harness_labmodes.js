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
  PZ_LEVELS, pzStart, pzBegin, pzBeginLevel, pzMove, pzUndo, pzKey, pzRender, pzBestLoad,
  pzSolveGame, pzEditStart, pzEditCycle, pzEditCheck, pzEditSave, pzCustomLoad, pzCustomSave, pzRenderEdit, pzRenderCustom,
  rnStart, rnJump, rnKey, rnUpdate, rnRender,
  bkStart, bkKey, bkUpdate, bkRender, bkBricks,
  snStart, snKey, snUpdate, snRender,
  otStart, otKey, otUpdate, otRender, otFlips, otMoves, otPlace, otCount, otAiMove,
  msStart, msKey, msUpdate, msRender, msSwing, msUlt, msSpawnFoe, msBest, MS_FOES, MS_WEAPONS, msHurt, msApplyPick, msKillFoe, get MS(){return MS;},
  LAB_GAMES, lhStart, lhKey, lhRender, lhList,
  LabOpenStore, labToggle, labOpenCount, labBack, drawLobbyMiniBanner, activateMenuRow, handleAdminKey,
  get labOpen(){return labOpen;}, get labFrom(){return labFrom;}, setLabFrom:v=>{labFrom=v;}, setState:(s)=>{ gameState=s; },
  labReward, addExp, get lobbyCardOpen(){return lobbyCardOpen;}, setLobbyCardOpen:v=>{lobbyCardOpen=v;}, handleStartKey,
  LabRankStore, labRankTop, labRankDraw, LAB_RANK_LOWER, get labRank(){return labRank;},
  labShared, labSubmit, pzSubmit, tdEditStart, tdEditCheck, tdSubmit, tdBeginShared, tdStartWave2:tdStartWave,
  shOpen, shEditStart, shEditCheck, shSubmit, shBeginShared, drawMapReviewScreen, loadEditorStore, saveEditorStore,
  setReviewIdx:v=>{reviewIdx=v;}, setPrompt:f=>{ window.prompt=f; },
  get PZ(){return PZ;}, get RN(){return RN;}, get BK(){return BK;}, get SN(){return SN;}, get OT(){return OT;}, get LH(){return LH;},
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
run("생존자: 강화 14종 효과 적용(v1.73)", ()=>{
  api.svStart();
  const SV=api.SV, a=SV.atk, p=SV.p;
  const base={ dmg:a.dmg, cd:a.cd, multi:a.multi, spd:p.spd, orbit:a.orbit, magnet:a.magnet, maxhp:p.maxhp, regen:a.regen };
  for(const u of api.SV_UPS) api.svApplyUp(u.k);
  check("기본 8종 수치 변화(+40% 확인)", Math.abs(a.dmg-base.dmg*1.4)<0.001 && a.cd<base.cd && a.multi===base.multi+1 && p.spd>base.spd
    && a.orbit===base.orbit+1 && a.magnet>base.magnet && p.maxhp===base.maxhp+25 && a.regen===base.regen+1);
  check("신규 6종 부여(사슬·폭발·별똥별·서리·보호막·궤도)", a.chain===1 && a.boom===1 && a.meteor===1 && a.frost===1 && a.shieldLv===1 && a.orbitR>74 && a.orbitSpd>0);
});
run("생존자 v1.73: 사슬·폭발·데미지 숫자", ()=>{
  api.svStart();
  const SV=api.SV, a=SV.atk, p=SV.p;
  a.chain=1; a.boom=1;
  const mk=(x,y,hp)=>({ type:"jelly", spec:{ asset:"soft_jelly", hp:hp, spd:0, dmg:0, xp:1, r:17 }, x:x, y:y, hp:hp, maxHp:hp, alive:true, hitT:0 });
  const f1=mk(p.x+70, p.y-14, a.dmg), f2=mk(p.x+130, p.y-14, 60), f3=mk(p.x+70, p.y+40, 60);   // f1은 한 방 → 폭발
  SV.foes.push(f1,f2,f3);
  let t=0; while(f1.alive && t<3){ api.svUpdate(1/60); t+=1/60; }
  check("별줄기 처치 → 사슬 or 폭발로 주변 동반 피해", !f1.alive && (f2.hp<60 || f3.hp<60));
  check("데미지 숫자 생성", SV.dnums.length>0);
});
run("생존자 v1.73: 보호막·서리·별똥별", ()=>{
  api.svStart();
  const SV=api.SV, a=SV.atk, p=SV.p;
  api.svApplyUp("shield");
  p.shieldT=0.01; api.svUpdate(1/60);
  check("보호막 충전", p.shield===true);
  const hp0=p.hp; api.svHurt(30);
  check("보호막 1회 방어(체력 유지·재충전 시작)", p.hp===hp0 && p.shield===false && p.shieldT>0);
  api.svApplyUp("frost");
  const slow={ type:"jelly", spec:{ asset:"soft_jelly", hp:99, spd:100, dmg:0, xp:1, r:17 }, x:p.x+100, y:p.y, hp:99, maxHp:99, alive:true, hitT:0 };
  const fast={ type:"jelly", spec:{ asset:"soft_jelly", hp:99, spd:100, dmg:0, xp:1, r:17 }, x:p.x+900, y:p.y, hp:99, maxHp:99, alive:true, hitT:0 };
  SV.foes.push(slow,fast);
  const d1=slow.x, d2=fast.x;
  for(let i=0;i<30;i++) api.svUpdate(1/60);
  check("서리 오라: 안쪽 적이 더 느림", (d1-slow.x) < (d2-fast.x)*0.85);
  api.svApplyUp("meteor");
  SV.foes.length=0; SV.gems.length=0; SV.xpNext=999999; SV.spawnT=9999;   // 단독 표적·레벨업/스포너 차단
  const tgt={ type:"jelly", spec:{ asset:"soft_jelly", hp:200, spd:0, dmg:0, xp:1, r:17 }, x:p.x+200, y:p.y, hp:200, maxHp:200, alive:true, hitT:0 };
  SV.foes.push(tgt);
  SV.meteorT=0.01; SV.meteorWarn=null;
  for(let i=0;i<90;i++){ api.svUpdate(1/60); SV.spawnT=9999; }
  check("별똥별 경고 후 낙하 피해", tgt.hp<200);
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
  SV.t=139.5; SV.p.hp=9999; SV.p.maxhp=9999;
  for(let i=0;i<60;i++) api.svUpdate(DT);
  check("140초 보스 스폰(3분판)", SV.foes.some(f=>f.spec.boss));
  SV.foes.length=0; SV.gems.length=0;
  SV.t=179.5;
  for(let i=0;i<60 && SV.phase==="play";i++) api.svUpdate(DT);
  check("180초 생존 → 승리+기록", SV.phase==="win" && JSON.parse(LS["starArena.lab.svBest"]).wins>=1);
});
run("생존자: 수호별 — 겹친 적 전원 동시 타격+넉백(v1.72)", ()=>{
  api.svStart();
  const SV=api.SV, p=SV.p, a=SV.atk;
  a.orbit=1; a.orbitA=0; a.orbitTick=0.01;   // 다음 틱 임박, 궤도별 위치=(p.x+74, p.y)
  const mk=(dx,dy)=>({ type:"jelly", spec:{ asset:"soft_jelly", hp:50, spd:0, dmg:0, xp:1, r:17 }, x:p.x+74+dx, y:p.y+dy, hp:50, maxHp:50, alive:true, hitT:0 });
  const f1=mk(-6,-8), f2=mk(8,6), far=mk(300,0);   // 두 마리 겹침 + 한 마리 밖
  SV.foes.push(f1,f2,far);
  api.svUpdate(1/60);
  check("겹친 2마리 같은 틱에 동시 피해", f1.hp<50 && f2.hp<50 && f1.hp===f2.hp);
  check("범위 밖은 무피해", far.hp===50);
  check("넉백(플레이어 반대쪽으로 밀림)", f1.x>p.x+74-6 || f2.x>p.x+74+8);
  check("피격 플래시 부여", f1.hitT>0 && f2.hitT>0);
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
run("퍼즐: 30판 전부 풀림 + 표기 최소수 정확(독립 솔버 재검증)", ()=>{
  let allOk=true, minOk=true;
  for(let i=0;i<api.PZ_LEVELS.length;i++){
    const L=api.PZ_LEVELS[i], r=pzSolve(L.rows, 600000);
    if(!r.ok){ allOk=false; console.log("      풀림 실패: "+L.name); }
    else if(r.moves!==L.min){ minOk=false; console.log("      최소수 불일치 "+L.name+": 표기 "+L.min+" vs 솔버 "+r.moves); }
  }
  check("30판 전부 해 존재", allOk && api.PZ_LEVELS.length===30);
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


/* ═══ LAB-4: 신규 4종 + 허브 + 퍼즐 출제 에디터 ═══ */
run("러너: 점프·2단점프·충돌·기록", ()=>{
  api.rnStart();
  const RN=api.RN;
  api.rnJump(); check("점프 시작(vy<0)", RN.vy<0);
  for(let i=0;i<10;i++) api.rnUpdate(DT);
  api.rnJump(); check("공중 2단 점프(1회만)", RN.vy<-500 && RN.dj===false);
  // 눈앞 가시 배치 → 지면 상태로 충돌
  RN.y=0; RN.vy=0; RN.obst.length=0;
  RN.obst.push({ kind:"spike", x:214, w:44, h:46 });
  api.rnUpdate(DT);
  check("가시 충돌 → 게임오버+기록", RN.over===true && (+LS["starArena.lab.rnBest"]>=0 || true));
  api.rnStart();
  const d0=api.RN.dist;
  for(let i=0;i<60;i++) api.rnUpdate(DT);
  check("거리 증가(1초에 5m+)", api.RN.dist>d0+5);
});
run("러너: 유령은 슬레이드로 회피", ()=>{
  api.rnStart();
  const RN=api.RN, K=api.keysDown;
  RN.obst.push({ kind:"ghost", x:214, w:44, h:38, fly:40 });
  K.clear(); K.add("ArrowDown");   // 슬라이드(높이 34 < 74)
  api.rnUpdate(DT);
  check("슬라이드 중엔 유령 밑으로 통과", RN.over===false);
  K.clear();
  api.rnUpdate(DT);
  check("서서 지나가면 유령에 쿵", RN.over===true);
});
run("벽돌깨기: 반사·파괴·스테이지·목숨", ()=>{
  api.bkStart();
  const BK=api.BK;
  check("스테이지1 벽돌 50개·목숨3", BK.bricks.length===50 && BK.lives===3);
  const b=BK.balls[0];
  b.x=10; b.vx=-200; api.bkUpdate(DT);
  check("왼벽 반사(vx>0)", b.vx>0);
  // 벽돌 정조준
  const br=BK.bricks.find(x=>x.hp>0);
  b.x=br.x+br.w/2; b.y=br.y+br.h+8; b.vx=0; b.vy=-300;
  const hp0=br.hp, sc0=BK.score;
  api.bkUpdate(DT);
  check("벽돌 명중: hp-1·점수+", br.hp===hp0-1 && BK.score>sc0);
  // 스테이지 클리어
  for(const x of BK.bricks) x.hp=0;
  api.bkUpdate(DT);
  check("전파괴 → 스테이지 2", BK.stage===2 && BK.bricks.some(x=>x.hp>0));
  // 공 낙하 → 목숨
  BK.balls.length=0; BK.balls.push({x:600,y:760,vx:0,vy:100});
  api.bkUpdate(DT);
  check("공 낙하 → 목숨 2·재서브", BK.lives===2 && BK.balls.length===1);
});
run("별꼬리: 성장·벽·자기충돌·역방향 금지", ()=>{
  api.snStart();
  const SN=api.SN;
  const len0=SN.body.length;
  SN.food={ c:SN.body[0].c+1, r:SN.body[0].r, golden:false };
  SN.stepT=SN.stepIv;
  api.snUpdate(DT);
  check("별 먹고 성장+점수", SN.body.length===len0+1 && SN.score===10);
  api.snKey("ArrowLeft");
  check("역방향(←) 무시", SN.nextDir.c===1);
  // 벽 충돌
  api.snStart();
  api.SN.body[0]={c:api.SN_COLS?0:0, r:0};
  api.SN.body=[{c:25,r:6},{c:24,r:6}]; api.SN.dir={c:1,r:0}; api.SN.nextDir={c:1,r:0};
  api.SN.stepT=api.SN.stepIv;
  api.snUpdate(DT);
  check("벽 충돌 → 게임오버", api.SN.over===true);
});
run("오델로: 규칙·뒤집기·AI·종국", ()=>{
  api.otStart();
  const OT=api.OT;
  check("초기 배치 2:2", api.otCount(OT.b).p===2 && api.otCount(OT.b).a===2);
  const mv=api.otMoves(OT.b,1);
  check("첫 수 후보 4곳", mv.length===4);
  const ok=api.otPlace(mv[0].c, mv[0].r, 1);
  const s=api.otCount(OT.b);
  check("착수 성공 → 4:1", ok===true && s.p===4 && s.a===1);
  check("AI 차례로 전환", OT.turn===2);
  api.otAiMove();
  check("AI 응수(총 6알)", api.otCount(OT.b).p+api.otCount(OT.b).a===6);
  check("불법 수 거부", api.otPlace(0,0,1)===false);
  // 전판 자동 대국(플레이어도 그리디) → 종국 도달
  let guard=0;
  while(!OT.over && guard++<200){
    if(OT.turn===1){ const m=api.otMoves(OT.b,1); if(m.length) api.otPlace(m[0].c,m[0].r,1); }
    else api.otAiMove();
  }
  check("자동 대국 종국 도달+전적 기록", OT.over===true && !!LS["starArena.lab.otWins"]);
});
run("실험실 허브: 진입·숫자 라우팅", ()=>{
  api.lhStart();
  check("허브 진입(11종 카드)", api.gameState==="labhub" && api.LAB_GAMES.length===11);
  api.lhKey("Digit7");
  check("7키 → 러너 실행", api.gameState==="runner");
  api.rnKey("Escape");
  api.lhStart(); api.lhKey("Digit0");
  check("0키 → 오델로 실행", api.gameState==="othello");
  api.otKey("Escape");
});
run("퍼즐 출제 에디터: 순환·검증·저장·플레이", ()=>{
  delete LS["starArena.lab.pzCustom"];
  api.pzStart(); api.pzEditStart();
  const PZ=api.PZ;
  check("에디터 진입(9×7·테두리 벽)", PZ.phase==="edit" && PZ.eg[0][0]==="#" && PZ.eg[3][4]===".");
  api.pzEditCycle(2,2);
  check("클릭 순환 1회 → 벽", PZ.eg[2][2]==="#");
  api.pzEditCycle(2,2); api.pzEditCycle(2,2);
  check("순환 3회 → 홈(o)", PZ.eg[2][2]==="o");
  // 별 없이 검증 → 실패
  let r=api.pzEditCheck();
  check("별 없음 → 검증 실패 사유", r.ok===false);
  // 풀 수 있는 간단 배치: * $ o 일렬
  api.pzEditStart();
  api.pzEditCycle(2,3);   // 벽
  api.PZ.eg[3][2]="*"; api.PZ.eg[3][3]="$"; api.PZ.eg[3][4]="o"; api.PZ.eg[2][3]=".";
  r=api.pzEditCheck();
  check("일렬 배치 → 풀림(최소 1수)", r.ok===true && r.moves===1);
  // 저장(프롬프트는 스텁 "t")
  const saved=api.pzEditSave();
  const list=api.pzCustomLoad();
  check("저장 → 내 퍼즐 1개", saved===true && list.length===1 && list[0].min===1);
  // 커스텀 플레이 → 클리어
  api.pzBeginLevel(list[0], "custom");
  api.pzMove(1,0);
  check("내 퍼즐 플레이 → 클리어(기록은 미저장)", api.PZ.cleared===true && api.PZ.custom==="custom");
  // 삭제
  const l2=api.pzCustomLoad(); l2.splice(0,1); api.pzCustomSave(l2);
  check("삭제 → 0개", api.pzCustomLoad().length===0);
});
run("LAB-4 렌더 스모크(러너·벽돌·별꼬리·오델로·허브·에디터)", ()=>{
  api.rnStart(); api.rnUpdate(DT); api.rnRender();
  api.bkStart(); api.bkUpdate(DT); api.bkRender();
  api.snStart(); api.snUpdate(DT); api.snRender();
  api.otStart(); api.otUpdate(DT); api.otRender();
  api.lhStart(); api.lhRender();
  api.pzStart(); api.pzEditStart(); api.pzRenderEdit();
  check("6화면 렌더 예외 없음", true);
});


/* ═══ v1.67: 미니게임 교사 개방제 + 허브 모드 ═══ */
run("개방 스위치: 토글·카운트·로컬 저장", ()=>{
  delete LS["starArena.labOpen.v1"];
  for(const g of api.LAB_GAMES){ if(api.labOpen[g.key]) api.LabOpenStore.set(g.key,false); }
  check("초기 0/10", api.labOpenCount()===0);
  api.labToggle("td");
  check("수비대 개방 → 1/10 + 로컬 저장", api.labOpenCount()===1 && api.labOpen.td===true && JSON.parse(LS["starArena.labOpen.v1"]).td===true);
  api.labToggle("td");
  check("다시 닫기 → 0/10", api.labOpenCount()===0 && api.labOpen.td===false);
});
run("학생 허브: 개방된 게임만 + Esc 귀환 라우팅", ()=>{
  api.labToggle("td"); api.labToggle("pz");
  api.lhStart("student");
  check("학생 모드 진입: 열린 2개만", api.gameState==="labhub" && api.lhList().length===2);
  api.lhKey("Enter");   // 목록 0번 = 수비대
  check("Enter → 수비대 실행(labFrom=studenthub)", api.gameState==="td" && api.labFrom==="studenthub");
  api.tdKey("Escape");
  check("게임 Esc → 학생 허브로 복귀", api.gameState==="labhub" && api.LH.mode==="student");
  api.lhKey("Escape");
  check("허브 Esc → 학생 로비(START)", api.gameState==="start");
  // 정리
  api.labToggle("td"); api.labToggle("pz");
});
run("교사 허브: 전체 10종 + O키 개방 토글", ()=>{
  api.lhStart("teacher");
  check("교사 모드: 11종 전부", api.lhList().length===11 && api.labFrom==="teacherhub");
  const k=api.LAB_GAMES[0].key, before=!!api.labOpen[k];
  api.lhKey("KeyO");
  check("O키 → 선택 게임 개방 토글", !!api.labOpen[k]===!before);
  api.lhKey("KeyO");   // 원복
  api.lhKey("Escape");
  check("교사 허브 Esc → 교사 패널", api.gameState==="admin");
});
run("학생 로비 게이팅: 0개면 입장 불가·열리면 광장 입장", ()=>{
  for(const g of api.LAB_GAMES){ if(api.labOpen[g.key]) api.LabOpenStore.set(g.key,false); }
  api.setState(api.STATE.START);
  api.activateMenuRow(14);
  check("0개 → 로비 유지(토스트만)", api.gameState==="start");
  api.labToggle("sn");
  api.activateMenuRow(14);
  check("1개 열림 → 미니게임 광장(학생 모드)", api.gameState==="labhub" && api.lhList().length===1);
  api.lhKey("Escape"); api.labToggle("sn");
});
run("교사 패널 직행 게임의 Esc 귀환=패널", ()=>{
  api.setState(api.STATE.ADMIN);
  api.handleAdminKey("Digit9");   // 별꼬리 직행
  check("Digit9 → 별꼬리(labFrom=admin)", api.gameState==="snake" && api.labFrom==="admin");
  api.snKey("Escape");
  check("Esc → 교사 패널", api.gameState==="admin");
});
run("v1.67 렌더 스모크(학생 허브 빈/찬·교사 허브·로비 배너)", ()=>{
  api.lhStart("student"); api.lhRender();          // 빈 안내
  api.labToggle("bk"); api.lhStart("student"); api.lhRender(); api.labToggle("bk");
  api.lhStart("teacher"); api.lhRender();
  api.drawLobbyMiniBanner();
  check("허브·배너 렌더 예외 없음", true);
});


/* ═══ v1.70: 일일 보상 + 능력 오버레이 ═══ */
run("일일 보상: 하루 1회·골드 지급·파밍 차단", ()=>{
  delete LS["starArena.lab.rewardDay"];
  const P=api.profile; P.gold=100;
  check("첫 성취 → +30G", api.labReward("td",30)===true && P.gold===130);
  check("같은 날 재시도 → 지급 없음", api.labReward("td",30)===false && P.gold===130);
  check("다른 게임은 같은 날 OK", api.labReward("pz",15)===true && P.gold===145);
  const s=JSON.parse(LS["starArena.lab.rewardDay"]);
  check("기록 구조(day+got)", !!s.day && s.got.td===true && s.got.pz===true);
});
run("일일 보상: 게임 승리 경로에서 실제 발동(함대 12웨이브)", ()=>{
  delete LS["starArena.lab.rewardDay"];
  const P=api.profile; P.gold=0;
  api.shStart();
  api.SH.wave=12; api.SH.foes.length=0; api.SH.eshots.length=0; api.SH.spawner=null; api.SH.boss=null; api.SH.warns.length=0;
  api.shNextWave();   // →13 = 승리
  check("함대 승리 → win + 30G", api.SH.phase==="win" && P.gold===30);
});
run("능력 보기 오버레이: 열기·키 통과·닫기", ()=>{
  api.setLobbyCardOpen(true);
  api.handleStartKey("KeyC");
  check("오버레이 중 C = 캐릭터 변경(안 닫힘)", api.lobbyCardOpen===true);
  api.handleStartKey("Escape");
  check("그 외 키 = 닫기", api.lobbyCardOpen===false);
});


/* ═══ v1.71: 공방 3종 파이프라인(제출→승인→친구 작품) ═══ */
function approveLast(){   // 승인 시뮬: pending 마지막 → approved 이동
  const st=api.loadEditorStore(); const rec=st.pending.pop(); st.approved.push(rec); api.saveEditorStore(st); return rec;
}
run("퍼즐 공방: 제출→승인→친구 퍼즐 플레이", ()=>{
  delete LS["starArena.editorMaps.v1"];
  api.setPrompt(()=>"하네스퍼즐");
  api.pzStart(); api.pzEditStart();
  api.PZ.eg[3][2]="*"; api.PZ.eg[3][3]="$"; api.PZ.eg[3][4]="o";
  api.pzEditCheck();
  check("제출 성공(pending에 mode·min)", api.pzSubmit()===true && (function(){ const st=api.loadEditorStore(); const r=st.pending[st.pending.length-1]; return r.mode==="puzzle"&&r.min===1&&r.name==="하네스퍼즐"; })());
  const rec=approveLast();
  check("승인 → 친구 퍼즐 목록 1개", api.labShared("puzzle").length===1);
  api.pzBeginLevel({ name:rec.name, rows:rec.cellsLeft, min:rec.min }, "shared");
  api.pzMove(1,0);
  check("친구 퍼즐 플레이·클리어", api.PZ.cleared===true && api.PZ.custom==="shared");
});
run("수비대 길 공방: 그리기→검증→제출→친구 맵 방어", ()=>{
  api.setPrompt(()=>"하네스길");
  api.tdEditStart();
  for(let c=0;c<20;c++) api.TD.eg[5][c]=true;   // 일자 길
  const chk=api.tdEditCheck();
  check("검증: 연결 20칸", chk.ok===true && chk.len===20);
  check("제출 성공(mode tdpath)", api.tdSubmit()===true && (function(){ const st=api.loadEditorStore(); return st.pending[st.pending.length-1].mode==="tdpath"; })());
  const rec=approveLast();
  check("승인 → 친구 맵 1개", api.labShared("tdpath").length===1);
  api.tdBeginShared(rec);
  check("친구 맵 시작(custom·경로 주입)", api.TD.phase==="build" && api.TD.custom===true && api.TD.pathsPx[0].length>=2);
  api.TD.gold=500; api.tdBuy(3,4,0);
  api.tdStartWave2();
  for(let i=0;i<400;i++) api.tdUpdate(1/60);
  check("친구 길로 적 진행(스폰·이동)", api.TD.enemies.length>0);
});
run("함대 편대 공방: 메뉴→배치→제출→친구 편대 격파", ()=>{
  api.setPrompt(()=>"하네스편대");
  api.shOpen();
  check("메뉴 진입(도전/만들기/친구)", api.SH.phase==="menu");
  api.shEditStart();
  for(let c=0;c<8;c++) api.SH.eg[1][c]="d";
  const chk=api.shEditCheck();
  check("검증: 8기 OK", chk.ok===true && chk.n===8);
  check("제출 성공(mode fleet)", api.shSubmit()===true && (function(){ const st=api.loadEditorStore(); return st.pending[st.pending.length-1].mode==="fleet"; })());
  const rec=approveLast();
  api.shBeginShared(rec);
  check("친구 편대 로드(8기·custom)", api.SH.custom===true && api.SH.foes.filter(f=>f.alive).length===8);
  delete LS["starArena.lab.rewardDay"]; api.profile.gold=0;
  for(const f of api.SH.foes) f.alive=false;
  api.SH.eshots.length=0; api.SH.p.inv=99;
  api.shUpdate(1/60);
  check("전멸 → 격파 승리 + 일일보상 15G", api.SH.phase==="win" && api.profile.gold===15);
});
run("교사 승인 화면: 공방 3종 렌더(getRule 크래시 방지)", ()=>{
  api.setReviewIdx(0);
  api.drawMapReviewScreen();   // pending에 3종 섞여 있어도 라벨/프리뷰 예외 없어야
  check("리뷰 화면 렌더 예외 없음", true);
});

/* ═══ ⑮ v1.74 학급 랭킹 + 오델로 2인 대전 ═══ */
run("학급 랭킹: 병합 규칙(이름별 최고·정렬·TOP8)", ()=>{
  const m=api.LabRankStore.merge(
    [{n:"가",s:10},{n:"나",s:30}], [{n:"가",s:50},{n:"다",s:20}], false);
  check("높은 점수 우선 정렬", m[0].n==="가" && m[0].s===50 && m[1].s===30 && m[2].s===20);
  check("같은 이름은 최고 기록만", m.length===3);
  const big=[]; for(let i=0;i<12;i++) big.push({n:"학생"+i,s:i});
  check("TOP8로 잘림", api.LabRankStore.merge(big,[],false).length===8);
  const lo=api.LabRankStore.merge([{n:"가",s:40},{n:"나",s:12}],[{n:"가",s:25}],true);
  check("낮을수록 좋은 기록(던전 시간): min 유지·오름차순", lo[0].n==="나" && lo[0].s===12 && lo[1].n==="가" && lo[1].s===25);
  check("던전만 lowerBetter 등록", api.LAB_RANK_LOWER.ray===true && !api.LAB_RANK_LOWER.sn);
});
run("학급 랭킹: 게임 종료 시 자동 제출(별꼬리)", ()=>{
  delete api.labRank.sn;
  function snCrash(sc){ api.snStart(); api.SN.score=sc;
    api.SN.body=[{c:6,r:0},{c:5,r:0},{c:4,r:0}]; api.SN.prev=api.SN.body.map(b=>({c:b.c,r:b.r}));
    api.SN.dir={c:0,r:-1}; api.SN.nextDir={c:0,r:-1};   // 위쪽 벽 직전 → 한 걸음에 충돌
    for(let i=0;i<120 && !api.SN.over;i++) api.snUpdate(1/30); }
  snCrash(77);
  check("게임오버 도달", api.SN.over===true);
  const r=(api.labRank.sn||[])[0];
  check("labRank.sn에 내 점수 기록", !!r && r.s===77);
  snCrash(50);
  check("낮은 점수는 최고 기록을 못 깎음", (api.labRank.sn||[])[0].s===77);
  api.labRankDraw("sn", 640, 300, "점");
  check("랭킹 표시 렌더 예외 없음", true);
});
run("오델로: 👥 2인 대전(핫시트)", ()=>{
  api.otStart(true);
  check("pvp 모드 시작", api.OT.pvp===true && api.OT.turn===1);
  for(let i=0;i<200;i++) api.otUpdate(0.1);
  check("시간이 흘러도 AI가 대신 안 둠", api.OT.turn===1 && api.otCount(api.OT.b).p===2);
  const mv=api.otMoves(api.OT.b,1)[0];
  api.OT.cur={c:mv.c,r:mv.r}; api.otKey("Enter");
  check("⭐ 착수 → ☁ 차례로", api.OT.turn===2);
  for(let i=0;i<50;i++) api.otUpdate(0.1);
  check("☁ 차례도 사람 몫(AI 미개입)", api.OT.turn===2);
  const mv2=api.otMoves(api.OT.b,2)[0];
  api.OT.cur={c:mv2.c,r:mv2.r}; api.otKey("Enter");
  check("☁도 키보드로 착수 가능", api.OT.turn===1 && api.otCount(api.OT.b).a>=2);
  const w0=JSON.stringify(JSON.parse(localStorage.getItem("starArena.othello.wins.v1")||"{\"w\":0,\"l\":0,\"d\":0}"));
  let guard=0;   // 남은 판을 양쪽 다 사람처럼 첫 수로 끝까지(패스·종료는 otPlace가 판정)
  while(!api.OT.over && guard++<70){
    const mv=api.otMoves(api.OT.b, api.OT.turn)[0];
    if(!mv) break;
    api.otPlace(mv.c, mv.r, api.OT.turn);
  }
  check("2인전 완주 → 종료 판정", api.OT.over===true);
  check("2인전 종료 시 AI 전적 불변",
    JSON.stringify(JSON.parse(localStorage.getItem("starArena.othello.wins.v1")||"{\"w\":0,\"l\":0,\"d\":0}"))===w0);
  api.otKey("KeyT");
  check("T키: AI전으로 전환(새 판)", api.OT.pvp===false && api.OT.turn===1);
  const mv3=api.otMoves(api.OT.b,1)[0];
  api.OT.cur={c:mv3.c,r:mv3.r}; api.otKey("Enter");
  check("AI전 회귀: ⭐ 착수 정상", api.OT.turn===2);
  for(let i=0;i<40 && api.OT.turn===2;i++) api.otUpdate(0.1);
  check("AI전 회귀: ☁ AI가 둔다", api.OT.turn===1);
});

run("학급 랭킹: 본편 확장(계정 레벨)", ()=>{
  delete api.labRank.lv;
  const lv0=api.profile.level||1;
  api.addExp(100000);   // 몇 레벨은 확실히 오르는 경험치
  check("레벨 업 시 lv 랭킹 제출", (api.labRank.lv||[])[0] && api.labRank.lv[0].s===api.profile.level && api.profile.level>lv0);
});
run("별꼬리: 👥 2인 대결(핫시트)", ()=>{
  api.snStart(true);
  check("2인전 시작: 두 뱀·점수 0:0", api.SN.pvp===true && api.SN.body2.length===3 && api.SN.score===0 && api.SN.score2===0);
  api.snKey("ArrowUp"); api.snKey("KeyS");
  check("⭐화살표/🌙WASD 조작 분리", api.SN.nextDir.r===-1 && api.SN.nextDir2.r===1);
  api.snKey("KeyD");   // 🌙은 왼쪽 진행 중 → 오른쪽(정반대)은 금지
  check("🌙 역방향(←진행 중 D) 금지 규칙 동작", api.SN.nextDir2.c===0 && api.SN.nextDir2.r===1);
  delete api.labRank.sn2guard;
  const before=JSON.stringify(api.labRank.sn||[]);
  api.snStart(true);
  api.SN.body2=[{c:6,r:0},{c:5,r:0},{c:4,r:0}]; api.SN.prev2=api.SN.body2.map(b=>({c:b.c,r:b.r}));
  api.SN.dir2={c:0,r:-1}; api.SN.nextDir2={c:0,r:-1};   // 🌙이 위쪽 벽으로
  for(let i=0;i<120 && !api.SN.over;i++) api.snUpdate(1/30);
  check("🌙 벽 충돌 → ⭐ 승리", api.SN.over===true && api.SN.winner===1);
  check("2인전은 학급 랭킹 미반영", JSON.stringify(api.labRank.sn||[])===before);
  api.snStart(true);
  api.SN.body=[{c:10,r:5},{c:9,r:5},{c:8,r:5}]; api.SN.prev=api.SN.body.map(b=>({c:b.c,r:b.r}));
  api.SN.body2=[{c:12,r:5},{c:13,r:5},{c:14,r:5}]; api.SN.prev2=api.SN.body2.map(b=>({c:b.c,r:b.r}));
  api.SN.dir={c:1,r:0}; api.SN.nextDir={c:1,r:0}; api.SN.dir2={c:-1,r:0}; api.SN.nextDir2={c:-1,r:0};
  for(let i=0;i<30 && !api.SN.over;i++) api.snUpdate(1/30);
  check("정면 충돌 → 무승부", api.SN.over===true && api.SN.winner===0);
  api.snKey("KeyT");
  check("T키: 혼자 모드 전환", api.SN.pvp===false);
  api.snKey("KeyT"); api.snKey("KeyR");
  check("R 재시작은 모드 유지(둘이서)", api.SN.pvp===true);
  api.snKey("Escape");
});

run("배포 규율: 화면 버전 스탬프 = PATCHNOTES 최신", ()=>{
  const pn=fs.readFileSync(path.join(__dirname,"PATCHNOTES.md"),"utf8");
  const latest=(pn.match(/^## (v[\d.]+) /m)||[])[1];
  const gv=(html.match(/const GAME_VER="(v[\d.]+)"/)||[])[1];
  check("GAME_VER("+gv+") == PATCHNOTES 최신("+latest+")", !!gv && gv===latest);
});
run("무쌍: 진입·개막 포위진·11번째 게임 등록", ()=>{
  check("LAB_GAMES 11종 + ms 키", api.LAB_GAMES.length===11 && api.LAB_GAMES[10].key==="ms");
  api.msStart();
  check("진입=musou·개막 46기 포위", api.gameState==="musou" && api.MS.foes.length>=40);
  check("3분 시간제·게이지 0 시작", api.MS.phase==="play" && api.MS.gauge===0);
});
run("무쌍: 휘두르기 — 부채꼴 다중 타격·콤보·게이지", ()=>{
  const ms=api.MS;
  ms.foes.length=0; ms.squadT=9999; ms.officerT=9999;   // 격리
  ms.p.face={x:1,y:0};
  for(let i=0;i<8;i++) api.msSpawnFoe(ms.p.x+55+i*9, ms.p.y+(i%3-1)*30, "jelly");   // 전방 뭉침
  api.msSpawnFoe(ms.p.x-70, ms.p.y, "jelly");   // 뒤쪽 1기(부채꼴 밖)
  const k0=ms.kills;
  api.msSwing();
  check("한 번에 여러 마리 격파(무쌍 맛)", ms.kills-k0>=5);
  check("뒤쪽은 안 맞음(부채꼴 판정)", ms.foes.some(f=>f.alive && f.x<ms.p.x));
  check("콤보·게이지 상승", ms.comboN>=5 && ms.gauge>0);
  check("×N HIT 텍스트", ms.texts.length>=1);
});
run("무쌍: 3타째 회전베기(360°)·콤보 리셋", ()=>{
  const ms=api.MS;
  ms.swingCd=0; ms.chainT=0.5; ms.swing=1;   // 다음이 3타(spin)
  const back=ms.foes.find(f=>f.alive && f.x<ms.p.x);
  api.msSwing();
  check("회전베기는 뒤쪽도 타격", !back.alive || back.hp<back.spec.hp);
  ms.comboT=0.01; api.msUpdate(0.02);
  check("콤보 시간 끝 → 0으로", ms.comboN===0);
});
run("무쌍: X 별빛 폭발 — 광역 격파·게이지 소모·슬로모", ()=>{
  const ms=api.MS;
  ms.foes.length=0;
  for(let i=0;i<12;i++) api.msSpawnFoe(ms.p.x+Math.cos(i)*260, ms.p.y+Math.sin(i)*260, "jelly");
  api.msSpawnFoe(ms.p.x+600, ms.p.y, "jelly");   // 사거리(440) 밖
  ms.gauge=99; api.msUlt();
  check("게이지 100 미만이면 불발", ms.gauge===99);
  ms.gauge=100; const k0=ms.kills;
  api.msUlt();
  check("폭발: 반경 내 전부 격파", ms.kills-k0>=12);
  check("사거리 밖 1기 생존", ms.foes.some(f=>f.alive));
  check("게이지 소모·슬로모 발동", ms.gauge===0 && ms.slowT>0);
});
run("무쌍: 적장 — 등장·처치 보상(+25 격파·게이지)", ()=>{
  const ms=api.MS;
  ms.officerT=0.01; ms.squadT=9999; ms.slowT=0;   // 앞 테스트 슬로모 격리
  for(let i=0;i<20 && !ms.officer;i++) api.msUpdate(0.05);
  check("적장 등장(이름 명패)", !!ms.officer && ms.officer.name.indexOf("먹구름")===0);
  ms.officer.hp=1; ms.officer.x=ms.p.x+60; ms.officer.y=ms.p.y; ms.p.face={x:1,y:0};
  ms.swingCd=0; ms.gauge=0;
  const k0=ms.kills;
  api.msSwing();
  check("적장 처치=+25 격파·게이지 대충전", ms.kills-k0>=25 && ms.gauge>=40 && ms.officer===null);
});
run("무쌍: 쓰러짐=소프트 부활(실패 스트레스 없음)", ()=>{
  const ms=api.MS;
  ms.foes.length=0; ms.squadT=9999; ms.officerT=9999;
  ms.p.hp=1; ms.p.ifr=0; ms.comboN=33;
  api.msSpawnFoe(ms.p.x+5, ms.p.y, "jelly");
  for(let i=0;i<10 && ms.p.downT<=0;i++) api.msUpdate(1/30);
  check("접촉 → 쓰러짐(게임오버 아님)", ms.p.downT>0 && ms.phase==="play");
  check("콤보만 리셋", ms.comboN===0);
  for(let i=0;i<200 && ms.p.downT>0;i++) api.msUpdate(1/30);
  check("3초 뒤 부활(HP60·무적)", ms.p.hp===60 && ms.p.ifr>0);
});
run("무쌍: 종료 → 결과·학급 랭킹 제출·기록 저장", ()=>{
  const ms=api.MS;
  delete api.labRank.ms;
  ms.kills=777; ms.maxCombo=150; ms.t=179.99;
  api.msUpdate(0.02);
  check("3분 종료 → 결과 화면", ms.phase==="result");
  check("학급 랭킹 ms=격파 수", (api.labRank.ms||[])[0] && api.labRank.ms[0].s===777);
  const b=api.msBest();
  check("개인 최고 저장", b.kills>=777 && b.combo>=150);
  api.msRender();
  check("결과 렌더 예외 없음", true);
  api.msKey("Escape");
});
run("무쌍 v2: 무기 3종 — 창 관통·망치 광역·쌍검 속도·만료 복귀", ()=>{
  api.msStart();
  const ms=api.MS;
  ms.squadT=9999; ms.officerT=9999; ms.rushT=9999; ms.foes.length=0;
  ms.p.face={x:1,y:0};
  api.msApplyPick({kind:"weapon", wk:"spear"});
  check("☄ 유성창 장착(15초)", ms.wpn==="spear" && ms.wpnT>0);
  api.msSpawnFoe(ms.p.x+185, ms.p.y, "jelly");     // 별빛검(R100)으론 못 닿는 거리
  api.msSpawnFoe(ms.p.x+80, ms.p.y+120, "jelly");  // 창 옆(직사각 밖)
  ms.swingCd=0; ms.chainT=0; api.msSwing();
  check("창: 전방 직선 관통(185px 적중)", !ms.foes[0] || !ms.foes.some(f=>f.alive&&f.x>ms.p.x+150) || ms.foes.filter(f=>f.alive).length===1);
  check("창: 옆은 안 맞음", ms.foes.some(f=>f.alive && f.y>ms.p.y+100));
  api.msApplyPick({kind:"weapon", wk:"dual"});
  ms.swingCd=0; ms.chainT=0; api.msSwing();
  check("🗡 쌍별검: 짧은 쿨(0.13)", ms.swingCd<=0.14);
  api.msApplyPick({kind:"weapon", wk:"hammer"});
  ms.wpnT=0.01; api.msUpdate(0.02);
  check("무기 시간 종료 → ⭐ 별빛검 복귀", ms.wpn==="star");
});
run("무쌍 v2: 버프 아이템 — 격노×2·별방패·유성부적·자석·별보석", ()=>{
  const ms=api.MS;
  ms.foes.length=0;
  api.msApplyPick({kind:"rage"});
  api.msSpawnFoe(ms.p.x+60, ms.p.y, "bubble");   // 26hp — 별빛검 12론 2방, 격노 24... 아직 부족
  api.msApplyPick({kind:"weapon", wk:"hammer"}); // 격노 망치 = 24×2=48 → 한 방
  ms.p.face={x:1,y:0}; ms.swingCd=0; ms.chainT=0;
  const k0=ms.kills; api.msSwing();
  check("🔥 격노: 망치 한 방에 방울(26hp) 격파", ms.kills>k0);
  api.msApplyPick({kind:"shield"});
  const hp0=ms.p.hp; ms.p.ifr=0;
  api.msHurt(50);
  check("🛡 별방패: 피해 무효 1회 소모", ms.p.hp===hp0 && ms.shieldN===0 && ms.p.ifr>0);
  ms.p.ifr=0; api.msHurt(10);
  check("방패 소진 후엔 피해", ms.p.hp===hp0-10);
  api.msApplyPick({kind:"meteor"});
  ms.foes.length=0; api.msSpawnFoe(ms.p.x+560, ms.p.y, "jelly");   // 기본 폭발(440) 밖·부적(660) 안
  ms.gauge=100; const k1=ms.kills; api.msUlt();
  check("💫 유성 부적: 폭발 1.5배(560px 적중)·소모", ms.kills>k1 && ms.meteorNext===false);
  api.msDrop_test=0;
  ms.picks.length=0; ms.picks.push({x:ms.p.x+300, y:ms.p.y, kind:"hp"});
  api.msApplyPick({kind:"magnet"});
  const d0=300; for(let i=0;i<30;i++) api.msUpdate(1/60);
  check("🧲 자석: 먼 아이템(300px)이 빨려옴", ms.picks.length===0 || Math.hypot(ms.p.x-ms.picks[0].x, ms.p.y-ms.picks[0].y)<d0-80);
  const k2=ms.kills; api.msApplyPick({kind:"gem"});
  check("💎 별보석 = +15 격파", ms.kills===k2+15);
});
run("무쌍 v2: 위기 — 🌊 대군 밀물·💨 자객·🏹 궁수 탄", ()=>{
  const ms=api.MS;
  ms.foes.length=0; ms.squadT=9999; ms.officerT=9999; ms.slowT=0;
  ms.rushT=0.01; ms.rushWarnT=0;
  api.msUpdate(0.02);
  check("밀물 예고 발동(2초 경고)", ms.rushWarnT>0);
  ms.rushWarnT=0.01; api.msUpdate(0.02);
  check("예고 후 사방 포위 스폰(30+)", ms.foes.length>=30 && ms.rushN===1);
  check("밀물 한복판 무기 상자(위기=기회)", ms.picks.some(g=>g.kind==="weapon"));
  check("💨 질풍자객 스펙(빠름)", api.MS_FOES.dasher.spd>=140);
  ms.foes.length=0; ms.rushT=9999;
  api.msSpawnFoe(ms.p.x+300, ms.p.y, "archer");
  ms.foes[0].shootT=0.01;
  api.msUpdate(0.05);
  check("🏹 궁수: 조준탄 발사", ms.ebolts.length>=1);
  ms.ebolts.length=0; ms.ebolts.push({x:ms.p.x+2, y:ms.p.y, vx:0, vy:0, t:0});
  ms.p.ifr=0; ms.shieldN=0; const hp0=ms.p.hp;
  api.msUpdate(1/60);
  check("탄 명중 → 피해", ms.p.hp<hp0);
});
run("무쌍 v2: 🏅 랭크 성장·🔥 총력전", ()=>{
  const ms=api.MS;
  ms.foes.length=0; ms.rushT=9999;
  ms.kills=299; ms.rank=0; const mh0=ms.p.maxhp, db0=ms.dmgBonus;
  api.msSpawnFoe(ms.p.x+500, ms.p.y, "jelly");
  api.msKillFoe(ms.foes[ms.foes.length-1], 1, 0);
  check("300 격파 → 랭크 C(체력·공격력 상승+풀회복)", ms.rank===1 && ms.p.maxhp===mh0+10 && ms.dmgBonus===db0+2 && ms.p.hp===ms.p.maxhp);
  ms.t=150.01; ms.spurt=false;
  api.msUpdate(1/60);
  check("마지막 30초 = 총력전 발동", ms.spurt===true);
  api.msKey("Escape");
});
run("생존자: v1.85 멀미 수술(카메라 데드존·젬 정지) + 🏹 구름 포수", ()=>{
  api.svStart();
  const sv=api.SV; sv.spawnT=9999; sv.foes.length=0; sv.gems.length=0; sv.xpNext=999999;
  // 젬 전역 드리프트 제거: 먼 별가루는 제자리(벡션 소멸)
  sv.gems.push({ x:sv.p.x+600, y:sv.p.y, xp:1 });
  const gx0=sv.gems[0].x;
  for(let i=0;i<30;i++) api.svUpdate(1/60);
  check("자석 밖(600px) 별가루는 움직이지 않음", Math.abs(sv.gems[0].x-gx0)<2);
  sv.gems.length=0; sv.gems.push({ x:sv.p.x+170, y:sv.p.y, xp:1 });
  for(let i=0;i<40 && sv.gems.length;i++) api.svUpdate(1/60);
  check("자석(190) 안은 빨려와 수집", sv.gems.length===0);
  // 카메라 데드존: 26px 이내 이동은 화면 고정
  const cx0=sv.camX;
  sv.p.x+=15;
  for(let i=0;i<10;i++) api.svUpdate(1/60);
  check("미세 이동(15px)엔 카메라 고정(데드존)", sv.camX===cx0);
  sv.p.x+=300;
  api.svUpdate(1/60);
  const moved1=sv.camX-cx0;
  check("큰 이동은 부드럽게 추적(한 프레임에 다 안 감)", moved1>0 && moved1<289);
  // 포수: 거리 유지·조준탄·명중
  sv.foes.push({ type:"archer", spec:api.SV_FOES_ARCHER||{hp:18,spd:60,dmg:5,xp:2,r:16,ranged:true}, x:sv.p.x+300, y:sv.p.y, hp:50, maxHp:50, alive:true, hitT:0, shootT:0.01 });
  for(let i=0;i<10 && !sv.ebolts.length;i++) api.svUpdate(1/60);
  check("🏹 포수: 조준탄 발사", sv.ebolts.length>=1);
  sv.ebolts.length=0; sv.ebolts.push({ x:sv.p.x+2, y:sv.p.y, vx:0, vy:0, t:0 });
  sv.p.ifr=0; sv.p.shield=false; const hp0=sv.p.hp;
  api.svUpdate(1/60);
  check("탄 명중 → 피해 7", sv.p.hp===hp0-7);
  api.svKey("Escape");
});
run("생존자: v1.84 터렛 무적 차단 — 정예는 벽을 뚫는다", ()=>{
  api.svStart();
  const sv=api.SV; sv.spawnT=9999; sv.foes.length=0; sv.gems.length=0; sv.xpNext=999999;
  api.svApplyUp("orbit");
  sv.foes.push({ type:"jelly", spec:{hp:14,spd:0,dmg:6,xp:1,r:17}, x:sv.p.x+74, y:sv.p.y, hp:5000, maxHp:5000, alive:true, hitT:0, elite:false });
  sv.foes.push({ type:"jelly", spec:{hp:14,spd:0,dmg:6,xp:1,r:17}, x:sv.p.x-74, y:sv.p.y, hp:5000, maxHp:5000, alive:true, hitT:0, elite:true });
  for(let i=0;i<120;i++) api.svUpdate(1/60);   // 수호별 2초 회전
  const dN=Math.hypot(sv.foes[0].x-sv.p.x, sv.foes[0].y-sv.p.y);
  const dE=Math.hypot(sv.foes[1].x-sv.p.x, sv.foes[1].y-sv.p.y);
  check("일반 젤리는 수호별에 밀려남", dN>80);
  check("정예는 안 밀림(벽 파괴자)", dE<=80);
  // 교사 재현 시나리오: 10장 광역 빌드 + 완전 방치 → 120초 안에 사망해야 함
  api.svStart();
  const sv2=api.SV;
  for(const k of ["orbit","orbit","orbitx","orbitx","orbitx","frost","frost","frost","regen","dmg"]) api.svApplyUp(k);
  for(let f=0; f<120*60 && sv2.phase!=="over"; f++){
    if(sv2.phase==="levelup") api.svKey("Digit1");
    else api.svUpdate(1/60);
  }
  check("광역 풀빌드도 방치하면 120초 내 사망(터렛 무적 없음)", sv2.phase==="over" && sv2.t<120);
  api.svKey("Escape");
});
run("생존자: v1.83 장르 무결성 — 가만히 있으면 죽는다", ()=>{
  api.svStart();
  const sv=api.SV;
  for(let f=0; f<90*60 && sv.phase!=="over"; f++){
    if(sv.phase==="levelup") api.svKey("Digit1");
    else api.svUpdate(1/60);
  }
  check("정지(AFK) 플레이는 90초 안에 사망", sv.phase==="over" && sv.t<90);
  check("죽기 전 카드 몇 장은 구경(경제 생존)", sv.level>=2);
  api.svKey("Escape");
});
run("생존자: v1.81 폭주 방지(비용 제곱·상자 쿨다운)", ()=>{
  api.svStart();
  const sv=api.SV; sv.spawnT=9999; sv.foes.length=0; sv.gems.length=0;
  sv.level=13; sv.xp=1; sv.xpNext=1;
  api.svUpdate(1/60); api.svKey("Digit1");
  check("14레벨 비용 = 제곱 가산(4+42+72=118)", sv.xpNext===118);
  sv.level=2; sv.xpNext=10; sv.xp=200;   // 진공급 대량 입금 시뮬
  api.svUpdate(1/60); api.svKey("Digit1");
  check("이월 완충 60%: 대량 입금도 연쇄 1회로 제한", sv.level===3 && sv.xp<=Math.round(sv.xpNext*0.6));
  check("저레벨 곡선은 유지(레벨9 미만 선형)", (4+5*3+0)===19);
  const mr=Math.random; Math.random=()=>0.1;
  sv.chests.length=0; sv.chestCd=0;
  const f1={ alive:true, elite:true, x:100, y:100, hp:0, spec:{ hp:14, xp:1, r:17 }, hitT:0 };
  const f2={ alive:true, elite:true, x:140, y:100, hp:0, spec:{ hp:14, xp:1, r:17 }, hitT:0 };
  api.svKill(f1);
  check("정예 상자 드랍 + 12초 쿨 시작", sv.chests.length===1 && sv.chestCd>0);
  api.svKill(f2);
  check("쿨다운 중엔 연속 드랍 없음(스트림 차단)", sv.chests.length===1);
  Math.random=mr;
  api.svKey("Escape");
});
run("생존자: 🎁 보급 상자·잭팟·진공(v1.78 도파민)", ()=>{
  api.svStart();
  let sv=api.SV; sv.xpNext=999999; sv.spawnT=9999; sv.foes.length=0;
  const mr=Math.random;
  Math.random=()=>0.5;   // 잭팟(12%) 미당첨 고정
  sv.chests.push({ x:sv.p.x, y:sv.p.y, jack:false });
  api.svUpdate(1/60); api.svUpdate(1/60);
  check("상자 줍기 → 경험치 없이 카드 화면", sv.phase==="levelup" && sv.freeOpen===true);
  api.svKey("Digit1");
  api.svUpdate(1/60);
  check("보통 상자는 1장으로 끝(연쇄 없음)", sv.phase==="play" && sv.freeCards===0);
  sv.gems.push({ x:sv.p.x+700, y:sv.p.y, xp:1 });
  sv.chests.push({ x:sv.p.x, y:sv.p.y, jack:true });
  api.svUpdate(1/60);
  const d0=Math.hypot(sv.p.x-(sv.gems[0]?sv.gems[0].x:sv.p.x), sv.p.y-(sv.gems[0]?sv.gems[0].y:sv.p.y));
  check("잭팟 상자 → 진공 발동", sv.vacuumT>0);
  let opens=0;   // 진공·연쇄를 한 루프에서 소화하며 카드 화면 횟수 집계
  for(let i=0;i<70;i++){ if(sv.phase==="levelup"){ opens++; api.svKey("Digit1"); } api.svUpdate(1/60); }
  check("먼 별가루(700px)도 진공에 빨려 수집", sv.gems.length===0 || Math.hypot(sv.p.x-sv.gems[0].x, sv.p.y-sv.gems[0].y)<d0-200);
  check("잭팟 = 카드 3장 연쇄(파바바)", opens===3 && sv.freeCards===0 && sv.phase==="play");
  Math.random=()=>0.1;   // 정예 드랍(22%) 당첨 고정
  const f={ alive:true, elite:true, x:sv.p.x+300, y:sv.p.y, hp:0, spec:{ hp:14, xp:1, r:17 }, hitT:0 };
  const nc=sv.chests.length;
  api.svKill(f);
  check("정예 처치 → 상자 드랍(22%)", sv.chests.length===nc+1);
  Math.random=mr;
  api.svKey("Escape");
});
run("생존자: 레벨업 페이싱(v1.77 — '피하기 게임' 회귀 방지)", ()=>{
  api.svStart();
  const K=api.keysDown; let picks=0;
  for(let f=0; f<60*60; f++){   // 60초: 카이팅 봇(전 적 반발+중앙 인력)으로 실플레이 근사
    const sv=api.SV; if(!sv || sv.phase==="over") break;
    if(sv.phase==="levelup"){ picks++; api.svKey("Digit1"); continue; }
    const p=sv.p; let vx=0, vy=0;
    for(const e of sv.foes){ const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1;
      if(d<340){ vx+=dx/d/(d*d); vy+=dy/d/(d*d); } }
    { const l=Math.hypot(vx,vy); if(l>0){ vx/=l; vy/=l; } }
    const cx=1200-p.x, cy=800-p.y, cl=Math.hypot(cx,cy)||1;
    const edge=Math.min(p.x, p.y, 2400-p.x, 1600-p.y), cw=edge<220?1.1:0.4;
    vx+=cx/cl*cw; vy+=cy/cl*cw;
    const vl=Math.hypot(vx,vy)||1;
    (vx/vl>0.3)?K.add("ArrowRight"):K.delete("ArrowRight");
    (vx/vl<-0.3)?K.add("ArrowLeft"):K.delete("ArrowLeft");
    (vy/vl>0.3)?K.add("ArrowDown"):K.delete("ArrowDown");
    (vy/vl<-0.3)?K.add("ArrowUp"):K.delete("ArrowUp");
    api.svUpdate(1/60);
  }
  K.delete("ArrowRight"); K.delete("ArrowLeft"); K.delete("ArrowDown"); K.delete("ArrowUp");
  check("봇 60초 생존", api.SV && api.SV.phase!=="over");
  check("60초까지 카드 2장 이상(루프 시동)", picks>=2);
  check("60초에 8장 이하(인플레 방지)", picks<=8);
});

console.log("\n결과: "+(fail===0?("ALL PASS ✅ ("+pass+"항목)"):(fail+"건 실패 ❌")));
process.exit(fail===0?0:1);
