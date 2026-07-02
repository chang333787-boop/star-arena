// 온라인 1대1 베타 테스트: (1)Firebase null 안전 (2)host 시뮬 (3)mock-DB 통합
const fs=require("fs"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"AB12"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>{ return 0; }; // 테스트에서 지연 콜백은 무시

// ---- mock Firebase (동기 thenable + 공유 인메모리 트리) ----
const TS={".sv":"timestamp"};
function makeMockDB(){
  const data={}; const listeners=[];
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function resolveTS(v){ if(v===TS) return 111111; if(v&&typeof v==="object"){ for(const k in v) v[k]=resolveTS(v[k]); } return v; }
  function getAt(path){ const parts=path.split("/").filter(Boolean); let n=data; for(const p of parts){ if(n==null)return null; n=n[p]; } return n===undefined?null:n; }
  function setAt(path,val){ const parts=path.split("/").filter(Boolean); if(!parts.length)return; let n=data; for(let i=0;i<parts.length-1;i++){ if(typeof n[parts[i]]!=="object"||n[parts[i]]==null)n[parts[i]]={}; n=n[parts[i]]; } if(val===null) delete n[parts[parts.length-1]]; else n[parts[parts.length-1]]=val; }
  function fire(){ for(const l of listeners.slice()){ try{ l.cb({val:()=>clone(getAt(l.path))}); }catch(e){ console.log("listener err",e.message); } } }
  function thenable(val){ return { then(cb){ try{cb&&cb(val);}catch(e){console.log("then err",e.message);} return thenable(val);}, catch(){return this;} }; }
  function ref(path){ path=path||""; return {
    _path:path,
    child(c){ return ref(path?path+"/"+c:c); },
    set(v){ setAt(path, resolveTS(clone(v))); fire(); return thenable(); },
    update(obj){ for(const k in obj) setAt(path+"/"+k, resolveTS(clone(obj[k]))); fire(); return thenable(); },
    get(){ return thenable({val:()=>clone(getAt(path))}); },
    on(ev,cb){ const l={path,cb}; listeners.push(l); cb({val:()=>clone(getAt(path))}); return cb; },
    off(ev,cb){ for(let i=listeners.length-1;i>=0;i--) if(listeners[i].cb===cb) listeners.splice(i,1); },
    onDisconnect(){ return { set(){return thenable();}, update(){return thenable();}, remove(){return thenable();}, cancel(){return thenable();} }; },
    remove(){ setAt(path,null); fire(); return thenable(); }
  }; }
  return { ref, _data:data };
}
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database: Object.assign(()=>null,{ ServerValue:{ TIMESTAMP:TS } }) };

