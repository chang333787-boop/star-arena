// RPG모드 "별빛 마을" 하니스 (RPG모드_PRD §10.3)
// RPG-1 게이트: 데이터 무결성(T1 축소판) · 진입/이탈 · 이동/충돌 · 워프 · 대화/선택지 · 상점(사기/팔기/전부팔기)
//               · 사탕/회복 · 취침(날짜) · 세이브 4개소 왕복(게스트+계정+클라우드 레코드+초기화)
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script = m[1];

// ---- 브라우저 스텁(harness.js와 동일) ----
const noop = ()=>{};
const ctxStub = new Proxy({}, {
  get(t, prop){
    if(prop==="createLinearGradient"||prop==="createRadialGradient") return ()=>({ addColorStop: noop });
    if(prop==="measureText") return ()=>({ width: 10 });
    if(prop==="canvas") return { width:1280, height:720 };
    return (typeof t[prop] === "function") ? t[prop] : noop;
  },
  set(){ return true; }
});
const canvasStub = { width:1280, height:720, style:{}, getContext: ()=>ctxStub };
const listeners = {};
function addEventListener(type, cb){ (listeners[type]=listeners[type]||[]).push(cb); }
const localStorageData = {};
const localStorageStub = {
  getItem: (k)=> (k in localStorageData ? localStorageData[k] : null),
  setItem: (k,v)=>{ localStorageData[k]=String(v); },
  removeItem: (k)=>{ delete localStorageData[k]; }
};
globalThis.window = { innerWidth:1366, innerHeight:768, devicePixelRatio:2,
  addEventListener, localStorage:localStorageStub, prompt: ()=>"테스터" };
