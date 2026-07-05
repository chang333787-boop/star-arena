// BIG-BATCH-2 P2 하니스: 전 규칙 온라인화(3대3) — host 권위 판정 + 패킷 + 게스트 뷰 일치(mock DB)
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
    remove(){ setAt(p,null); fire(); return thenable(); },
    transaction(fn){ const cur=clone(getAt(p)); const res=fn(cur);
      if(res===undefined||res===null) return thenable({committed:false,snapshot:{val:()=>clone(getAt(p))}});
      setAt(p,resolveTS(res)); fire(); return thenable({committed:true,snapshot:{val:()=>clone(getAt(p))}}); }
  }; }
  return { ref, _data:data };
}
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };

const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__t={ OM:OnlineManager, emptyInput, STATE, get state(){return gameState;}, setState:v=>{gameState=v;},
  tStartMatch, get RULE(){return RULE;}, tTickRule, tRuleTimeUpTeam, tGuestApplyRule, tSetupRule,
  tPaintRLE, tPaintApplyRLE, tPaintCellBy, tPaintSplash, tDamageRuleStruct, tHostWriteState, tUpdateBullets, tApplyDamage,
  get tFighters(){return tFighters;}, get tBullets(){return tBullets;}, pushBullet:b=>{tBullets.push(b);},
  setT:v=>{tTimeLeft=v;}, get tTimeLeft(){return tTimeLeft;}, get tWinner(){return tWinner;},
  tTeamStars, tFightersList, setRule:(r)=>{onlineSelectedRule=r;}, tRuleId, effSpeed, castTagSpecial, TAG_X_ALLOW,
  get OBSTACLES(){return OBSTACLES;}, RULE_CONFIG, GAME_CONFIG,
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  setMyTag:v=>{tMyTagRole=v;}, tComputeResultText };`;
let api; try{ (0,eval)(s); api=globalThis.__t; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM;

// 규칙별 6인 방 셋업 도우미(호스트 관점)
function setupRoom(rule){
  OM.leaveRoom(true);
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB();
  api.setSel("student_01","tool_01");
  api.setRule(rule);
  let code=null;
  OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok) code=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  const chars=["student_01","student_02","student_03","student_04","student_05","student_06"];
  const mk=(i,team)=>({uid:"p"+i,nickname:"p"+i,slot:"p"+i,team:team,characterId:chars[i-1],weaponId:null,connected:true,ready:false,isBot:false,input:api.emptyInput()});
  rr.child("players/p2").set(mk(2,"blue")); rr.child("players/p3").set(mk(3,"blue"));
  rr.child("players/p4").set(mk(4,"red")); rr.child("players/p5").set(mk(5,"red")); rr.child("players/p6").set(mk(6,"red"));
  api.tStartMatch();
  return { code, rr, room:OM.db._data.starArenaOnline.rooms[code] };
}
function hostState(code){ return OM.db._data.starArenaOnline.rooms[code].state; }
function asGuestApply(code){
  // 게스트 뷰 재현: RULE을 새로 셋업하고 패킷만으로 채운다
  const st=JSON.parse(JSON.stringify(hostState(code)));
  const role=OM.role; OM.role="guest";
  api.tSetupRule();
  api.tGuestApplyRule(st);
  OM.role=role;
  return st;
}

console.log("=== 1) 방 규칙 메타 + 대기실 ===");
run("meta.rule 기록(hotzone)", ()=>{
  const {room}=setupRoom("hotzone");
  check("meta.rule=hotzone", room.meta.rule==="hotzone");
  check("RULE 셋업(점령전)", api.RULE && api.RULE.id==="hotzone");
  check("매치 시간=180", Math.abs(api.tTimeLeft-api.RULE_CONFIG.matchTime)<1);
});

console.log("=== 2) 점령전(hotzone): 게이지 host 판정 + 게스트 일치 ===");
run("단독 점유 → 게이지 상승 → 패킷 → 게스트 뷰", ()=>{
  const {code}=setupRoom("hotzone");
  const R=api.RULE, fs2=api.tFighters;
  for(const s2 in fs2){ const f=fs2[s2]; f.x=(f.team==="blue")?R.x:ARENAX(); f.y=(f.team==="blue")?R.y:60; }
  function ARENAX(){ return 60; }
  for(let i=0;i<120;i++) api.tTickRule(1/60);   // 2초
  check("블루 게이지 ≈ +16", R.gauge.player>14 && R.gauge.player<18);
  check("홀더=player", R.holder==="player");
  api.tHostWriteState();
  const st=hostState(code);
  check("패킷 rule.gp 존재", st.rule && st.rule.gp>14);
  const before=R.gauge.player;
  asGuestApply(code);
  check("게스트 뷰 게이지 일치", Math.abs(api.RULE.gauge.player-Math.round(before*10)/10)<0.2);
});

console.log("=== 3) 수정부수기(siege): 구조물·탑 파괴 승리·벽 재건 ===");
run("구조물 8개 + 탄환 피해 + 탑 파괴 = 승리", ()=>{
  const {code}=setupRoom("siege");
  const R=api.RULE;
  check("구조물 8개(탑2+벽6)", R.structs.length===8);
  check("장애물에 구조물 포함", api.OBSTACLES.filter(o=>o.structure).length===8);
  const tw=R.towers.enemy, hp0=tw.hp;
  // 블루 탄환을 탑 중앙에 명중시킨다
  api.pushBullet({ x:tw.x+tw.w/2-40, y:tw.y+tw.h/2, vx:600, vy:0, r:8, damage:30, team:"blue", owner:"p1",
    color:"#fff", alive:true, traveled:0, maxRange:900, age:0 });
  api.tUpdateBullets(1/10);
  check("탑 피해", tw.hp<hp0);
  api.tHostWriteState();
  check("패킷 sh 목록(8)", hostState(code).rule.sh.length===8);
  // 게스트 적용: 탑 hp 반영
  const hpNow=Math.round(tw.hp);
  asGuestApply(code);
  check("게스트 탑 HP 일치", Math.round(api.RULE.towers.enemy.hp)===hpNow);
  // 벽 파괴 → 재건 예약 → 시간 경과 후 절반 HP 복구
  api.tSetupRule();   // 초기화(호스트 뷰 복원)
  const R2=api.RULE, wall=R2.structs.find(s2=>s2.sid.indexOf("rwall_")===0);
  for(const s2 in api.tFighters){ api.tFighters[s2].x=640; api.tFighters[s2].y=60; }   // 재건 자리 비우기
  api.tDamageRuleStruct(wall, 9999);
  check("벽 파괴 + 재건 예약", wall.hp===0 && R2.rebuild.length===1);
  for(let i=0;i<26*10;i++) api.tTickRule(0.1);
  check("재건: 절반 HP 복귀 + 충돌 복원", wall.hp===Math.round(wall.maxHp*0.5) && api.OBSTACLES.indexOf(wall)>=0);
  // 탑 전파괴 → 즉시 승부
  api.tDamageRuleStruct(R2.towers.enemy, 99999);
  check("탑 파괴 → 블루 승 + 종료", api.tWinner==="blue" && api.state==="online_over");
});

console.log("=== 4) 별모으기(stargrab): 픽업·드랍·카운트다운 ===");
run("픽업 → 캐리어 사망 드랍 → 10개 카운트다운 → 승리", ()=>{
  const {code}=setupRoom("stargrab");
  const R=api.RULE, f1=api.tFighters.p1, f4=api.tFighters.p4;
  for(const s2 in api.tFighters){ api.tFighters[s2].x=100; api.tFighters[s2].y=100; }
  f1.x=640; f1.y=350;
  R.stars.push({x:640,y:350});
  api.tTickRule(1/60);
  check("별 픽업(p1)", (f1.stars||0)===1 && R.stars.length===0);
  // 캐리어 사망 → 드랍
  f4.x=100; api.tApplyDamage(f1, 9999, "red", "p4", false, 1);
  check("사망 드랍(ttl 별)", f1.stars===0 && R.stars.length===1 && R.stars[0].ttl>0);
  R.stars.length=0;
  f1.dead=false; f1.hp=f1.maxHp;
  f1.stars=api.RULE_CONFIG.stargrab.goal;
  api.tTickRule(1/60);
  check("목표 도달 → 블루 카운트다운", R.countdown.player>0);
  api.tHostWriteState();
  const st=hostState(code);
  check("패킷 cp>0 + 파이터 st 필드", st.rule.cp>0 && st.fighters.p1.st===api.RULE_CONFIG.stargrab.goal);
  for(let i=0;i<16*10;i++){ api.tTickRule(0.1); if(api.tWinner) break; }
  check("카운트다운 완주 → 블루 승", api.tWinner==="blue");
});

console.log("=== 5) 별빛 술래(tag): 감염·역할 동기화·전원 감염 승부 ===");
run("술래 선정 → 감염 → 패킷 tg → 전원 감염 종료", ()=>{
  const {code}=setupRoom("tag");
  const R=api.RULE;
  check("공개 단계", R.phase==="reveal");
  const list=api.tFightersList();
  for(let i=0;i<list.length;i++){ list[i].x=80+i*200; list[i].y=120+(i%2)*400; }
  api.tTickRule(1/60);                       // needInit → 술래 1명
  check("술래 정확히 1명", list.filter(f=>f.isTagger).length===1);
  api.tTickRule(3.2);                        // reveal 소진
  check("추격 단계", R.phase==="chase");
  const tg=list.find(f=>f.isTagger), r1=list.find(f=>!f.isTagger && !f.tagShield);
  tg.tagCd=0; r1.x=tg.x; r1.y=tg.y; r1.tagShield=0;
  api.tTickRule(1/60);
  check("접촉 감염", r1.isTagger===true);
  api.tHostWriteState();
  const st=hostState(code);
  let tgCount=0; for(const s2 in st.fighters) if(st.fighters[s2].tg) tgCount++;
  check("패킷 tg 동기화(2명)", tgCount===2);
  check("도망자 버프 rm>1", st.rule.rm>1);
  for(const f of list) f.isTagger=true;
  api.tTickRule(1/60);
  check("전원 감염 → taggers 승", api.tWinner==="taggers");
  api.setMyTag(true);
  check("결과 문구: 내가 술래=승리", api.tComputeResultText()==="승리!");
  api.setMyTag(false);
  check("결과 문구: 도망자=패배", api.tComputeResultText()==="패배!");
});

console.log("=== 6) 별빛 칠하기(paint): 도색·RLE 왕복·게스트 일치·판정 ===");
run("탄 도색 + RLE 왕복 + 승부", ()=>{
  const {code}=setupRoom("paint");
  const R=api.RULE;
  check("그리드 220 + 매치 75초", R.grid.length===220 && Math.abs(api.tTimeLeft-api.RULE_CONFIG.paint.matchTime)<1);
  // 열린 칸에 직접 도색
  let painted=0;
  for(let r=0;r<10 && painted<30;r++) for(let c=0;c<22 && painted<30;c++){
    if(api.tPaintCellBy(24+c*56+28, 70+r*56+28, "blue", "p1")) painted++;
  }
  check("도색 30칸(블루)", R.count[1]===30);
  // 탄환 경로 도색
  const b0=R.count[2];
  api.pushBullet({ x:200, y:400, vx:600, vy:0, r:6, damage:5, team:"red", owner:"p4",
    color:"#fff", alive:true, traveled:0, maxRange:300, age:0 });
  api.tUpdateBullets(0.5);
  check("탄 경로+착탄 도색(레드)", R.count[2]>b0);
  // RLE 왕복
  const rle=api.tPaintRLE(), g1=Array.from(R.grid).join("");
  api.tHostWriteState();
  const st=hostState(code);
  check("패킷 g=RLE", st.rule.g===rle);
  asGuestApply(code);
  check("게스트 그리드 완전 일치", Array.from(api.RULE.grid).join("")===g1);
  check("게스트 카운터 일치", api.RULE.count[1]===30);
  // 시간 종료 → 다수 승
  api.tSetupRule();
  api.RULE.count[1]=50; api.RULE.count[2]=30;
  api.tRuleTimeUpTeam();
  check("면적 다수 → 블루 승", api.tWinner==="blue");
});

console.log("=== 7) 술래 X 도구(온라인 host 판정) ===");
run("럭키 대시 — 팀 목록으로 castTagSpecial", ()=>{
  setupRoom("tag");
  api.tTickRule(1/60); api.tTickRule(3.2);   // 술래 선정 + 추격 단계
  const list=api.tFightersList();
  const lucky=list.find(f=>f.char.id==="student_01");
  lucky.specialCd=0;
  const ok=api.castTagSpecial(lucky, list);
  check("대시 발동(쿨 시작)", ok===true && lucky.tagDashT>0 && lucky.specialCd>0);
  check("대시 이속 반영", api.effSpeed(lucky)>lucky.moveSpeed);
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