// ---- 스크립트 로드 + 내부 노출 ----
const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__api={
  OnlineManager, profile:()=>profile, keysDown, emptyInput, handleKeyPress, openOnlineMenu,
  resetOnlineMatchFromRoom, hostStartOnlineMatch, updateOnline, renderOnlineMatch, drawOnlineMenu, drawOnlineLobby, drawOnlineOver,
  applyOnlineDamage, computeOnlineResultText, getOnlineDrawData,
  get state(){return gameState;}, setState:(v)=>{gameState=v;}, STATE, setMenuIndex:(i)=>{menuIndex=i;},
  get fighters(){return onlineFighters;}, get bullets(){return onlineBullets;},
  predictBullets:()=>onlinePredictBullets, predict:()=>onlinePredict, predictCd:()=>onlinePredictCd,
  setTime:(v)=>{onlineTimeLeft=v;}, get time(){return onlineTimeLeft;},
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  readLocalInput, GAME_CONFIG, myCombatStatus
};`;
let api; try{ (0,eval)(s); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let ts=0; const F=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn();}catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };

console.log("=== A) FIREBASE_CONFIG=null 안전 ===");
check("초기 available=false", api.OnlineManager.available===false);
run("온라인 메뉴 진입/렌더", ()=>{ api.openOnlineMenu(); check("state=online_menu", api.state===api.STATE.ONLINE_MENU); F(3); });
run("메뉴에서 Esc → start", ()=>{ api.handleKeyPress("Escape"); check("state=start", api.state===api.STATE.START); });
run("로비 '온라인 센터'(row1) Enter → online_menu(소프트락 아님)", ()=>{
  api.setState(api.STATE.START); api.setMenuIndex(1); api.handleKeyPress("Enter");  // 새 로비: row1=온라인 센터
  check("Enter로 online_menu 진입", api.state===api.STATE.ONLINE_MENU);
  api.handleKeyPress("Escape"); check("다시 Esc로 탈출", api.state===api.STATE.START);
});
run("로비 'O' 단축키 → online_menu", ()=>{
  api.setState(api.STATE.START); api.handleKeyPress("KeyO");
  check("O로 online_menu 진입", api.state===api.STATE.ONLINE_MENU);
  api.handleKeyPress("Escape");
});

console.log("=== B) host 시뮬레이션 (DB 없이) ===");
run("host 매치 시작 & 이동/발사", ()=>{
  const OM=api.OnlineManager;
  OM.available=true; OM.role="host"; OM.uid="hostUID"; OM.roomRef=null; // DB write는 try/catch로 무시됨
  OM.meta={ characterHost:"lumi", characterGuest:"nova", weaponHost:"stardust", weaponGuest:"star_blaster", status:"playing" };
  OM.players={ host:{connected:true,input:api.emptyInput()}, guest:{connected:true,input:api.emptyInput()} };
  OM.onlineInput={ host:api.emptyInput(), guest:api.emptyInput() };
  api.resetOnlineMatchFromRoom();
  api.setState(api.STATE.ONLINE_PLAYING);
  const h0x=api.fighters.host.x;
  api.keysDown.add("ArrowRight"); api.keysDown.add("KeyZ");
  F(30);
  check("host 이동함", api.fighters.host.x!==h0x);
  check("탄환 생성됨", api.bullets.length>0);
  api.keysDown.clear();
});
run("피해/점수/리스폰", ()=>{
  const g=api.fighters.guest;
  api.applyOnlineDamage(g, 99999, "host");
  check("guest 사망", g.dead===true);
  check("host 점수 +1", api.fighters.host.score===1);
  F(220); // 3초 경과
  check("guest 리스폰", api.fighters.guest.dead===false);
});
run("끊긴 guest 유령 입력 무시", ()=>{
  // 새 매치 준비
  const OM=api.OnlineManager;
  api.resetOnlineMatchFromRoom();
  api.setState(api.STATE.ONLINE_PLAYING);
  // guest가 right+attack 누른 채 연결 끊김
  OM.players={ host:{connected:true,input:api.emptyInput()}, guest:{connected:false,input:{up:false,down:false,left:false,right:true,attack:true,super:false}} };
  OM.onlineInput={ host:api.emptyInput(), guest:{up:false,down:false,left:false,right:true,attack:true,super:false} };
  const gx0=api.fighters.guest.x;
  const nb0=api.bullets.length;
  F(30);
  check("끊긴 guest 이동 안 함", Math.abs(api.fighters.guest.x-gx0)<0.001);
  check("끊긴 guest 발사 안 함(탄환 증가 없음 또는 host만)", api.bullets.every(b=>b.owner==="host"));
});
run("시간 종료 → online_over", ()=>{
  api.setTime(0.005);
  F(2);
  check("state=online_over", api.state===api.STATE.ONLINE_OVER);
});
run("결과 텍스트 계산", ()=>{ const t=api.computeOnlineResultText(); check("결과 텍스트 존재", typeof t==="string" && t.length>0); });

console.log("=== E) 온라인 X/C(1v1) — v1.18 ===");
run("X/C 입력이 input.special/ultimate에 포함", ()=>{
  api.keysDown.clear(); api.keysDown.add("KeyX");
  check("readLocalInput.special=true", api.readLocalInput().special===true);
  api.keysDown.clear(); api.keysDown.add("KeyC");
  check("readLocalInput.ultimate=true", api.readLocalInput().ultimate===true);
  api.keysDown.clear(); check("떼면 둘 다 false", api.readLocalInput().special===false && api.readLocalInput().ultimate===false);
});
run("R 입력이 input.reload에 포함(온라인 장전 전송)", ()=>{
  api.keysDown.clear(); api.keysDown.add("KeyR");
  check("readLocalInput.reload=true", api.readLocalInput().reload===true);
  check("emptyInput.reload=false 존재", api.emptyInput().reload===false);
  api.keysDown.clear();
  // host 시뮬: 탄창 일부 소비 후 R → host가 장전 시작
  const OM=api.OnlineManager;
  OM.available=true; OM.role="host"; OM.uid="hostUID"; OM.roomRef=null;
  OM.meta={ characterHost:"student_02", characterGuest:"nova", weaponHost:"star_blaster", weaponGuest:"star_blaster", status:"playing" };   // v1.21: 럭키는 무한 탄창 → 달이로 장전 검증
  OM.players={ host:{connected:true,input:api.emptyInput()}, guest:{connected:true,input:api.emptyInput()} };
  OM.onlineInput={ host:api.emptyInput(), guest:api.emptyInput() };
  api.resetOnlineMatchFromRoom(); api.setState(api.STATE.ONLINE_PLAYING);
  api.fighters.host.ammo=3; api.fighters.host.reloading=false;
  api.keysDown.add("KeyR"); F(2); api.keysDown.clear();
  check("R로 host 장전 시작됨", api.fighters.host.reloading===true);
});
run("게이지 가득→C(럭키 별빛 일곱 발)로 상대 피해, 자기 무피해, 게이지 0", ()=>{
  const OM=api.OnlineManager;
  OM.available=true; OM.role="host"; OM.uid="hostUID"; OM.roomRef=null;
  OM.meta={ characterHost:"student_01", characterGuest:"student_02", status:"playing" };
  OM.players={ host:{connected:true,input:api.emptyInput()}, guest:{connected:true,input:api.emptyInput()} };
  OM.onlineInput={ host:api.emptyInput(), guest:api.emptyInput() };
  api.resetOnlineMatchFromRoom(); api.setState(api.STATE.ONLINE_PLAYING);
  const H=api.fighters.host, G=api.fighters.guest;
  H.facing=0; G.x=H.x+60; G.y=H.y; G.invincibleTimer=0;  // 상대를 정면 가까이에(탄이 몇 프레임 안에 명중)
  const ghp0=G.hp, hhp0=H.hp;
  H.superGauge=api.GAME_CONFIG.superCharge;               // 게이지 가득
  api.keysDown.add("KeyC"); F(8); api.keysDown.clear();
  check("상대(guest) 피해 받음", G.hp<ghp0);
  check("자기(host) 무피해", H.hp===hhp0);
  check("사용 후 게이지 0", H.superGauge===0);
  check("C 피해로 게이지 재충전 안 됨", H.superGauge===0);
});
run("게이지 부족 시 미발동", ()=>{
  api.resetOnlineMatchFromRoom(); api.setState(api.STATE.ONLINE_PLAYING);
  const H=api.fighters.host, G=api.fighters.guest;
  H.facing=0; G.x=H.x+60; G.y=H.y; G.invincibleTimer=0; const ghp0=G.hp;
  H.superGauge=api.GAME_CONFIG.superCharge-1;           // 1 부족
  api.keysDown.add("KeyC"); F(8); api.keysDown.clear();
  check("게이지 부족이면 상대 무피해", G.hp===ghp0);
  check("게이지 그대로 유지", H.superGauge===api.GAME_CONFIG.superCharge-1);
});
run("내 HUD 정보(캐릭터/도구/탄창/궁극기) 노출", ()=>{
  const OM=api.OnlineManager;
  OM.available=true; OM.role="host"; OM.uid="hostUID"; OM.roomRef=null;
  OM.meta={ characterHost:"lumi", characterGuest:"nova", weaponHost:"star_blaster", weaponGuest:"star_blaster", status:"playing" };
  OM.players={ host:{connected:true,input:api.emptyInput()}, guest:{connected:true,input:api.emptyInput()} };
  OM.onlineInput={ host:api.emptyInput(), guest:api.emptyInput() };
  api.resetOnlineMatchFromRoom(); api.setState(api.STATE.ONLINE_PLAYING);
  const s=api.myCombatStatus();
  check("HUD 상태 객체 존재", !!s);
  check("캐릭터 이름 포함", typeof s.charName==="string" && s.charName.length>0);
  check("도구 이름 포함", typeof s.toolName==="string" && s.toolName.length>0);
  check("탄창/궁극기 포함", typeof s.ammo==="number" && typeof s.sg==="number" && typeof s.superName==="string");
});
run("기본 공격 명중 시 게이지 충전", ()=>{
  api.resetOnlineMatchFromRoom(); api.setState(api.STATE.ONLINE_PLAYING);
  const H=api.fighters.host, G=api.fighters.guest; H.superGauge=0; G.invincibleTimer=0;
  api.applyOnlineDamage(G, 5, "host", false);          // 기본 공격(비궁극기)
  check("명중 시 게이지 증가", H.superGauge>0);
  const sg1=H.superGauge;
  api.applyOnlineDamage(G, 5, "host", true);            // 궁극기 피해는 충전 안 함
  check("궁극기 피해는 충전 제외", H.superGauge===sg1);
});

console.log("=== C) guest 렌더 ===");
run("guest가 state로 렌더", ()=>{
  const OM=api.OnlineManager;
  OM.role="guest";
  OM.onlineState={ timeLeft:55, host:{x:300,y:300,hp:80,maxHp:100,facing:0,score:1,dead:false,inv:false,charId:"lumi"},
    guest:{x:900,y:300,hp:60,maxHp:100,facing:3.14,score:0,dead:false,inv:false,charId:"nova"}, bullets:[{x:500,y:300,r:9,c:"#ffe066"}] };
  api.setState(api.STATE.ONLINE_PLAYING);
  const d=api.getOnlineDrawData();
  check("guest drawData host/guest 존재", !!d.host && !!d.guest);
  F(3); // renderOnlineMatch 호출됨
  // 보간: 새 스냅샷에서 host가 300→900으로 점프하면 한 프레임 뒤엔 그 중간 어딘가여야 함(부드럽게)
  OM.onlineState={ timeLeft:54, host:{x:900,y:300,hp:80,maxHp:100,facing:0,score:1,dead:false,inv:false,charId:"lumi"},
    guest:{x:900,y:300,hp:60,maxHp:100,facing:3.14,score:0,dead:false,inv:false,charId:"nova"}, bullets:[] };
  F(1);
  const d2=api.getOnlineDrawData();
  check("상대 위치 보간(점프 대신 중간값)", d2.host.x>305 && d2.host.x<895);
  // 예측(스냅온리): 내 캐릭터는 스냅샷 안 바뀌어도 입력에 즉시 반응하고, 가속 없이 정확한 속도로만 이동
  OM.onlineState={ timeLeft:53, host:{x:300,y:300,hp:80,maxHp:100,facing:0,score:1,dead:false,inv:false,charId:"lumi"},
    guest:{x:500,y:300,hp:60,maxHp:100,facing:0,score:0,dead:false,inv:false,charId:"nova"}, bullets:[] };
  F(2);
  api.keysDown.clear(); api.keysDown.add("ArrowRight");
  F(10);
  const d3=api.getOnlineDrawData();
  api.keysDown.clear();
  const moved=d3.guest.x-500;
  // 10프레임(~0.167s) 동안 노바 속도(225)면 이론상 ~37px. 가속이면 이보다 훨씬 큼.
  check("내 캐릭터 즉시 반응(예측)", moved>5);
  check("가속 없음(이동량이 정상 속도 범위)", moved<60);
  // 발사 예측: 깨끗한 상태에서, 빈 공간을 향해 발사 → 내 총알 즉시 생성, 권한값의 내 총알은 가려 중복 방지
  api.resetOnlineMatchFromRoom();
  OM.role="guest";
  OM.onlineState={ timeLeft:52,
    host:{x:1100,y:600,hp:80,maxHp:100,facing:0,score:1,dead:false,inv:false,charId:"lumi"},
    guest:{x:200,y:300,hp:60,maxHp:100,facing:-1.5708,score:0,dead:false,inv:false,charId:"nova"},  // 위쪽(빈 공간) 조준
    bullets:[{x:1000,y:600,r:9,c:"#fff",o:"host",vx:0,vy:0},{x:200,y:280,r:9,c:"#fff",o:"guest",vx:0,vy:0}] };
  api.setState(api.STATE.ONLINE_PLAYING);
  F(1); // 예측 위치/방향 초기화(위쪽)
  api.keysDown.clear(); api.keysDown.add("KeyZ");
  F(1); // 발사
  const d4=api.getOnlineDrawData();
  api.keysDown.clear();
  // 상대(host) 권한총알 1 + 내 예측총알 1 = 2. 내 권한총알(guest)은 가려져 3이 되면 안 됨.
  check("내 발사 즉시 표시 + 중복 없음", d4.bullets.length===2);
});

console.log("=== D) mock-DB 통합 (방 만들기/입장/시작/나가기) ===");
run("createRoom → guest join → start → leave", ()=>{
  const OM=api.OnlineManager;
  // leaveRoom으로 이전 상태 정리
  OM.leaveRoom();
  const mock=makeMockDB();
  OM.db=mock; OM.available=true; OM.uid="hostUID"; OM.role=null; OM.roomRef=null;
  api.setSel("lumi","star_blaster");
  let createdCode=null;
  OM.createRoom((ok,info)=>{ if(ok) createdCode=info; });
  check("방 생성됨", !!createdCode);
  check("역할 host", OM.role==="host");
  const roomData=mock._data.starArenaOnline.rooms[createdCode];
  check("meta.status=waiting", roomData.meta.status==="waiting");
  check("players.host 기록", !!roomData.players.host);
  // 원격 guest 입장 시뮬(다른 클라이언트가 트리에 쓴다)
  const rr=mock.ref("starArenaOnline/rooms/"+createdCode);
  rr.child("players/guest").set({ uid:"guestUID", nickname:"게스트", characterId:"nova", weaponId:"star_blaster", connected:true, input:api.emptyInput() });
  rr.child("meta").update({ status:"ready", guestUid:"guestUID", characterGuest:"nova" });
  check("host가 guest 인식", !!(OM.players && OM.players.guest));
  check("meta.status=ready 수신", OM.meta && OM.meta.status==="ready");
  // host 시작
  api.setState(api.STATE.ONLINE_LOBBY);
  api.hostStartOnlineMatch();
  check("state=online_playing", api.state===api.STATE.ONLINE_PLAYING);
  check("meta.status=playing 기록", roomData.meta.status==="playing");
  check("state.host 기록됨", !!roomData.state && !!roomData.state.host);
  // 몇 프레임 진행(상태 write)
  api.keysDown.add("ArrowLeft"); F(10); api.keysDown.clear();
  check("state.bullets 배열 존재", Array.isArray(roomData.state.bullets));
  // 나가기
  OM.leaveRoom();
  check("leave 후 roomRef null", OM.roomRef===null);
  check("leave 후 방 리스너 해제(연결감시 1개만 남음)", OM.unsubs.length<=1);
  check("leave 후 meta/players 초기화", OM.meta===null && OM.players.guest===null);
  F(5); // 나간 뒤 추가 프레임 안전
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
