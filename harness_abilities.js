// 별빛 아레나 v1.18 — Z 부가효과 / X 특수기술 / C 궁극기 동작 검증 하네스(로컬 엔진 기준)
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
  GAME_CONFIG, getWeapon, getAbility, getWeaponForCharacter,
  startGame, handleKeyPress, keysDown, useCharacterSpecial, useCharacterSuper,
  castSpecialFor, castUltimateFor, envLocal, tickSkillZones, tickMoaPassive, bulletHitDamage, get skillZones(){return skillZones;},
  newAttackId, tryChargeGauge, applySlowTo, applyKnockbackTo, effSpeed, atkSlowFactor, incomingDamage, applyDamage, isFrozen,
  get player(){return player;}, get allies(){return allies;}, get enemies(){return enemies;}, get enemy(){return enemy;},
  get bullets(){return bullets;}, get superGauge(){return superGauge;}, setSuper:(v)=>{superGauge=v;},
  setSel:(c,w,d,mp,md)=>{selectedCharacterId=c;selectedWeaponId=w||null;selectedDifficultyId=d||"normal";selectedMapId=mp||"training";selectedModeId=md||"solo";
    profile.selectedCharacterId=c;profile.selectedWeaponId=w||null;profile.selectedDifficultyId=d||"normal";profile.selectedMapId=mp||"training";profile.selectedModeId=md||"solo";},
  setState:(v)=>{gameState=v;}, get state(){return gameState;}, setObstacles:(a)=>{OBSTACLES=a;}
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let ts=0; const frames=(n,dt)=>{dt=dt||16.7;for(let i=0;i<n;i++){ts+=dt;globalThis.__r(ts);}};
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
// 준비: 적을 고정(빙결)시켜 결정적으로 만들고, 정면에 배치
function setup(charId, foeDx){
  api.setSel(charId,null,"normal","training","solo");
  api.startGame(); frames(2);
  const p=api.player, e=api.enemy;
  p.facing=0; e.freezeTimer=9999; e.invincibleTimer=0; e.hp=e.maxHp;
  e.x=p.x+ (foeDx||150); e.y=p.y;
  return {p:p,e:e};
}

console.log("=== 1) 시고니 부메랑: 왕복 각 1회 타격 + attackId 게이지 20 ===");
run("부메랑 왕복", ()=>{
  const {p,e}=setup("student_03", 150);
  api.setSuper(0);
  api.keysDown.add("KeyZ"); frames(1); api.keysDown.clear();   // 1회 발사
  check("부메랑 1발 생성", api.bullets.length===1 && api.bullets[0].boomerang===true);
  const hp0=e.maxHp;
  frames(50);   // 나가기(150/476≈0.32s) — 1타 (v1.21 너프: 9.5·탄속 476)
  const afterOut=e.hp;
  check("나갈 때 9.5 피해", Math.abs(hp0-afterOut-9.5)<1e-6);
  frames(190);  // 500까지 갔다가 복귀 — 2타 후 소멸
  // 복귀타는 적의 등 뒤에서 맞음 → 기습 패시브 +20% (9.5×1.2=11.4). 총 20.9
  check("돌아올 때 추가 11.4(기습 +20% — 총 20.9)", Math.abs(hp0-e.hp-20.9)<1e-6);
  check("부메랑 소멸(잔류 없음)", api.bullets.length===0);
  check("왕복 2타여도 게이지 최대 20", api.superGauge===20);
});

