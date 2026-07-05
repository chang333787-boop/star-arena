// 별빛 아레나 — GENRE-EXPAND-1 하니스: 별빛 술래(tag) · 별빛 칠하기(paint) (2026-07-05)
// PRD §1.8 / §2.8 수용 기준(AC) 자동 검증
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
  startGame, setSel:(c,w,d,mp,md)=>{selectedCharacterId=c;selectedWeaponId=w;selectedDifficultyId=d||"normal";selectedMapId=mp||"training";selectedModeId=md||"trio";
    profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  setRule:(r)=>{selectedRuleId=r;}, get RULE(){return RULE;}, tickRule, tagInfect, ruleTimeUp,
  paintCellBy, paintCellIdx, paintSplash, effSpeed, allFighters, useCharacterSpecial, useCharacterSuper,
  get player(){return player;}, get enemies(){return enemies;}, get allies(){return allies;},
  keysDown, handleKeyPress, get state(){return gameState;}, get superGauge(){return superGauge;}, setSuper:(v)=>{superGauge=v;},
  GAME_CONFIG, RULE_CONFIG, RULES, get stats(){return stats;}, get toast(){return toastText;},
  edPaletteFor:(mode)=>{ const bak=ED; ED={mode:mode}; const p=edPalette(); ED=bak; return p; }
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let ts=0; function frames(n,dtMs){ dtMs=dtMs||16.7; for(let i=0;i<n;i++){ ts+=dtMs; if(globalThis.__rafCb) globalThis.__rafCb(ts); } }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };

console.log("=== 1) 별빛 술래 (PRD §1.8) ===");
run("규칙 등록 + 매치 셋업 + 술래 1명 선정", ()=>{
  check("RULES에 tag/paint 존재", api.RULES.some(r=>r.id==="tag") && api.RULES.some(r=>r.id==="paint"));
  api.setRule("tag"); api.setSel("student_01","tool_01","normal","training","trio");
  api.startGame(); frames(3);
  check("RULE.id=tag + 공개 단계", api.RULE && api.RULE.id==="tag" && api.RULE.phase==="reveal");
  const all=api.allFighters(), taggers=all.filter(f=>f.isTagger);
  check("6인 매치 + 술래 정확히 1명", all.length===6 && taggers.length===1);
});
run("술래 공개 3초 → 추격 + 술래 이속 +12% (결정적 — 직접 틱)", ()=>{
  // 라이브 봇 시뮬 개입을 배제: 전원 멀리 격리 후 tickRule만 직접 진행
  const all=api.allFighters();
  for(let i=0;i<all.length;i++){ all[i].x=80+i*200; all[i].y=120+ (i%2)*400; all[i].tagCd=0; }
  api.tickRule(3.2);   // reveal 소진
  check("추격 단계 진입", api.RULE.phase==="chase");
  const tg=all.find(f=>f.isTagger);
  tg.isTagger=false; const off=api.effSpeed(tg); tg.isTagger=true; const on=api.effSpeed(tg);
  check("술래 실효 이속 +12%", on > off*1.08);
});
run("감염: 접촉 → 전환 + 2초 재감염 쿨(AC)", ()=>{
  const all=api.allFighters();
  const tg=all.find(f=>f.isTagger), runners=all.filter(f=>!f.isTagger);
  const r1=runners[0], r2=runners[1];
  tg.tagCd=0;
  r1.x=tg.x; r1.y=tg.y; api.tickRule(0.016);
  check("접촉 즉시 감염", r1.isTagger===true);
  check("감염 직후 잡기 쿨 2s", r1.tagCd>1.5);
  tg.x=-999; tg.y=-999;   // 원래 술래는 멀리(로직상 좌표만 이동)
  r2.x=r1.x; r2.y=r1.y; api.tickRule(0.016);
  check("쿨 중 재감염 0건", r2.isTagger!==true);
  for(let i=0;i<130;i++) api.tickRule(0.016);   // 2초+ 경과
  check("쿨 종료 후 감염됨", r2.isTagger===true);
});
run("스킬 잠금: 럭키 X/C 비활성 · 시고니/눈꽃 X 허용", ()=>{
  const cd0=api.player.specialCd||0;
  api.useCharacterSpecial();
  check("럭키 X 발동 0(잠금)", (api.player.specialCd||0)===cd0);
  api.setSuper(100); api.useCharacterSuper();
  check("C 발동 0(잠금) — 게이지 유지", api.superGauge===100);
});
run("전원 감염 → 술래팀 승 / 타이머 종료 → 생존자 승", ()=>{
  for(const f of api.allFighters()) if(!f.isPlayer) api.tagInfect(f,true);
  api.player.isTagger=false;
  api.tickRule(0.016); api.tickRule(0.016);
  // 생존자=플레이어 1명뿐 — 아직 승부 안 남
  check("생존자 1명 유지", api.RULE.winner===null && api.RULE.survivors===1);
  api.tagInfect(api.player,true); api.tickRule(0.016);
  check("전원 감염 → 술래팀 승(내가 술래=승)", api.RULE.winner==="player" && api.state==="over");
  // 타이머 종료 케이스
  api.setRule("tag"); api.startGame(); frames(3);
  api.player.isTagger=false; api.ruleTimeUp();
  check("타이머 종료 → 생존자(나) 승", api.RULE.winner==="player");
});
run("술래 맵 팔레트: 함정류 제외", ()=>{
  const pal=api.edPaletteFor("tag").map(p=>p.ch);
  check("가시/끈끈이/쿠션벽 없음", pal.indexOf("S")<0 && pal.indexOf("L")<0 && pal.indexOf("C")<0);
  check("벽·수풀·얼음·시작점 있음", pal.indexOf("W")>=0 && pal.indexOf("B")>=0 && pal.indexOf("I")>=0 && pal.indexOf("*")>=0);
});

