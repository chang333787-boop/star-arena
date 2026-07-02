// 별빛 아레나 v1.18 — 6인 협동 PVE 밸런스 시뮬레이션(분석용, 실게임 코드 구동)
// A) 미시: 캐릭터별 Z 실측 TTK / X·C 실측 효과(피해·CC·회복)
// B) 솔로: 각 캐릭터 단독 스테이지1 클리어(시간·사망·피해)
// C) 파티: 6인 풀런(스테이지 진행·킬·사망·X/C 사용·CC/힐 기여)
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
  get tFighters(){return tFighters;}, get tEnemies(){return tEnemies;}, get pve(){return tPve;}, get tBullets(){return tBullets;},
  get skillZones(){return skillZones;}, GAME_CONFIG, getWeapon, getAbility, getWeaponForCharacter,
  hasLineOfSight:(a,b,c,d)=>hasLineOfSight(a,b,c,d), emptyInput, getMap, get tMapId(){return tMapId;},
  tSpawnEnemy:(t,m)=>tSpawnEnemy(t,m,getMap(tMapId)), tActivePlayerCount,
  setSel:(c)=>{selectedCharacterId=c;profile.selectedCharacterId=c;selectedWeaponId=getWeaponForCharacter(c);profile.selectedWeaponId=selectedWeaponId;},
  clearEnemies:()=>{for(const id in tEnemies) delete tEnemies[id];},
  clearZones:()=>{skillZones=[];}, clearBullets:()=>{tBullets.length=0;},
  PVE_STAGES, PVE_ENEMY_TYPES };`;
let api; try{ (0,eval)(s); api=globalThis.__s; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
const OM=api.OM;
const CHARS=["student_01","student_02","student_03","student_04","student_05","student_06"];
const NAME={student_01:"럭키",student_02:"달이",student_03:"시고니",student_04:"눈꽃",student_05:"모아",student_06:"별골렘"};
const r1=n=>Math.round(n*10)/10;

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
  OM.mySlot="p0";   // 전원 스크립트 입력 사용(호스트 keysDown 배제)
  if(!OM.players.p1) OM.players.p1={connected:true,input:api.emptyInput()};
  // 시뮬 안정화: 상태/메타 쓰기를 무음화(mock DB 리스너가 players/입력을 되덮는 churn 차단)
  OM.writeHostState=()=>{}; OM.writeMetaStatus=()=>{}; OM.writeInput=()=>{};
  return code;
}
// ── 스크립트 조종(모든 캐릭터 동일 실력의 '무난한 학생' 가정) ──
function nearestEnemy(f){
  let best=null,bd=1e9, bestLos=null, bdLos=1e9; const E=api.tEnemies;
  for(const id in E){ const e=E[id]; if(e.dead)continue;
    const d=Math.hypot(e.x-f.x,e.y-f.y);
    if(d<bd){bd=d;best=e;}
    if(d<bdLos && api.hasLineOfSight(f.x,f.y,e.x,e.y)){bdLos=d;bestLos=e;} }
  // 보이는 적 우선(사거리 1.5배 이내면) — 벽 건너 최근접만 노려 교착되는 것 방지
  if(bestLos && bdLos<bd*1.8) return {e:bestLos,d:bdLos};
  return {e:best,d:bd};
}
function ctrl(f,t){
  const inp=api.emptyInput();
  if(api.pve && api.pve.phase==="stageclear") inp.pick=Math.floor(Math.random()*3);   // 강화 3택1 자동 선택
  if(f.dead) return inp;
  const {e:tgt,d:bd}=nearestEnemy(f); if(!tgt) return inp;
  const w=api.getWeapon(f.weaponId);
  const range=api.GAME_CONFIG.playerRange*w.rangeMul;
  f.facing=Math.atan2(tgt.y-f.y,tgt.x-f.x);       // 시뮬 편의: 조준 고정
  const los=api.hasLineOfSight(f.x,f.y,tgt.x,tgt.y);
  let mx=0,my=0;
  const dx=tgt.x-f.x, dy=tgt.y-f.y;
  if(f._simDir===undefined) f._simDir=(f.slot==="p2"||f.slot==="p4"||f.slot==="p6")?-1:1;
  if(bd<=range*0.98 && !los){                                                    // 사거리 내인데 벽 → 옆으로 돌아 시야 확보
    mx=Math.sign(-dy)*f._simDir; my=Math.sign(dx)*f._simDir;
    if(mx===0&&my===0){ mx=f._simDir; }
  }
  else if(bd>range*0.9){ mx=Math.sign(dx); my=Math.sign(dy); }                   // 접근
  else if(bd<range*0.45){ mx=-Math.sign(dx); my=-Math.sign(dy); }               // 이탈
  // 벽 끼임 감지 → 0.6초 수직 우회(게임 봇과 유사)
  if(f._simStuck===undefined){ f._simStuck=0; f._simDir=(f.slot==="p2"||f.slot==="p4"||f.slot==="p6")?-1:1; f._simLX=f.x; f._simLY=f.y; f._simReStuck=0; }
  const tryingMove=(mx!==0||my!==0);
  const movedDist=Math.hypot(f.x-f._simLX, f.y-f._simLY);
  if(f._simStuck>0){ f._simStuck-=1/30;
    mx=Math.sign(-dy)*f._simDir; my=Math.sign(dx)*f._simDir;                     // 목표 기준 수직 이동
    if(mx===0&&my===0){ mx=f._simDir; }
  } else if(tryingMove && movedDist<1.2){
    f._simReStuck++;
    if(f._simReStuck>=2){ f._simDir*=-1; f._simReStuck=0; }                      // 반복 끼임 → 반대로 우회
    f._simStuck=1.0;
  }
  f._simLX=f.x; f._simLY=f.y;
  inp.up=my<0; inp.down=my>0; inp.left=mx<0; inp.right=mx>0;
  inp.attack = bd<range*0.98 && los;
  const cid=f.char.id;
  if(f.specialCd<=0){
    if(cid==="student_05"){ let hurt=false; const F=api.tFighters; for(const s in F){const a=F[s]; if(!a.dead&&!a.inactive&&a.hp<a.maxHp-25){hurt=true;break;}} inp.special=hurt; }
    else if(cid==="student_06"){ inp.special = bd<300; }
    else inp.special = bd<Math.max(range,260)*1.1 && los;
  }
  if((f.superGauge||0)>=100){
    if(cid==="student_05"){ let deficit=0; const F=api.tFighters; for(const s in F){const a=F[s]; if(!a.dead&&!a.inactive) deficit+=a.maxHp-a.hp;} inp.ultimate=deficit>120; }
    else if(cid==="student_04"){ inp.ultimate = bd<140; }
    else if(cid==="student_06"){ let n=0; const E=api.tEnemies; for(const id in E){ if(!E[id].dead&&Math.hypot(E[id].x-f.x,E[id].y-f.y)<380)n++; } inp.ultimate=n>=3; }
    else inp.ultimate = bd<range && los;
  }
  return inp;
}
function runParty(chars, capSec, label){
  mkRoom(chars);
  const dt=1/30; let t=0;
  const S={}; const slots=Object.keys(api.tFighters);
  for(const sl of slots){ const f=api.tFighters[sl]; S[sl]={cid:f.char.id, score:0, deaths:0, dmgTaken:0, healGot:0, xUse:0, cUse:0}; }
  const prev={}; for(const sl of slots){ const f=api.tFighters[sl]; prev[sl]={hp:f.hp,dead:f.dead,cd:0,sg:0}; }
  let freezeSec=0, slowSec=0; const waveLog=[]; let lastKey="";
  while(t<capSec && api.pve.status==="playing"){
    for(const sl of slots){ const f=api.tFighters[sl]; if(OM.players[sl]) OM.players[sl].input=ctrl(f,t); }
    api.tPveUpdateHost(dt);
    for(const sl of slots){ const f=api.tFighters[sl], p=prev[sl], st=S[sl];
      if(!p.dead && f.dead) st.deaths++;
      if(!f.dead && !p.dead){ const d=f.hp-p.hp; if(d<0) st.dmgTaken-=d; else if(d>0) st.healGot+=d; }
      if(p.cd<=0 && f.specialCd>1) st.xUse++;
      if(p.sg>=100 && (f.superGauge||0)<20) st.cUse++;
      st.score=f.score;
      p.hp=f.hp; p.dead=f.dead; p.cd=f.specialCd; p.sg=f.superGauge||0;
    }
    const E=api.tEnemies; for(const id in E){ if(E[id].freezeTimer>0) freezeSec+=dt; if(E[id].wSlowTimer>0) slowSec+=dt; }
    const key=api.pve.stageIndex+"-"+api.pve.waveIndex;
    if(key!==lastKey){ waveLog.push({t:r1(t), stage:api.pve.stageIndex+1, wave:api.pve.waveIndex+1}); lastKey=key; }
    t+=dt;
  }
  return { label, chars, time:r1(t), status:api.pve.status, stage:api.pve.stageIndex+1, wave:api.pve.waveIndex+1,
    lives:api.pve.teamLives, S, freezeSec:r1(freezeSec), slowSec:r1(slowSec), waveLog };
}
// ── A) 미시 측정 ──
function microZ(cid){
  mkRoom([cid]);
  api.pve.phase="gap"; api.pve.phaseTimer=99999; api.clearEnemies(); api.clearBullets(); api.clearZones();
  const f=api.tFighters.p1; const w=api.getWeapon(f.weaponId);
  const range=api.GAME_CONFIG.playerRange*w.rangeMul;
  api.tSpawnEnemy("tank",1);                       // 더미
  const id=Object.keys(api.tEnemies)[0], e=api.tEnemies[id];
  e.freezeTimer=1e9; e.hp=e.maxHp=200;
  e.x=f.x+range*0.8; e.y=f.y;
  const dt=1/30; let t=0; let firstHit=null;
  while(t<40 && api.tEnemies[id]){
    OM.players.p1.input=(function(){ const inp=api.emptyInput(); f.facing=Math.atan2(e.y-f.y,e.x-f.x); inp.attack=true; return inp; })();
    api.tPveUpdateHost(dt);
    if(firstHit===null && api.tEnemies[id] && api.tEnemies[id].hp<200) firstHit=t;
    t+=dt;
  }
  const far={ ttk200:r1(t), dps:r1(200/Math.max(0.1,t-(firstHit||0))) };
  // 근접(110px) — 더미 위치 핀 고정(밀치기 무시): 확산탄의 실전 근접 화력
  api.clearEnemies(); api.clearBullets(); api.clearZones();
  api.tSpawnEnemy("tank",1);
  const id2=Object.keys(api.tEnemies)[0], e2=api.tEnemies[id2];
  e2.freezeTimer=1e9; e2.hp=e2.maxHp=200;
  const px=f.x+110, py=f.y;
  t=0; firstHit=null;
  while(t<40 && api.tEnemies[id2]){
    e2.x=px; e2.y=py;   // 핀 고정
    OM.players.p1.input=(function(){ const inp=api.emptyInput(); f.facing=0; inp.attack=true; return inp; })();
    api.tPveUpdateHost(dt);
    if(firstHit===null && api.tEnemies[id2] && api.tEnemies[id2].hp<200) firstHit=t;
    t+=dt;
  }
  return { far, near:{ ttk200:r1(t), dps:r1(200/Math.max(0.1,t-(firstHit||0))) } };
}
function microC(cid){
  mkRoom([cid]);
  api.pve.phase="gap"; api.pve.phaseTimer=99999; api.clearEnemies(); api.clearBullets(); api.clearZones();
  const f=api.tFighters.p1; const A=api.getAbility(cid);
  // 8마리 그런트를 부채꼴 전방에 배치(HP 1000 = 안 죽게)
  for(let i=0;i<8;i++) api.tSpawnEnemy("grunt",1);
  const ids=Object.keys(api.tEnemies); let k=0;
  for(const id of ids){ const e=api.tEnemies[id]; e.freezeTimer=0; e.hp=e.maxHp=1000;
    const ang=(k-3.5)*0.16, dist=140+((k%3)*60);   // 전방 140~260 분산
    e.x=f.x+Math.cos(ang)*dist; e.y=f.y+Math.sin(ang)*dist; e.speed=0; k++; }
  f.facing=0; f.superGauge=100;
  const hp0={}; for(const id of ids) hp0[id]=api.tEnemies[id].hp;
  const dt=1/30; let t=0; let cast=false;
  let frz=0, slw=0;
  while(t<6){
    const inp=api.emptyInput(); if(!cast){ inp.ultimate=true; cast=true; }
    f.facing=0; OM.players.p1.input=inp;
    api.tPveUpdateHost(dt);
    for(const id of ids){ const e=api.tEnemies[id]; if(!e) continue; if(e.freezeTimer>0)frz+=dt; if(e.wSlowTimer>0)slw+=dt; }
    t+=dt;
  }
  let dmg=0, hitN=0;
  for(const id of ids){ const e=api.tEnemies[id]; const d=e?hp0[id]-e.hp:hp0[id]; if(d>0.5){dmg+=d; hitN++;} }
  return { cDmg:Math.round(dmg), cTargets:hitN, freezeSec:r1(frz), slowSec:r1(slw) };
}
function microX(cid){
  mkRoom([cid]);
  api.pve.phase="gap"; api.pve.phaseTimer=99999; api.clearEnemies(); api.clearBullets(); api.clearZones();
  const f=api.tFighters.p1;
  for(let i=0;i<8;i++) api.tSpawnEnemy("grunt",1);
  const ids=Object.keys(api.tEnemies); let k=0;
  for(const id of ids){ const e=api.tEnemies[id]; e.freezeTimer=0; e.hp=e.maxHp=1000;
    const ang=(k-3.5)*0.18, dist=150+((k%3)*55);
    e.x=f.x+Math.cos(ang)*dist; e.y=f.y+Math.sin(ang)*dist; e.speed=0; k++; }
  f.facing=0;
  const hp0={}; for(const id of ids) hp0[id]=api.tEnemies[id].hp;
  const dt=1/30; let t=0; let cast=false; let slw=0;
  while(t<6){
    const inp=api.emptyInput(); if(!cast){ inp.special=true; cast=true; }
    // 시고니 X는 이동해야 가시가 깔림 → 이동 입력
    if(cid==="student_03" && t<3){ inp.right=true; }
    f.facing=0; OM.players.p1.input=inp;
    api.tPveUpdateHost(dt);
    for(const id of ids){ const e=api.tEnemies[id]; if(!e) continue; if(e.wSlowTimer>0)slw+=dt; }
    t+=dt;
  }
  let dmg=0, hitN=0;
  for(const id of ids){ const e=api.tEnemies[id]; const d=e?hp0[id]-e.hp:hp0[id]; if(d>0.5){dmg+=d; hitN++;} }
  return { xDmg:Math.round(dmg), xTargets:hitN, slowSec:r1(slw) };
}
function microHeal(){ // 모아 X/C 회복량
  mkRoom(["student_05","student_06"]);
  api.pve.phase="gap"; api.pve.phaseTimer=99999; api.clearEnemies(); api.clearBullets(); api.clearZones();
  const m=api.tFighters.p1, g=api.tFighters.p2;
  g.hp=g.maxHp-120; m.hp=m.maxHp-50; g.x=m.x+10; g.y=m.y;
  m.superGauge=100;
  const dt=1/30; let t=0; let cast=false;
  const g0=g.hp, m0=m.hp;
  while(t<2){ const inp=api.emptyInput(); if(!cast){ inp.ultimate=true; cast=true; } OM.players.p1.input=inp; OM.players.p2&&(OM.players.p2.input=api.emptyInput()); api.tPveUpdateHost(dt); t+=dt; }
  const cHeal=(g.hp-g0)+(m.hp-m0);
  // X 구급상자
  m.specialCd=0; g.hp=g.maxHp-120; const g1=g.hp; let cast2=false; t=0;
  while(t<2){ const inp=api.emptyInput(); if(!cast2){ inp.special=true; cast2=true; } OM.players.p1.input=inp; api.tPveUpdateHost(dt); t+=dt; }
  return { cHeal:Math.round(cHeal), xHeal:Math.round(g.hp-g1) };
}

if(process.env.DBG3){
  mkRoom(CHARS);
  const dt=1/30;
  for(let i=0;i<200*30;i++){
    for(const sl of Object.keys(api.tFighters)){ const f=api.tFighters[sl]; if(OM.players[sl]) OM.players[sl].input=ctrl(f,i*dt); }
    api.tPveUpdateHost(dt);
  }
  console.log("200s 후 stage/wave:", api.pve.stageIndex+1, api.pve.waveIndex+1, "적:", Object.keys(api.tEnemies).length);
  for(const id in api.tEnemies){ const e=api.tEnemies[id];
    console.log("  잔존:", e.type, "hp", Math.round(e.hp)+"/"+Math.round(e.maxHp), "pos", Math.round(e.x)+","+Math.round(e.y)); }
  const F=api.tFighters;
  for(const sl in F){ const f=F[sl]; console.log("  아군:", NAME[f.char.id], "pos", Math.round(f.x)+","+Math.round(f.y), "hp", Math.round(f.hp), "score", f.score); }
  process.exit(0);
}
if(process.env.DBG2){
  mkRoom(CHARS);
  const f=api.tFighters.p1;
  console.log("전:", f.x, f.y, "cd", f.cooldown);
  OM.players.p1.input={up:false,down:false,left:false,right:true,attack:false,special:false,ultimate:false,super:false,reload:false};
  api.tPveUpdateHost(1/30);
  console.log("1틱 후:", f.x, f.y, "같은 객체?", api.tFighters.p1===f);
  console.log("fighters keys:", Object.keys(api.tFighters).join(","));
  console.log("mySlot:", OM.mySlot, "p1 connected:", OM.players.p1&&OM.players.p1.connected);
  // 점수 확인(적이 어떻게 죽는지)
  for(let i=0;i<300;i++){ api.tPveUpdateHost(1/30); }
  let sc=""; for(const sl in api.tFighters) sc+=sl+":"+api.tFighters[sl].score+" ";
  console.log("10s 방치 후 score:", sc, "enemies:", Object.keys(api.tEnemies).length, "lives:", api.pve.teamLives);
  process.exit(0);
}
if(process.env.DBG){
  mkRoom(CHARS);
  console.log("fighters:", Object.keys(api.tFighters).length, "enemies:", Object.keys(api.tEnemies).length, "phase:", api.pve.phase, "status:", api.pve.status, "active:", api.tActivePlayerCount());
  const dt=1/30;
  for(let i=0;i<300;i++){
    for(const sl of Object.keys(api.tFighters)){ const f=api.tFighters[sl]; if(OM.players[sl]) OM.players[sl].input=ctrl(f,i*dt); }
    api.tPveUpdateHost(dt);
  }
  const f1=api.tFighters.p1, eids=Object.keys(api.tEnemies);
  console.log("10s 후: enemies", eids.length, "bullets", api.tBullets.length, "zones", api.skillZones.length);
  console.log("p1:", JSON.stringify({x:Math.round(f1.x),y:Math.round(f1.y),hp:f1.hp,ammo:f1.ammo,cd:Math.round((f1.cooldown||0)*100)/100,dead:f1.dead,inactive:f1.inactive}));
  if(eids[0]){ const e=api.tEnemies[eids[0]]; console.log("enemy0:", JSON.stringify({x:Math.round(e.x),y:Math.round(e.y),hp:e.hp,type:e.type})); }
  console.log("p1 ctrl:", JSON.stringify(ctrl(f1,0)));
  console.log("p1 OM.input:", JSON.stringify(OM.players.p1 && OM.players.p1.input));
  process.exit(0);
}
console.log("======== A) 미시 측정(실게임 코드) ========");
console.log("캐릭터 | Z원거리(0.8R) DPS | Z근접(110px) DPS | X: 8마리 총피해/명중/둔화초 | C: 총피해/명중/빙결초/둔화초");
for(const cid of CHARS){
  const z=microZ(cid), x=microX(cid), c=microC(cid);
  console.log(`${NAME[cid]}\t원 ${z.far.dps} (ttk${z.far.ttk200})\t근 ${z.near.dps} (ttk${z.near.ttk200})\t| X ${x.xDmg}dmg/${x.xTargets}명 slow${x.slowSec}s\t| C ${c.cDmg}dmg/${c.cTargets}명 frz${c.freezeSec}s slow${c.slowSec}s`);
}
const heal=microHeal();
console.log(`모아 회복 실측: C 전체회복 ${heal.cHeal} · X 구급상자 ${heal.xHeal}`);

console.log("\n======== B) 솔로 스테이지1 (1인 스케일) 상한 150s ========");
for(const cid of CHARS){
  const r=runParty([cid],150,"solo-"+NAME[cid]);
  const st=r.S.p1;
  console.log(`${NAME[cid]}\t ${r.status==="playing"?("진행중 s"+r.stage+"w"+r.wave):r.status} t=${r.time}s 남은라이프${r.lives} | 킬점수${st.score} 사망${st.deaths} 피해${Math.round(st.dmgTaken)} X${st.xUse} C${st.cUse}`);
}

console.log("\n======== C) 6인 파티 풀런 상한 480s × 3회(RNG 민감) ========");
const agg={}; for(const c of CHARS) agg[c]={score:0,deaths:0,dmg:0,heal:0,x:0,c:0};
for(let rep=1;rep<=3;rep++){
  const r=runParty(CHARS,480,"party6-"+rep);
  console.log(`run${rep}: ${r.status} 도달 s${r.stage}w${r.wave} t=${r.time}s 라이프${r.lives} 빙결${r.freezeSec}s 둔화${r.slowSec}s | ` + r.waveLog.slice(-3).map(w=>`s${w.stage}w${w.wave}@${w.t}`).join(" "));
  for(const sl in r.S){ const st=r.S[sl]; const a=agg[st.cid]; a.score+=st.score; a.deaths+=st.deaths; a.dmg+=st.dmgTaken; a.heal+=st.healGot; a.x+=st.xUse; a.c+=st.cUse; }
}
console.log("캐릭터 | 평균킬점수 | 사망 | 받은피해 | 받은회복 | X | C  (3회 합산/3)");
for(const c of CHARS){ const a=agg[c];
  console.log(`${NAME[c]}\t${r1(a.score/3)}\t${r1(a.deaths/3)}\t${Math.round(a.dmg/3)}\t${Math.round(a.heal/3)}\t${r1(a.x/3)}\t${r1(a.c/3)}`);
}
const pr=runParty(CHARS,1,"skip");
console.log(`결과: ${pr.status} · 도달 s${pr.stage}w${pr.wave} · ${pr.time}s · 남은라이프 ${pr.lives} · 빙결누적 ${pr.freezeSec}s · 둔화누적 ${pr.slowSec}s`);
console.log("슬롯 | 캐릭터 | 킬점수 | 사망 | 받은피해 | 받은회복 | X사용 | C사용");
for(const sl of Object.keys(pr.S)){ const st=pr.S[sl];
  console.log(`${sl}\t${NAME[st.cid]}\t${st.score}\t${st.deaths}\t${Math.round(st.dmgTaken)}\t${Math.round(st.healGot)}\t${st.xUse}\t${st.cUse}`);
}
console.log("웨이브 타임라인:", pr.waveLog.map(w=>`s${w.stage}w${w.wave}@${w.t}s`).join(" "));