console.log("=== 2) 다중탄 = 탄약 1 소비 + 같은 대상 게이지 20 ===");
run("눈꽃 2발/탄약1", ()=>{                                  // GAMEPLAY-1: 탄막 정리 — 발수 3→2(확산 ±12° → 90px 표적이면 명중)
  const {p,e}=setup("student_04", 90);
  api.setSuper(0);
  const ammo0=p.ammo;
  api.keysDown.add("KeyZ"); frames(1); api.keysDown.clear();
  check("방울 2발 생성", api.bullets.length===2);
  check("탄약 1개만 소비", p.ammo===ammo0-1);
  frames(30);   // 명중(150px, 440spd)
  check("최소 1발 이상 명중해도 게이지 20", api.superGauge===20);
  check("둔화 적용(20% — v1.21 패시브)", e.wSlowTimer>0 && Math.abs(e.wSlowPct-0.20)<1e-9);
});
run("둔화 중첩 없음(시간만 갱신)", ()=>{
  const {e}=setup("student_04", 60);
  api.applySlowTo(e, 0.20, 0.6);
  api.applySlowTo(e, 0.20, 0.6);
  check("pct 그대로 20%", Math.abs(e.wSlowPct-0.20)<1e-9);
  check("타이머 0.6 이하(누적 아님)", e.wSlowTimer<=0.6+1e-9);
  api.applySlowTo(e, 0.30, 0.2);
  check("더 강한 둔화(30%)로 교체", Math.abs(e.wSlowPct-0.30)<1e-9);
});

console.log("=== 3) 모아 밀치기 + 0.4초 면역 ===");
run("밀치기 면역", ()=>{
  const {p,e}=setup("student_05", 100);
  const x0=e.x;
  api.applyKnockbackTo(e, p.x, p.y, 35, 0.4);
  check("35만큼 밀림", Math.round(e.x-x0)===35);
  const x1=e.x;
  api.applyKnockbackTo(e, p.x, p.y, 35, 0.4);
  check("면역 중 추가 밀치기 없음", e.x===x1);
});

console.log("=== 4) attackId 게이지 상한 ===");
run("같은 공격·같은 대상 20, 다른 대상은 각각", ()=>{
  const aid=api.newAttackId(); let g=0;
  api.tryChargeGauge(aid,"t1",()=>{g+=20;});
  api.tryChargeGauge(aid,"t1",()=>{g+=20;});
  check("같은 대상 2회 → 20", g===20);
  api.tryChargeGauge(aid,"t2",()=>{g+=20;});
  check("다른 대상 → 40", g===40);
});

console.log("=== 5) X/C 피해로 게이지 충전 금지 ===");
run("럭키 C(v1.21b: 일자 폭발) 명중해도 게이지 0 유지", ()=>{
  const {p,e}=setup("student_01", 80);
  api.setSuper(100);
  api.handleKeyPress("KeyC"); frames(70);   // 예고 0.5s+순차 폭발 대기
  check("C 시전 후 게이지 0", api.superGauge===0);
  check("적이 피해 받음(45·시전당 1회)", Math.round(e.maxHp-e.hp)===45);
  check("C 피해로 재충전 안 됨", api.superGauge===0);
  check("장판 정리됨", !api.skillZones.some(z=>z.type==="meteor"));
});
run("럭키 X(v1.21b 스왑: 일곱 발): 부채꼴 7발·대상당 27·게이지 0 유지", ()=>{
  const {p,e}=setup("student_01", 160);
  api.setSuper(0);
  api.handleKeyPress("KeyX");
  check("부채꼴 7발 생성", api.bullets.length===7);
  check("대상당 상한 3발(9×3=27)", api.bullets[0].ultMaxHits===3);
  frames(60);
  check("같은 대상 최대 27 피해", (e.maxHp-e.hp)<=27+1e-6 && e.hp<e.maxHp);
  check("X 피해로 게이지 충전 없음", api.superGauge===0);
});

