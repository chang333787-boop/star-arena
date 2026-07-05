// BIG-BATCH-2 P4 하니스: 줌아웃 카메라 + 대형맵(36×16/48×22) — 22×10 회귀 0 + 대형맵 제작→승인→플레이
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:lsS,prompt:()=>"큰맵"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=(cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={
  CAM, ARENA, ARENA_BASE, setCameraForMap, logicalToWorld, worldBegin, worldEnd,
  getMap, MAPS, applyApprovedMaps, saveEditorStore, loadEditorStore, compileEditorMap,
  startGame, setSel:(c,w,d,mp,md)=>{selectedCharacterId=c;selectedWeaponId=w;selectedDifficultyId=d||"normal";selectedMapId=mp||"training";selectedModeId=md||"trio";
    profile.selectedCharacterId=c;profile.selectedWeaponId=w;profile.selectedDifficultyId=selectedDifficultyId;
    profile.selectedMapId=selectedMapId;profile.selectedModeId=selectedModeId;},
  setRule:(r)=>{selectedRuleId=r;}, get RULE(){return RULE;}, get player(){return player;}, allFighters,
  get state(){return gameState;}, keysDown, ED_SIZES, MOUSE, getLocalIntent,
  setControl:(m2)=>{profile.controlMode=m2;}, GAME_CONFIG
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let ts=0; function frames(n,dtMs){ dtMs=dtMs||16.7; for(let i=0;i<n;i++){ ts+=dtMs; if(globalThis.__rafCb) globalThis.__rafCb(ts); } }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };

// 대형 에디터 맵 레코드 생성기(테두리 없음 · 시작점 1)
function bigRec(id, cols, rows, mode){
  const half=cols/2, rowsArr=[];
  for(let r=0;r<rows;r++){ let s2=""; for(let c=0;c<half;c++) s2+="."; rowsArr.push(s2); }
  rowsArr[Math.floor(rows/2)]="."+"*"+rowsArr[0].slice(2);
  // 수풀·벽 약간(칠 불가 마스크·오브 검증용)
  rowsArr[2]=rowsArr[2].slice(0,4)+"WW"+rowsArr[2].slice(6);
  rowsArr[3]=rowsArr[3].slice(0,6)+"BB"+rowsArr[3].slice(8);
  if(mode==="hotzone") rowsArr[1]=rowsArr[1].slice(0,half-1)+"O";
  if(mode==="stargrab") rowsArr[1]=rowsArr[1].slice(0,half-1)+"G";
  if(mode==="siege") rowsArr[4]=rowsArr[4].slice(0,2)+"X"+rowsArr[4].slice(3);
  return { id:id, name:"큰맵"+cols, author:"별", mode:mode||"tdm", size:[cols,rows], floor:"basic",
    cellsLeft:rowsArr, createdAt:1 };
}

console.log("=== 1) 22×10 회귀 0 ===");
run("기본 맵 = CAM off + ARENA 원본 그대로", ()=>{
  api.setSel("student_01","tool_01","normal","training","trio");
  api.setRule("tdm"); api.startGame(); frames(5);
  check("CAM off · scale 1", api.CAM.on===false && api.CAM.scale===1 && api.CAM.ox===0);
  check("ARENA = 24,70,1232,576", api.ARENA.x===24 && api.ARENA.y===70 && api.ARENA.w===1232 && api.ARENA.h===576);
  const p={x:640,y:360}, q=api.logicalToWorld(p);
  check("좌표 변환 = 항등", q.x===640 && q.y===360);
});

console.log("=== 2) 대형맵 제작 → 승인 → 목록 탑재 ===");
run("36×16 + 48×22 승인 → MAPS 등장(gridCols)", ()=>{
  api.saveEditorStore({pending:[], approved:[ bigRec("ed_b36",36,16,"tdm"), bigRec("ed_b48",48,22,"hotzone") ]});
  api.applyApprovedMaps();
  const m36=api.getMap("ed_b36"), m48=api.getMap("ed_b48");
  check("36×16 탑재", m36.id==="ed_b36" && m36.gridCols===36 && m36.gridRows===16);
  check("48×22 탑재", m48.id==="ed_b48" && m48.gridCols===48 && m48.gridRows===22);
  check("에디터 크기 3종(48×22 포함)", api.ED_SIZES.length===3 && api.ED_SIZES[2].cols===48);
});

console.log("=== 3) 줌아웃 카메라 수치 + 가독성 실측 ===");
run("scale·중앙 정렬·유닛 크기", ()=>{
  api.setCameraForMap(api.getMap("ed_b36"));
  const s36=api.CAM.scale;
  check("36×16: CAM on + ARENA 확장", api.CAM.on===true && api.ARENA.w===36*56 && api.ARENA.h===16*56+16);
  check("36×16: scale=화면 맞춤("+s36.toFixed(3)+")", Math.abs(s36-Math.min(1232/(36*56),576/(16*56+16)))<0.001);
  console.log("      → 36×16 캐릭터 지름 실측: "+(44*s36).toFixed(1)+"px (기본 44px)");
  api.setCameraForMap(api.getMap("ed_b48"));
  const s48=api.CAM.scale;
  check("48×22: CAM on("+s48.toFixed(3)+")", api.CAM.on===true && s48<s36);
  console.log("      → 48×22 캐릭터 지름 실측: "+(44*s48).toFixed(1)+"px (기본 44px)");
  // 월드↔화면 왕복
  const w={x:api.ARENA.x+api.ARENA.w/2, y:api.ARENA.y+api.ARENA.h/2};
  const scr={x:w.x*api.CAM.scale+api.CAM.ox, y:w.y*api.CAM.scale+api.CAM.oy};
  const back=api.logicalToWorld(scr);
  check("월드↔화면 왕복 오차 0", Math.abs(back.x-w.x)<0.001 && Math.abs(back.y-w.y)<0.001);
  check("월드 중앙 → 화면 중앙 부근", Math.abs(scr.x-640)<2 && Math.abs(scr.y-(70+288))<2);
});

console.log("=== 4) 대형맵 실플레이(모드별 스모크) ===");
for(const [mode,mapId] of [["tdm","ed_b36"],["hotzone","ed_b48"],["paint","ed_b36"],["tag","ed_b36"]]){
  run(mode+" @ "+mapId+" — 5초 무예외 + 경계 유지", ()=>{
    api.setSel("student_01","tool_01","normal",mapId,"trio");
    api.setRule(mode); api.startGame();
    api.keysDown.add("ArrowRight"); api.keysDown.add("KeyZ");
    frames(300);   // 5초
    api.keysDown.clear();
    check("상태 유지(플레이/종료)", api.state==="playing"||api.state==="over");
    let inb=true;
    for(const f of api.allFighters()){ if(f.x<api.ARENA.x-1||f.x>api.ARENA.x+api.ARENA.w+1||f.y<api.ARENA.y-1||f.y>api.ARENA.y+api.ARENA.h+1) inb=false; }
    check("전 파이터 확장 ARENA 안", inb);
    if(mode==="hotzone") check("거점=에디터 배치점(고정)", api.RULE.fixed===true);
    if(mode==="paint") check("페인트 그리드=36×16", api.RULE.cols===36 && api.RULE.rows===16);
  });
}

console.log("=== 5) 마우스 조준 월드 변환 ===");
run("mouse 모드 aimPoint = 월드 좌표", ()=>{
  api.setSel("student_01","tool_01","normal","ed_b48","trio");
  api.setRule("tdm"); api.startGame(); frames(3);
  api.setControl("mouse");
  api.MOUSE.x=640; api.MOUSE.y=360; api.MOUSE.seen=true;
  const it=api.getLocalIntent();
  const expect=api.logicalToWorld({x:640,y:360});
  check("aimPoint 월드 변환(x "+Math.round(it.aimPoint.x)+")", Math.abs(it.aimPoint.x-expect.x)<0.01 && it.aimPoint.x>1000);
  api.setControl("keyboard");
});

console.log("=== 6) 복귀: 기본 맵 → 카메라 원복 ===");
run("대형→기본 전환 시 원복", ()=>{
  api.setSel("student_01","tool_01","normal","training","trio");
  api.setRule("tdm"); api.startGame(); frames(3);
  check("CAM off + ARENA 원복", api.CAM.on===false && api.ARENA.w===1232 && api.ARENA.h===576);
  api.saveEditorStore({pending:[],approved:[]}); api.applyApprovedMaps();
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
