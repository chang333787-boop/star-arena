// 온라인 6인 협동 PVE mock DB 테스트
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
  function fire(){ for(const l of listeners.slice()){ try{ l.cb({val:()=>clone(getAt(l.path))}); }catch(e){ console.log("listener err",e.message,e.stack); } } }
  function thenable(v){ return { then(cb){ try{cb&&cb(v);}catch(e){console.log("then err",e.message,e.stack);} return thenable(v);}, catch(){return this;} }; }
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
s+=`;globalThis.__p={ OM:OnlineManager, profile:()=>profile, keysDown, emptyInput,
  setState:(v)=>{gameState=v;}, get state(){return gameState;}, STATE,
  tStartMatch, tPveUpdateBullets, tHurtPlayer, tActivePlayerCount, tPveGetDrawData, GAME_CONFIG, pushBullet:(b)=>{tBullets.push(b);},
  castUlt:(f)=>castUltimateFor(f, envTeam(), ()=>f.superGauge||0, v=>{f.superGauge=v;}),
  castSp:(f)=>castSpecialFor(f, envTeam()), tickZones:(dt)=>tickSkillZones(dt, envTeam()),
  get skillZones(){return skillZones;}, getAbility, magSizeOf,
  get tFighters(){return tFighters;}, get tEnemies(){return tEnemies;}, get pve(){return tPve;}, get tBullets(){return tBullets;},
  PVE_STAGES, PVE_ENEMY_TYPES,
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;} };`;
let api; try{ (0,eval)(s); api=globalThis.__p; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let ts=0; const F=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM;
let code=null;

console.log("=== PVE 방 생성 ===");
run("createTeamRoom(onlinePve6)", ()=>{
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB(); api.setSel("lumi","star_blaster");
  OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok) code=info; });
  check("방 생성됨", !!code);
  check("mode=onlinePve6", OM.mode==="onlinePve6");
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("p1 team=pve", room.players.p1.team==="pve");
});

console.log("=== 3명 입장 + 시작(스테이지1 웨이브1) ===");
run("start pve", ()=>{
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  rr.child("players/p2").set({uid:"p2",nickname:"p2",slot:"p2",team:"pve",characterId:"bolt",weaponId:"star_blaster",connected:true,input:api.emptyInput()});
  rr.child("players/p3").set({uid:"p3",nickname:"p3",slot:"p3",team:"pve",characterId:"nova",weaponId:"star_blaster",connected:true,input:api.emptyInput()});
  api.setState(api.STATE.ONLINE_LOBBY);
  api.tStartMatch();
  check("state=online_playing", api.state===api.STATE.ONLINE_PLAYING);
  check("플레이어 3명", Object.keys(api.tFighters).length===3);
  check("모두 pve팀", Object.keys(api.tFighters).every(s=>api.tFighters[s].team==="pve"));
  check("적 생성됨(웨이브1)", Object.keys(api.tEnemies).length>0);
  check("개인 목숨 5개씩 지급(PRD 12.2, 3인 합계 15)", api.pve.teamLives===15 && api.tFighters.p1.lives===5);
  check("phase=wave", api.pve.phase==="wave");
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("state.enemies 기록", !!(room.state&&room.state.enemies));
  check("state.pve 기록", !!(room.state&&room.state.pve));
});

console.log("=== 플레이어 탄환이 적에게 피해/처치 ===");
run("적 처치 + 점수", ()=>{
  const ids=Object.keys(api.tEnemies); const eid=ids[0]; const e=api.tEnemies[eid];
  const score0=api.tFighters.p1.score;
  api.pushBullet({x:e.x,y:e.y,vx:0,vy:0,r:9,damage:99999,team:"pve",owner:"p1",color:"#fff",alive:true,traveled:0,maxRange:500});
  api.tPveUpdateBullets(0.016);
  check("적 처치됨", !api.tEnemies[eid]);
  check("처치자 점수 증가", api.tFighters.p1.score>score0);
});