console.log("=== 6) 별골렘 X 방패 생성(GAMEPLAY-1): 흡수막 80(4초)·막은 피해로 궁 충전 ===");
run("흡수막", ()=>{
  const {p}=setup("student_06", 400);
  api.castSpecialFor(p, api.envLocal());
  check("흡수막 80·4초·쿨8s", p.shieldAbsorb===80 && p.shieldAbsorbTimer>3.9 && p.specialCd<=8);
  const g0=api.superGauge; const hp0=p.hp;
  api.applyDamage(p, 10, "enemy", 999, p.x, p.y);
  check("10 피해 전부 흡수(HP 불변·막 70 잔여)", p.hp===hp0 && p.shieldAbsorb===70);
  check("수호자 패시브: 막은 10×0.6=6 게이지", Math.abs(api.superGauge-(g0+6))<1e-6);
  api.applyDamage(p, 100, "enemy", 999, p.x, p.y);
  check("막 70 흡수 후 초과 30만 HP 피해", Math.abs((hp0-p.hp)-30)<1e-6 && p.shieldAbsorb===0);
  check("이동 패널티 없음(×TEMPO만)", Math.abs(api.effSpeed(p)-p.moveSpeed*0.90)<1e-6);
});
run("흡수막 아군 부여(조준 방향)", ()=>{
  api.setSel("student_06",null,"normal","training","trio"); api.startGame(); frames(2);
  const p=api.player, ally=api.allies[0];
  ally.x=p.x+120; ally.y=p.y; p.facing=0;                    // 바라보는 방향의 아군
  p.specialCd=0;
  api.castSpecialFor(p, api.envLocal());
  check("본인+조준 아군 모두 흡수막", p.shieldAbsorb===80 && ally.shieldAbsorb===80);
});

console.log("=== 7) 시고니 C 질주: 1초 무적 + 후반 50% 감소 + 45% 가속 ===");
run("질주 버프", ()=>{
  const {p}=setup("student_03", 400);
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("가속 3초", p.cSpeedTimer>2.9);
  check("처음 1초 무적", p.invincibleTimer>0.9);
  check("이동속도 +45%(×TEMPO)", Math.abs(api.effSpeed(p)-p.moveSpeed*1.45*0.90)<1e-6);
  const hp0=p.hp;
  api.applyDamage(p, 20, "enemy", 999, p.x, p.y);
  check("무적 중 피해 0", p.hp===hp0);
  p.invincibleTimer=0;                     // 1초 경과 가정
  api.applyDamage(p, 20, "enemy", 999, p.x, p.y);
  check("후반 피해 50%(10)", Math.abs((hp0-p.hp)-10)<1e-6);
});

console.log("=== 8) 모아(v1.21 서포터): X 오오라 기물 / C 전체 무적 2초 / 패시브 근처 회복 ===");
run("X 오오라 기물: 5초·반경140·팀원 초당 10", ()=>{
  api.setSel("student_05",null,"normal","training","trio"); api.startGame(); frames(2);   // v1.26: duo 제거 → trio(아군 2)로 아군 확보
  const p=api.player, ally=api.allies[0], e=api.enemy;
  e.freezeTimer=9999; e.x=p.x+500;
  ally.freezeTimer=9999; ally.x=p.x+50; ally.y=p.y;
  p.hp=p.maxHp; ally.hp=ally.maxHp-50;
  api.castSpecialFor(p, api.envLocal());
  check("오오라 기물 설치(5초)", api.skillZones.some(z=>z.type==="healTotem" && z.timer===5));
  const h0=ally.hp;
  for(let i=0;i<63;i++) api.tickSkillZones(1/60, api.envLocal());
  check("팀원 1초에 +10", Math.abs(ally.hp-(h0+10))<1e-6);
  check("적은 회복 없음", e.hp===e.maxHp);
  p.specialCd=0;
  api.castSpecialFor(p, api.envLocal());
  check("동시 1개만 존재", api.skillZones.filter(z=>z.type==="healTotem").length===1);
});
run("모아 C: 살아있는 팀 전체(본인 포함) 무적 1.2초(GAMEPLAY-1 너프)", ()=>{
  api.setSel("student_05",null,"normal","training","trio"); api.startGame(); frames(2);   // v1.26: duo 제거 → trio(아군 2)로 아군 확보
  const p=api.player, ally=api.allies[0], e=api.enemy;
  e.freezeTimer=9999; ally.freezeTimer=9999;
  p.invincibleTimer=0; ally.invincibleTimer=0; const einv0=e.invincibleTimer||0;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("본인 무적 1.2초", p.invincibleTimer===1.2);
  check("아군 무적 1.2초", ally.invincibleTimer===1.2);
  check("적은 무적 없음", (e.invincibleTimer||0)===einv0);
  check("게이지 0", api.superGauge===0);
  const hp0=p.hp;
  api.applyDamage(p, 30, "enemy", 999, p.x, p.y);
  check("무적 중 피해 0", p.hp===hp0);
});
run("모아 패시브: 반경 180 팀원 초당 5(본인 제외)", ()=>{
  api.setSel("student_05",null,"normal","training","trio"); api.startGame(); frames(2);   // v1.26: duo 제거 → trio(아군 2)로 아군 확보
  const p=api.player, ally=api.allies[0];
  ally.freezeTimer=9999; ally.x=p.x+100; ally.y=p.y; ally.hp=ally.maxHp-30;
  const h0=ally.hp; p.moaAcc=0;
  for(let i=0;i<63;i++) api.tickMoaPassive(p, 1/60, api.envLocal);
  check("1초에 +5", Math.abs(ally.hp-(h0+5))<1e-6);
  ally.x=p.x+400; const h1=ally.hp; p.moaAcc=0;
  for(let i=0;i<63;i++) api.tickMoaPassive(p, 1/60, api.envLocal);
  check("반경 밖(400px)은 회복 없음", ally.hp===h1);
});

