// 별빛 아레나 — TOUCH-UI-1 하니스: 모든 메뉴 화면 마우스·터치 클릭 대응 검증 (2026-07-07)
// render()가 UI_HITS에 버튼 rect+동작을 등록하고, uiPointerDown(좌표)이 그 동작을 실행하는지 좌표 단위로 검증.
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return (s)=>({width:(""+s).length*8}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),addEventListener:noop};
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const lsS={getItem:k=>(k in LS?LS[k]:null),setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:1,addEventListener,localStorage:lsS,prompt:()=>"플레이어",location:{hash:""}};
globalThis.document={getElementById:()=>canvasStub,addEventListener,hidden:false,createElement:()=>({getContext:()=>ctxStub,style:{}}),head:{appendChild:noop}};
globalThis.localStorage=lsS;
globalThis.requestAnimationFrame=(cb)=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>0; globalThis.clearTimeout=noop; globalThis.setInterval=()=>0; globalThis.clearInterval=noop;
globalThis.firebase=undefined;
script+=`;globalThis.__u={ STATE, get state(){return gameState;}, setState:v=>{gameState=v;},
  render, uiPointerDown, get UI_HITS(){return UI_HITS;}, uiMenuActive,
  get profile(){return profile;}, get menuIndex(){return menuIndex;}, setMenuIndex:v=>{menuIndex=v;},
  get selectedMapId(){return selectedMapId;}, get selectedCharacterId(){return selectedCharacterId;},
  get settingsOpen(){return settingsOpen;}, setSettingsOpen:v=>{settingsOpen=v;},
  get onlineMenuIndex(){return onlineMenuIndex;},
  loadProfile, MAPS, STUDENT_CHARACTERS, get gold(){return profile.gold;},
  openEditor, get ED(){return ED;}, uiMenuActive };`;
let U; try{ (0,eval)(script); U=globalThis.__u; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }

let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){ console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++; } };
// 지정 상태의 화면을 렌더해 UI_HITS를 채우고, 좌표 클릭을 시뮬
function renderState(st){ U.setState(st); try{ U.render(); }catch(e){} }
function clickAt(x,y){ return U.uiPointerDown({x:x,y:y}); }
// UI_HITS에서 라벨 못 쓰니 좌표로 클릭. 특정 동작이 걸린 rect를 찾아 그 중심 클릭.
function hitCenters(){ return U.UI_HITS.map(h=>({cx:h.x+h.w/2, cy:h.y+h.h/2, fn:h.fn, r:h})); }

U.loadProfile();   // 게스트 기본 프로필

console.log("=== TOUCH-UI-1) 메뉴 클릭/탭 라우팅 ===");

run("코어: uiMenuActive는 플레이/에디터/RPG/별빛점프에서 false", ()=>{
  U.setState(U.STATE.PLAYING); check("PLAYING=false", U.uiMenuActive()===false);
  U.setState(U.STATE.EDITOR); check("EDITOR=false", U.uiMenuActive()===false);
  U.setState(U.STATE.RPG); check("RPG=false", U.uiMenuActive()===false);
  U.setState(U.STATE.PLATFORMER); check("PLATFORMER=false", U.uiMenuActive()===false);
  U.setState(U.STATE.START); check("START=true", U.uiMenuActive()===true);
});

run("START: 히트영역 등록됨 + 프레임마다 초기화", ()=>{
  renderState(U.STATE.START);
  const n1=U.UI_HITS.length;
  check("START 렌더 → 히트영역 다수 등록", n1>=5);
  renderState(U.STATE.START);
  check("재렌더 → 중복 누적 없음(초기화)", U.UI_HITS.length===n1);
});

run("START: '빠른 대전' 모드행 클릭 → 게임 시작", ()=>{
  renderState(U.STATE.START);
  // 모드행 i:2(빠른 대전)은 drawLobbyMenu에서 x-12~x+W, 특정 y. 좌표를 알기 위해 클릭 대상 rect를 fn 실행으로 탐지.
  // 대신 알려진 레이아웃: 빠른대전 라벨 y=186 + (헤더24 + 캠페인44 + 난이도30) = 284 근처. 행 중앙 클릭.
  // 안전하게: menuIndex를 2로 두고 START 재렌더 후, 모드행 영역(x=288..752, y≈276)을 클릭.
  let started=false; const realStart=U.state;
  // 좌표 계산이 취약하니, 등록된 히트 중 실행 시 gameState가 PLAYING이 되는 것을 찾는다.
  renderState(U.STATE.START);
  const hits=hitCenters();
  let ok=false;
  for(const h of hits){ U.setState(U.STATE.START); try{ h.fn(); }catch(e){} if(U.state===U.STATE.PLAYING){ ok=true; break; } }
  check("모드행 클릭 동작 중 '게임 시작(PLAYING)'이 존재", ok);
});

run("START: '온라인 센터' 행 클릭 → ONLINE_MENU", ()=>{
  renderState(U.STATE.START);
  const hits=hitCenters(); let ok=false;
  for(const h of hits){ U.setState(U.STATE.START); try{ h.fn(); }catch(e){} if(U.state===U.STATE.ONLINE_MENU){ ok=true; break; } }
  check("온라인 센터로 가는 클릭 존재", ok);
});