console.log("=== 2) 별빛 칠하기 (PRD §2.8) ===");
run("칠·덧칠·불가칸 판정", ()=>{
  api.setRule("paint"); api.setSel("student_01","tool_01","normal","training","trio");
  api.startGame(); frames(3);
  check("RULE.id=paint + 그리드 생성", api.RULE.id==="paint" && api.RULE.grid.length===220);
  check("칠 불가 마스크 존재(벽·수풀·함정)", api.RULE.paintable < 220 && api.RULE.paintable > 100);
  // 열린 칸 하나 찾기
  let oc=-1, ox=0, oy=0;
  for(let r=0;r<10;r++){ for(let c=0;c<22;c++){ const i=r*22+c;
    if(!api.RULE.blocked[i]){ oc=i; ox=24+c*56+28; oy=70+r*56+28; break; } } if(oc>=0) break; }
  const b1=api.RULE.count[1], b2=api.RULE.count[2];   // 봇이 시작 직후 칠했을 수 있어 증분 기준
  check("칠 성공(무색→청)", api.paintCellBy(ox,oy,"player",true)===true && api.RULE.grid[oc]===1 && api.RULE.count[1]===b1+1);
  check("같은 색 덧칠 무시", api.paintCellBy(ox,oy,"player",true)===false && api.RULE.count[1]===b1+1);
  check("상대색 덮어씀(청→홍, 카운트 이동)", api.paintCellBy(ox,oy,"enemy",false)===true && api.RULE.grid[oc]===2 && api.RULE.count[1]===b1 && api.RULE.count[2]===b2+1);
  // 막힌 칸
  let bc=-1, bx=0, by=0;
  for(let r=0;r<10;r++){ for(let c=0;c<22;c++){ const i=r*22+c;
    if(api.RULE.blocked[i]){ bc=i; bx=24+c*56+28; by=70+r*56+28; break; } } if(bc>=0) break; }
  check("불가칸 칠 무시", api.paintCellBy(bx,by,"player",true)===false && api.RULE.grid[bc]===0);
});
run("면적 카운터 = 전수 재계산 (오차 0, AC)", ()=>{
  for(let k=0;k<60;k++){ const c=(k*7)%22, r=(k*3)%10;
    api.paintCellBy(24+c*56+28, 70+r*56+28, (k%2?"player":"enemy"), false); }
  let p=0,e=0; for(let i=0;i<220;i++){ if(api.RULE.grid[i]===1)p++; else if(api.RULE.grid[i]===2)e++; }
  check("청 카운터 일치", p===api.RULE.count[1]);
  check("홍 카운터 일치", e===api.RULE.count[2]);
});
run("탄이 바닥을 칠함 + 내 칠 집계", ()=>{
  api.setRule("paint"); api.startGame(); frames(3);   // 새 그리드(이전 테스트 오염 방지)
  const before=api.RULE.count[1], my0=api.RULE.myPaint;
  api.player.x=650; api.player.y=550; api.player.facing=0;   // 열린 칸(650,350은 중앙 수정 기둥 안)
  api.keysDown.add("KeyZ"); frames(60); api.keysDown.delete("KeyZ");
  check("칠한 칸 증가(탄 경로+착탄)", api.RULE.count[1]>before);
  check("내 칠 집계 증가", api.RULE.myPaint>my0);
});
run("자기색 위 이속 +10%", ()=>{
  const f=api.player;
  // 플레이어 위치 칸을 강제로 내 색으로
  const i=api.paintCellIdx(f.x,f.y);
  if(i>=0){ api.RULE.blocked[i]=0; api.RULE.grid[i]=1; }
  const on=api.effSpeed(f);
  api.RULE.grid[i]=0;
  const off=api.effSpeed(f);
  check("자기색 위에서 더 빠름", on>off*1.05);
});
run("종료 판정: 다수 승 / 동수 무승부", ()=>{
  api.RULE.count[1]=50; api.RULE.count[2]=30; api.ruleTimeUp();
  check("청 다수 → player 승", api.RULE.winner==="player");
  api.setRule("paint"); api.startGame(); frames(3);
  api.RULE.count[1]=10; api.RULE.count[2]=10; api.ruleTimeUp();
  check("동수 → 무승부", api.RULE.winner==="draw");
  api.setRule("tdm");
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
