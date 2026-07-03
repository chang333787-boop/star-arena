// v1.24 PRD 12.6 체크포인트 재도전 스모크 (harness_pve.js 부트스트랩 재사용)
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
  function fire(){ for(const l of listeners.slice()){ try{ l.cb({val:()=>clone(getAt(l.path))}); }catch(e){ console.log("listener err",e.message); } } }
  function thenable(v){ return { then(cb){ try{cb&&cb(v);}catch(e){console.log("then err",e.message);} return thenable(v);}, catch(){return this;} }; }
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
s+=`;globalThis.__p={ OM:OnlineManager, emptyInput, setState:(v)=>{gameState=v;}, get state(){return gameState;}, STATE,
  tStartMatch, tHurtPlayer, get tFighters(){return tFighters;}, get tEnemies(){return tEnemies;}, get pve(){return tPve;},
  setStage:(i)=>{tPve.stageIndex=i; tPve.waveIndex=0;}, PVE_STAGES, killAll:()=>{ for(const id in tEnemies) delete tEnemies[id]; },
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;} };`;
let api; try{ (0,eval)(s); api=globalThis.__p; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let ts=0; const F=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM;
let code=null;

console.log("=== 준비: PVE 방 2인 시작 ===");
run("setup", ()=>{
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB(); api.setSel("lumi","star_blaster");
  OM.createTeamRoom("onlinePve6",(ok,info)=>{ if(ok) code=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  rr.child("players/p2").set({uid:"p2",nickname:"p2",slot:"p2",team:"pve",characterId:"bolt",weaponId:"star_blaster",connected:true,input:api.emptyInput()});
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  check("시작 시 checkpoint 없음", api.pve.checkpoint===null && api.pve.retryUsed===false);
});

console.log("=== 체크포인트 이전(스테이지 1~5) 실패 → 재도전 없이 즉시 실패 ===");
run("no-checkpoint fail", ()=>{
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; f.lives=0; f.invincibleTimer=0; if(!f.dead) api.tHurtPlayer(f,99999); }
  F(3);
  check("즉시 실패(재도전 없음)", api.pve.status==="failed" && api.state===api.STATE.ONLINE_OVER);
});

console.log("=== 재시작 후 s5 보스 클리어 → 체크포인트 저장 ===");
run("checkpoint save", ()=>{
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();      // 새 판
  check("재시작 후 checkpoint 초기화", api.pve.checkpoint===null && api.pve.retryUsed===false);
  api.setStage(4); api.killAll(); F(3);                          // s5(보스, 웨이브1개) 전멸 처리
  check("stageclear 진입", api.pve.phase==="stageclear");
  F(650);                                                        // 강화 자동선택(9s) 경과
  check("s6 진행(stageIndex=5)", api.pve.stageIndex===5);
  check("checkpoint=5 저장", api.pve.checkpoint===5);
  check("retryUsed=false", api.pve.retryUsed===false);
  check("s6 적 스폰", Object.keys(api.tEnemies).length>0);
});

console.log("=== 실패 → 체크포인트 재도전(목숨1·체력50%·강화 유지) ===");
run("retry", ()=>{
  api.setStage(7); api.killAll(); F(3);                          // s8 진행 중이라 치고
  F(200);                                                        // 다음 웨이브 스폰 대기
  api.tFighters.p1._marker="perk-kept";                          // 강화 유지 검증용(파이터 객체 보존)
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; f.lives=0; f.invincibleTimer=0; if(!f.dead) api.tHurtPlayer(f,99999); }
  F(3);
  check("실패 대신 retry 페이즈", api.pve.phase==="retry");
  check("status는 playing 유지", api.pve.status==="playing");
  check("stageIndex가 체크포인트(5)로", api.pve.stageIndex===5);
  check("retryUsed=true", api.pve.retryUsed===true);
  check("적 없음(연출 중)", Object.keys(api.tEnemies).length===0);
  F(200);                                                        // 3초 경과 → 재개
  check("재개: phase=wave", api.pve.phase==="wave");
  check("s6부터 재시작(stageIndex=5)", api.pve.stageIndex===5);
  check("적 스폰", Object.keys(api.tEnemies).length>0);
  const p1=api.tFighters.p1, p2=api.tFighters.p2;
  check("전원 부활", !p1.dead && !p2.dead);
  check("목숨 1개씩", p1.lives===1 && p2.lives===1);
  check("체력 50%", Math.abs(p1.hp-p1.maxHp*0.5)<1 && Math.abs(p2.hp-p2.maxHp*0.5)<1);
  check("강화(파이터 객체) 유지", p1._marker==="perk-kept");
});

console.log("=== 두 번째 실패 → 이번엔 진짜 실패 ===");
run("second fail", ()=>{
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; f.lives=0; f.invincibleTimer=0; if(!f.dead) api.tHurtPlayer(f,99999); }
  F(3);
  check("재도전 소진 → failed", api.pve.status==="failed" && api.state===api.STATE.ONLINE_OVER);
});

console.log("=== 새 체크포인트 도달 시 재도전 리필 ===");
run("refill", ()=>{
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  api.setStage(4); api.killAll(); F(3); F(650);                  // s5 클리어 → cp=5
  for(const sl in api.tFighters){ const f=api.tFighters[sl]; f.lives=0; f.invincibleTimer=0; if(!f.dead) api.tHurtPlayer(f,99999); }
  F(3); F(200);                                                  // 재도전 1회 사용
  check("retryUsed=true", api.pve.retryUsed===true);
  api.setStage(9); api.killAll(); F(3); F(650);                  // s10 보스 클리어 → cp=10, 리필
  check("checkpoint=10", api.pve.checkpoint===10);
  check("재도전 리필(retryUsed=false)", api.pve.retryUsed===false);
});

console.log(fails===0 ? "\n결과: ALL PASS ✅" : ("\n결과: "+fails+"건 실패 ❌"));
process.exit(fails===0?0:1);
