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
// 온라인긴급 P0: 실서버식 엄격 검증 — undefined/NaN/함수가 패킷에 있으면 set/update 전체 거부(mock 관대함 제거)
function fbValidate(v, path, errs){
  if(v===undefined){ errs.push(path+" = undefined"); return; }
  if(typeof v==="number"&&!isFinite(v)){ errs.push(path+" = "+v); return; }
  if(typeof v==="function"){ errs.push(path+" = function"); return; }
  if(v&&typeof v==="object"){ for(const k in v) fbValidate(v[k], path+"."+k, errs); }
}
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
    set(v){ const errs=[]; fbValidate(v,"set("+p+")",errs); if(errs.length) throw new Error("FB_REJECT "+errs[0]); setAt(p,resolveTS(clone(v))); fire(); return thenable(); },
    update(o){ const errs=[]; fbValidate(o,"update("+p+")",errs); if(errs.length) throw new Error("FB_REJECT "+errs[0]); for(const k in o) setAt(p+"/"+k,resolveTS(clone(o[k]))); fire(); return thenable(); },
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
  tPaintRLE, tPaintApplyRLE, tPaintCellBy, tPaintSplash, tDamageRuleStruct, tHostWriteState, tUpdateBullets, tApplyDamage, tUpdate,
  get tFighters(){return tFighters;}, get tBullets(){return tBullets;}, pushBullet:b=>{tBullets.push(b);},
  setT:v=>{tTimeLeft=v;}, get tTimeLeft(){return tTimeLeft;}, get tWinner(){return tWinner;},
  tTeamStars, tFightersList, setRule:(r)=>{onlineSelectedRule=r;}, tRuleId, effSpeed, castTagSpecial, TAG_X_ALLOW,
  get OBSTACLES(){return OBSTACLES;}, RULE_CONFIG, GAME_CONFIG,
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  setMyTag:v=>{tMyTagRole=v;}, tComputeResultText,
  tUpdateGuest, onlineReconcile, onlineInterpTarget, onlineSnapPush, onlineInputBtnSig, readLocalInput,
  get tRenderFighters(){return tRenderFighters;}, get tSnapBuf(){return tSnapBuf;}, get tPredict(){return tPredict;}, get tEnemiesView(){return tEnemiesView;},
  setGuestState:v=>{OnlineManager.onlineState=v;},
  resetGuestView:()=>{tRenderFighters={};tPredict=null;tSnapBuf=[];tInterpClock=0;tLastStateRef=null;tBulletsView=[];} };`;
let api; try{ (0,eval)(s); api=globalThis.__t; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM;

// 규칙별 방 셋업 도우미(호스트 관점) — humans명만 사람, 나머지 슬롯은 봇 충원(온라인긴급: 교실 기본 케이스)
function setupRoom(rule, humans, modeId){
  humans=humans||6;
  OM.leaveRoom(true);
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB();
  api.setSel("student_01","tool_01");
  api.setRule(rule);
  let code=null;
  OM.createTeamRoom(modeId||"online3v3",(ok,info)=>{ if(ok) code=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  const chars=["student_01","student_02","student_03","student_04","student_05","student_06"];
  const mk=(i,team)=>({uid:"p"+i,nickname:"p"+i,slot:"p"+i,team:team,characterId:chars[i-1],weaponId:null,connected:true,ready:false,isBot:false,input:api.emptyInput()});
  for(let i=2;i<=humans;i++) rr.child("players/p"+i).set(mk(i, (i<=3)?"blue":"red"));
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

console.log("=== 8) 온라인긴급 P0: 봇 충원 방(사람 2+봇 4) — 실서버식 검증 통과 + 게스트 동기화 ===");
for(const rule of ["tdm","paint","tag"]){
  run(rule+" · 사람 2명+봇 4 — state 전송 성공(동기화 대기 재발 방지)", ()=>{
    const {code}=setupRoom(rule, 2);
    for(let i=0;i<30;i++) api.tUpdate(1/60);   // 봇 AI 실구동 + 15Hz 주기 전송(엄격 mock — 독성 필드면 여기서 THROW)
    api.tHostWriteState();
    const st=hostState(code);
    check("state.fighters 6슬롯", !!st && st.fighters && Object.keys(st.fighters).length===6);
    let amOk=true;
    for(const s2 in st.fighters){ const am=st.fighters[s2].am; if(typeof am!=="number"){ amOk=false; } }
    check("전 슬롯 am=숫자(봇=-1 무한탄)", amOk);
    check("봇 am=-1 존재", Object.keys(st.fighters).some(s2=>st.fighters[s2].am===-1));
    if(rule!=="tdm"){ asGuestApply(code); check("게스트 규칙 뷰 재구성", api.RULE && api.RULE.id===rule); }
  });
}
run("PVE(onlinePve6) 1인 방 — 같은 tPackFighter 경로 + pve 필드 엄격 통과", ()=>{
  const {code}=setupRoom("tdm", 1, "onlinePve6");
  for(let i=0;i<30;i++) api.tUpdate(1/60);
  api.tHostWriteState();
  const st=hostState(code);
  check("state 기록(fighters+pve)", !!st && !!st.fighters && !!st.pve);
  check("p1 am=숫자", typeof st.fighters.p1.am==="number");
});

console.log("=== 9) 온라인긴급 P1: inputs 분리·페어 보간·연속 화해·패킷 다이어트 ===");
run("inputs/$slot 분리 노드 — 쓰기 경로·host 구독 왕복", ()=>{
  const {code,rr,room}=setupRoom("tdm");
  const saveSlot=OM.mySlot, saveRole=OM.role;
  OM.mySlot="p2"; OM.role="guest";
  const inp=api.emptyInput(); inp.attack=true; inp.mvx=0.5;
  OM.writeInput(inp);
  OM.mySlot=saveSlot; OM.role=saveRole;
  check("rooms/*/inputs/p2 에 기록(players 아님)", !!room.inputs && !!room.inputs.p2 && room.inputs.p2.attack===true
    && !(room.players.p2 && room.players.p2.input && room.players.p2.input.attack===true));
  check("host 리스너 → OnlineManager.inputs 반영", !!OM.inputs && !!OM.inputs.p2 && OM.inputs.p2.mvx===0.5);
});
run("입력 버튼 시그니처(캐핑 예외 판별)", ()=>{
  const a=api.emptyInput(), b=api.emptyInput();
  b.mvx=0.7; b.aim=1.05;   // 아날로그만 변화
  check("아날로그 변화는 버튼 시그니처 동일(20Hz 캡 대상)", api.onlineInputBtnSig(a)===api.onlineInputBtnSig(b));
  b.special=true;          // 버튼 변화
  check("버튼 변화는 시그니처 상이(즉시 전송)", api.onlineInputBtnSig(a)!==api.onlineInputBtnSig(b));
});
run("게스트 스냅샷 페어 보간(순간이동 없음)", ()=>{
  setupRoom("tdm");
  const saveRole=OM.role; OM.role="guest"; OM.mySlot="p1";
  api.resetGuestView();
  const mk=x=>({ timeLeft:90, teamScores:{blue:0,red:0}, bullets:[],
    fighters:{ p1:{x:300,y:300,facing:0,dead:false,hp:100}, p2:{x:x,y:200,facing:0,dead:false,hp:100} } });
  const s1=mk(100);
  api.setGuestState(s1);
  for(let i=0;i<3;i++) api.tUpdateGuest(1/15);        // 워밍업(버퍼 적재 + 시계 진행)
  const s2=mk(200);                                    // 다음 스냅샷: p2가 +100px
  api.setGuestState(s2);
  api.tUpdateGuest(1/30);
  const rx=api.tRenderFighters.p2.x;
  check("스냅샷 점프(+100px)를 즉시 스냅하지 않음(중간값)", rx>105 && rx<195);
  const s3=mk(200);                                    // 같은 위치의 후속 스냅샷들 → 수렴
  api.setGuestState(s3);
  for(let i=0;i<20;i++) api.tUpdateGuest(1/15);
  check("후속 스냅샷으로 목표 수렴", Math.abs(api.tRenderFighters.p2.x-200)<4);
  OM.role=saveRole;
});
run("자기 캐릭터 연속 화해(70px 하드스냅 제거)", ()=>{
  const pred={x:0,y:0}, auth={x:100,y:0};
  api.onlineReconcile(pred, auth, 1/60);
  check("100px 오차: 프레임당 일부만 흡수(점진)", pred.x>3 && pred.x<40);
  let last=pred.x;
  for(let i=0;i<200;i++) api.onlineReconcile(pred, auth, 1/60);
  check("연속 적용 시 수렴(잔차 ≤6px 데드존)", Math.abs(pred.x-100)<=6.5);
  const pred2={x:0,y:0};
  api.onlineReconcile(pred2, {x:300,y:0}, 1/60);
  check("220px 초과(리스폰/워프급)만 즉시 스냅", pred2.x===300);
});
run("패킷 다이어트: 탄 48발 패킹 + 페인트 RLE 조건 전송", ()=>{
  const {code}=setupRoom("paint");
  for(let i=0;i<80;i++) api.pushBullet({ x:100+i, y:100, vx:10, vy:0, r:6, color:"#fff", wid:null, owner:"p1", team:"blue", traveled:0, maxRange:400 });
  let _p1=false;   // 그리드 변화(픽셀 좌표 — 차단 칸 회피 위해 칠해질 때까지 순회)
  for(let c=1;c<20&&!_p1;c++) _p1=api.tPaintCellBy(24+c*56+28, 70+2*56+28, "blue", "p1");
  api.tHostWriteState();
  const st1=hostState(code);
  check("시뮬 탄 80발 → 패킷은 최신 48발", api.tBullets.length>=48 && st1.bullets.length===48);
  check("그리드 변화 직후 패킷엔 RLE 포함", typeof st1.rule.g==="string");
  api.tHostWriteState();
  const st2=hostState(code);
  check("그리드 무변화 → g 생략(고정 비용 제거)", st2.rule.g===undefined);
  let _p2=false;
  for(let c=1;c<20&&!_p2;c++) _p2=api.tPaintCellBy(24+c*56+28, 70+6*56+28, "red", "p4");
  api.tHostWriteState();
  const st3=hostState(code);
  check("그리드 변화 → g 재전송", typeof st3.rule.g==="string");
  // 게스트: g 생략 패킷을 받아도 이전 그리드 유지(중간에 초기화되지 않음)
  const role=OM.role; OM.role="guest"; api.tSetupRule();
  api.tGuestApplyRule(JSON.parse(JSON.stringify(st3)));
  const g3=api.tPaintRLE();
  api.tGuestApplyRule(JSON.parse(JSON.stringify(st2)));   // g 없음
  check("g 생략 패킷 → 그리드 유지", api.tPaintRLE()===g3);
  OM.role=role;
});

console.log("=== 10) 온라인긴급 P1b: 재접속 복귀·PVE 적 보간 ===");
run("끊김→봇 인계→재연결 복귀(isBot 역전이)", ()=>{
  setupRoom("tdm", 2);   // 사람 2(p1=host, p2) + 봇 4
  const f2=api.tFighters.p2;
  check("시작: p2는 사람", f2.isBot===false);
  OM.players.p2.connected=false;
  api.tUpdate(1/60);
  check("끊김 → 봇 인계", f2.isBot===true);
  OM.players.p2.connected=true;   // presence 재-set 재현(재연결)
  api.tUpdate(1/60);
  check("재연결 → 사람 복귀", f2.isBot===false);
  const f3=api.tFighters.p3;
  check("원래 봇 슬롯은 역전이 무해(봇 유지)", !!f3 && f3.isBot===true);
});
run("PVE 적 페어 보간(게스트 화면 점프 제거)", ()=>{
  setupRoom("tdm");
  const saveRole=OM.role; OM.role="guest"; OM.mySlot="p1";
  api.resetGuestView();
  const mk=x=>({ timeLeft:90, teamScores:{blue:0,red:0}, bullets:[],
    fighters:{ p1:{x:300,y:300,facing:0,dead:false,hp:100} },
    enemies:{ e1:{x:x,y:200,facing:0,hp:50,maxHp:50,type:"grunt",dead:false} } });
  api.setGuestState(mk(100));
  for(let i=0;i<3;i++) api.tUpdateGuest(1/15);
  api.setGuestState(mk(200));
  api.tUpdateGuest(1/30);
  const ex=api.tEnemiesView.e1.x;
  check("적 +100px 점프를 중간값으로 보간", ex>105 && ex<195);
  const dead=mk(200); dead.enemies.e1.dead=true;
  api.setGuestState(dead);
  api.tUpdateGuest(1/30);
  check("사망 적은 뷰에서 즉시 제거(시체 잔상 없음)", api.tEnemiesView.e1===undefined);
  OM.role=saveRole;
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
