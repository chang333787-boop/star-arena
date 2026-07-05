// 별빛 아레나 — UPDATE-1 조작 3모드(키보드/마우스/터치) + 가시 재생 버그 검증 하니스 (2026-07-05)
// 1) 키보드 모드 = 기존 동작 동일(이동 방향 조준·Z 발사)
// 2) 마우스 모드 = 이동/조준 분리 → **후퇴 사격(카이팅)** 실제 성립 검증
// 3) 터치 모드 = 스틱 수학·조준+발사·스킬독 탭 래치
// 4) 온라인 패킷 = mvx/mvy/aim 확장 + host 판정(applyIntentMoveAim) 하위호환
// 5) P1 가시 버그 = 함정 위에서 재생 정지, 벗어나면 재생 재개
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
script+=`;globalThis.__api={
  GAME_CONFIG, getLocalIntent, readLocalInput, stickVec, applyIntentMoveAim, emptyInput,
  MOUSE, TOUCH, keysDown, CONTROL_MODES, controlMode, makeOnlineFighter, applyTrapTo,
  startGame, setSel:(c,w,d,mp,md)=>{selectedCharacterId=c;selectedWeaponId=w;selectedDifficultyId=d||"normal";selectedMapId=mp||"training";selectedModeId=md||"solo";
    profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  get player(){return player;}, get profile(){return profile;}, get MATCH(){return MATCH;},
  setControl:(m)=>{ profile.controlMode=m; }, setState:v=>{gameState=v;}, get state(){return gameState;},
  get matchElapsed(){return matchElapsed;}
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let ts=0; function frames(n,dtMs){ dtMs=dtMs||16.7; for(let i=0;i<n;i++){ ts+=dtMs; if(globalThis.__rafCb) globalThis.__rafCb(ts); } }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
const approx=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-6);

console.log("=== 1) 키보드 모드 = 기존 동작(회귀 없음) ===");
run("이동 방향 = 조준 방향 · Z 발사 의도", ()=>{
  api.setControl("keyboard");
  api.setSel("student_01","tool_01"); api.startGame(); frames(3);
  api.keysDown.add("ArrowRight"); api.keysDown.add("KeyZ");
  const it=api.getLocalIntent();
  check("mx=1·fire=true·aim 없음", it.mx===1 && it.fire===true && it.aim===null && !it.aimPoint);
  const x0=api.player.x; frames(10);
  check("오른쪽 이동 + 조준=오른쪽(0rad)", api.player.x>x0 && approx(api.player.facing,0,0.01));
  api.keysDown.clear();
});

console.log("=== 2) 마우스 모드 — 카이팅(후퇴 사격) ===");
run("이동(WASD)과 조준(커서) 분리", ()=>{
  api.setControl("mouse");
  api.setSel("student_01","tool_01"); api.startGame(); frames(3);
  const px=api.player.x, py=api.player.y;
  api.MOUSE.x=px+300; api.MOUSE.y=py; api.MOUSE.seen=true;   // 커서 = 오른쪽
  api.keysDown.add("KeyA");                                   // 이동 = 왼쪽(후퇴)
  frames(12);
  check("왼쪽으로 이동함(후퇴)", api.player.x < px-10);
  check("조준은 오른쪽 유지(카이팅 성립!)", Math.abs(api.player.facing) < 0.15);
  // 좌클릭 발사 의도
  api.MOUSE.down=true;
  check("좌클릭 = fire", api.getLocalIntent().fire===true);
  api.MOUSE.down=false; api.keysDown.clear();
});
run("우클릭 X · Space C 에지(1회 발동)", ()=>{
  const cd0=api.player.specialCd||0;
  api.MOUSE.rdown=true; frames(2); api.MOUSE.rdown=false; frames(1);
  check("우클릭 → X 시전(쿨타임 시작)", (api.player.specialCd||0) > cd0);
});

console.log("=== 3) 터치 모드 — 스틱·탭 ===");
run("stickVec 수학", ()=>{
  const v=api.stickVec({x:100,y:100},{x:160,y:100},60);
  check("반경만큼 = 1.0", approx(v.x,1) && approx(v.y,0));
  const v2=api.stickVec({x:100,y:100},{x:100,y:400},60);
  check("반경 밖 클램프", approx(Math.hypot(v2.x,v2.y),1));
});
run("우 스틱 = 조준+발사 · 데드존", ()=>{
  api.setControl("touch");
  api.TOUCH.aiming=true; api.TOUCH.aimVec={x:0,y:-1};
  let it=api.getLocalIntent();
  check("위로 조준(-π/2)·발사", approx(it.aim,-Math.PI/2,0.01) && it.fire===true);
  api.TOUCH.aimVec={x:0.1,y:0};   // 데드존(0.25) 이하
  it=api.getLocalIntent();
  check("데드존: 발사 안 함", it.fire===false && it.aim===null);
  api.TOUCH.aiming=false;
});
run("스킬독 탭 래치(1회 소모)", ()=>{
  api.TOUCH.xTap=true;
  check("X 탭 → special 1회", api.getLocalIntent().special===true);
  check("두 번째 읽기엔 소모됨", api.getLocalIntent().special===false);
});

console.log("=== 4) 온라인 패킷 + host 판정 ===");
run("패킷 확장(mvx/aim) + 키보드 하위호환", ()=>{
  api.setControl("mouse");
  api.MOUSE.x=api.player.x+100; api.MOUSE.y=api.player.y;
  const inp=api.readLocalInput();
  check("마우스: aim 숫자 포함", typeof inp.aim==="number");
  api.setControl("keyboard");
  const inp2=api.readLocalInput();
  check("키보드: aim=null + 구형 불리언 유지", inp2.aim===null && typeof inp2.up==="boolean" && typeof inp2.attack==="boolean");
});
run("host 판정: 아날로그 이동 + 분리 조준(원격 카이팅)", ()=>{
  const f=api.makeOnlineFighter("host",{x:600,y:300,characterId:"student_01",weaponId:null});
  const x0=f.x;
  api.applyIntentMoveAim(f, {mvx:-1, mvy:0, aim:0}, 0.5);
  check("왼쪽 이동", f.x < x0-50);
  check("조준은 오른쪽(aim=0)", approx(f.facing,0));
  const g=api.makeOnlineFighter("guest",{x:600,y:300,characterId:"student_01",weaponId:null});
  api.applyIntentMoveAim(g, {up:false,down:false,left:true,right:false}, 0.5);   // 구형 패킷
  check("구형 불리언: 이동+이동방향 조준", g.x<600 && approx(g.facing,Math.PI,0.01));
});

console.log("=== 5) P1 가시 버그 — 함정 위 재생 정지 ===");
run("밟는 동안 회복 없음 → 벗어나면 회복", ()=>{
  api.setControl("keyboard");
  api.setSel("student_01","tool_01"); api.startGame(); frames(3);
  const p=api.player;
  api.MATCH.map.traps=api.MATCH.map.traps||[];
  api.MATCH.map.traps.push({x:p.x-28,y:p.y-28,w:56,h:56,type:"spike"});
  frames(6);                                     // 함정 피해 1회(trapCooldown 내)
  const hpAfterHit=p.hp;
  check("함정 피해 발생", hpAfterHit < p.maxHp);
  frames(240);                                   // 함정 위에서 4초 대기(기존 버그: 여기서 다시 참)
  check("함정 위 4초: 회복 안 됨(피해 누적)", p.hp <= hpAfterHit);
  api.MATCH.map.traps.pop();                     // 함정 제거(벗어남)
  p.trapTimer=0;
  const hpOff=p.hp;
  frames(300);                                   // regenStartTime(3s) 후 회복
  check("벗어나면 회복 재개", p.hp > hpOff);
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
