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
  castSpecialFor, castUltimateFor, envLocal, tickSkillZones, get skillZones(){return skillZones;},
  newAttackId, tryChargeGauge, applySlowTo, applyKnockbackTo, effSpeed, incomingDamage, applyDamage, isFrozen,
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
  frames(40);   // 나가기(150/650≈0.23s) — 1타
  const afterOut=e.hp;
  check("나갈 때 11 피해", Math.round(hp0-afterOut)===11);
  frames(140);  // 500까지 갔다가 복귀 — 2타 후 소멸
  check("돌아올 때 추가 11(총 22)", Math.round(hp0-e.hp)===22);
  check("부메랑 소멸(잔류 없음)", api.bullets.length===0);
  check("왕복 2타여도 게이지 최대 20", api.superGauge===20);
});

console.log("=== 2) 다중탄 = 탄약 1 소비 + 같은 대상 게이지 20 ===");
run("눈꽃 3발/탄약1", ()=>{
  const {p,e}=setup("student_04", 150);
  api.setSuper(0);
  const ammo0=p.ammo;
  api.keysDown.add("KeyZ"); frames(1); api.keysDown.clear();
  check("방울 3발 생성", api.bullets.length===3);
  check("탄약 1개만 소비", p.ammo===ammo0-1);
  frames(30);   // 명중(150px, 440spd)
  check("최소 1발 이상 명중해도 게이지 20", api.superGauge===20);
  check("둔화 적용(12%)", e.wSlowTimer>0 && Math.abs(e.wSlowPct-0.12)<1e-9);
});
run("둔화 중첩 없음(시간만 갱신)", ()=>{
  const {e}=setup("student_04", 60);
  api.applySlowTo(e, 0.12, 0.6);
  api.applySlowTo(e, 0.12, 0.6);
  check("pct 그대로 12%", Math.abs(e.wSlowPct-0.12)<1e-9);
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
run("럭키 C 명중해도 게이지 0 유지", ()=>{
  const {p,e}=setup("student_01", 80);
  api.setSuper(100);
  api.handleKeyPress("KeyC"); frames(20);
  check("C 발사 후 게이지 0", api.superGauge===0);
  check("적이 피해 받음", e.hp<e.maxHp);
  check("C 피해로 재충전 안 됨", api.superGauge===0);
});
run("럭키 X(별똥별) 폭발 피해 22 · 게이지 0 유지", ()=>{
  const {p,e}=setup("student_01", 220);
  api.setSuper(0);
  api.handleKeyPress("KeyX");
  check("별똥별 장판 생성", api.skillZones.some(z=>z.type==="meteor"));
  frames(40);   // 0.45초 예고 후 폭발
  check("폭발 피해 22", Math.round(e.maxHp-e.hp)===22);
  check("X 피해로 게이지 충전 없음", api.superGauge===0);
  check("장판 정리됨", !api.skillZones.some(z=>z.type==="meteor"));
});

console.log("=== 6) 별골렘 X 방패: 60% 감소·최소 1 ===");
run("방패 피해 감소", ()=>{
  const {p}=setup("student_06", 400);
  api.castSpecialFor(p, api.envLocal());
  check("방패 켜짐(2.5s)", p.shieldTimer>2.4);
  const hp0=p.hp;
  api.applyDamage(p, 10, "enemy", 999, p.x, p.y);
  check("10 피해 → 4로 감소", Math.abs((hp0-p.hp)-4)<1e-6);
  const hp1=p.hp;
  api.applyDamage(p, 1, "enemy", 999, p.x, p.y);
  check("최소 피해 1 보장", Math.abs((hp1-p.hp)-1)<1e-6);
  check("이동속도 20% 감소", Math.abs(api.effSpeed(p)-p.moveSpeed*0.8)<1e-6);
});

console.log("=== 7) 시고니 C 질주: 1초 무적 + 후반 50% 감소 + 45% 가속 ===");
run("질주 버프", ()=>{
  const {p}=setup("student_03", 400);
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("가속 3초", p.cSpeedTimer>2.9);
  check("처음 1초 무적", p.invincibleTimer>0.9);
  check("이동속도 +45%", Math.abs(api.effSpeed(p)-p.moveSpeed*1.45)<1e-6);
  const hp0=p.hp;
  api.applyDamage(p, 20, "enemy", 999, p.x, p.y);
  check("무적 중 피해 0", p.hp===hp0);
  p.invincibleTimer=0;                     // 1초 경과 가정
  api.applyDamage(p, 20, "enemy", 999, p.x, p.y);
  check("후반 피해 50%(10)", Math.abs((hp0-p.hp)-10)<1e-6);
});

console.log("=== 8) 모아 X 구급상자 / C 전체 회복(팀만) ===");
run("구급상자: 처음 닿은 아군 30, 1회용, 1인 1개", ()=>{
  api.setSel("student_05",null,"normal","training","duo"); api.startGame(); frames(2);
  const p=api.player, ally=api.allies[0], e=api.enemy;
  e.freezeTimer=9999; e.x=p.x+500;
  ally.freezeTimer=9999;                    // 아군 고정
  p.hp=p.maxHp; ally.hp=ally.maxHp-50;
  ally.x=p.x+10; ally.y=p.y;                // 상자 반경(32) 안
  api.castSpecialFor(p, api.envLocal());
  check("구급상자 설치", api.skillZones.some(z=>z.type==="medkit"));
  api.tickSkillZones(0.05, api.envLocal());
  check("아군 30 회복", Math.abs(ally.hp-(ally.maxHp-20))<1e-6);
  check("사용 후 제거(1회용)", !api.skillZones.some(z=>z.type==="medkit"));
  p.specialCd=0;
  api.castSpecialFor(p, api.envLocal()); api.castSpecialFor(p, api.envLocal());
  check("동시 1개만 존재", api.skillZones.filter(z=>z.type==="medkit").length===1);
});
run("모아 C: 살아있는 팀원만 +100(초과 금지·부활 없음·적 회복 없음)", ()=>{
  api.setSel("student_05",null,"normal","training","duo"); api.startGame(); frames(2);
  const p=api.player, ally=api.allies[0], e=api.enemy;
  e.freezeTimer=9999; const ehp0=e.hp=e.maxHp-30;
  p.hp=p.maxHp-40; ally.hp=ally.maxHp-120<1?1:ally.maxHp-100; ally.hp=Math.max(1,ally.maxHp-100);
  const deadAllyHp=0;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("자신 회복(최대 상한)", p.hp===p.maxHp);
  check("아군 +100", Math.abs(ally.hp-Math.min(ally.maxHp, Math.max(1,ally.maxHp-100)+100))<1e-6);
  check("적은 회복 안 됨", e.hp===ehp0);
  check("게이지 0", api.superGauge===0);
});

console.log("=== 9) 눈꽃 X 얼음바닥 / C 빙결(보스 저항) ===");
run("얼음 바닥: 30% 둔화 + 첫 진입 4", ()=>{
  const {p,e}=setup("student_04", 150);
  api.handleKeyPress("KeyX");
  check("얼음 장판 생성", api.skillZones.some(z=>z.type==="ice"));
  const hp0=e.hp;
  api.tickSkillZones(0.1, api.envLocal());
  check("첫 진입 피해 4", Math.abs((hp0-e.hp)-4)<1e-6);
  check("30% 둔화", Math.abs(e.wSlowPct-0.30)<1e-9 && e.wSlowTimer>0);
  const hp1=e.hp;
  api.tickSkillZones(0.5, api.envLocal());
  check("같은 바닥 반복 피해 없음", e.hp===hp1);
});
run("눈꽃 C: 일반 적 빙결 1초+깨질 때 30 / 보스는 40% 둔화+30", ()=>{
  const {p,e}=setup("student_04", 100);
  e.freezeTimer=0;
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  check("일반 적 빙결", e.freezeTimer>0.9);
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
  check("보스 40% 둔화", Math.abs(e2.wSlowPct-0.40)<1e-9);
  check("보스 피해 30 즉시", Math.abs((e2.maxHp-e2.hp)-30)<1e-6);
});

console.log("=== 10) 달이 X/C ===");
run("달이 X: 38dmg/950rng 탄환 · C: 반사 비행기", ()=>{
  const {p,e}=setup("student_02", 300);
  api.handleKeyPress("KeyX");
  const xb=api.bullets[api.bullets.length-1];
  check("X 탄환 38/950/480/r16", Math.round(xb.damage)===38 && xb.maxRange===950 && Math.round(Math.hypot(xb.vx,xb.vy))===480 && xb.r===16);
  check("X 탄환은 게이지 미충전(isSuper)", xb.isSuper===true);
  api.setSuper(100);
  api.handleKeyPress("KeyC");
  const cb=api.bullets[api.bullets.length-1];
  check("C 통통비행기(반사6·45dmg·r18)", cb.bounce===true && cb.maxBounce===6 && Math.round(cb.damage)===45 && cb.r===18);
  frames(30);
  check("적 1명 맞으면 소멸(관통 없음)", !api.bullets.some(b=>b.bounce) || e.hp===e.maxHp);
});

console.log("=== 11) 별골렘 C 블랙홀: 끌어당김 + 상한 18 + 아군 무영향 ===");
run("블랙홀", ()=>{
  api.setSel("student_06",null,"normal","training","duo"); api.startGame(); frames(2);
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