globalThis.document = { getElementById: ()=>canvasStub, addEventListener, hidden:false };
globalThis.localStorage = localStorageStub;
globalThis.requestAnimationFrame = (cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame = noop;

// ---- RPG 내부 API 노출 ----
script += `
;globalThis.__rpg = {
  RPG_DB, RPG_CONST, rpgDb, rpgFind, rpgItemAny, rpgNameOf,
  rpgExpNeed, rpgDefaultSave, rpgMergeSave, rpgMaxHpFor,
  rpgEnter, rpgExit, rpgUpdate, rpgRender, rpgLoadMap, rpgPersist,
  rpgTalkTo, rpgDialogAdvance, rpgChoicePick, rpgOpenShop, rpgShopRows, rpgShopBuy, rpgShopSell, rpgSellAllCrops,
  rpgInvAdd, rpgInvCount, rpgInvRemove, rpgUseCandy, rpgSleep, rpgInteract, rpgScanContext, rpgCheckWarp,
  rpgCollides, rpgSolidAt, rpgAddGold, rpgAddExp,
  handleRpgKey, handleKeyPress, keysDown,
  loadAccounts, createStudent, studentLogin, logout, resetStudent, accountToProfile, mergeProfile, saveProfile, loadProfile,
  AccountStore, PROFILE_KEY,
  get RPG(){return RPG;}, get profile(){return profile;}, get accounts(){return accounts;}, get state(){return gameState;},
  setState:(v)=>{gameState=v;},
  lsGet:(k)=>window.localStorage.getItem(k)
};`;
let R;
try { (0, eval)(script); R = globalThis.__rpg; }
catch(e){ console.log("LOAD_FAIL:", e.stack||e.message); process.exit(1); }

let fails = 0;
function check(name, cond){ console.log((cond?"  ok  ":"FAIL  ")+name); if(!cond) fails++; }
function run(name, fn){ try{ fn(); }catch(e){ console.log("THROW ["+name+"]: "+(e.stack||e.message)); fails++; } }
function drainDialog(maxSteps){   // 대화 끝(닫힘) 또는 선택지 등장까지 진행
  for(let i=0;i<(maxSteps||60);i++){
    if(!R.RPG.dialog) return "closed";
    if(R.RPG.dialog.choice) return "choice";
    R.rpgDialogAdvance(); R.rpgUpdate(0.05);
  }
  return "stuck";
}

console.log("=== RPG-1) 데이터 무결성(T1 축소판) ===");
run("데이터", ()=>{
  const db=R.rpgDb();
  check("테이블 규모: 맵10·몬스터8·도구7·작물6·NPC6·퀘스트10",
    db.maps.length===10&&db.monsters.length===8&&db.weapons.length===7&&db.crops.length===6&&db.npcs.length===6&&db.quests.length===10);
  let ghost=0;
  for(const n of db.npcs) for(const s of (n.shop||[])){ const ref=s.itemRef||s; if(!R.rpgItemAny(ref)) ghost++; }
  for(const mo of db.monsters) for(const d of (mo.drops||[])){ if(!R.rpgItemAny(d.itemId)) ghost++; }
  check("상점·드랍 유령 참조 0", ghost===0);
  let badPortal=0;
  for(const mp of db.maps) for(const p of (mp.portals||[])){
    const dst=db.maps.find(x=>x.id===p.to);
    if(!dst){ badPortal++; continue; }
    const ch=(dst.rows[p.ty]||"")[p.tx];
    if(ch===undefined||db.legend.solid.indexOf(ch)>=0) badPortal++;
  }
  check("포탈 목적지 실재+통행 가능("+db.maps.reduce((a,mp)=>a+(mp.portals||[]).length,0)+"개)", badPortal===0);
  check("대사 주입(NPC 6·시스템)", Object.keys(db.dialogs.npcs).length===6 && !!db.dialogs.system.levelup);
});

console.log("=== RPG-2) 진입·이동·충돌·워프 ===");
run("진입", ()=>{
  R.rpgEnter();
  check("진입: state=rpg · 맵=별마중 마을", R.state==="rpg" && R.RPG.map.id==="rpg_village");
  check("줌아웃 카메라(36×16 → s<1)", R.RPG.cam.s<1 && R.RPG.cam.s>0.5);
  check("스폰 위치 통행 가능", !R.rpgCollides(R.RPG.p.x, R.RPG.p.y));
});
run("이동/충돌", ()=>{
  const x0=R.RPG.p.x;
  R.keysDown.add("ArrowRight");
  for(let i=0;i<10;i++) R.rpgUpdate(0.05);
  R.keysDown.delete("ArrowRight");
  check("→ 이동으로 x 증가", R.RPG.p.x>x0+50);
  // 벽 타일 중심은 충돌, 통행 타일은 비충돌
  const db=R.rpgDb(), vil=db.maps.find(m=>m.id==="rpg_village");
  let tc=-1,tr=-1;
  for(let r=0;r<vil.rows.length&&tc<0;r++) for(let c=0;c<vil.rows[r].length;c++) if(vil.rows[r][c]==="T"){ tc=c; tr=r; break; }
  check("벽(T) 타일 중심 = 충돌 판정", R.rpgCollides((tc+0.5)*56,(tr+0.5)*56));
});
run("워프 왕복", ()=>{
  const vil=R.rpgDb().maps.find(m=>m.id==="rpg_village");
  const p0=vil.portals.find(p=>p.to==="rpg_home");
  R.RPG.p.x=(p0.at[0]+0.5)*56; R.RPG.p.y=(p0.at[1]+0.5)*56; R.RPG.p.warpLock=false;
  R.rpgCheckWarp();
  check("마을→농가 워프", R.RPG.map.id==="rpg_home");
  const home=R.rpgDb().maps.find(m=>m.id==="rpg_home");
  const back=home.portals.find(p=>p.to==="rpg_village");
  R.RPG.p.x=(back.at[0]+0.5)*56; R.RPG.p.y=(back.at[1]+0.5)*56; R.RPG.p.warpLock=false;
  R.rpgCheckWarp();
  check("농가→마을 복귀 워프", R.RPG.map.id==="rpg_village");
  check("워프 직후 재워프 잠금", R.RPG.p.warpLock===true);
});

console.log("=== RPG-3) 대화·선택지·상점 ===");
run("모모 대화→상점", ()=>{
  R.rpgLoadMap("rpg_store",-1,-1);
  R.rpgTalkTo("npc_momo");
  check("대화 열림(모모)", R.RPG.ui==="dialog" && R.RPG.dialog.lines.length>0);
  const res=drainDialog();
  check("마지막 줄에서 선택지 등장", res==="choice");
  R.handleRpgKey("Enter");   // 0번 = 가게 보기
  check("선택 0 → 상점 열림", R.RPG.ui==="shop");
});
run("사기/팔기/전부팔기", ()=>{
  R.RPG.save.gold=100;
  const rows=R.rpgShopRows();
  const ci=rows.findIndex(r=>r.id==="it_jelly_candy");
  check("모모 상점에 젤리 사탕 진열", ci>=0);
  R.rpgShopBuy(rows[ci]);
  check("구매: 골드 100→85 · 사탕 1개", R.RPG.save.gold===85 && R.rpgInvCount("it_jelly_candy")===1);
  R.rpgInvAdd("crop_byeolmu",3);
  R.RPG.shop.tab="sell";
  const sell=R.rpgShopRows();
  check("팔기 탭에 별무 표시", sell.some(r=>r.id==="crop_byeolmu"));
  R.rpgSellAllCrops();
  check("작물 전부 팔기: +54G(18×3) · 작물 0", R.RPG.save.gold===85+54 && R.rpgInvCount("crop_byeolmu")===0);
  R.handleRpgKey("Escape");
  check("Esc → 상점 닫힘(field)", R.RPG.ui==="field");
});
run("사탕·비전투 회복", ()=>{
  R.RPG.save.hp=10; R.rpgUseCandy();
  check("사탕: HP 10→35 · 소모", R.RPG.save.hp===35 && R.rpgInvCount("it_jelly_candy")===0);
  R.RPG.p.hurtT=0; const h0=R.RPG.save.hp;
  for(let i=0;i<10;i++) R.rpgUpdate(0.1);
  check("비전투 회복 ~8/s", R.RPG.save.hp>h0+6 && R.RPG.save.hp<=R.rpgMaxHpFor(R.RPG.save));
});

console.log("=== RPG-4) 취침·영속·재진입 ===");
run("취침=하루 진행", ()=>{
  const d0=R.RPG.save.day;
  R.rpgSleep();
  for(let i=0;i<25;i++) R.rpgUpdate(0.1);
  check("취침: day+1 · HP 전량 회복 · field 복귀",
    R.RPG.save.day===d0+1 && R.RPG.save.hp===R.rpgMaxHpFor(R.RPG.save) && R.RPG.ui==="field");
});
run("이탈→재진입 복원", ()=>{
  const g=R.RPG.save.gold, d=R.RPG.save.day, mapId=R.RPG.map.id;
  R.rpgExit();
  check("이탈: state=admin · profile.rpg 저장", R.state==="admin" && R.profile.rpg && R.profile.rpg.gold===g);
  check("게스트 localStorage에 rpg 동승", (R.lsGet(R.PROFILE_KEY)||"").indexOf("\"rpg\"")>=0);
  R.rpgEnter();
  check("재진입: 골드·날짜·맵 복원", R.RPG.save.gold===g && R.RPG.save.day===d && R.RPG.map.id===mapId);
  R.rpgExit();
});

console.log("=== RPG-5) 세이브 4개소 왕복(§7.3 — 로그인 유실 방지) ===");
run("계정 왕복", ()=>{
  R.loadAccounts();
  const cr=R.createStudent("s99","테스트","1234");
  check("계정 생성", cr.ok===true);
  R.studentLogin("s99","1234");
  check("신규 계정 rpg=null", !R.profile.rpg);
  R.rpgEnter();
  R.RPG.save.gold=77;
  R.rpgExit();
  check("① 계정에 rpg 동승(gold 77)", R.accounts.students.s99.rpg && R.accounts.students.s99.rpg.gold===77);
  const rec=R.AccountStore.toRecord(R.accounts.students.s99);
  check("② 클라우드 레코드에 rpg 포함", rec.rpg && rec.rpg.gold===77);
  R.logout();
  R.studentLogin("s99","1234");
  check("③ 재로그인 복원(mergeProfile 경로 — 유실 0)", R.profile.rpg && R.profile.rpg.gold===77);
  R.resetStudent("s99");
  check("④ 교사 초기화 → rpg 소거", R.accounts.students.s99.rpg===null);
  R.logout();
});

console.log("\n결과: " + (fails===0 ? "RPG1_PASS ✅" : (fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