console.log("=== 웨이브 진행 ===");
run("웨이브 클리어 → 다음 웨이브", ()=>{
  for(const id in api.tEnemies) delete api.tEnemies[id]; // 남은 적 전멸 시뮬
  const w0=api.pve.waveIndex;
  F(150); // gap 2s 경과
  check("웨이브 인덱스 증가", api.pve.waveIndex===w0+1);
  check("다음 웨이브 적 생성", Object.keys(api.tEnemies).length>0);
});

console.log("=== 적 AI 프레임 안전 ===");
run("적 AI 다수 프레임", ()=>{ F(30); check("프레임 진행 안전", true); });

console.log("=== 개인 목숨 0 → 관전 → 전원 소진 시 실패 (PRD 12.2) ===");
run("개인 목숨 소진 시 실패", ()=>{
  // 모든 파이터 부활/무적해제 후 마지막 목숨 상태로
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; f.dead=false; f.hp=f.maxHp; f.invincibleTimer=0; f.lives=1; }
  api.tHurtPlayer(api.tFighters.p1, 99999);
  check("플레이어 사망", api.tFighters.p1.dead===true);
  check("개인 목숨 0(자기 것만 소비)", api.tFighters.p1.lives===0);
  check("다른 플레이어 목숨은 그대로(1)", api.tFighters.p2.lives===1);
  F(2);
  check("남은 플레이어가 있으면 실패 아님", api.pve.status==="playing");
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; if(!f.dead) api.tHurtPlayer(f, 99999); }   // 전원 소진
  F(2);
  check("실패 처리(online_over)", api.state===api.STATE.ONLINE_OVER);
  check("pve.status=failed", api.pve.status==="failed");
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("meta.status=ended", room.meta.status==="ended");
});

console.log("=== connected=false 플레이어 비활성(타겟/피해/팀라이프 제외) ===");
run("끊긴 PVE 플레이어 제외", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("lumi","star_blaster");
  let c=null; OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok) c=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+c);
  rr.child("players/p2").set({uid:"p2",nickname:"p2",slot:"p2",team:"pve",characterId:"bolt",weaponId:"star_blaster",connected:true,input:api.emptyInput()});
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  check("끊기 전 active=2", api.tActivePlayerCount()===2);
  rr.child("players/p2/connected").set(false); // p2 연결 끊김
  F(2); // inactive 반영
  const p2=api.tFighters.p2;
  check("p2 inactive 처리", p2.inactive===true);
  check("active=1(끊긴 p2 제외, host 자신 유지)", api.tActivePlayerCount()===1);
  const lives0=api.pve.teamLives;
  api.tHurtPlayer(p2, 99999);
  check("끊긴 플레이어 직접 피해 무효", p2.dead!==true);
  check("끊긴 플레이어로 팀라이프 안 깎임", api.pve.teamLives===lives0);
  api.pushBullet({x:p2.x,y:p2.y,vx:0,vy:0,r:9,damage:9999,team:"enemy",owner:"e1",color:"#fff",alive:true,traveled:0,maxRange:500});
  api.tPveUpdateBullets(0.016);
  check("끊긴 플레이어 적 탄환 무효", p2.dead!==true && api.pve.teamLives===lives0);
});

