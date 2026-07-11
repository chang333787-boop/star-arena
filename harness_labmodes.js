// 별빛 아레나 — LAB-1 하니스: 관리자 실험 게임틀 3종(수비대·함대·던전3D) 로직 검증
// 수비대: 건설 규칙·경제·웨이브 클리어/패배 · 함대: 봇 클리어·피격 · 던전3D: BFS 도달성·충돌·골인
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
  tdStart, tdBuy, tdBuildable, tdStartWave, tdUpdate, tdRender, tdUpgrade, tdSell, tdMouse, tdKey,
  shStart, shUpdate, shRender, shKey,
  rayStart, rayUpdate, rayRender, rayKey, rayOpen, RAY_MAP,
  get TD(){return TD;}, get SH(){return SH;}, get RAY(){return RAY;}, get gameState(){return gameState;},
  setState:(s)=>{ gameState=s; } };`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
// 결정론화: 게임이 쓰는 Math.random(함대 발사 대상·다이버 위치)을 시드 PRNG로 교체 — 매 실행 동일 결과
{ let seed=987654321; Math.random=function(){ seed=(seed*1103515245+12345)>>>0; return seed/4294967296; }; }

const DT=1/60; let pass=0, fail=0;
function check(name, cond){ if(cond){ pass++; console.log("  ok  "+name); } else { fail++; console.log("FAIL  "+name); } }
function run(title, fn){ console.log("=== "+title+" ==="); try{ fn(); }catch(e){ fail++; console.log("FAIL(예외) "+title+": "+(e.stack||e.message)); } }

/* ── ① 별빛 수비대 ── */
run("수비대: 시작·건설 규칙·경제", ()=>{
  api.tdStart();
  const TD=api.TD;
  check("진입: 상태=td, 골드180·생명10", api.gameState==="td" && TD.gold===180 && TD.lives===10);
  // 길 위엔 못 지음(웨이포인트 첫 구간 [0..3,5])
  check("길 칸 건설 불가", api.tdBuildable(2,5)===false);
  check("빈 칸 건설 가능", api.tdBuildable(2,4)===true);
  const g0=TD.gold;
  check("건설 성공(별화살탑 60G)", api.tdBuy(2,4,0)===true && TD.towers.length===1 && TD.gold===g0-60);
  check("같은 칸 중복 건설 불가", api.tdBuy(2,4,0)===false);
  // 골드 부족
  TD.gold=10;
  check("골드 부족 시 건설 거부", api.tdBuy(4,4,3)===false && TD.towers.length===1);
  TD.gold=500;
  // 강화·판매
  const t=TD.towers[0];
  api.tdUpgrade(t); check("강화 → 2레벨", t.lv===2);
  const goldBefore=TD.gold, spent=t.spent;
  api.tdSell(t);
  check("판매 → 철거+70% 환급", TD.towers.length===0 && TD.gold===goldBefore+Math.round(spent*0.7));
});
run("수비대: 웨이브1 방어 성공(화살탑 3기)", ()=>{
  api.tdStart();
  const TD=api.TD;
  TD.gold=500;
  api.tdBuy(2,4,0); api.tdBuy(4,6,0); api.tdBuy(7,3,0);   // 길목 3기
  api.tdStartWave();
  check("웨이브 시작: phase=wave·큐 8마리", TD.phase==="wave" && TD.queue.length===8);
  let t=0; while(TD.phase==="wave" && t<90){ api.tdUpdate(DT); t+=DT; }
  check("웨이브1 전멸 방어(생명 손실 0)", TD.phase==="build" && TD.wave===2 && TD.lives===10);
  check("처치 골드+클리어 보너스 획득", TD.gold>500-180);
});
run("수비대: 무방비 → 생명 소진 패배", ()=>{
  api.tdStart();
  const TD=api.TD;
  for(let w=0; w<3 && TD.phase!=="over"; w++){
    if(TD.phase==="build") api.tdStartWave();
    let t=0; while(TD.phase==="wave" && t<120){ api.tdUpdate(DT); t+=DT; }
  }
  check("탑 없음 → 패배(over)", TD.phase==="over" && TD.lives===0);
});
run("수비대: 렌더 스모크(스텁 ctx)", ()=>{
  api.tdStart(); api.tdUpdate(DT); api.tdRender();
  check("tdRender 예외 없음", true);
});

/* ── ② 별빛 함대 ── */
run("함대: 봇 클리어 시뮬(웨이브 전진·점수)", ()=>{
  api.shStart();
  const SH=api.SH, K=api.keysDown;
  check("진입: wave1·목숨3", SH.wave===1 && SH.p.lives===3);
  K.clear(); K.add("KeyZ");   // 연사 홀드
  let t=0;
  while(SH.phase==="play" && SH.wave<3 && t<120){
    // 봇: 최하단(가장 가까운 줄) 적 하나를 안정 추적(진동 방지: y최대→x최소 고정 순서)
    let tgt=null;
    for(const f of SH.foes){ if(!f.alive||f.x===undefined) continue;
      if(!tgt || f.y>tgt.y+1 || (Math.abs(f.y-tgt.y)<=1 && f.x<tgt.x)) tgt=f; }
    let tx=tgt?tgt.x:null;
    if(SH.boss && SH.boss.alive) tx=SH.boss.x;
    // 회피: 내 머리 위로 떨어지는 적탄이 가까우면 옆으로 피하기(추적보다 우선)
    let dodge=0;
    for(const e of SH.eshots){ if(Math.abs(e.x-SH.p.x)<44 && e.y>SH.p.y-300 && e.y<SH.p.y){ dodge=(e.x>=SH.p.x)?-1:1; break; } }
    K.delete("ArrowLeft"); K.delete("ArrowRight");
    if(dodge<0) K.add("ArrowLeft"); else if(dodge>0) K.add("ArrowRight");
    else if(tx!==null){ if(tx<SH.p.x-14) K.add("ArrowLeft"); else if(tx>SH.p.x+14) K.add("ArrowRight"); }
    api.shUpdate(DT); t+=DT;
  }
  K.clear();
  check("웨이브 2 이상 도달(봇, 120s 내)", SH.wave>=2);
  check("점수 획득", SH.score>0);
});
run("함대: 피격 → 목숨 감소·무적", ()=>{
  api.shStart();
  const SH=api.SH;
  SH.eshots.push({ x:SH.p.x, y:SH.p.y, vx:0, vy:0 });
  api.shUpdate(DT);
  check("피격 시 목숨 3→2 + 무적 부여", SH.p.lives===2 && SH.p.inv>0);
  const lv=SH.p.lives;
  SH.eshots.push({ x:SH.p.x, y:SH.p.y, vx:0, vy:0 });
  api.shUpdate(DT);
  check("무적 중 추가 피격 없음", SH.p.lives===lv);
});
run("함대: 렌더 스모크", ()=>{ api.shStart(); api.shUpdate(DT); api.shRender(); check("shRender 예외 없음", true); });

/* ── ③ 별빛 던전 3D ── */
run("던전3D: 미로 BFS 도달성(*→G)", ()=>{
  const M=api.RAY_MAP, H=M.length, W=M[0].length;
  let s=null, g=null;
  for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(M[r][c]==="*") s=[c,r]; if(M[r][c]==="G") g=[c,r]; }
  check("시작(*)·골(G) 존재", !!s && !!g);
  const seen={}; const q=[s]; seen[s[0]+","+s[1]]=1; let found=false;
  while(q.length){ const [c,r]=q.shift();
    if(c===g[0]&&r===g[1]){ found=true; break; }
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nc=c+dc,nr=r+dr,k=nc+","+nr;
      if(nc<0||nr<0||nr>=H||nc>=W||M[nr][nc]==="#"||seen[k]) continue; seen[k]=1; q.push([nc,nr]); } }
  check("골까지 길이 이어짐(BFS)", found);
});
run("던전3D: 이동·벽 충돌·골인", ()=>{
  api.rayStart();
  const RAY=api.RAY, K=api.keysDown;
  check("진입: 시작칸(1.5,1.5)", Math.abs(RAY.px-1.5)<0.01 && Math.abs(RAY.py-1.5)<0.01);
  // 위(북쪽)는 벽 — 북쪽으로 밀어도 통과 불가
  RAY.ang=-Math.PI/2; K.clear(); K.add("ArrowUp");
  for(let i=0;i<60;i++) api.rayUpdate(DT);
  check("벽 통과 불가(py>=1.2 유지)", RAY.py>1.2);
  // 동쪽 복도는 열림 — 전진 시 x 증가
  RAY.ang=0; const x0=RAY.px;
  for(let i=0;i<30;i++) api.rayUpdate(DT);
  check("열린 복도 전진", RAY.px>x0+0.5);
  K.clear();
  // 골 위(북쪽 열린 칸)로 텔레포트 → 남향 전진 → 클리어 (골 동쪽 (2,11)은 벽이라 위에서 접근)
  RAY.px=RAY.gx; RAY.py=RAY.gy-0.9; RAY.ang=Math.PI/2;
  K.add("ArrowUp");
  for(let i=0;i<60 && !RAY.cleared;i++) api.rayUpdate(DT);
  K.clear();
  check("골 도달 → cleared", RAY.cleared===true);
});
run("던전3D: 렌더 스모크(DDA 320기둥)", ()=>{ api.rayStart(); api.rayUpdate(DT); api.rayRender(); check("rayRender 예외 없음", true); });

console.log("\n결과: "+(fail===0?("ALL PASS ✅ ("+pass+"항목)"):(fail+"건 실패 ❌")));
process.exit(fail===0?0:1);
