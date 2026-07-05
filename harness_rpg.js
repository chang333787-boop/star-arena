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

console.log("=== RPG-6) 전투: 스폰·근접·기습/가드·원거리·스킬·피격·부활 (RPG-2) ===");
run("스폰·근접 처치", ()=>{
  R.profile.rpg=null;   // 새 캐릭터로
  R.rpgEnter();
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
  R.RPG.p.x=tgt.x-150; R.RPG.p.y=tgt.y; R.RPG.p.facing=0; R.RPG.p.attackCd=0;
  R.rpgAttack();
  check("부메랑 발사(boomer 탄)", R.RPG.bullets.length===1&&R.RPG.bullets[0].boomer===true);
  const h0=tgt.hp, perHit=7+2+(R.RPG.save.level-1);   // w.dmg 7 + BASE_ATK 2 + 레벨당 1
  for(let i=0;i<200&&R.RPG.bullets.length;i++) R.rpgBulletsUpdate(0.03);
  check("왕복 2타(나가며 1+돌아오며 1 = "+(2*perHit)+"뎀)", R.RPG.bullets.length===0 && (h0-tgt.hp)===2*perHit);
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
  R.profile.rpg=null; R.rpgEnter();
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

console.log("\n결과: " + (fails===0 ? "RPG3A_PASS ✅" : (fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
