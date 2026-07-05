// 별빛 아레나 — BALANCE-1 교사용 밸런스 콘솔 검증 하니스 (2026-07-05)
// 1) 부팅 적용: localStorage에 저장된 수치가 게임 데이터에 반영되는지(파생값 포함)
// 2) 편집 로직: balSetValue 클램프·저장·기본값 복원·전체 초기화
// 3) 레지스트리 무결성: id 유일·min<max·def가 범위 안
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
// ── 부팅 전에 교사 밸런스 저장값을 심는다: 함정 피해 30 · 럭키 체력 260(파생값→hpMul 환산 확인) ──
LS["starArena.balance.v1"]=JSON.stringify({ "g.trapDamage":30, "char.student_01.hp":260, "r.siege.wallHp":45 });
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener,localStorage:lsS,prompt:()=>"t"};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;};
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={
  GAME_CONFIG, RULE_CONFIG, GROWTH, getCharacter, getWeapon, getWeaponForCharacter, PVE_ENEMY_TYPES, ABILITY,
  balanceFields, balSetValue, balResetAll, balModifiedCount, applyBalanceOverrides, loadBalanceStore, saveBalanceStore,
  handleBalanceKey, get BAL(){return BAL;}, setState:v=>{gameState=v;}, get state(){return gameState;}, STATE, handleKeyPress,
  startGame, setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;}, get player(){return player;}
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
const approx=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-9);

console.log("=== 1) 부팅 시 저장된 밸런스 적용 ===");
run("직접값·파생값·규칙값 반영", ()=>{
  check("함정 피해 12→30 적용", api.GAME_CONFIG.trapDamage===30);
  check("럭키 체력 100→260 (hpMul=2.6 환산)", approx(api.getCharacter("student_01").hpMul, 2.6, 1e-6));
  check("쿠션벽 HP 60→45 적용", api.RULE_CONFIG.siege.wallHp===45);
});
run("적용값이 실제 전투 생성에 반영", ()=>{
  api.setSel("student_01","tool_01"); api.startGame();
  check("매치 시작 시 럭키 maxHp=260", approx(api.player.maxHp, 260, 1e-6));
});

console.log("=== 2) 레지스트리 무결성 ===");
run("필드 규모·유일성·범위", ()=>{
  const reg=api.balanceFields(); const ids=new Set(); let n=0, bad=0;
  for(const c of reg.cats) for(const f of c.fields){ n++;
    if(ids.has(f.id)) bad++; ids.add(f.id);
    if(!(f.min<f.max)) bad++;
    if(!(f.def>=f.min-1e-9 && f.def<=f.max+1e-9)) { bad++; console.log("    범위 밖 def:", f.id, f.def, f.min, f.max); }
  }
  check("분류 10종(+캠페인·별빛 점프)", reg.cats.length===10);
  check("필드 120개 이상 ("+n+"개)", n>=120);
  check("id 중복·범위 오류 0건", bad===0);
});

console.log("=== 3) 편집 로직(클램프·저장·복원) ===");
run("balSetValue 클램프 + 저장", ()=>{
  const reg=api.balanceFields(), f=reg.byId["g.playerMaxHp"];
  api.balSetValue(f, 9999);
  check("최대치로 클램프(400)", api.GAME_CONFIG.playerMaxHp===400);
  check("localStorage 저장", api.loadBalanceStore()["g.playerMaxHp"]===400);
  api.balSetValue(f, f.def);
  check("기본값 복원 시 저장소에서 제거", api.loadBalanceStore()["g.playerMaxHp"]===undefined);
});
run("키 입력 흐름(숫자 입력 → Enter 확정)", ()=>{
  api.setState(api.STATE.BALANCE);
  const reg=api.balanceFields();
  api.BAL.cat=0; api.BAL.idx=reg.cats[0].fields.findIndex(f=>f.id==="g.trapDamage"); api.BAL.edit=null;
  api.handleKeyPress("Enter"); api.handleKeyPress("Digit2"); api.handleKeyPress("Digit0"); api.handleKeyPress("Enter");
  check("입력 20 → trapDamage=20", api.GAME_CONFIG.trapDamage===20);
  check("수정 카운트 ≥ 3", api.balModifiedCount()>=3);
});
run("전체 초기화", ()=>{
  api.balResetAll();
  check("trapDamage 기본(12) 복원", api.GAME_CONFIG.trapDamage===12);
  check("럭키 hpMul 기본(1.0) 복원", approx(api.getCharacter("student_01").hpMul, 1.0, 1e-6));
  check("쿠션벽 기본(60) 복원", api.RULE_CONFIG.siege.wallHp===60);
  check("저장소 비움 + 수정 0개", Object.keys(api.loadBalanceStore()).length===0 && api.balModifiedCount()===0);
});
run("퍼센트 필드 입력(30 → 0.30)", ()=>{
  const reg=api.balanceFields();
  api.BAL.cat=reg.cats.findIndex(c=>c.name==="성장 오브");
  api.BAL.idx=reg.cats[api.BAL.cat].fields.findIndex(f=>f.id==="gr.atkPct");
  api.handleKeyPress("Enter"); api.handleKeyPress("Digit3"); api.handleKeyPress("Digit0"); api.handleKeyPress("Enter");
  check("공격 오브 30% → 0.30", approx(api.GROWTH.atkPct, 0.30, 1e-9));
  api.balResetAll();
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
