// 별빛 아레나 v1.18 — 고정 매칭/능력치/마이그레이션 검증 하네스
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
globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;};
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={
  STUDENT_CHARACTERS, STUDENT_WEAPONS, GAME_CONFIG, getCharacter, getWeapon,
  getWeaponForCharacter, sanitizeLoadout, sanitizeCharacterId, isStudentCharacter,
  mergeProfile, cycleCharacter, cycleWeapon, applyProfileSelections, startGame,
  makeOnlineFighter:(slot,d)=>makeOnlineFighter(slot,d), weaponFireSpec, magSizeOf, reloadTimeOf,
  setSel:(c,w,d,mp,md)=>{selectedCharacterId=c;selectedWeaponId=w;selectedDifficultyId=d||"normal";selectedMapId=mp||"training";selectedModeId=md||"solo";
    profile.selectedCharacterId=c;profile.selectedWeaponId=w;profile.selectedDifficultyId=d||"normal";profile.selectedMapId=mp||"training";profile.selectedModeId=md||"solo";},
  get player(){return player;}, get allies(){return allies;}, get profile(){return profile;},
  get selWeapon(){return selectedWeaponId;}, get selChar(){return selectedCharacterId;},
  setState:(v)=>{gameState=v;}, get state(){return gameState;}, MENU_ROWS, SHOP_ENABLED
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
const approx=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-9);

console.log("=== 1) 고정 매칭: 캐릭터 → 도구 ===");
const MATCHING={student_01:"tool_01",student_02:"tool_02",student_03:"tool_03",student_04:"tool_04",student_05:"tool_05",student_06:"tool_06"};
run("6캐릭터 defaultWeaponId 고정", ()=>{
  for(const cid in MATCHING) check(cid+" → "+MATCHING[cid], api.getWeaponForCharacter(cid)===MATCHING[cid]);
});
run("sanitizeLoadout: 잘못된 weaponId 교정", ()=>{
  check("student_03 + star_blaster → tool_03", api.sanitizeLoadout("student_03","star_blaster").weaponId==="tool_03");
  check("레거시 캐릭터 lumi → student_01 + tool_01", (function(){ const lo=api.sanitizeLoadout("lumi","wave_cannon"); return lo.characterId==="student_01"&&lo.weaponId==="tool_01"; })());
  check("없는 id → student_01", api.sanitizeCharacterId("no_such")==="student_01");
});
run("온라인 파이터 생성 시 교정(makeOnlineFighter)", ()=>{
  const f=api.makeOnlineFighter("host",{x:100,y:100,characterId:"student_05",weaponId:"galaxy_sniper"});
  check("student_05 잘못된 무기 → tool_05", f.weaponId==="tool_05");
  const g=api.makeOnlineFighter("guest",{x:100,y:100,characterId:"stella",weaponId:"blackhole_core"});
  check("레거시 캐릭터 → student_01+tool_01", g.char.id==="student_01" && g.weaponId==="tool_01");
});
run("cycleWeapon은 무기를 바꾸지 못함(항상 고정 재교정)", ()=>{
  api.setSel("student_02","tool_02"); api.cycleWeapon(1);
  check("달이 무기 tool_02 유지", api.selWeapon==="tool_02");
});

console.log("=== 2) 캐릭터 능력치(실제 HP·이동속도 = 설계값) ===");
const STATS={student_01:[100,225],student_02:[90,216],student_03:[85,259],student_04:[95,234],student_05:[110,221],student_06:[140,209]};
run("6캐릭터 HP/속도 정확 일치", ()=>{
  for(const cid in STATS){
    api.setSel(cid,null); api.startGame();
    const p=api.player;
    check(cid+" HP="+STATS[cid][0], approx(p.maxHp,STATS[cid][0]));
    check(cid+" 속도="+STATS[cid][1], approx(p.moveSpeed,STATS[cid][1]));
    check(cid+" damageMul=1.0", api.getCharacter(cid).damageMul===1.0);
  }
});

console.log("=== 3) Z 무기 수치(피해·간격·사거리·탄속·크기·탄창·장전) ===");
// v1.21: 탄속은 설계값 × TEMPO.playerBullet(0.85) — "게임이 너무 빠름" 전역 하향.
//         시고니(tool_03) 너프: 피해 11→9.5·탄속 650→560(×0.85=476).
const WSPEC={ // [dmg, cooldown, range, speed(실효), radius, count, spreadDeg, mag, reload]
  tool_01:[18,0.42,470,520*0.85,9,1,0,7,1.3],
  tool_02:[29,0.65,680,430*0.85,14,1,0,5,1.5],
  tool_03:[9.5,0.50,500,560*0.85,10,1,0,7,1.2],
  tool_04:[5.2,0.32,260,440*0.85,7,3,32,12,1.0],
  tool_05:[14.3,0.48,363,420*0.85,12,1,0,7,1.2],   // PVE 시뮬 조정(+10%/+10%)
  tool_06:[6,0.55,310,390*0.85,10,3,24,8,1.4] };   // PVE 시뮬 조정(확산 28→24)
