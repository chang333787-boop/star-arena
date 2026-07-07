// 별빛 아레나 — EDIT-TEST-1 하니스: 아레나 모드 에디터 미리하기(나+봇1 테스트플레이) 검증 (2026-07-07)
// 에디터 셀 → 즉석 컴파일 → solo(1대1) 섬멸전 플레이 → Esc/결과로 에디터 복귀 · 보상/기록 없음 · 임시맵 정리.
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return (s)=>({width:(""+s).length*8}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),addEventListener:noop};
function addEventListener(){}
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:1,addEventListener,localStorage:lsS,prompt:()=>"테스트맵",location:{hash:""}};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false,createElement:()=>({getContext:()=>ctxStub,style:{}}),head:{appendChild:noop}};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=(cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop; globalThis.setTimeout=(fn)=>0; globalThis.clearTimeout=noop; globalThis.setInterval=()=>0; globalThis.clearInterval=noop;
globalThis.firebase=undefined;
script+=`;globalThis.__e={ STATE, get state(){return gameState;}, setState:v=>{gameState=v;},
  openEditor, edStartGrid, edStartTest, edEndTest, handleKeyPress, handleEditorKey, grantMatchReward, endGame,
  get ED(){return ED;}, get edTest(){return edTest;}, get MAPS(){return MAPS;},
  get selectedMapId(){return selectedMapId;}, get selectedModeId(){return selectedModeId;}, get selectedRuleId(){return selectedRuleId;},
  get player(){return player;}, get enemies(){return enemies;}, get profile(){return profile;},
  loadProfile, get matchGoldEarned(){return matchGoldEarned;}, get matchRewardGiven(){return matchRewardGiven;},
  edTestBtnHit, setEDTestBtn:(r)=>{ED._testBtn=r;},
  compileEditorMap, validateEditorMap, starSpawnPoint, setupRuleState, get RULE(){return RULE;},
  get allies(){return allies;}, get ARENA(){return ARENA;}, get OBSTACLES(){return OBSTACLES;}, RULE_CONFIG,
  edPaletteFor:(m)=>{ ED.mode=m; return edPalette(); } };`;
let E; try{ (0,eval)(script); E=globalThis.__e; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }

let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };

E.loadProfile();

// 아레나(tdm) 에디터 맵 하나 구성
function setupArenaEditor(){
  E.openEditor();
  const ed=E.ED; ed.step="mode"; ed.mode="tdm"; ed.modeIdx=0; ed.sizeIdx=0;
  E.edStartGrid();   // tdm 22x10, 좌측 스폰 * 자동 배치
  // 벽 몇 개 배치(레이아웃 테스트용)
  ed.cells[3][3]="#"; ed.cells[5][4]="B";
  return ed;
}

console.log("=== EDIT-TEST-1) 아레나 에디터 미리하기 ===");

run("T 미리하기 → solo 섬멸전 진입(나+봇1)", ()=>{
  setupArenaEditor();
  const before={ map:E.selectedMapId, mode:E.selectedModeId, rule:E.selectedRuleId };
  E.edStartTest();
  check("게임 시작(PLAYING)", E.state===E.STATE.PLAYING);
  check("edTest 활성 + 원래 선택 보관", !!E.edTest && E.edTest.mapId===before.map);
  check("임시 맵 __edtest가 MAPS에 등록", E.MAPS.some(m=>m.id==="__edtest"));
  check("선택: 나+봇1(solo·tdm·__edtest)", E.selectedMapId==="__edtest"&&E.selectedModeId==="solo"&&E.selectedRuleId==="tdm");
  check("플레이어 1 + 적 1 스폰", !!E.player && E.enemies.length===1);
});

run("미리하기는 보상·기록 없음", ()=>{
  const g0=E.profile.gold;
  E.endGame();   // 매치 종료 → grantMatchReward
  check("결과 화면(OVER)", E.state===E.STATE.OVER);
  check("골드 미지급(0)", E.matchGoldEarned===0);
  check("프로필 골드 불변", E.profile.gold===g0);
});