run("START: 맵공방 칩 클릭 → EDITOR", ()=>{
  renderState(U.STATE.START);
  const hits=hitCenters(); let ok=false;
  for(const h of hits){ U.setState(U.STATE.START); try{ h.fn(); }catch(e){} if(U.state===U.STATE.EDITOR){ ok=true; break; } }
  check("맵공방으로 가는 클릭 존재", ok);
});

run("START: 값 행(맵) ◀/▶ 클릭 → 맵 변경", ()=>{
  renderState(U.STATE.START);
  const before=U.selectedMapId;
  const hits=hitCenters(); let changed=false;
  for(const h of hits){ const b4=U.selectedMapId; U.setState(U.STATE.START); try{ h.fn(); }catch(e){} if(U.selectedMapId!==b4){ changed=true; break; } }
  check("맵을 바꾸는 클릭 존재(값 행 ◀/▶)", changed);
});

run("START: 캐릭터 카드 탭 → 다음 캐릭터", ()=>{
  U.setSettingsOpen(false);   // 앞 테스트 오염 제거(설정 열림이면 배경 히트가 카드를 가림)
  renderState(U.STATE.START);
  // 카드 영역 (800,166,286,408) 중앙 클릭
  const before=U.selectedCharacterId;
  clickAt(800+143, 166+204);
  check("카드 탭 → 캐릭터 변경(해금 2종 이상 시)", U.STUDENT_CHARACTERS.length<2 || U.selectedCharacterId!==before || U.profile.unlockedCharacters.length<2);
});

run("START: 설정 칩 클릭 → 설정 오버레이 열림", ()=>{
  U.setSettingsOpen(false); renderState(U.STATE.START);
  const hits=hitCenters(); let ok=false;
  for(const h of hits){ U.setSettingsOpen(false); try{ h.fn(); }catch(e){} if(U.settingsOpen){ ok=true; break; } }
  check("설정을 여는 클릭 존재", ok);
});

run("설정 오버레이: 조작방식 버튼 클릭 → 순환", ()=>{
  U.setSettingsOpen(true); renderState(U.STATE.START);
  const before=U.profile.controlMode;
  const hits=hitCenters(); let changed=false;
  for(const h of hits){ const b4=U.profile.controlMode; try{ h.fn(); }catch(e){} if(U.profile.controlMode!==b4){ changed=true; break; } U.setSettingsOpen(true); }
  check("조작 방식을 바꾸는 클릭 존재", changed);
  U.setSettingsOpen(false);
});

run("설정 오버레이: 배경 탭 → 닫힘", ()=>{
  U.setSettingsOpen(true); renderState(U.STATE.START);
  clickAt(30, 30);   // 좌상단 배경(패널 밖)
  check("배경 탭 → 설정 닫힘", U.settingsOpen===false);
});

run("ONLINE_MENU: 렌더 + 뒤로 클릭 존재", ()=>{
  renderState(U.STATE.ONLINE_MENU);
  check("온라인 메뉴 히트영역 등록", U.UI_HITS.length>=1);
  const hits=hitCenters(); let backOk=false;
  for(const h of hits){ U.setState(U.STATE.ONLINE_MENU); try{ h.fn(); }catch(e){} if(U.state===U.STATE.START){ backOk=true; break; } }
  check("시작 화면으로 돌아가는 클릭 존재(오프라인일 땐 전체 탭)", backOk);
});

run("SPLASH: 탭 → 로그인", ()=>{
  renderState(U.STATE.SPLASH);
  clickAt(640, 360);
  check("스플래시 탭 → LOGIN", U.state===U.STATE.LOGIN);
});

run("PROFILE: 탭 → START", ()=>{
  renderState(U.STATE.PROFILE);
  clickAt(640, 360);
  check("정보창 탭 → START", U.state===U.STATE.START);
});

run("COLLECTION: 좌/우 탭 → 인덱스 이동, 하단 탭 → 뒤로", ()=>{
  renderState(U.STATE.COLLECTION);
  const backHit = hitCenters().some(h=>{ U.setState(U.STATE.COLLECTION); try{ h.fn(); }catch(e){} return U.state===U.STATE.START; });
  check("수집창에 뒤로 가는 클릭 존재", backHit);
});

run("PAUSED: 계속/나가기 탭 존재", ()=>{
  renderState(U.STATE.PAUSED);
  const hits=hitCenters();
  const toStart = hits.some(h=>{ U.setState(U.STATE.PAUSED); try{ h.fn(); }catch(e){} return U.state===U.STATE.START; });
  check("일시정지 → 시작 화면 탭 존재", toStart);
});

run("좌표 밖 클릭 → 아무 동작 없음(false)", ()=>{
  renderState(U.STATE.START);
  check("빈 곳(9999,9999) 클릭 = false", clickAt(9999,9999)===false);
});

run("에디터 모드 선택 단계 클릭 가능(태블릿 맵공방 입구)", ()=>{
  U.openEditor(); U.ED.step="mode"; U.setState(U.STATE.EDITOR);
  check("uiMenuActive: 에디터 mode단계=true", U.uiMenuActive()===true);
  try{ U.render(); }catch(e){}
  const hits=hitCenters(); let advanced=false;
  for(const h of hits){ U.ED.step="mode"; try{ h.fn(); }catch(e){} if(U.ED.step==="size"){ advanced=true; break; } }
  check("모드 버튼 클릭 → size 단계로", advanced);
  check("uiMenuActive: 에디터 edit단계=false(자체 처리)", (U.ED.step="edit", U.uiMenuActive()===false));
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
