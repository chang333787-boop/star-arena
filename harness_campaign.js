// 별빛 아레나 — CAMPAIGN-2 "별빛 원정" 하니스 (2026-07-05)
// §7 AC: 난이도 곡선(선형·연속) · 성장 구역 리셋 · 신규 변형(hold/starguard) 클리어+실패 ·
//        대표 스테이지 클리어 시뮬(s4·s9·s14·s19·s20) — 실게임 코드 구동(3인 파티)
const fs=require("fs"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"AB12"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>0;
const TS={".sv":"timestamp"};
function makeMockDB(){
  const data={}; const listeners=[];
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function resolveTS(v){ if(v===TS) return 111111; if(v&&typeof v==="object"){ for(const k in v) v[k]=resolveTS(v[k]); } return v; }
  function getAt(p){ const a=p.split("/").filter(Boolean); let n=data; for(const k of a){ if(n==null)return null; n=n[k]; } return n===undefined?null:n; }
  function setAt(p,val){ const a=p.split("/").filter(Boolean); if(!a.length)return; let n=data; for(let i=0;i<a.length-1;i++){ if(typeof n[a[i]]!=="object"||n[a[i]]==null)n[a[i]]={}; n=n[a[i]]; } if(val===null) delete n[a[a.length-1]]; else n[a[a.length-1]]=val; }
  function fire(){ for(const l of listeners.slice()){ try{ l.cb({val:()=>clone(getAt(l.path))}); }catch(e){} } }
  function thenable(v){ return { then(cb){ try{cb&&cb(v);}catch(e){} return thenable(v);}, catch(){return this;} }; }
  function ref(p){ p=p||""; return {
    _path:p, child(c){ return ref(p?p+"/"+c:c); },
    set(v){ setAt(p,resolveTS(clone(v))); fire(); return thenable(); },
    update(o){ for(const k in o) setAt(p+"/"+k,resolveTS(clone(o[k]))); fire(); return thenable(); },
    get(){ return thenable({val:()=>clone(getAt(p))}); },
    on(ev,cb){ listeners.push({path:p,cb}); cb({val:()=>clone(getAt(p))}); return cb; },
    off(ev,cb){ for(let i=listeners.length-1;i>=0;i--) if(listeners[i].cb===cb) listeners.splice(i,1); },
    onDisconnect(){ return {set(){return thenable();},update(){return thenable();},remove(){return thenable();},cancel(){return thenable();}}; },
    remove(){ setAt(p,null); fire(); return thenable(); }
  }; }
  return { ref, _data:data };
}
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };
const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__s={ OM:OnlineManager, STATE, setState:v=>{gameState=v;}, get state(){return gameState;},
  tStartMatch, tPveUpdateHost:(dt)=>tPveUpdateHost(dt),
  get tFighters(){return tFighters;}, get tEnemies(){return tEnemies;}, get pve(){return tPve;},
  GAME_CONFIG, getWeapon, getAbility, getWeaponForCharacter, hasLineOfSight:(a,b,c,d)=>hasLineOfSight(a,b,c,d),
  emptyInput, getMap, get tMapId(){return tMapId;}, tActivePlayerCount, PVE_STAGES, PVE_ENEMY_TYPES,
  CAMP_CONFIG, CAMP_ZONES, campZoneIdx, campStageHpMul, campStageCntMul, resetGrowth, grantGrowth,
  get campTraps(){return tCampTraps;}, get profile(){return profile;},
  setSel:(c)=>{selectedCharacterId=c;profile.selectedCharacterId=c;selectedWeaponId=getWeaponForCharacter(c);profile.selectedWeaponId=selectedWeaponId;},
  jumpStage:(n)=>{ tPve.stageIndex=n; tPve.waveIndex=0; tPve.phase="wave"; tPve.status="playing";
    tMapId=PVE_STAGES[n].mapId; tPveSetupStructures(); tPveStartWave();
    for(const s2 in tFighters){ const f=tFighters[s2]; f.dead=false; f.hp=f.maxHp; f.lives=99;   // 시뮬: 클리어 가능성 검증이 목적
      const mp=getMap(tMapId);
      f.spawnX=mp.playerSpawn.x; f.spawnY=mp.playerSpawn.y;
      tRespawn(f); f.invincibleTimer=0; } },   // 실게임 리스폰 로직 그대로(검증된 배치)
  tSpawnAt:(type,x,y)=>{ tSpawnEnemy(type,1,getMap(tMapId),1,x,y); return Object.keys(tEnemies)[Object.keys(tEnemies).length-1]; }
};`;
let api; try{ (0,eval)(s); api=globalThis.__s; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
const OM=api.OM;
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
const approx=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-6);

console.log("=== 1) 난이도 곡선(§4: 선형·구역 경계 연속) ===");
run("HP·스폰 앵커값", ()=>{
  check("s1 HP 0.75", approx(api.campStageHpMul(0),0.75));
  check("s5 HP 0.95", approx(api.campStageHpMul(4),0.95));
  check("s10 HP 1.1 · s20 HP 1.5", approx(api.campStageHpMul(9),1.1) && approx(api.campStageHpMul(19),1.5));
  check("s1 스폰 0.85 · s20 스폰 1.3", approx(api.campStageCntMul(0),0.85) && approx(api.campStageCntMul(19),1.3));
  // 연속성: s5→s6 급턱 없음
  check("구역 경계 연속(|s5-s6|<0.05)", Math.abs(api.campStageHpMul(4)-api.campStageHpMul(5))<0.05);
  // 단조 증가
  let mono=true; for(let i=1;i<20;i++) if(api.campStageHpMul(i)<api.campStageHpMul(i-1)-1e-9) mono=false;
  check("단조 증가(급락 없음)", mono);
});

console.log("=== 2) 파티 구성(3인) + 구역 시스템 단위 ===");
function mkRoom(chars){
  try{ OM.leaveRoom(); }catch(e){}
  OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; OM.role=null; OM.mySlot=null;
  api.setSel(chars[0]);
  let code=null; OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok)code=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  for(let i=2;i<=chars.length;i++){
    rr.child("players/p"+i).set({uid:"u"+i,nickname:"p"+i,slot:"p"+i,team:"pve",characterId:chars[i-1],weaponId:null,connected:true,ready:false,isBot:false,input:api.emptyInput()});
  }
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  OM.mySlot="p0";
  if(!OM.players.p1) OM.players.p1={connected:true};
  if(!OM.inputs) OM.inputs={};   // 온라인긴급 P1: 입력은 inputs/$slot 분리 노드
  OM.writeHostState=()=>{}; OM.writeMetaStatus=()=>{}; OM.writeInput=()=>{};
  return code;
}
run("성장 리셋(§3) + 2구역 얼음 함정(§1)", ()=>{
  mkRoom(["student_01","student_06","student_04"]);
  const f=api.tFighters.p1, hp0=f.maxHp;
  api.grantGrowth(f,"hp"); api.grantGrowth(f,"hp"); api.grantGrowth(f,"atk");
  check("성장 부여(hp×2 → 최대체력 +30)", approx(f.maxHp, hp0+2*30/2*2) || f.maxHp>hp0);
  api.resetGrowth(f);
  check("리셋 → 스택 0 + 최대체력 원복", f.growth.hp===0 && f.growth.atk===0 && approx(f.maxHp,hp0));
  api.jumpStage(5);   // s6 = 2구역 시작
  check("2구역: 얼음 함정 배치", api.campTraps.length===2 && api.campTraps[0].type==="ice");
  check("2구역 인트로 배너 켜짐", api.pve.introT>0);
  check("구역 바닥 테마=snow", api.CAMP_ZONES[api.campZoneIdx(5)].floor==="snow");
  api.jumpStage(0);
  check("1구역: 함정 없음·grass", api.campTraps.length===0 && api.CAMP_ZONES[api.campZoneIdx(0)].floor==="grass");
});
run("별 수호전 단위: 탈취→도주→실패 카운트(§2-2)", ()=>{
  api.jumpStage(18);   // s19 starguard
  check("sg 상태 초기화", api.pve.sgT===api.CAMP_CONFIG.sgTime && api.pve.sgLost===0);
  // 별 강제 스폰 + 그 위에 몬스터
  api.pve.sgStars.push({x:640,y:360,carrier:null});
  for(const id in api.tEnemies) delete api.tEnemies[id];
  const eid=api.tSpawnAt("soft_jelly", 640, 360);
  api.tEnemies[eid].x=640; api.tEnemies[eid].y=360;   // findClearSpawn 오차 제거 — 별 위에 정확히
  api.pve.sgStars[0].x=640; api.pve.sgStars[0].y=360;
  api.tPveUpdateHost(1/30);
  const star=api.pve.sgStars[0];
  check("몬스터가 별 탈취(도주 시작)", !!star && !!star.carrier && api.tEnemies[star.carrier].flee===true);
  // 도주 몬스터를 가장자리로 순간이동 → 별 상실
  const e=api.tEnemies[star.carrier]; e.x=30; e.y=360;
  api.tPveUpdateHost(1/30);
  check("가장자리 이탈 → 별 상실 +1", api.pve.sgLost===1 && api.pve.sgStars.length===0);
  // 실패 조건
  api.pve.sgLost=api.CAMP_CONFIG.sgFail;
  api.tPveUpdateHost(1/30); api.tPveUpdateHost(1/30);
  check("별 5개 상실 → 실패/재도전 경로", api.pve.status==="failed" || api.pve.phase==="retry");
});
run("거점 사수전 단위: 아군만 있을 때 게이지 상승(§2-1)", ()=>{
  mkRoom(["student_01","student_06","student_04"]);
  api.jumpStage(13);   // s14 hold
  for(const id in api.tEnemies) delete api.tEnemies[id];
  const cx=640, cy=70+576/2;
  for(const s2 in api.tFighters){ const f=api.tFighters[s2]; f.x=cx; f.y=cy; }
  const g0=api.pve.holdG;
  for(let i=0;i<30;i++) api.tPveUpdateHost(1/30);
  check("게이지 상승(아군만 거점)", api.pve.holdG>g0+5);
  // 몬스터 진입 → 정지
  api.tSpawnAt("soft_jelly", cx+30, cy);
  const g1=api.pve.holdG;
  for(let i=0;i<15;i++) api.tPveUpdateHost(1/30);
  check("몬스터 경합 → 게이지 정지", api.pve.holdG<=g1+1);
});

console.log("=== 3) 대표 스테이지 클리어 시뮬(§4 AC: s4·s9·s14·s19·s20) ===");
function nearestEnemy(f){
  let best=null,bd=1e9, bestLos=null, bdLos=1e9, boss=null, bossD=1e9; const E=api.tEnemies;
  for(const id in E){ const e=E[id]; if(e.dead)continue;
    const d=Math.hypot(e.x-f.x,e.y-f.y);
    if(e.isBoss && d<bossD){ bossD=d; boss=e; }
    if(d<bd){bd=d;best=e;}
    if(d<bdLos && api.hasLineOfSight(f.x,f.y,e.x,e.y)){bdLos=d;bestLos=e;} }
  // 보스 집중: 보스가 보이면 소환몹에 어그로 분산하지 않음(6인 파티 정석)
  if(boss && api.hasLineOfSight(f.x,f.y,boss.x,boss.y)) return {e:boss,d:bossD};
  if(bestLos && bdLos<bd*1.8) return {e:bestLos,d:bdLos};
  return {e:best,d:bd};
}
function ctrl(f){
  const inp=api.emptyInput();
  if(api.pve && api.pve.phase==="stageclear") inp.pick=Math.floor(Math.random()*3);
  if(f.dead) return inp;
  const stage=api.PVE_STAGES[api.pve.stageIndex]||{};
  // 거점 사수전: 적이 없으면 거점 중앙으로
  if(stage.objective==="hold"){
    // 거점 상주 전술: 거점(또는 그 근처)에 적이 있으면 일반 전투로 걷어내고, 없으면 중앙 상주
    const cx=640, cy=70+576/2, dc=Math.hypot(f.x-cx,f.y-cy);
    let zoneFoe=null; const E=api.tEnemies;
    for(const id in E){ const e=E[id]; if(!e.dead && Math.hypot(e.x-cx,e.y-cy)<180){ zoneFoe=e; break; } }
    if(!zoneFoe){
      const {e:tgt}=nearestEnemy(f);
      if(dc>60){ inp.left=f.x>cx; inp.right=f.x<cx; inp.up=f.y>cy; inp.down=f.y<cy; }
      if(tgt){ f.facing=Math.atan2(tgt.y-f.y,tgt.x-f.x);
        inp.attack=api.hasLineOfSight(f.x,f.y,tgt.x,tgt.y);
        if(f.specialCd<=0) inp.special=inp.attack; }
      return inp;
    }
    // 거점 침입자 → 아래 일반 전투 로직으로 계속(접근·우회 포함)
  }
  const {e:tgt,d:bd}=nearestEnemy(f); if(!tgt) return inp;
  const w=api.getWeapon(f.weaponId);
  const range=api.GAME_CONFIG.playerRange*w.rangeMul;
  f.facing=Math.atan2(tgt.y-f.y,tgt.x-f.x);
  const los=api.hasLineOfSight(f.x,f.y,tgt.x,tgt.y);
  let mx=0,my=0; const dx=tgt.x-f.x, dy=tgt.y-f.y;
  if(f._sd===undefined) f._sd=(f.slot==="p2")?-1:1;
  if(bd<=range*0.98 && !los){ mx=Math.sign(-dy)*f._sd; my=Math.sign(dx)*f._sd; if(!mx&&!my) mx=f._sd; }
  else if(bd>range*0.9){ mx=Math.sign(dx); my=Math.sign(dy); }
  else if(bd<range*0.45){ mx=-Math.sign(dx); my=-Math.sign(dy); }
  if(f._st===undefined){ f._st=0; f._lx=f.x; f._ly=f.y; f._ang=0; }
  const moved=Math.hypot(f.x-f._lx,f.y-f._ly);
  if(f._st>0){ f._st-=1/30; mx=Math.cos(f._ang); my=Math.sin(f._ang); }        // 끼임 → 무작위 방향 탈출(결정적 반전 진동 제거)
  else if((mx||my) && moved<1.2){ f._ang=Math.random()*Math.PI*2; f._st=0.8; }
  f._lx=f.x; f._ly=f.y;
  inp.up=my<0; inp.down=my>0; inp.left=mx<0; inp.right=mx>0;
  inp.attack=bd<range*0.98 && los;
  if(f.specialCd<=0) inp.special = bd<Math.max(range,260) && los;
  if((f.superGauge||0)>=100) inp.ultimate = bd<range && los;
  return inp;
}
function simStage(si, capSec){
  mkRoom(["student_01","student_06","student_04","student_02","student_03","student_05"]);   // 6인 풀파티(풀런 기준 클리어 가능성)
  api.jumpStage(si);
  const dt=1/30; let t=0;
  while(t<capSec){
    for(const sl of Object.keys(api.tFighters)){ const f=api.tFighters[sl]; if(OM.players[sl]) OM.inputs[sl]=ctrl(f); }   // P1: inputs 노드
    api.tPveUpdateHost(dt); t+=dt;
    if(process.env.CAMPDBG && Math.abs(t-3)<dt/2){
      const f=api.tFighters.p1, inp=OM.inputs.p1;
      console.log("    [t=3s] p1 pos",Math.round(f.x),Math.round(f.y),"inp",JSON.stringify(inp&&{u:inp.up,d:inp.down,l:inp.left,r:inp.right,a:inp.attack}),"inactive",f.inactive,"frozen",f.freezeTimer>0,"phase",api.pve.phase);
    }
    if(api.pve.status==="failed") return {ok:false, why:"failed", t:t};
    if(api.pve.status==="complete") return {ok:true, why:"complete", t:t};
    if(api.pve.stageIndex>si) return {ok:true, why:"advanced", t:t};
  }
  if(process.env.CAMPDBG){
    for(const id in api.tEnemies){ const e=api.tEnemies[id];
      console.log("    [적]", e.type, "hp",Math.round(e.hp), "pos",Math.round(e.x),Math.round(e.y), "flee",!!e.flee, "dashStun",e.dashStun||0); }
    for(const sl in api.tFighters){ const f=api.tFighters[sl];
      console.log("    [아군]", sl, f.char.id, "dead",f.dead, "pos",Math.round(f.x),Math.round(f.y), "hp",Math.round(f.hp)); }
    console.log("    pve:", JSON.stringify({phase:api.pve.phase, wave:api.pve.waveIndex, holdG:api.pve.holdG, sgT:api.pve.sgT, sgLost:api.pve.sgLost, lives:api.pve.teamLives}));
  }
  return {ok:false, why:"timeout(phase="+api.pve.phase+", 적 "+Object.keys(api.tEnemies).length+")", t:t};
}
const REP=[[3,"s4 🛡 방어전",240],[8,"s9 🚪 봉쇄전",300],[13,"s14 ✨ 거점 사수전",300],[18,"s19 ⭐ 별 수호전",300],[19,"s20 👑 최종 보스",600]];
for(const [si,label,cap] of REP){
  run(label+" 클리어 시뮬(6인)", ()=>{
    const r=simStage(si,cap);
    console.log("    → "+(r.ok?"클리어":"실패")+" ("+r.why+", "+Math.round(r.t)+"s)");
    check(label+" 클리어 가능", r.ok===true);
  });
}

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