console.log("=== 렉 최적화: 게스트가 적 color/r을 type으로 역산 ===");
run("lean enemy state → color/r/boss 복원", ()=>{
  OM.leaveRoom(); OM.role="guest"; OM.mode="onlinePve6"; OM.mySlot="p2"; OM.roomRef=null;
  OM.players={ p1:{slot:"p1",team:"pve",characterId:"student_01",connected:true},
               p2:{slot:"p2",team:"pve",characterId:"student_02",connected:true} };
  OM.onlineState={ timeLeft:0,
    fighters:{ p2:{x:200,y:200,hp:80,facing:0,dead:false,inv:false} },
    enemies:{ e1:{x:500,y:300,hp:60,maxHp:60,facing:1,type:"tank",dead:false},
              e2:{x:700,y:300,hp:900,maxHp:900,facing:1,type:"boss",dead:false} },
    bullets:[], pve:{ stageIndex:0, waveIndex:0, teamLives:10, status:"playing", phase:"wave", enemiesRemaining:2 } };
  const d=api.tPveGetDrawData();
  const e1=d.enemies.find(e=>e.type==="tank"), e2=d.enemies.find(e=>e.type==="boss");
  check("보스가 일반 적보다 큼(r)", api.PVE_ENEMY_TYPES.boss.r>=64 && api.PVE_ENEMY_TYPES.boss.r>api.PVE_ENEMY_TYPES.grunt.r);
  check("보스 r은 type으로 역산(전송량 유지)", e2 && e2.r===api.PVE_ENEMY_TYPES.boss.r);
  check("탱크 color 역산", e1 && e1.color===api.PVE_ENEMY_TYPES.tank.color);
  check("탱크 r 역산", e1 && e1.r===api.PVE_ENEMY_TYPES.tank.r);
  check("보스 boss 플래그 역산", e2 && e2.boss===true);
  check("내 파이터 charId 역산", d.fighters.length===1 && d.fighters[0].charId==="student_02");
  OM.role=null; OM.mode=null; OM.mySlot=null; OM.onlineState=null; OM.players={host:null,guest:null};
});

console.log("=== C 궁극기(PVE): 적에게 피해 + 게이지 (v1.18) ===");
run("눈꽃 C(얼음 깨기)로 주변 적 빙결→파괴 피해", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("student_04","tool_04"); // 눈꽃
  let c=null; OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok)c=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  const me=api.tFighters.p1;
  check("p1 ultName=꽁꽁 얼음 깨기", me.char.ultName==="꽁꽁 얼음 깨기");
  // 적 하나를 내 옆에 강제 배치
  const ids=Object.keys(api.tEnemies); const eid=ids[0]; const e=api.tEnemies[eid];
  e.x=me.x+30; e.y=me.y; const ehp0=e.hp;
  me.superGauge=api.GAME_CONFIG.superCharge;
  api.castUlt(me);
  check("일반 몬스터 즉시 빙결(1초)", e.freezeTimer>0);
  api.tickZones(1.05);   // 빙결 종료 → 파괴 피해 30
  check("적 피해/처치됨", !api.tEnemies[eid] || api.tEnemies[eid].hp<ehp0);
  check("사용 후 게이지 0", me.superGauge===0);
});
run("별골렘 C(블랙홀): 적 끌어당김 + 지속 피해", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("student_06","tool_06"); // 별골렘
  let c=null; OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok)c=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  const me=api.tFighters.p1; me.facing=0;
  const ids=Object.keys(api.tEnemies); const eid=ids[0]; const e=api.tEnemies[eid];
  const A=api.getAbility("student_06").c;
  e.x=me.x+A.dist+80; e.y=me.y; const ex0=e.x, ehp0=e.hp;   // 블랙홀 중심(+220)에서 80 떨어진 곳
  me.superGauge=api.GAME_CONFIG.superCharge;
  api.castUlt(me);
  check("블랙홀 장판 생성", api.skillZones.some(z=>z.type==="blackhole"));
  api.tickZones(0.5);
  check("적이 중심 쪽으로 끌려옴", e.x<ex0);
  api.tickZones(0.6);   // 누적 1.1초 → 1틱 피해(6)
  check("지속 피해 적용", (api.tEnemies[eid]?api.tEnemies[eid].hp:0)<ehp0);
  check("사용 후 게이지 0", me.superGauge===0);
});
run("탄창: PVE 플레이어 무기별 ammo 보유", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("student_04","tool_04");
  let c=null; OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok)c=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  check("p1 탄창=눈꽃 12발", api.tFighters.p1.ammo===12 && api.magSizeOf(api.tFighters.p1)===12);
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
