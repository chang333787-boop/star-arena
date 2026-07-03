// v1.25 학생 제작 맵 검증 하네스 — 등록·대칭·스폰 안전·연결성·비율·플레이 스모크
const fs=require("fs"); const path=require("path"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"테스터"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>0;

let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__p={ MAPS, getMap, STATE, ARENA, startGame, get state(){return gameState;}, setState:(v)=>{gameState=v;},
  setMap:(id)=>{ selectedMapId=id; if(profile) profile.selectedMapId=id; }, get MATCH(){return MATCH;},
  get STUDENT_MAPS(){return STUDENT_MAPS;} };`;
let api; try{ (0,eval)(s); api=globalThis.__p; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let ts=0; const F=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };

const IDS=["stu01_hajung","stu02_deathworld","stu03_quilt","stu04_sigoni","stu05_doridori"];
const A=api.ARENA, CS=56, COLS=22, ROWS=10, CX=A.x+A.w/2;

function cellBlocked(map){ // 22×10 그리드: 장애물이 덮는 칸 표시
  const g=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  for(const o of map.obstacles){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const x=A.x+c*CS, y=A.y+r*CS;
      if(x<o.x+o.w && x+CS>o.x && y<o.y+o.h && y+CS>o.y) g[r][c]=true;
    }
  }
  return g;
}
function cellOf(p){ return { c:Math.floor((p.x-A.x)/CS), r:Math.floor((p.y-A.y)/CS) }; }
function reachable(map){ // 스폰 → 반대편 스폰 4방향 플러드필
  const g=cellBlocked(map), s=cellOf(map.playerSpawn), e=cellOf(map.enemySpawn);
  const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  const q=[[s.r,s.c]]; seen[s.r][s.c]=true;
  while(q.length){ const [r,c]=q.shift();
    if(r===e.r && c===e.c) return true;
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!seen[nr][nc]&&!g[nr][nc]){ seen[nr][nc]=true; q.push([nr,nc]); }
    } }
  return false;
}
function rectDist(p,rc){ const dx=Math.max(rc.x-p.x, 0, p.x-(rc.x+rc.w)), dy=Math.max(rc.y-p.y, 0, p.y-(rc.y+rc.h)); return Math.hypot(dx,dy); }
function mirrored(x,w){ return 2*CX-(x+w); }

console.log("=== 1) 등록·대칭·스폰·연결성 (정적 검증) ===");
for(const id of IDS){
  run(id, ()=>{
    const m=api.getMap(id);
    check(id+" 등록됨", m.id===id);
    // 좌우 대칭: 모든 rect의 거울상이 같은 목록에 존재
    const sym=(list,eq)=>list.every(o=>list.some(p=>Math.abs(p.x-mirrored(o.x,o.w))<1 && p.y===o.y && p.w===o.w && p.h===o.h && (!eq||eq(o,p))));
    check(id+" 장애물 좌우대칭", sym(m.obstacles,(a,b)=>a.kind===b.kind));
    check(id+" 풀숲 좌우대칭", sym(m.bushes));
    check(id+" 트랩 좌우대칭", sym(m.traps,(a,b)=>a.type===b.type));
    check(id+" 스폰 미러 일치", Math.abs(m.enemySpawn.x-(2*CX-m.playerSpawn.x))<1 && m.enemySpawn.y===m.playerSpawn.y);
    // 스폰 안전: 경기장 내부, 장애물/트랩 안 아님, 가시와 160+ 거리
    const p=m.playerSpawn;
    check(id+" 스폰 경기장 내부", p.x>A.x&&p.x<A.x+A.w&&p.y>A.y&&p.y<A.y+A.h);
    check(id+" 스폰이 장애물 밖", m.obstacles.every(o=>rectDist(p,o)>0));
    check(id+" 스폰이 트랩 밖", m.traps.every(t=>rectDist(p,t)>0));
    check(id+" 가시와 160px 이상", m.traps.filter(t=>t.type==="damage").every(t=>rectDist(p,t)>=160));
    check(id+" 스폰↔반대편 연결", reachable(m));
    // 비율(테두리 행/열 벽은 밀실 컨셉 허용 — 내부만 계산)
    const g=cellBlocked(m); let wall=0;
    for(let r=1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++) if(g[r][c]) wall++;
    const wallPct=wall/((ROWS-2)*(COLS-2));
    check(id+" 내부 벽 비율 ≤25% ("+(wallPct*100).toFixed(1)+"%)", wallPct<=0.25);
    let bushArea=0; for(const b of m.bushes) bushArea+=b.w*b.h;
    const bushPct=bushArea/(A.w*A.h);
    check(id+" 풀숲 비율 ≤15% ("+(bushPct*100).toFixed(1)+"%)", bushPct<=0.15);
  });
}

console.log("=== 2) 플레이 스모크 (맵마다 3대3 시작 → 3초 진행) ===");
for(const id of IDS){
  run(id+" smoke", ()=>{
    api.setMap(id);
    api.startGame();
    check(id+" 경기 시작(playing)", api.state===api.STATE.PLAYING);
    check(id+" MATCH.map 적용", api.MATCH.map.id===id);
    F(180);   // 3초 — 봇 이동·탄환·충돌 프레임 안전
    const me=api.MATCH.fighters?api.MATCH.fighters[0]:null;
    check(id+" 프레임 진행 안전", true);
    if(me) check(id+" 플레이어 경기장 내부 유지", me.x>A.x-1&&me.x<A.x+A.w+1&&me.y>A.y-1&&me.y<A.y+A.h+1);
    api.setState(api.STATE.START);
  });
}

console.log(fails===0 ? "\n결과: ALL PASS ✅" : ("\n결과: "+fails+"건 실패 ❌"));
process.exit(fails===0?0:1);
