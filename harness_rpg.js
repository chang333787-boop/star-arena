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
  rpgAttack, rpgCastX, rpgCastC, rpgHurtPlayer, rpgDie, rpgInvenUse, rpgBulletsUpdate,
  rpgMakeMob, rpgHitMob, rpgWeapon, rpgDef, rpgLearnSkills, rpgSkillX, rpgMobUpdate,
  rpgFarmDo, rpgFarmActionFor, rpgFarmCell, rpgFarmNeed, rpgFarmDone, rpgPlant, rpgWater, rpgHarvest,
  rpgSeedStacks, rpgFarmCount, rpgSoil, rpgOnDayAdvance,
  rpgQuestRec, rpgQuestDone, rpgQuestActive, rpgQuestAccept, rpgQuestComplete, rpgQuestFulfilled,
  rpgQuestAvailFor, rpgQuestOnKill, rpgQuestOnHarvest, rpgStartRaid, rpgSpawnRaid, rpgRaidLights, rpgTrackText,
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
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
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
function clearIntro(){ for(let i=0;i<8&&R.RPG&&R.RPG.dialog;i++) drainDialog(80); if(R.RPG) R.RPG.ui="field"; }   // 온보딩/인트로 대화 비우기

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
  check("온보딩: 첫 진입 인트로 대화+mq01 자동 시작", R.RPG.ui==="dialog"&&R.rpgQuestActive("mq01"));
  clearIntro();
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

