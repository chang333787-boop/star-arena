// 별빛 아레나 — 부팅 시 승인 맵 로드 회귀 테스트 (코드감사 2026-07-05)
// 배경: applyApprovedMaps() 부팅 호출이 EDITOR_STORE_KEY(const)보다 앞에 있으면 TDZ 예외가
//       loadEditorStore의 try/catch에 조용히 삼켜져 '승인 맵이 새로고침마다 사라지는' 버그가 된다.
//       이 하니스는 localStorage에 승인 맵을 심은 채 게임 스크립트를 부팅해, 부팅 직후 MAPS에
//       해당 맵이 실제로 반영되는지 검증한다(호출 위치가 다시 앞으로 가면 즉시 FAIL).
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
// ── 핵심: 스크립트 평가(=부팅) 전에 승인 맵을 심는다 ──
LS["starArena.editorMaps.v1"]=JSON.stringify({ pending:[], approved:[
  { id:"ed_boot1", name:"부팅테스트맵", author:"하니스", mode:"hotzone", size:[22,10], floor:"snow",
    cellsLeft:["...........",
               ".W.........",
               "...........",
               "...........",
               ".*.....O...",
               "...........",
               "...........",
               "...........",
               "...........",
               "..........."], createdAt:1 },
  { id:"ed_boot_big", name:"대형맵", author:"하니스", mode:"tdm", size:[36,16], floor:"basic",
    cellsLeft:[], createdAt:2 }   // 36폭은 탑재 제외 규칙 유지 확인용
]});
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener,localStorage:lsS,prompt:()=>"t"};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;};
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={ getMap, MAPS, get selMap(){return selectedMapId;} };`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};

console.log("=== 부팅 시 승인 맵공방 맵 자동 반영 ===");
const bm=api.MAPS.find(x=>x.id==="ed_boot1");
check("부팅 직후 MAPS에 승인 맵 존재(ed_boot1)", !!bm);
check("컴파일 결과 정상(벽 미러 2개·거점·스폰·눈밭)", !!bm && bm.obstacles.length===2 && !!bm.rulePoints.zone && !!bm.playerSpawn && bm.floor==="snow");
check("getMap으로 조회 가능", api.getMap("ed_boot1").id==="ed_boot1");
check("대형(36폭) 맵은 탑재 제외 유지", !api.MAPS.find(x=>x.id==="ed_boot_big"));

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
