// 별빛 아레나 — GENRE-EXPAND-1 §3 별빛 점프(플랫포머) 하니스 (2026-07-05)
// §3.9 AC: 가변 점프·코요테·버퍼·원웨이(착지/통과/하강)·머리박기·낙사·밟기 vs 접촉사 ·
//          내장 3레벨(그래프 도달성+파스 무결성) · 에디터 테스트플레이 제출 게이트 · 보상 연동
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener,localStorage:lsS,prompt:()=>"테스트맵"};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=(cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop;
script+=`;globalThis.__api={
  PF_CONST, PF_LEVELS, pfStartLevel, pfUpdate, pfDie, pfLevelList, pfLoadBest, pfJumpPressed, handlePlatformerKey,
  get PF(){return PF;}, keysDown, get profile(){return profile;}, get state(){return gameState;}, setState:v=>{gameState=v;},
  get ED(){return ED;}, setED:v=>{ED=v;}, edStartGrid, edSubmit, validateEditorMap, loadEditorStore, saveEditorStore,
  EDITOR_MODES, handleKeyPress, openEditor, STATE, expNeed
};`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
const DT=1/60;
function ticks(n){ for(let i=0;i<n;i++) api.pfUpdate(DT); }
const FLAT={ id:"__flat", name:"평지", rows:[
  "....................",
  "....................",
  "....................",
  "....................",
  "....#...............",
  "....#....----.......",
  ".*..#...........SS..",
  "####################" ] };

console.log("=== 1) 가변 점프(§3.3) ===");
run("탭 vs 홀드 점프 높이", ()=>{
  // 홀드
  api.pfStartLevel(FLAT); let p=api.PF.p;
  api.keysDown.add("KeyZ"); api.pfJumpPressed();
  let minY=p.y; for(let i=0;i<90;i++){ api.pfUpdate(DT); minY=Math.min(minY,p.y); if(p.onGround&&i>10) break; }
  api.keysDown.delete("KeyZ");
  const holdH=(7*56-0.01)-minY;   // 시작 발 높이 - 최고점
  // 탭(3프레임 후 릴리즈)
  api.pfStartLevel(FLAT); p=api.PF.p;
  api.keysDown.add("KeyZ"); api.pfJumpPressed();
  minY=p.y;
  for(let i=0;i<90;i++){ if(i===3) api.keysDown.delete("KeyZ"); api.pfUpdate(DT); minY=Math.min(minY,p.y); if(p.onGround&&i>10) break; }
  const tapH=(7*56-0.01)-minY;
  console.log("    실측: 탭 "+(tapH/56).toFixed(2)+"칸 · 홀드 "+(holdH/56).toFixed(2)+"칸");
  check("탭 점프 0.8~2.5칸", tapH>0.8*56 && tapH<2.5*56);
  check("홀드 점프 2.5~5칸", holdH>2.5*56 && holdH<5*56);
  check("가변 폭 유의미(홀드 > 탭×1.4)", holdH > tapH*1.4);
});
run("코요테 타임 + 점프 버퍼(§3.3)", ()=>{
  api.pfStartLevel(FLAT); const p=api.PF.p;
  // 코요테: 지면에서 벗어난 직후 0.05s 뒤 점프 가능
  p.x=4.5*56; p.y=7*56-0.01; p.onGround=true; p.coyote=api.PF_CONST.COYOTE;
  p.onGround=false;                       // 낭떠러지 이탈 가정
  for(let i=0;i<3;i++) api.pfUpdate(DT);  // 0.05s 경과
  api.pfJumpPressed(); api.pfUpdate(DT);
  check("코요테: 공중 이탈 직후 점프 성공", p.vy<-400);
  // 버퍼: 착지 0.06s 전 입력 → 착지 시 자동 점프
  api.pfStartLevel(FLAT); const q=api.PF.p;
  q.y=7*56-40; q.vy=600; q.onGround=false;   // 낙하 중
  api.pfJumpPressed();                        // 미리 누름
  let jumped=false;
  for(let i=0;i<20;i++){ api.pfUpdate(DT); if(q.vy<-400){ jumped=true; break; } }
  check("버퍼: 착지 직전 입력이 착지 순간 점프로", jumped);
});

console.log("=== 2) 원웨이·머리박기·낙사 ===");
run("원웨이 발판(§3.3)", ()=>{
  api.pfStartLevel(FLAT); const p=api.PF.p;
  // 위에서 낙하 → 착지
  p.x=10.5*56; p.y=4*56; p.vy=300; p.onGround=false;
  ticks(30);
  check("하강 착지(발판 위 정지)", p.onGround && Math.abs(p.y-(5*56-0.01))<2);
  // 아래에서 점프 → 통과
  p.x=10.5*56; p.y=7*56-0.01; p.onGround=true; p.vy=0;
  api.keysDown.add("KeyZ"); api.pfJumpPressed();
  let passed=false;
  for(let i=0;i<40;i++){ api.pfUpdate(DT); if(p.y<5*56-4) passed=true; }
  api.keysDown.delete("KeyZ");
  check("상승 중 원웨이 통과", passed);
  // ↓+점프 하강
  api.pfStartLevel(FLAT); const q=api.PF.p;
  q.x=10.5*56; q.y=5*56-0.01; q.onGround=true; q.vy=0; api.PF.camGY=q.y;
  api.keysDown.add("ArrowDown"); api.pfJumpPressed(); api.keysDown.delete("ArrowDown");
  ticks(25);
  check("↓+점프 원웨이 하강", q.y>5*56+20);
});
run("머리 박기 + 낙사 리스폰", ()=>{
  api.pfStartLevel(FLAT); const p=api.PF.p;
  // 머리 위 블록(4,4~6 세로 기둥 col4): col4 위 점프
  p.x=4.5*56+56; p.y=7*56-0.01; p.onGround=true;   // 기둥 오른쪽
  p.x=4*56+84;                                      // 기둥 바로 옆
  // 직접: 상승 중 천장 충돌 검사 — 기둥 아래 셀에서 점프
  api.pfStartLevel(FLAT); const q=api.PF.p;
  q.x=4.5*56; q.y=7*56-0.01; q.onGround=true;       // 기둥(#, r4~r6) 바로 아래? col4는 벽 — col4.5 위 r6까지 벽 → 머리 위 r6이 벽
  api.keysDown.add("KeyZ"); api.pfJumpPressed();
  let bumped=false;
  for(let i=0;i<20;i++){ api.pfUpdate(DT); if(q.vy===0 && !q.onGround){ bumped=true; break; } if(q.vy>0) break; }
  api.keysDown.delete("KeyZ");
  check("머리 박기 → vy=0", bumped);
  // 낙사
  const d0=api.PF.deaths;
  q.x=19.5*56; q.y=(api.PF.rows+3)*56; api.pfUpdate(DT);
  check("낙사 → 사망+체크포인트 리스폰", api.PF.deaths===d0+1 && Math.abs(q.x-api.PF.checkpoint.x)<1);
});
run("가시 접촉 = 사망", ()=>{
  api.pfStartLevel(FLAT); const p=api.PF.p, d0=api.PF.deaths;
  p.x=16.5*56; p.y=7*56-0.01; p.onGround=true;   // SS 위치(r6 c16~17)
  api.pfUpdate(DT);
  check("가시 밟음 → 사망", api.PF.deaths===d0+1);
});

console.log("=== 3) 몬스터: 밟기 vs 접촉사(§3.4) ===");
run("밟기=처치·바운스 / 옆 접촉=사망", ()=>{
  const LV={ id:"__mon", name:"몬스터", rows:[
    "....................",
    "....................",
    ".*......M...........",
    "####################" ] };
  api.pfStartLevel(LV);
  const p=api.PF.p, mon=api.PF.monsters[0];
  check("몬스터 파스(1마리·그리드에서 제거)", api.PF.monsters.length===1 && api.PF.grid[2][8]===".");
  // 밟기: 몬스터 위에서 낙하
  p.x=mon.x; p.y=mon.y-mon.h-10; p.vy=300; p.onGround=false;
  ticks(8);
  check("밟기 → 몬스터 처치 + 바운스(vy<0)", mon.dead===true && p.vy<0);
  // 접촉사: 새 판에서 옆으로 접촉
  api.pfStartLevel(LV);
  const q=api.PF.p, m2=api.PF.monsters[0], d0=api.PF.deaths;
  q.x=m2.x-m2.w/2-api.PF_CONST.PW/2-4; q.y=3*56-0.01; q.onGround=true; q.vy=0;
  m2.dir=-1;                                    // 몬스터가 다가옴
  ticks(60);
  check("옆 접촉 → 사망", api.PF.deaths>d0);
});

console.log("=== 4) 내장 3레벨: 파스 + 도달성(그래프) ===");
function reachable(level){
  const rows=level.rows, R=rows.length, C=rows[0].length;
  const solid=(c,r)=>(c<0||c>=C)?true:(r<0||r>=R)?false:rows[r][c]==="#";
  const stand=(c,r)=>{ if(r+1>=R) return false; const b=rows[r+1][c], h=rows[r][c];
    return (b==="#"||b==="-"||b==="J") && h!=="#" && h!=="S"; };
  let sc=-1,sr=-1,gc=-1,gr=-1;
  for(let r=0;r<R;r++) for(let c=0;c<C;c++){ if(rows[r][c]==="*"){sc=c;sr=r;} if(rows[r][c]==="G"){gc=c;gr=r;} }
  if(sc<0||gc<0) return false;
  const seen=new Set(), q=[[sc,sr]]; seen.add(sc+","+sr);
  const push=(c,r)=>{ const k=c+","+r; if(c<0||c>=C||r<0||r>=R||seen.has(k)) return; if(rows[r][c]==="#"||rows[r][c]==="S") return; seen.add(k); q.push([c,r]); };
  while(q.length){
    const [c,r]=q.shift();
    if(Math.abs(c-gc)<=1 && Math.abs(r-gr)<=1) return true;
    // 낙하(아무 높이) — 착지 지점까지
    for(let rr=r; rr<R; rr++){ if(stand(c,rr)){ push(c,rr); break; } if(solid(c,rr+0)) break; }
    // 좌우 걷기(발판 위에서)
    if(stand(c,r)){ push(c-1,r); push(c+1,r);
      // 점프: 위로 최대 3칸, 좌우 최대 3칸(스프링이면 위로 6칸)
      const up=(rows[r+1] && rows[r+1][c]==="J")?6:3;
      for(let dy=0;dy<=up;dy++) for(let dx=-3;dx<=3;dx++) push(c+dx, r-dy);
    } else { push(c-1,r); push(c+1,r); }   // 공중 이동 근사
  }
  return false;
}
run("내장 레벨 무결성 + 골 도달 가능", ()=>{
  for(const lv of api.PF_LEVELS){
    const C0=lv.rows[0].length, uni=lv.rows.every(s=>s.length===C0);
    const st=lv.rows.join("").split("*").length-1, gl=lv.rows.join("").split("G").length-1;
    check(lv.name+": 행 길이 균일·시작1·골1", uni && st===1 && gl===1);
    check(lv.name+": 골 도달 가능(그래프)", reachable(lv));
  }
});
run("레벨 시작·별 집계·클리어·보상(E16 연동)", ()=>{
  const g0=api.profile.gold;
  api.pfStartLevel(api.PF_LEVELS[0]);
  check("상태=platformer + 별 총계>0", api.state==="platformer" && api.PF.starsTotal>0);
  // 골 위로 순간이동 → 클리어
  let gc=-1,gr=-1; const rows=api.PF.grid;
  for(let r=0;r<rows.length;r++) for(let c=0;c<rows[r].length;c++) if(rows[r][c]==="G"){gc=c;gr=r;}
  api.PF.p.x=(gc+0.5)*56; api.PF.p.y=(gr+1)*56-4; api.PF.p.vy=0;
  api.pfUpdate(DT);
  check("골 도달 → 클리어", api.PF.cleared===true);
  check("첫 클리어 보상 +40G", api.profile.gold===g0+40);
  const best=api.pfLoadBest();
  check("베스트 기록 저장", !!best[api.PF_LEVELS[0].id]);
});

console.log("=== 5) 에디터: 테스트플레이 제출 게이트(§3.8) ===");
run("미클리어 제출 불가 → 클리어 후 제출 → 레벨 목록 반영", ()=>{
  api.saveEditorStore({pending:[],approved:[]});
  api.setED({ step:"size", modeIdx:api.EDITOR_MODES.length-1, sizeIdx:0, floorIdx:0, mode:"platformer",
              cols:33, rows:12, half:33, cells:null, cur:{c:1,r:4}, palIdx:1, msg:"", undo:[], mbtn:0 });
  api.edStartGrid();
  const ED=api.ED;
  check("pf 그리드(미러 없음·바닥+시작+골 기본)", ED.pf===true && ED.half===33 && ED.cells[10][1]==="*" && ED.cells[10][31]==="G");
  check("검증 통과(시작1·골1)", api.validateEditorMap().ok===true);
  api.setState("editor");
  api.edSubmit();
  check("미검증 제출 차단", api.loadEditorStore().pending.length===0 && ED.msg.indexOf("테스트플레이")>=0);
  ED.testCleared=true;
  api.edSubmit();
  const st=api.loadEditorStore();
  check("클리어 후 제출 성공(mode=platformer)", st.pending.length===1 && st.pending[0].mode==="platformer");
  // 승인 → 레벨 선택 목록 등장
  st.approved.push(st.pending.pop()); api.saveEditorStore(st);
  const list=api.pfLevelList();
  check("승인 레벨이 별빛 점프 목록에 등장", list.some(l=>l.name==="테스트맵"));
  api.saveEditorStore({pending:[],approved:[]});
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