console.log("=== 9) 눈꽃 X 서리 바닥(GAMEPLAY-1: 이동+공속 둔화) / C 빙결 너프(보스 저항) ===");
run("서리 바닥: 30% 이동 둔화 + 공격간격 +40% + 첫 진입 4", ()=>{
  const {p,e}=setup("student_04", 150);
  api.handleKeyPress("KeyX");
  check("서리 장판 생성", api.skillZones.some(z=>z.type==="ice"));
  const hp0=e.hp;
  api.tickSkillZones(0.1, api.envLocal());
  check("첫 진입 피해 4", Math.abs((hp0-e.hp)-4)<1e-6);
  check("30% 이동 둔화", Math.abs(e.wSlowPct-0.30)<1e-9 && e.wSlowTimer>0);
  check("공속 둔화(간격 ×1.4)", e.atkSlowTimer>0 && Math.abs(api.atkSlowFactor(e)-1.4)<1e-9);
  const hp1=e.hp;
  api.tickSkillZones(0.5, api.envLocal());
  check("같은 바닥 반복 피해 없음", e.hp===hp1);
});
run("눈꽃 C(GAMEPLAY-1 너프): 빙결 1초+깨질 때 30 / 보스는 50% 둔화+30", ()=>{
  const {p,e}=setup("student_04", 100);
  e.freezeTimer=0;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("일반 적 빙결(1초)", e.freezeTimer>0.9);
  check("빙결 중 이동속도 0", api.effSpeed(e)===0);
  const hp0=e.hp;
  api.tickSkillZones(1.05, api.envLocal());
  check("빙결 종료 시 30 피해", Math.abs((hp0-e.hp)-30)<1e-6);
  // 보스 저항
  const {p:p2,e:e2}=setup("student_04", 100);
  e2.freezeTimer=0; e2.isBoss=true;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("보스는 빙결 없음", !(e2.freezeTimer>0));
  check("보스 50% 둔화", Math.abs(e2.wSlowPct-0.50)<1e-9);
  check("보스 피해 30 즉시", Math.abs((e2.maxHp-e2.hp)-30)<1e-6);
});

