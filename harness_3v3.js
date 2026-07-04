// 온라인 3대3 mock DB 테스트
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
    remove(){ setAt(p,null); fire(); return thenable(); },
    transaction(fn){
      // 실제 RTDB 동작 모사: 첫 호출은 캐시 미동기화로 null로 올 수 있고,
      // 그때 콜백이 undefined를 반환하면 트랜잭션이 영구 abort된다(= 입장 실패 버그 재현).
      const first=fn(null);
      if(first===undefined){ return thenable({committed:false,snapshot:{val:()=>clone(getAt(p))}}); }
      const cur=clone(getAt(p)); const res=fn(cur);
      if(res===undefined||res===null){ return thenable({committed:false,snapshot:{val:()=>clone(getAt(p))}}); }
      setAt(p,resolveTS(res)); fire(); return thenable({committed:true,snapshot:{val:()=>clone(getAt(p))}}); }
  }; }
  return { ref, _data:data };
}
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };

const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__t={ OM:OnlineManager, profile:()=>profile, keysDown, emptyInput, isTeamOnline, getOnlineMode,
  setState:(v)=>{gameState=v;}, get state(){return gameState;}, STATE,
  resetTeam:resetTeamMatchFromRoom, tStartMatch, tApplyDamage, tUpdateBullets, tGetDrawData,
  get tFighters(){return tFighters;}, get tBullets(){return tBullets;}, get tScores(){return tTeamScores;},
  setT:(v)=>{tTimeLeft=v;}, pushBullet:(b)=>{tBullets.push(b);}, GAME_CONFIG,
  castUlt:(f)=>castUltimateFor(f, envTeam(), ()=>f.superGauge||0, v=>{f.superGauge=v;}),
  castSp:(f)=>castSpecialFor(f, envTeam()), tickZones:(dt)=>tickSkillZones(dt, envTeam()),
  get skillZones(){return skillZones;}, getWeaponForCharacter,
  setMap:(m)=>{selectedMapId=m;profile.selectedMapId=m;}, getMap, MAPS, get tMapId(){return tMapId;}, get OBSTACLES(){return OBSTACLES;},
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;} };`;
let api; try{ (0,eval)(s); api=globalThis.__t; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let ts=0; const F=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM;

console.log("=== 3v3 방 생성/팀 배정 ===");
let code=null;
run("createTeamRoom(online3v3)", ()=>{
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB();
  api.setSel("lumi","star_blaster");
  OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok) code=info; });
  check("방 생성됨", !!code);
  check("mode=online3v3", OM.mode==="online3v3");
  check("host slot=p1", OM.mySlot==="p1");
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("meta.mode 기록", room.meta.mode==="online3v3");
  check("p1 team=blue", room.players.p1.team==="blue");
});

console.log("=== 6명 입장(3 blue / 3 red) → 시작 ===");
run("6명 채우고 시작", ()=>{
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  const mk=(slot,team)=>({uid:slot,nickname:slot,slot:slot,team:team,characterId:"lumi",weaponId:"star_blaster",connected:true,ready:false,isBot:false,input:api.emptyInput()});
  rr.child("players/p2").set(mk("p2","blue"));
  rr.child("players/p3").set(mk("p3","blue"));
  rr.child("players/p4").set(mk("p4","red"));
  rr.child("players/p5").set(mk("p5","red"));
  rr.child("players/p6").set(mk("p6","red"));
  api.setState(api.STATE.ONLINE_LOBBY);
  api.tStartMatch();
  check("state=online_playing", api.state===api.STATE.ONLINE_PLAYING);
  const fs2=api.tFighters; const slots=Object.keys(fs2);
  check("파이터 6명", slots.length===6);
  const blue=slots.filter(s=>fs2[s].team==="blue").length, red=slots.filter(s=>fs2[s].team==="red").length;
  check("blue 3 / red 3", blue===3 && red===3);
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("meta.status=playing", room.meta.status==="playing");
  check("state.fighters 기록(6)", room.state && Object.keys(room.state.fighters).length===6);
  // 네트워크 payload에는 이미지가 들어가지 않음
  const json=JSON.stringify(room.state);
  check("state에 이미지/에셋 객체 없음", !/\"(img|image|asset|assetId|sprite|png)\"/i.test(json) && json.indexOf(".png")<0);
  // 렉 최적화: 정적 필드(charId/team/slot/maxHp/score)는 매 틱 전송하지 않음(로스터로 역산)
  let lean=true; for(const sl in room.state.fighters){ const f=room.state.fighters[sl];
    if("charId" in f || "team" in f || "slot" in f || "maxHp" in f || "score" in f) lean=false; }
  check("파이터 패킷은 동적값만(charId/team/maxHp 미전송)", lean);
  // 동적 핵심값은 들어있어야 함
  let dyn=true; for(const sl in room.state.fighters){ const f=room.state.fighters[sl]; if(!("x" in f)||!("hp" in f)||!("facing" in f)) dyn=false; }
  check("파이터 패킷에 x/hp/facing 존재", dyn);
  // 탄환 패킷도 owner/team 제외
  const b0=(room.state.bullets&&room.state.bullets[0]);
  check("탄환 패킷에 owner/team 미전송", !b0 || (!("o" in b0) && !("team" in b0)));
  check("state.powerups 배열 존재", Array.isArray(room.state.powerups));
});

console.log("=== 팀 피해/점수/아군오사 ===");
run("팀 기반 피해 판정", ()=>{
  const fs2=api.tFighters; const slots=Object.keys(fs2);
  const blueF=fs2[slots.find(s=>fs2[s].team==="blue")];
  const redF=fs2[slots.find(s=>fs2[s].team==="red")];
  // 블루 탄환이 레드에 명중
  const rhp0=redF.hp;
  api.pushBullet({x:redF.x,y:redF.y,vx:0,vy:0,r:9,damage:30,team:"blue",owner:blueF.slot,color:"#fff",alive:true,traveled:0,maxRange:500});
  api.tUpdateBullets(0.016);
  check("블루 탄환이 레드에 피해", redF.hp<rhp0);
  // 블루 탄환이 블루에게는 피해 없음(아군 오사 방지)
  const bhp0=blueF.hp;
  api.pushBullet({x:blueF.x,y:blueF.y,vx:0,vy:0,r:9,damage:30,team:"blue",owner:redF.slot==="p4"?"p1":"p1",color:"#fff",alive:true,traveled:0,maxRange:500});
  api.tUpdateBullets(0.016);
  check("아군 오사 없음", blueF.hp===bhp0);
  // 처치 시 팀 점수 증가
  const blueScore0=api.tScores.blue;
  api.tApplyDamage(redF, 99999, "blue", blueF.slot);
  check("레드 사망", redF.dead===true);
  check("블루 팀 점수 +1", api.tScores.blue===blueScore0+1);
});

console.log("=== 입력 반영 + 발사 ===");
run("host 입력으로 이동/발사", ()=>{
  // 살아있는 블루 p1(host) 사용
  const p1=api.tFighters.p1;
  const x0=p1.x;
  api.keysDown.clear(); api.keysDown.add("ArrowRight"); api.keysDown.add("KeyZ");
  F(20);
  api.keysDown.clear();
  check("host 이동함", api.tFighters.p1.x!==x0);
  check("p1 탄환 생성", api.tBullets.some(b=>b.owner==="p1"));
});

console.log("=== 시간 종료 → 결과 ===");
run("시간 종료 처리", ()=>{
  api.setT(0.01);
  F(2);
  check("state=online_over", api.state===api.STATE.ONLINE_OVER);
  const room=OM.db._data.starArenaOnline.rooms[code];
  check("meta.status=ended", room.meta.status==="ended");
  check("승자 기록", typeof room.meta.winner==="string");
});

console.log("=== 6명 미만 시작 → 봇 채움 ===");
run("2명 시작 시 봇으로 6명", ()=>{
  OM.leaveRoom();
  OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID";
  let code2=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)code2=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code2);
  rr.child("players/p2").set({uid:"p2",nickname:"p2",slot:"p2",team:"red",characterId:"lumi",weaponId:"star_blaster",connected:true,input:api.emptyInput()});
  api.setState(api.STATE.ONLINE_LOBBY);
  api.tStartMatch();
  const fs2=api.tFighters; const slots=Object.keys(fs2);
  check("봇 포함 6명", slots.length===6);
  const bots=slots.filter(s=>fs2[s].isBot).length;
  check("봇 4명 생성", bots===4);
  const blue=slots.filter(s=>fs2[s].team==="blue").length, red=slots.filter(s=>fs2[s].team==="red").length;
  check("팀 균형 3/3", blue===3 && red===3);
  // 봇 AI 한 프레임 안전
  F(5);
  check("봇 AI 프레임 안전", true);
});

console.log("=== 팀 모드: 참가자 나가도 매치 종료 안 됨 ===");
run("guest 퇴장은 슬롯만 비활성", ()=>{
  OM.leaveRoom();
  OM.db=makeMockDB(); OM.available=true; OM.uid="g3";
  const rr=OM.db.ref("starArenaOnline/rooms/ZZTT");
  rr.set({ meta:{mode:"online3v3",status:"playing",hostUid:"h"}, players:{ p3:{slot:"p3",team:"red",connected:true,input:api.emptyInput()} } });
  OM.roomRef=rr; OM.role="guest"; OM.mode="online3v3"; OM.mySlot="p3"; OM.unsubs=[];
  OM.leaveRoom();
  const room=OM.db._data.starArenaOnline.rooms.ZZTT;
  check("매치 안 끝남(status!=ended)", room.meta.status!=="ended");
  check("내 슬롯만 connected=false", room.players.p3.connected===false);
});

console.log("=== 렉 최적화: 게스트가 로스터로 정적값 역산 ===");
run("lean state + roster → charId/team/maxHp 복원", ()=>{
  OM.leaveRoom();
  OM.role="guest"; OM.mode="online3v3"; OM.mySlot="p2"; OM.maxPlayers=6; OM.roomRef=null;
  // 로스터(players)에는 정적 정보가 있다(입장 시 기록됨)
  OM.players={ p1:{slot:"p1",team:"blue",characterId:"student_02",connected:true},
               p2:{slot:"p2",team:"red", characterId:"student_03",connected:true} };
  // host가 보낸 state.fighters에는 동적값만 있다(charId/team/maxHp 없음)
  OM.onlineState={ timeLeft:50, teamScores:{blue:1,red:0},
    fighters:{ p1:{x:200,y:200,hp:80,facing:0,dead:false,inv:false},
               p2:{x:900,y:400,hp:70,facing:3.14,dead:false,inv:false} },
    bullets:[{x:300,y:300,r:8,c:"#ffe066",vx:100,vy:0}] };
  const d=api.tGetDrawData();
  const f1=d.fighters.find(f=>f.slot==="p1"), f2=d.fighters.find(f=>f.slot==="p2");
  check("p1 charId 역산", f1 && f1.charId==="student_02");
  check("p1 team 역산", f1 && f1.team==="blue");
  check("p1 maxHp 역산(>0)", f1 && f1.maxHp>0);
  check("p2(나) charId 역산", f2 && f2.charId==="student_03" && f2.isMe===true);
  OM.role=null; OM.mode=null; OM.mySlot=null; OM.onlineState=null; OM.players={host:null,guest:null};
});

console.log("=== 단일 입장(transaction null-first 보정) ===");
run("게스트 1명 정상 입장", ()=>{
  OM.leaveRoom();
  OM.db=makeMockDB(); OM.available=true; OM.uid="hostQ";
  let rc=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok) rc=info; }); // host=p1
  // 다른 클라이언트가 방 코드로 입장
  OM.uid="guestQ"; OM.role=null; OM.mySlot=null;
  let joined=false, gotCode=null;
  OM.joinRoomAny(rc,(ok,info)=>{ joined=ok; gotCode=info; });
  check("입장 성공(committed)", joined===true && gotCode===rc);
  check("슬롯 배정됨", !!OM.mySlot && OM.mySlot!=="p1");
  const room=OM.db._data.starArenaOnline.rooms[rc];
  check("DB에 내 슬롯 기록", !!room.players[OM.mySlot] && room.players[OM.mySlot].uid==="guestQ");
  check("meta.status=ready", room.meta.status==="ready");
});

console.log("=== 동시 입장 transaction: 슬롯 중복 없음 ===");
run("두 명 입장 시 서로 다른 슬롯", ()=>{
  OM.leaveRoom();
  OM.db=makeMockDB(); OM.available=true; OM.uid="hostU";
  let rc=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok) rc=info; }); // host=p1
  // 참가자1
  OM.uid="g1"; OM.role=null; OM.mySlot=null;
  OM.joinRoomAny(rc,()=>{});
  const s1=OM.mySlot;
  // 참가자2 (다른 uid, 새 클라이언트인 척)
  OM.uid="g2"; OM.role=null; OM.mySlot=null;
  OM.joinRoomAny(rc,()=>{});
  const s2=OM.mySlot;
  check("두 슬롯이 서로 다름", !!s1 && !!s2 && s1!==s2);
  const room=OM.db._data.starArenaOnline.rooms[rc];
  check("host p1 유지", room.players.p1 && room.players.p1.uid==="hostU");
  check("슬롯 3개 점유(중복 없음)", Object.keys(room.players).length===3);
});

console.log("=== C 궁극기(3v3): 적팀만 피해 + 게이지 (v1.18) ===");
run("눈꽃 C(얼음 깨기) 적팀 피해/아군 무피해", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("student_04","tool_04"); // 눈꽃
  let c=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)c=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+c);
  rr.child("players/p2").set({uid:"p2",slot:"p2",team:"blue",characterId:"student_02",weaponId:null,connected:true,input:api.emptyInput()});
  rr.child("players/p4").set({uid:"p4",slot:"p4",team:"red", characterId:"student_02",weaponId:null,connected:true,input:api.emptyInput()});
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  const F2=api.tFighters; const me=F2.p1, ally=F2.p2, foe=F2.p4;
  check("p1 ultName=꽁꽁 얼음 깨기", me.char.ultName==="꽁꽁 얼음 깨기");
  check("무기 완전 고정: p1=tool_04", me.weaponId==="tool_04");
  check("잘못된 weaponId도 캐릭터 무기로 교정(p2=tool_02)", F2.p2.weaponId===api.getWeaponForCharacter("student_02"));
  foe.x=me.x+40; foe.y=me.y; foe.invincibleTimer=0;     // 적을 반경 150 안에
  ally.x=me.x-40; ally.y=me.y; ally.invincibleTimer=0;   // 아군도 붙임
  const foeHp0=foe.hp, allyHp0=ally.hp;
  me.superGauge=api.GAME_CONFIG.superCharge;
  api.castUlt(me);
  check("적팀 즉시 빙결", foe.freezeTimer>0);
  check("아군 빙결 없음", !(ally.freezeTimer>0));
  api.tickZones(1.05);                                   // 빙결(GAMEPLAY-1 너프: 1.0s) 종료 → 파괴 피해 30
  check("빙결 종료 피해(30) 적팀만", foe.hp===foeHp0-30 && ally.hp===allyHp0);
  check("사용 후 게이지 0", me.superGauge===0);
  check("C 피해로 게이지 재충전 안 됨", me.superGauge===0);
  check("게이지 부족 시 미발동", (function(){ const h0=foe.hp; me.superGauge=10; api.castUlt(me); return foe.hp===h0 && me.superGauge===10; })());
});
run("X 특수기술(3v3): 쿨타임 + 아군 무피해", ()=>{
  const F2=api.tFighters; const me=F2.p1, foe=F2.p4;
  me.specialCd=0; foe.wSlowTimer=0;
  const ok1=api.castSp(me);
  check("X 시전 성공", ok1===true);
  check("X 쿨타임 시작(7초)", me.specialCd>6.9);
  const ok2=api.castSp(me);
  check("쿨타임 중 재시전 불가", ok2===false);
});
run("탄창: 실제 플레이어만 ammo, 봇은 무한", ()=>{
  // 1명만 입장 → 나머지는 봇
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostUID"; api.setSel("lumi","star_blaster");
  let c=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)c=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  const F2=api.tFighters;
  check("host(p1) 탄창 보유", F2.p1.ammo===api.GAME_CONFIG.magazineSize);
  const bot=Object.keys(F2).map(s=>F2[s]).find(f=>f.isBot);
  check("봇은 탄창 없음(무한)", bot && bot.ammo===undefined);
});

console.log("=== 풀숲 공격-드러남(fr) 플러밍 ===");
run("공격하면 fr 플래그가 draw data에 실림", ()=>{
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostU"; api.setSel("lumi","star_blaster");
  let c=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)c=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  const me=api.tFighters.p1;
  me.fireRevealTimer=0;
  let d=api.tGetDrawData(); let f=d.fighters.find(x=>x.slot==="p1");
  check("발사 전 fr=0", !f.fr);
  me.fireRevealTimer=1.0;   // 방금 발사한 상태
  d=api.tGetDrawData(); f=d.fighters.find(x=>x.slot==="p1");
  check("발사 직후 fr=1(드러남 신호)", f.fr===1);
});

console.log("=== 맵 선택(15): 방 mapId 기록·동기·적용·fallback ===");
run("방 생성 시 host 선택 맵 기록, 게스트 수신, OBSTACLES 적용", ()=>{
  check("맵 4개 이상", api.MAPS.length>=4 && !!api.getMap("lane3") && api.getMap("lane3").id==="lane3");
  // host가 lane3 선택 후 3v3 방 생성
  OM.leaveRoom(); OM.db=makeMockDB(); OM.available=true; OM.uid="hostU"; api.setSel("lumi","star_blaster"); api.setMap("lane3");
  let c=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)c=info; });
  const room=OM.db._data.starArenaOnline.rooms[c];
  check("meta.mapId=lane3 기록", room.meta.mapId==="lane3");
  // 게스트 입장 → meta 수신
  OM.uid="g1"; OM.role=null; OM.mySlot=null; OM.joinRoomAny(c,()=>{});
  check("게스트 meta.mapId 수신", OM.meta && OM.meta.mapId==="lane3");
  // host 시작 → tMapId/OBSTACLES가 lane3 적용
  OM.leaveRoom();
  OM.db=makeMockDB(); OM.available=true; OM.uid="hostU"; api.setSel("lumi","star_blaster"); api.setMap("lane3");
  let c2=null; OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok)c2=info; });
  api.setState(api.STATE.ONLINE_LOBBY); api.tStartMatch();
  check("tMapId=lane3", api.tMapId==="lane3");
  check("OBSTACLES가 lane3 것", api.OBSTACLES===api.getMap("lane3").obstacles);
});
run("없는 mapId는 training으로 fallback", ()=>{
  check("getMap(없음)=training", api.getMap("zzz").id==="training");
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