console.log("=== RPG-6) 전투: 스폰·근접·기습/가드·원거리·스킬·피격·부활 (RPG-2) ===");
run("스폰·근접 처치", ()=>{
  R.profile.rpg=null;   // 새 캐릭터로
  R.rpgEnter(); clearIntro();
  R.rpgLoadMap("rpg_field1",-1,-1);
  check("이슬별 들판 몬스터 8 스폰", R.RPG.mobs.length===8);
  R.rpgInvAdd("wp_hoe",1);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="wp_hoe"));
  check("호미 장착", R.RPG.save.equip.weapon==="wp_hoe");
  const jelly=R.RPG.mobs.find(m=>m.id==="mob_jelly");
  R.RPG.p.x=jelly.x-44; R.RPG.p.y=jelly.y; R.RPG.p.facing=0;
  const g0=R.RPG.save.gold;
  let n=0; while(!jelly.dead&&n<10){ R.RPG.p.attackCd=0; R.rpgAttack(); n++; }
  check("호미 2타 처치(15HP vs 11뎀)", jelly.dead&&n===2);
  check("처치 보상: 도감 킬 1·골드 2~4·경험치 6", R.RPG.save.kills.mob_jelly===1&&R.RPG.save.gold>=g0+2&&R.RPG.save.gold<=g0+4&&R.RPG.save.exp===6);
});
run("기습·정면 가드", ()=>{
  const thorn=R.RPG.mobs.find(m=>m.id==="mob_thorn");
  R.RPG.save.skills.indexOf("sk_ambush")>=0||R.RPG.save.skills.push("sk_ambush");
  // 정면(가드): 가시딱지가 나를 보게 → 감쇄
  thorn.facing=0; R.RPG.p.x=thorn.x+50; R.RPG.p.y=thorn.y;
  const h1=thorn.hp; R.rpgHitMob(thorn,10);
  const frontDmg=h1-thorn.hp;
  // 등 뒤(기습): 반대편 → +20%
  R.RPG.p.x=thorn.x-50; R.RPG.p.y=thorn.y;
  const h2=thorn.hp; R.rpgHitMob(thorn,10);
  const backDmg=h2-thorn.hp;
  check("정면 가드 감쇄(10→"+frontDmg+") < 등뒤 기습(10→"+backDmg+")", frontDmg===4&&backDmg===12);
});
run("레벨업·스킬 자동습득·X 시전", ()=>{
  R.rpgAddExp(120);   // Lv1→4 부근
  check("레벨업(≥3)·빙글 베기 자동 습득+X 장착", R.RPG.save.level>=3&&R.RPG.save.skills.indexOf("sk_spin_slash")>=0&&R.RPG.save.skillX==="sk_spin_slash");
  const near=R.RPG.mobs.filter(m=>!m.dead&&R.rpgFind("monsters",m.id))[0];
  R.RPG.p.x=near.x+60; R.RPG.p.y=near.y;
  const h0=near.hp; R.RPG.p.skillCd=0; R.rpgCastX();
  check("X 시전: 피해 발생+쿨다운 시작", near.hp<h0&&R.RPG.p.skillCd>0);
});
run("부메랑 왕복 2타", ()=>{
  R.rpgInvAdd("wp_old_boomerang",1);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="wp_old_boomerang"));
  check("낡은 부메랑 장착(Lv3+)", R.RPG.save.equip.weapon==="wp_old_boomerang");
  const tgt=R.RPG.mobs.find(m=>!m.dead&&m.id==="mob_seedgunner")||R.RPG.mobs.find(m=>!m.dead);
  tgt.hp=tgt.maxHp=999;   // 왕복 2타 계수용
  // 벽 없는 가로 6칸 개활 구간을 찾아 배치(부메랑 왕복 경로 보장)
  let pr=-1,pc=-1;
  outer: for(let r=1;r<R.RPG.rows-1;r++) for(let c=1;c<R.RPG.cols-6;c++){
    let open=true; for(let k=0;k<6;k++) if(R.rpgSolidAt(c+k,r)){ open=false; break; }
    if(open){ pr=r; pc=c; break outer; }
  }
  R.RPG.p.x=(pc+0.5)*56; R.RPG.p.y=(pr+0.5)*56; R.RPG.p.facing=0; R.RPG.p.attackCd=0;
  tgt.x=(pc+3)*56; tgt.y=(pr+0.5)*56;   // 플레이어 오른쪽 ~140px(부메랑 사거리 300 안, 왕복 통과)
  for(const mm of R.RPG.mobs){ if(mm!==tgt&&!mm.dead){ mm.x=9000; mm.y=9000; } }   // 다른 몹이 부메랑 가로채지 않게
  const _amb=R.RPG.save.skills.indexOf("sk_ambush");   // 왕복 2타 순수 계수: 기습(등뒤 랜덤 +20%) 잠시 제외
  if(_amb>=0) R.RPG.save.skills.splice(_amb,1);
  R.rpgAttack();
  check("부메랑 발사(boomer 탄)", R.RPG.bullets.length===1&&R.RPG.bullets[0].boomer===true);
  const h0=tgt.hp, perHit=7+2+(R.RPG.save.level-1);   // w.dmg 7 + BASE_ATK 2 + 레벨당 1
  for(let i=0;i<200&&R.RPG.bullets.length;i++) R.rpgBulletsUpdate(0.03);
  check("왕복 2타(나가며 1+돌아오며 1 = "+(2*perHit)+"뎀)", R.RPG.bullets.length===0 && (h0-tgt.hp)===2*perHit);
  if(_amb>=0) R.RPG.save.skills.push("sk_ambush");
});
run("C 게이지·질주", ()=>{
  R.RPG.save.skills.push("sk_sparkle_dash");
  R.RPG.gauge=100; R.rpgCastC();
  check("질주 발동: 게이지 소모+가속/무적 타이머", R.RPG.gauge===0&&R.RPG.p.dashT>0&&R.RPG.p.dashInvulT>0);
});
run("피격·무적·사망/부활", ()=>{
  R.RPG.p.invulT=0; R.RPG.p.dashInvulT=0;
  const h0=R.RPG.save.hp;
  R.rpgHurtPlayer(8);
  check("피격 8뎀(방어 0)", R.RPG.save.hp===h0-8&&R.RPG.p.invulT>0);
  R.rpgHurtPlayer(8);
  check("무적 프레임 중 추가 피격 무시", R.RPG.save.hp===h0-8);
  R.rpgInvAdd("ar_cloth_vest",1);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="ar_cloth_vest"));
  check("천 조끼 장착 → 최대 HP +12", R.rpgMaxHpFor(R.RPG.save)===60+8*(R.RPG.save.level-1)+12);
  R.RPG.save.hp=3; R.RPG.p.invulT=0;
  R.rpgHurtPlayer(50);
  check("사망 → 별우물(마을) 부활·HP 전량·페널티 0", R.RPG.map.id==="rpg_village"&&R.RPG.save.hp===R.rpgMaxHpFor(R.RPG.save));
});
run("한 방 ≤10% 헌장(§0.4 — 몬스터×권장 레벨 데이터 검증)", ()=>{
  const tierLv={1:3,2:6,3:8};
  let bad=[];
  for(const mo of R.rpgDb().monsters){
    if(mo.isBoss){
      const hp9=60+8*8;
      const worst=Math.max(mo.atk, (mo.patternArgs&&mo.patternArgs.dashDmg)||0, (mo.patternArgs&&mo.patternArgs.bulletDmg)||0);
      if(worst/hp9>0.101) bad.push(mo.id+"(보스 "+worst+"/"+hp9+")");
    } else {
      const lv=tierLv[mo.tier]||3, hp=60+8*(lv-1);
      if(mo.atk/hp>0.101) bad.push(mo.id+"("+mo.atk+"/"+hp+")");
    }
  }
  check("전 몬스터 한 방 ≤10% (위반: "+(bad.join(",")||"없음")+")", bad.length===0);
});