console.log("=== 10) 달이(v1.21 저격수): X 대형 탄환 / C 관통 일직선 / 패시브 ===");
run("달이 X: 38dmg/950rng/560spd/r26 + 저격 플래그", ()=>{
  const {p,e}=setup("student_02", 300);
  api.handleKeyPress("KeyX");
  const xb=api.bullets[api.bullets.length-1];
  check("X 탄환 38/950/560/r26", Math.round(xb.damage)===38 && xb.maxRange===950 && Math.round(Math.hypot(xb.vx,xb.vy))===560 && xb.r===26);
  check("X 탄환은 게이지 미충전(isSuper)", xb.isSuper===true);
  check("저격 패시브 플래그(snipe=320)", xb.snipe===320);
});
run("달이 C: 눈앞 일직선(900×56) 위 적 55 즉시 + 저격선 이펙트", ()=>{
  const {p,e}=setup("student_02", 300);
  p.facing=0; e.y=p.y;                       // 일직선 위
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("라인 위 적 55 피해(즉시)", Math.abs((e.maxHp-e.hp)-55)<1e-6);
  check("저격선 이펙트 존(beam)", api.skillZones.some(z=>z.type==="beam"));
  check("게이지 0", api.superGauge===0);
});
run("달이 패시브: 320px+ 비행 후 명중 +30%", ()=>{
  check("원거리 29→37.7", Math.abs(api.bulletHitDamage({damage:29,snipe:320,traveled:350,vx:1,vy:0},{facing:0})-37.7)<1e-6);
  check("근거리 보너스 없음", api.bulletHitDamage({damage:29,snipe:320,traveled:100,vx:1,vy:0},{facing:0})===29);
});
run("시고니 패시브: 등 뒤 명중 +20%", ()=>{
  check("등 뒤 10→12", Math.abs(api.bulletHitDamage({damage:10,stab:1,vx:1,vy:0},{facing:0})-12)<1e-9);
  check("정면 보너스 없음", api.bulletHitDamage({damage:10,stab:1,vx:1,vy:0},{facing:Math.PI})===10);
});

console.log("=== 11) 별골렘 C 블랙홀: 끌어당김 + 상한 18 + 아군 무영향 ===");
run("블랙홀", ()=>{
  api.setSel("student_06",null,"normal","training","trio"); api.startGame(); frames(2);   // v1.26: duo 제거 → trio(아군 2)로 아군 확보
  const p=api.player, ally=api.allies[0], e=api.enemy;
  p.facing=0; e.freezeTimer=9999; e.invincibleTimer=0; e.hp=e.maxHp;
  const A=api.getAbility("student_06").c;
  e.x=p.x+A.dist+100; e.y=p.y;
  ally.freezeTimer=9999; ally.x=p.x+A.dist-50; ally.y=p.y; const allyX0=ally.x, allyHp0=ally.hp;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("블랙홀 생성", api.skillZones.some(z=>z.type==="blackhole"));
  const ex0=e.x;
  api.tickSkillZones(0.5, api.envLocal());
  check("적이 끌려옴", e.x<ex0);
  check("아군은 안 끌림", ally.x===allyX0);
  api.tickSkillZones(0.6, api.envLocal());   // 1틱째 피해
  api.tickSkillZones(1.0, api.envLocal());   // 2틱
  api.tickSkillZones(1.0, api.envLocal());   // 3틱(장판 수명 3s 내)
  const dmg=e.maxHp-e.hp;
  check("지속 피해 발생(최대 18)", dmg>0 && dmg<=18+1e-6);
  check("아군 피해 없음", ally.hp===allyHp0);
});

console.log("=== 12) 빙결 중 공격 불가 + X/C 시전 불가 ===");
run("빙결 상태 제약", ()=>{
  const {p,e}=setup("student_01", 150);
  p.freezeTimer=1.0;
  check("isFrozen", api.isFrozen(p));
  const n0=api.bullets.length;
  api.keysDown.add("KeyZ"); frames(2); api.keysDown.clear();
  check("빙결 중 Z 발사 안 됨", api.bullets.length===n0);
  const ok=api.castSpecialFor(p, api.envLocal());
  check("빙결 중 X 시전 불가", ok===false);
  p.freezeTimer=0;
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