run("결과에서 Esc → 에디터 복귀 + 정리", ()=>{
  const prev={ map:E.edTest.mapId, mode:E.edTest.modeId, rule:E.edTest.ruleId };
  E.handleKeyPress("Escape");
  check("EDITOR로 복귀", E.state===E.STATE.EDITOR);
  check("edTest 해제", E.edTest===null);
  check("임시 맵 __edtest 제거됨", !E.MAPS.some(m=>m.id==="__edtest"));
  check("원래 선택 복원", E.selectedMapId===prev.map&&E.selectedModeId===prev.mode&&E.selectedRuleId===prev.rule);
  check("에디터 맵 데이터 보존(편집 계속 가능)", !!E.ED && E.ED.step==="edit" && E.ED.cells[3][3]==="#");
});

run("플레이 중 Esc → 에디터 복귀(결과 안 거치고도)", ()=>{
  setupArenaEditor();
  E.edStartTest();
  check("진입 PLAYING", E.state===E.STATE.PLAYING);
  E.handleKeyPress("Escape");
  check("Esc → EDITOR", E.state===E.STATE.EDITOR && E.edTest===null);
});

run("미리하기 버튼(마우스·터치 rect) 히트 → 진입", ()=>{
  setupArenaEditor();
  E.ED._testBtn={ x:900, y:30, w:170, h:38 };   // drawEditorGrid가 채우는 rect 모사
  const hit=E.edTestBtnHit({ x:985, y:49 });
  check("버튼 중앙 히트 true", hit===true);
  check("히트 → 미리하기 진입(PLAYING)", E.state===E.STATE.PLAYING && !!E.edTest);
  E.edEndTest();
  check("버튼 밖 좌표 히트 false", E.edTestBtnHit({ x:100, y:100 })===false);
});

run("T 키(에디터) → 미리하기 · 플랫포머는 무관", ()=>{
  const ed=setupArenaEditor();
  E.handleEditorKey("KeyT");
  check("아레나 T → 미리하기 진입", E.state===E.STATE.PLAYING && !!E.edTest);
  E.edEndTest();
});

run("EDIT-TEST-2: 편집 모드로 미리하기(섬멸전 강제 아님)", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="siege"; ed.modeIdx=1; ed.sizeIdx=0; E.edStartGrid();
  // siege 필수요소 X(수정탑) 하나 배치
  ed.cells[4][5]="X";
  E.edStartTest();
  check("siege 미리하기 → 규칙이 siege(tdm 아님)", E.selectedRuleId==="siege" && E.state===E.STATE.PLAYING);
  check("비-tdm은 3v3(trio)", E.selectedModeId==="trio");
  E.edEndTest();
  check("복귀 후 원래 선택 복원", E.selectedMapId!=="__edtest");
});