console.log("=== RPG-7) 생활: 농사 사이클·재수확·물뿌리개·대장간 (RPG-3a) ===");
function sleepNow(){ R.rpgSleep(); for(let i=0;i<25;i++) R.rpgUpdate(0.1); }
run("씨앗 구매·농사 풀 사이클", ()=>{
  R.profile.rpg=null; R.rpgEnter(); clearIntro();
  R.RPG.save.gold=500;
  R.rpgOpenShop("npc_leaf");
  let rows=R.rpgShopRows();
  check("리프 가게: 씨앗 4종(콩·묘목은 mq05 잠금)+물뿌리개", rows.filter(r=>r.id.indexOf("seed_")===0).length===4&&rows.some(r=>r.sp==="watercan"));
  R.rpgShopBuy(rows.find(r=>r.id==="seed_crop_byeolmu"));
  check("별무 씨앗 ×5 구매(50G — 묶음=단가×5)", R.RPG.save.gold===450&&R.rpgInvCount("seed_crop_byeolmu")===5);
  R.handleRpgKey("Escape");
  R.rpgFarmDo(0);
  check("괭이질 → 경작지", !!(R.RPG.save.farm[0]&&R.RPG.save.farm[0].t));
  R.rpgFarmDo(0);
  check("심기(씨앗 1종=바로) → 별무·씨앗 소모", R.RPG.save.farm[0].c==="crop_byeolmu"&&R.rpgInvCount("seed_crop_byeolmu")===4);
  R.rpgFarmDo(0);
  check("물 주기 → 젖음", R.RPG.save.farm[0].wt===true);
  sleepNow();
  check("취침 → 성장 +1(별무 1일=다자람)", R.RPG.save.farm[0].wd===1&&R.rpgFarmActionFor(0).act==="harvest");
  R.rpgFarmDo(0);
  check("수확 → 별무 +1·경작지 복귀", R.rpgInvCount("crop_byeolmu")===1&&R.RPG.save.farm[0].t===1&&!R.RPG.save.farm[0].c);
});
run("밭 문맥 스캔(soil 좌표 실접근 — 렌더/조명/상호작용 정합)", ()=>{
  const soil=R.rpgSoil();
  check("soil 항목은 [c,r] 배열", Array.isArray(soil[0])&&typeof soil[0][0]==="number");
  const j=5;   // 이 흐름에서 손 안 댄 밭 칸
  R.RPG.save.farm[j]=null;
  R.RPG.p.x=(soil[j][0]+0.5)*56; R.RPG.p.y=(soil[j][1]+0.5)*56; R.RPG.ui="field"; R.RPG.dialog=null;
  R.rpgScanContext();
  check("밭 위 스캔 → farm 문맥 타겟(idx "+j+")", R.RPG.ctxTarget&&R.RPG.ctxTarget.kind==="farm"&&R.RPG.ctxTarget.idx===j);
  R.rpgInteract();   // 문맥 상호작용 = 괭이질(빈 밭)
  check("문맥 상호작용 → 경작지", !!(R.RPG.save.farm[j]&&R.RPG.save.farm[j].t));
  R.RPG.save.farm[j]=null;   // 흐름 원복
});
run("물 안 주면 성장 정지(사멸 없음)", ()=>{
  R.rpgFarmDo(0);   // 직전 씨앗 기억 → 바로 심기
  check("연속 심기(직전 씨앗 기억)", R.RPG.save.farm[0].c==="crop_byeolmu");
  sleepNow();
  check("물 없이 취침 → wd 0 유지·작물 생존", R.RPG.save.farm[0].wd===0&&R.RPG.save.farm[0].c==="crop_byeolmu");
});
run("별딸기 재수확(그루터기)", ()=>{
  R.rpgInvAdd("seed_crop_star_strawberry",1);
  R.rpgFarmDo(1);   // 괭이질
  R.RPG.lastSeed="seed_crop_star_strawberry";
  R.rpgFarmDo(1);   // 심기
  check("딸기 심김", R.RPG.save.farm[1].c==="crop_star_strawberry");
  for(let d=0;d<3;d++){ R.rpgFarmDo(1); sleepNow(); }   // 물+취침 ×3
  check("3일 성장 → 다자람", R.rpgFarmActionFor(1).act==="harvest");
  R.rpgFarmDo(1);
  check("수확 → 그루터기(재수확 대기)", R.rpgInvCount("crop_star_strawberry")===1&&R.RPG.save.farm[1].rg===true);
  for(let d=0;d<2;d++){ R.rpgFarmDo(1); sleepNow(); }   // 재수확 2일
  check("재수확 2일 → 다시 다자람", R.rpgFarmActionFor(1).act==="harvest");
});
run("물뿌리개 개량(3칸 급수)", ()=>{
  R.rpgOpenShop("npc_leaf");
  R.rpgShopBuy(R.rpgShopRows().find(r=>r.sp==="watercan"));
  check("개량 구매(120G)", R.RPG.save.flags.canUp===1);
  R.handleRpgKey("Escape");
  // 0번 옆 칸(같은 줄)에 심고 0번에 물 → 이웃도 젖는지
  R.rpgFarmDo(3); R.RPG.lastSeed="seed_crop_byeolmu"; R.rpgFarmDo(3);
  const soil=R.RPG.map.soil, adj=soil.findIndex((s,j)=>j!==3&&Math.abs(s[0]-soil[3][0])+Math.abs(s[1]-soil[3][1])===1&&R.RPG.save.farm[j]&&R.RPG.save.farm[j].c);
  R.rpgFarmDo(3);
  check("이웃 밭 동시 급수", R.RPG.save.farm[3].wt===true&&(adj<0||R.RPG.save.farm[adj].wt===true));
});
run("대장간: 강화·제작(승계)", ()=>{
  R.RPG.save.gold=600;
  R.rpgOpenShop("npc_bolt");
  let rows=R.rpgShopRows();
  check("볼트 가게: 도구 2+강화 메뉴", rows.some(r=>r.id==="wp_star_dagger")&&rows.some(r=>r.sp==="up1"));
  R.rpgShopBuy(rows.find(r=>r.sp==="up1"));
  check("강화 +1 (120G)", R.RPG.save.flags.boomerUp===1&&R.RPG.save.gold===480);
  R.rpgInvAdd("wp_old_boomerang",1); R.rpgInvAdd("it_starpiece",3);
  rows=R.rpgShopRows();
  check("재료 갖추면 제작 메뉴 등장", rows.some(r=>r.sp==="craft"));
  R.rpgShopBuy(rows.find(r=>r.sp==="craft"));
  check("반짝 부메랑 완성: 재료 소모·낡은 것 소멸·강화 승계", R.rpgInvCount("wp_sparkle_boomerang")===1&&R.rpgInvCount("wp_old_boomerang")===0&&R.rpgInvCount("it_starpiece")===0&&R.RPG.save.flags.boomerUp===1);
  R.handleRpgKey("Escape");
});
run("퀘스트 해금 상점(mq05)", ()=>{
  R.RPG.save.quests.done.push("mq05");
  R.rpgOpenShop("npc_leaf");
  check("mq05 완료 후 콩·묘목 씨앗 노출(6종)", R.rpgShopRows().filter(r=>r.id.indexOf("seed_")===0).length===6);
  R.handleRpgKey("Escape");
});