run("6무기 실제 발사 스펙 = 설계값", ()=>{
  for(const cid in MATCHING){
    const wid=MATCHING[cid];
    api.setSel(cid,null); api.startGame();
    const w=api.getWeapon(wid), spec=api.weaponFireSpec(api.player,w), e=WSPEC[wid];
    check(wid+" 피해 "+e[0], approx(spec.damage,e[0],1e-6));
    check(wid+" 간격 "+e[1], approx(api.GAME_CONFIG.playerAttackCooldown*w.cooldownMul,e[1],1e-6));
    check(wid+" 사거리 "+e[2], approx(spec.range,e[2],1e-6));
    check(wid+" 탄속 "+e[3], approx(spec.speed,e[3],1e-6));
    check(wid+" 크기 "+e[4], approx(spec.radius,e[4],1e-6));
    check(wid+" 발수 "+e[5]+"/확산 "+e[6], spec.count===e[5] && (w.spreadAngleDeg||0)===e[6]);
    check(wid+" 탄창 "+e[7]+"/장전 "+e[8], api.magSizeOf(api.player)===e[7] && approx(api.reloadTimeOf(api.player),e[8]));
  }
});
run("부메랑 플래그(tool_03만)", ()=>{
  check("tool_03 boomerang", api.getWeapon("tool_03").boomerang===true);
  check("tool_01 부메랑 아님", !api.getWeapon("tool_01").boomerang);
});
run("부가효과 데이터", ()=>{
  check("눈꽃 20% 둔화 0.6s (v1.21 패시브)", api.getWeapon("tool_04").slowPct===0.20 && api.getWeapon("tool_04").slowTime===0.6);
  check("별골렘 10% 둔화 0.7s", api.getWeapon("tool_06").slowPct===0.10 && api.getWeapon("tool_06").slowTime===0.7);
  check("모아 밀치기 35/0.4s", api.getWeapon("tool_05").knockback===35 && api.getWeapon("tool_05").knockImmuneTime===0.4);
});

console.log("=== 4) 프로필 마이그레이션(레거시 → 학생, 진행도 보존) ===");
run("레거시 선택/해금 → 학생 세트 교정 + 골드·전적 보존", ()=>{
  const p=api.mergeProfile({ selectedCharacterId:"stella", selectedWeaponId:"galaxy_sniper",
    unlockedCharacters:["lumi","bolt","stella","student_01"], unlockedWeapons:["star_blaster","galaxy_sniper"],
    gold:777, wins:12, losses:3, level:5, exp:40 });
  check("선택 캐릭터 → student_01", p.selectedCharacterId==="student_01");
  check("선택 무기 → 고정 무기", p.selectedWeaponId==="tool_01");
  check("해금 캐릭터 학생 6종만", p.unlockedCharacters.length===6 && p.unlockedCharacters.every(api.isStudentCharacter));
  check("해금 무기 학생 6종만", p.unlockedWeapons.length===6 && p.unlockedWeapons.every(id=>id.indexOf("tool_")===0));
  check("골드 보존(777)", p.gold===777);
  check("전적 보존", p.wins===12 && p.losses===3);   // level/exp는 계정 계층(accountToProfile)에서 별도 보존
});
run("학생 캐릭터 선택은 그대로 유지", ()=>{
  const p=api.mergeProfile({ selectedCharacterId:"student_04", selectedWeaponId:"tool_01", gold:5 });
  check("눈꽃 유지 + 무기 tool_04로 교정", p.selectedCharacterId==="student_04" && p.selectedWeaponId==="tool_04");
});

console.log("=== 5) 로비/상점 구조 ===");
run("메뉴 11행(v1.26 로비 3층 IA: 캠페인·빠른대전+스코프설정·온라인·상점·수집·설정) + 상점 비활성", ()=>{
  check("MENU_ROWS=11", api.MENU_ROWS===11);
  check("SHOP_ENABLED=false", api.SHOP_ENABLED===false);
});
run("아군 봇도 학생 캐릭터 + 고정 무기", ()=>{
  api.setSel("student_01",null,"normal","training","trio"); api.startGame();
  check("아군 2명", api.allies.length===2);
  for(const a of api.allies){
    check("봇 "+a.char.id+" 학생 캐릭터", api.isStudentCharacter(a.char.id));
    check("봇 무기 고정("+a.weaponId+")", a.weaponId===api.getWeaponForCharacter(a.char.id));
  }
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