console.log("=== EDITOR-MODES) 술래 개인스폰·별모으기 랜덤·수정부수기 보조탑 ===");
function compileMode(mode, place){
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode=mode; ed.sizeIdx=0; E.edStartGrid();
  place(ed);
  return E.compileEditorMap({ id:"__t", name:"t", author:"t", mode:mode, size:[ed.cols,ed.rows],
    floor:"basic", cellsLeft:ed.cells.map(r=>r.join("")), createdAt:0 });
}
run("술래(@): 개인 시작점 3개 → playerSpawns/enemySpawns 배열", ()=>{
  const map=compileMode("tag", (ed)=>{ // edStartGrid가 이미 @ 3개 배치
  });
  check("playerSpawns 3개", !!map.playerSpawns && map.playerSpawns.length===3);
  check("enemySpawns 3개(미러)", !!map.enemySpawns && map.enemySpawns.length===3);
  check("미러 대칭(x 반전)", Math.abs((map.playerSpawns[0].x + map.enemySpawns[0].x) - (24+ed_cols(map))) < 2 || map.enemySpawns[0].x!==map.playerSpawns[0].x);
});
function ed_cols(map){ return map.gridCols*56; }
run("술래 검증: @ 정확히 3개 요구", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="tag"; ed.sizeIdx=0; E.edStartGrid();
  let v=E.validateEditorMap(); check("기본(@3개) 통과", v.ok===true);
  ed.cells[0][2]="@"; v=E.validateEditorMap(); check("@4개 → 거부", v.ok===false);
});
run("별모으기: starSpawnPoint는 벽 위를 피함", ()=>{
  // ARENA 채우는 큰 장애물 하나 두고 스폰이 그 밖으로 나오는지
  E.setState(E.STATE.START);
  const A=E.ARENA;
  const save=E.OBSTACLES.slice();
  E.OBSTACLES.length=0;
  E.OBSTACLES.push({x:A.x, y:A.y, w:A.w*0.5, h:A.h});   // 좌측 절반을 벽으로
  let allRight=true;
  for(let i=0;i<20;i++){ const p=E.starSpawnPoint(); if(p && p.x < A.x+A.w*0.5) allRight=false; }
  check("스폰이 벽(좌측 절반) 위에 안 생김", allRight);
  E.OBSTACLES.length=0; for(const o of save) E.OBSTACLES.push(o);
});
run("수정부수기 보조탑(Y): subTowers 컴파일 + RULE.turrets 확장 + raux_ 접두사", ()=>{
  const map=compileMode("siege", (ed)=>{ ed.cells[3][5]="X"; ed.cells[5][3]="Y"; ed.cells[6][4]="Y"; });
  check("rulePoints.subTowers 2개", !!map.rulePoints.subTowers && map.rulePoints.subTowers.length===2);
  // 이 맵으로 로컬 siege 매치 붙여 RULE 구성
  E.openEditor(); const ed2=E.ED; ed2.step="mode"; ed2.mode="siege"; ed2.sizeIdx=0; E.edStartGrid();
  ed2.cells[3][5]="X"; ed2.cells[5][3]="Y"; ed2.cells[6][4]="Y";
  E.edStartTest();
  const R=E.RULE;
  check("siege 규칙 활성", !!R && R.id==="siege");
  check("turrets = 팀당 (메인1+보조2) = 6", R.turrets.length===6);
  const aux=R.turrets.filter(t=>t.o.sid.indexOf("raux_")===0);
  check("보조탑 4개(2팀×2) · raux_ 접두사(승리 무관)", aux.length===4 && aux.every(t=>t.o.sid.indexOf("rtower_")!==0));
  check("메인탑은 rtower_ 2개", R.turrets.filter(t=>t.o.sid.indexOf("rtower_")===0).length===2);
  E.edEndTest();
});
run("수정부수기 검증: 보조탑 최대 3개", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="siege"; ed.sizeIdx=0; E.edStartGrid();
  ed.cells[3][5]="X"; ed.cells[1][2]="Y"; ed.cells[2][2]="Y"; ed.cells[3][2]="Y"; ed.cells[4][2]="Y";
  const v=E.validateEditorMap();
  check("Y 4개 → 거부(최대 3)", v.ok===false);
});

console.log("=== FREE-MAP) 풀숲·벽 밀도는 경고(막지 않음) · 못 노는 맵만 차단 ===");
run("풀숲 가득한 컨셉맵 → 통과+경고(막지 않음)", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="tdm"; ed.modeIdx=0; ed.sizeIdx=0; E.edStartGrid();
  // 좌측 절반을 풀숲으로 덮음(스폰 1칸·시작점 인접 제외)
  for(let r=0;r<ed.rows;r++) for(let c=2;c<ed.half;c++) ed.cells[r][c]="B";
  const v=E.validateEditorMap();
  check("풀숲 15% 초과여도 제출 가능(ok:true)", v.ok===true);
  check("대신 경고 표시", typeof v.warn==="string" && v.warn.indexOf("풀숲")>=0);
});
run("스폰 없음·못 가는 곳은 여전히 차단(안전 유지)", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="tdm"; ed.modeIdx=0; ed.sizeIdx=0; E.edStartGrid();
  // 시작점(*) 제거 → 시작점 0개
  for(let r=0;r<ed.rows;r++) for(let c=0;c<ed.half;c++) if(ed.cells[r][c]==="*") ed.cells[r][c]=".";
  check("시작점 없으면 여전히 차단", E.validateEditorMap().ok===false);
});
run("벽 미로(25% 초과) 연결되면 통과", ()=>{
  E.openEditor(); const ed=E.ED; ed.step="mode"; ed.mode="tdm"; ed.modeIdx=0; ed.sizeIdx=0; E.edStartGrid();
  // 성긴 벽 다수(연결성 유지되게 띄엄띄엄) — 벽 비율만 올림
  for(let r=1;r<ed.rows-1;r+=2) for(let c=2;c<ed.half;c+=2) ed.cells[r][c]="W";
  const v=E.validateEditorMap();
  check("연결된 벽 많은 맵 → 통과(막지 않음)", v.ok===true);
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