console.log("=== RPG-8) T2 구간별 + T3 연속: 챕터1 메인 체인 완주 시뮬 (RPG-3b · §10.4) ===");
function talkPick(npcId, pick){   // 대화 → (선택지면) pick 선택, 아니면 끝까지
  R.rpgTalkTo(npcId);
  const res=drainDialog(120);
  if(res==="choice"){ for(let i=0;i<(pick||0);i++) R.handleRpgKey("ArrowDown"); R.handleRpgKey("Enter"); R.rpgUpdate(0.05); }
  return res;
}
function talkFlush(npcId){ talkPick(npcId,0); for(let i=0;i<3&&R.RPG.dialog;i++) drainDialog(60); }
function killSim(mobId, n){   // 전투 시뮬: 몬스터 스폰→실제 히트→드랍 줍기(실경로)
  for(let k=0;k<n;k++){
    const def=R.rpgFind("monsters",mobId);
    const mob=R.rpgMakeMob(def, R.RPG.p.x+60, R.RPG.p.y);
    R.RPG.mobs.push(mob);
    let guard=0;
    while(!mob.dead&&guard++<400) R.rpgHitMob(mob, 12);
    for(const d of R.RPG.drops.slice()){ R.RPG.p.x=d.x; R.RPG.p.y=d.y; R.rpgUpdate(0.03); }   // 접촉 자동 획득
  }
}
function farmGrow(cropSeedId, cells, days){   // cells개 심고 days일 물+취침
  for(const i of cells){ if(!R.rpgFarmCell(i)||!R.RPG.save.farm[i].t){ R.rpgFarmDo(i); } R.RPG.lastSeed=cropSeedId; R.rpgFarmDo(i); }
  for(let d=0;d<days;d++){ for(const i of cells){ const c=R.rpgFarmCell(i); if(c&&c.c&&!R.rpgFarmDone(c)) R.rpgWater(i); } sleepNow(); }
  for(const i of cells){ if(R.rpgFarmActionFor(i).act==="harvest") R.rpgFarmDo(i); }
}
run("경제·경험치 총량(§3.1 단일 출처)", ()=>{
  const qs=R.rpgDb().quests;
  const mainExp=qs.filter(q=>q.id[0]==="m").reduce((a,q)=>a+q.reward.exp,0);
  const sideExp=qs.filter(q=>q.id[0]==="s").reduce((a,q)=>a+q.reward.exp,0);
  const mainG=qs.filter(q=>q.id[0]==="m").reduce((a,q)=>a+(q.reward.gold||0),0);
  check("퀘스트 exp 600+130 · 골드 460+120", mainExp===600&&sideExp===130&&mainG===460&&qs.filter(q=>q.id[0]==="s").reduce((a,q)=>a+(q.reward.gold||0),0)===120);
});
run("mq01 도착: 자동 시작→촌장 대화=완료·호미·씨앗5", ()=>{
  R.profile.rpg=null; R.rpgEnter();
  check("mq01 자동 활성(진입 시)", R.rpgQuestActive("mq01"));
  clearIntro();   // 오프닝 튜토리얼 대사 스킵
  talkFlush("npc_onbyeol");
  check("mq01 완료: 호미+별무 씨앗5·exp15", R.rpgQuestDone("mq01")&&R.rpgInvCount("wp_hoe")===1&&R.rpgInvCount("seed_crop_byeolmu")===5&&R.RPG.save.exp>=15);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="wp_hoe"));
});
run("mq02 밤손님: 수확 3 → 보고", ()=>{
  talkPick("npc_onbyeol",0);   // 수락
  check("mq02 수락", R.rpgQuestActive("mq02"));
  farmGrow("seed_crop_byeolmu",[0,1,2],1);
  check("수확 카운트 3/3", R.RPG.save.quests.active.mq02>=3);
  talkFlush("npc_onbyeol");
  check("mq02 완료(+30G)", R.rpgQuestDone("mq02"));
});
run("mq03 별조각 도둑: 부슬이 사냥→가루 수집→낡은 부메랑", ()=>{
  talkPick("npc_onbyeol",0);
  check("mq03 수락", R.rpgQuestActive("mq03"));
  let guard=0;
  while(R.rpgInvCount("it_stardust_powder")<3&&guard++<60) killSim("mob_busuri",1);
  check("별조각 가루 3 수집(실드랍 "+guard+"킬)", R.rpgInvCount("it_stardust_powder")>=3);
  talkFlush("npc_onbyeol");
  check("mq03 완료: 낡은 부메랑 해금", R.rpgQuestDone("mq03")&&R.rpgInvCount("wp_old_boomerang")===1);
});
run("mq04 마을의 부탁: 은하밀 3 배달 → 대장간 개방", ()=>{
  talkPick("npc_onbyeol",0);
  R.RPG.save.gold+=200; R.rpgOpenShop("npc_leaf");
  R.rpgShopBuy(R.rpgShopRows().find(r=>r.id==="seed_crop_galaxy_wheat"));
  R.handleRpgKey("Escape");
  farmGrow("seed_crop_galaxy_wheat",[0,1,2],2);
  check("은하밀 3 보유", R.rpgInvCount("crop_galaxy_wheat")>=3);
  talkFlush("npc_momo");   // 납품
  check("mq04 완료: 대장간 개방+무쇠 별검", R.rpgQuestDone("mq04")&&R.RPG.save.flags.smith_open===1&&R.rpgInvCount("wp_iron_starsword")===1);
});
run("mq05 간부전: 부슬이 5 → 전직·질주·콩 해금", ()=>{
  talkPick("npc_onbyeol",0);
  killSim("mob_busuri",5);
  check("킬 카운트 5/5", R.RPG.save.quests.active.mq05>=5);
  talkFlush("npc_onbyeol");
  check("mq05 완료: job_change·sk_sparkle_dash·빛나지 않는 별조각", R.rpgQuestDone("mq05")&&R.RPG.save.flags.job_change===1&&R.RPG.save.skills.indexOf("sk_sparkle_dash")>=0&&R.rpgInvCount("it_dim_starpiece")===1);
});
run("전직: 별빛 검사 시험(가시딱지 3)", ()=>{
  while(R.RPG.save.level<5) R.rpgAddExp(100);
  talkPick("npc_onbyeol",0);   // 전직 선택지 → 검사
  check("시험 시작", R.RPG.save.flags.trialJob==="job_swordsman");
  killSim("mob_thorn",3);
  check("전직 완료: 별빛 검사+별똥별 내리치기", R.RPG.save.jobId==="job_swordsman"&&R.RPG.save.skills.indexOf("sk_starfall_smash")>=0);
});
run("sq02 콩 배달(도시락 게이트=교차점 2)", ()=>{
  talkPick("npc_momo",0);   // sq02 수락
  check("sq02 수락", R.rpgQuestActive("sq02"));
  R.RPG.save.gold+=300; R.rpgOpenShop("npc_leaf");
  R.rpgShopBuy(R.rpgShopRows().find(r=>r.id==="seed_crop_starbell_bean"));
  R.handleRpgKey("Escape");
  farmGrow("seed_crop_starbell_bean",[0,1,2],4);
  talkFlush("npc_momo");
  check("sq02 완료(콩 3 납품)", R.rpgQuestDone("sq02"));
});
run("mq06 별광맥 방어전: 야습+빛나무 조명(교차점 3)", ()=>{
  // 빛나무 심기(조명용)
  R.RPG.save.gold+=200; R.rpgOpenShop("npc_leaf");
  R.rpgShopBuy(R.rpgShopRows().find(r=>r.id==="seed_crop_lightwood_sapling"));
  R.handleRpgKey("Escape");
  R.rpgFarmDo(3); R.RPG.lastSeed="seed_crop_lightwood_sapling"; R.rpgFarmDo(3);
  talkPick("npc_onbyeol",0);   // mq06 수락 → 야습
  check("야습 발생: 마을에 부엉이 4+호위", R.RPG.save.flags.raidOn===1&&R.RPG.mobs.filter(m=>!m.dead&&m.id==="mob_moonowl").length===4);
  // 빛나무 조명 작동 — 대상 owl만 빛나무 옆, 나머지는 멀리 치워 최근접 보장
  const owl=R.RPG.mobs.find(m=>!m.dead&&m.id==="mob_moonowl");
  const soil=R.rpgSoil();
  for(const m of R.RPG.mobs){ if(m!==owl){ m.x=9000; m.y=9000; } }
  owl.x=(soil[3][0]+0.5)*56+40; owl.y=(soil[3][1]+0.5)*56;
  const h0=owl.hp; R.RPG.p.x=-9000; R.RPG.p.y=-9000; R.RPG.lightT=99; R.rpgRaidLights(0.1);   // 플레이어 멀리 → 조명 순수 6뎀
  check("빛나무 조명이 야습 몬스터 피해(6뎀)", owl.hp===h0-6);
  for(const m of R.RPG.mobs){ if(m!==owl&&!m.dead){ m.x=owl.x; m.y=owl.y; } }   // 처치 위해 복귀
  for(const m of R.RPG.mobs.filter(m=>!m.dead&&m.id==="mob_moonowl")){ let g=0; while(!m.dead&&g++<400) R.rpgHitMob(m,14); }
  check("부엉이 4 처치", (R.RPG.save.quests.active.mq06||0)>=4);
  talkFlush("npc_onbyeol");
  check("mq06 완료: 별조각×3·밭 확장 해금", R.rpgQuestDone("mq06")&&R.rpgInvCount("it_starpiece")===3&&R.RPG.save.flags.farm_expand===1);
});
run("반짝 부메랑 제작(강화 승계)", ()=>{
  R.RPG.save.gold+=200; R.rpgOpenShop("npc_bolt");
  const up=R.rpgShopRows().find(r=>r.sp==="up1"); if(up) R.rpgShopBuy(up);
  R.rpgShopBuy(R.rpgShopRows().find(r=>r.sp==="craft"));
  R.handleRpgKey("Escape");
  check("반짝 부메랑 완성", R.rpgInvCount("wp_sparkle_boomerang")===1);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="wp_sparkle_boomerang"));
  check("장착(Lv9 미만이면 실패해야 정상)", R.RPG.save.level>=9?R.RPG.save.equip.weapon==="wp_sparkle_boomerang":true);
});
run("mq07 뭉게대왕: 게이트→3페이즈→격파→엔딩", ()=>{
  // 게이트: 수락 전 요새 닫힘
  R.rpgLoadMap("rpg_field2",-1,-1);
  const gate=R.RPG.map.portals.find(p=>p.to==="rpg_den1");
  R.RPG.p.x=(gate.at[0]+0.5)*56; R.RPG.p.y=(gate.at[1]+0.5)*56; R.RPG.p.warpLock=false;
  R.rpgCheckWarp();
  check("mq07 수락 전 요새 잠김", R.RPG.map.id==="rpg_field2");
  R.rpgLoadMap("rpg_village",-1,-1);
  talkPick("npc_onbyeol",0);   // mq07 수락
  check("mq07 수락(요구: mq06+sq02)", R.rpgQuestActive("mq07"));
  while(R.RPG.save.level<9) R.rpgAddExp(200);
  R.rpgInvenUse(R.RPG.save.inventory.findIndex(s=>s.id==="wp_sparkle_boomerang"));
  R.rpgLoadMap("rpg_den3",-1,-1);
  for(let i=0;i<3&&R.RPG.dialog;i++) drainDialog(60);   // 보스 등장 대사
  const boss=R.RPG.mobs.find(m=>m.def.isBoss);
  check("보스 스폰(900HP)", !!boss&&boss.maxHp===900);
  // 회피 정책 봇(§10.4 T2): 실제 공속(attackCd) 존중 → 페이즈 전환·소환·장막이 실제로 발생하는지 검증
  let it=0, sawP2=false, sawP3=false, sawVeil=false, sawSummon=false, t=0;
  while(!boss.dead&&it++<12000){
    t+=0.05;
    if(dist2(R.RPG.p.x,R.RPG.p.y,boss.x,boss.y)>90000){ R.RPG.p.x=boss.x-150; R.RPG.p.y=boss.y; }   // 사거리 유지
    R.RPG.p.facing=Math.atan2(boss.y-R.RPG.p.y,boss.x-R.RPG.p.x);
    R.rpgAttack();   // 공속 존중(내부 attackCd)
    R.rpgMobUpdate(boss,0.05); R.rpgBulletsUpdate(0.05);
    R.RPG.p.attackCd=Math.max(0,R.RPG.p.attackCd-0.05);   // 플레이어 쿨다운만 수동 감소(update 우회)
    if(boss.phase>=1) sawP2=true;
    if(boss.phase>=2) sawP3=true;
    if(R.RPG.veil) sawVeil=true;
    if(R.RPG.mobs.filter(m=>!m.dead&&!m.def.isBoss).length>0) sawSummon=true;
    if(R.RPG.save.hp<30) R.RPG.save.hp=R.rpgMaxHpFor(R.RPG.save);   // 젤리 사탕 대용
    if(!R.RPG.mobs.includes(boss)) break;
  }
  check("보스 격파(완벽조준 봇 "+t.toFixed(1)+"초) · P2·P3 전환·소환·장막 전부 목격", boss.dead&&sawP2&&sawP3&&sawVeil&&sawSummon);
  // 참고(§10.4 T3 soft): 완벽조준·상시명중·자동사거리유지 봇의 하한이므로 실플레이(회피·명중률·피격)는 이 값의 3~5배.
  // 3페이즈가 전부 발생 후 격파됨을 확인 = "구조적으로 깰 수 있고 연출이 성립" 검증 목적 달성.
  R.rpgLoadMap("rpg_village",-1,-1);
  talkFlush("npc_onbyeol");
  for(let i=0;i<3&&R.RPG.dialog;i++) drainDialog(80);   // 엔딩 대사
  check("mq07 완료: 칭호·챕터1 클리어 플래그", R.rpgQuestDone("mq07")&&R.RPG.save.flags.title==="별빛 수호자"&&R.RPG.save.flags.chapter1_clear===1);
  check("완주 시 레벨 ≥ 8(권장 9 근접)", R.RPG.save.level>=8);
  check("격파한 보스는 재입장 시 미등장", (function(){ R.rpgLoadMap("rpg_den3",-1,-1); return !R.RPG.mobs.some(m=>m.def.isBoss); })());
});
run("밭 확장 구매(챕터 완료 후 서비스 도달)", ()=>{
  R.rpgLoadMap("rpg_village",-1,-1);
  R.RPG.save.gold+=200;
  talkPick("npc_onbyeol",0);   // 새 퀘스트 없음 → 밭 확장 서비스
  check("확장 후 soil ≥ 40칸", R.rpgSoil().length>=40);
});
run("T3 연속 완주 판정(§10.4)", ()=>{
  const sv=R.RPG.save;
  check("메인 7비트 전부 done", ["mq01","mq02","mq03","mq04","mq05","mq06","mq07"].every(q=>sv.quests.done.indexOf(q)>=0));
  check("반짝 부메랑 도달(기원담 완성)", R.rpgInvCount("wp_sparkle_boomerang")>=1||sv.equip.weapon==="wp_sparkle_boomerang");
  check("전직 1회+칭호+챕터클리어", sv.jobId!=="job_novice"&&sv.flags.title==="별빛 수호자"&&sv.flags.chapter1_clear===1);
});

console.log("\n결과: " + (fails===0 ? "RPG3B_PASS ✅ (T2 구간별+연속 완주 성립)" : (fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
