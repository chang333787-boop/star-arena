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
  edTestBtnHit, setEDTestBtn:(r)=>{ED._testBtn=r;} };`;
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

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
