// 별빛 아레나 — 학생 계정 클라우드 동기화 하네스 (in-memory mock Firebase RTDB)
// 실제 Firebase를 건드리지 않고 classes/{classCode}/students/{id} 동작을 검증한다.
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/); if(!m){ console.log("NO SCRIPT"); process.exit(1); }
let script=m[1];

// ---- 브라우저 스텁 ----
const noop=()=>{};
const ctxStub=new Proxy({},{ get(t,p){ if(p==="measureText")return ()=>({width:10}); if(p==="canvas")return{width:1280,height:720}; if(p==="createLinearGradient"||p==="createRadialGradient")return ()=>({addColorStop:noop}); return (typeof t[p]==="function")?t[p]:noop; }, set(){return true;} });
const canvasStub={ width:1280,height:720,style:{},getContext:()=>ctxStub };
const listeners={}; function addEventListener(t,cb){ (listeners[t]=listeners[t]||[]).push(cb); }
const LS={}; const localStorageStub={ getItem:k=>(k in LS?LS[k]:null), setItem:(k,v)=>{LS[k]=String(v);}, removeItem:k=>{delete LS[k];} };
let promptQueue=[]; let confirmRet=true;
globalThis.window={ innerWidth:1366,innerHeight:768,devicePixelRatio:2, addEventListener, localStorage:localStorageStub,
  prompt:()=> (promptQueue.length?promptQueue.shift():"테스터"), confirm:()=>confirmRet };
globalThis.document={ getElementById:()=>canvasStub, addEventListener, hidden:false };
globalThis.localStorage=localStorageStub;
globalThis.requestAnimationFrame=cb=>{ globalThis.__rafCb=cb; return 1; };
globalThis.cancelAnimationFrame=noop;

// ---- in-memory mock RTDB (공유 클라우드) ----
function makeCloud(){
  const root={};
  const clone=v=> v==null?null:JSON.parse(JSON.stringify(v));
  function getNode(p){ const ps=p.split("/").filter(Boolean); let c=root; for(const k of ps){ if(c==null||typeof c!=="object")return null; c=c[k]; if(c===undefined)return null; } return c===undefined?null:c; }
  function setNode(p,v){ const ps=p.split("/").filter(Boolean); let c=root; for(let i=0;i<ps.length-1;i++){ const k=ps[i]; if(c[k]==null||typeof c[k]!=="object")c[k]={}; c=c[k]; } const last=ps[ps.length-1]; if(v===null)delete c[last]; else c[last]=clone(v); }
  function ref(p){ return {
    path:p, child(k){ return ref(p+"/"+k); },
    once(){ return Promise.resolve({ val:()=>clone(getNode(p)) }); },
    set(v){ setNode(p,v); return Promise.resolve(); },
    update(v){ setNode(p, Object.assign({}, getNode(p)||{}, v)); return Promise.resolve(); },
    remove(){ setNode(p,null); return Promise.resolve(); },
    transaction(fn,onC){ const cur=clone(getNode(p)); let r; try{ r=fn(cur); }catch(e){ if(onC)onC(e,false,null); return Promise.reject(e); }
      if(r===undefined){ if(onC)onC(null,false,{val:()=>cur}); return Promise.resolve({committed:false}); }
      setNode(p,r); if(onC)onC(null,true,{val:()=>r}); return Promise.resolve({committed:true}); }
  }; }
  return { ref, get:getNode, root };
}

// ---- __api 노출 ----
script += `
;globalThis.__api = {
  OnlineManager, AccountStore, studentLoginCloud, onCloudAccountsReady, adminMigrateLocal, adminRefreshFromCloud,
  createStudent, studentLogin, setStudentPin, resetStudent, deleteStudent, hashPin, saveProfile, bindStudent,
  loadAccounts, nowTs, ADMIN_CONFIG, mergeProfile,
  connectCloud:(db)=>{ OnlineManager.available=true; OnlineManager.db=db; OnlineManager.connected=true; },
  disconnectCloud:()=>{ OnlineManager.available=false; OnlineManager.connected=false; },
  resetDevice:()=>{ for(const k in globalThis.__ls) {}; },  // placeholder(교체됨)
  hardResetDevice:()=>{ currentStudentId=null; session=null; accounts=null; profile=mergeProfile(null); loadAccounts(); },
  setGold:(v)=>{ profile.gold=v; }, setWins:(v)=>{ profile.wins=v; },
  get gold(){return profile.gold;}, get wins(){return profile.wins;},
  get curStudent(){return currentStudentId;}, get accounts(){return accounts;}, get session(){return session;},
  get cloudStatus(){return cloudAccountStatus;},
  pendingOf:(id)=> (accounts&&accounts.students[id]?!!accounts.students[id]._pendingSync:null)
};
`;
let api; try{ (0,eval)(script); api=globalThis.__api; }catch(e){ console.log("LOAD_FAIL:",e.stack||e.message); process.exit(1); }

// device 전환(로컬 캐시 비우기, 공유 클라우드는 유지)
function resetDevice(){ for(const k in LS) delete LS[k]; api.hardResetDevice(); }
const flush=async(n=8)=>{ for(let i=0;i<n;i++) await new Promise(r=>setImmediate(r)); };
const login=(id,pin)=> new Promise(res=>api.studentLoginCloud(id,pin,res));

let fails=0; function check(n,c){ console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++; }

(async function(){
  const cloud=makeCloud();
  const PIN="1234", PIN2="5678";

  console.log("=== A) 계정 생성 & 클라우드 저장 (브라우저 A) ===");
  resetDevice(); api.connectCloud(cloud); await flush();
  let r=api.createStudent("s01","별하",PIN); check("로컬 생성 ok", r.ok);
  await api.AccountStore.saveCloudStudent(api.accounts.students.s01); await flush();
  const c1=cloud.get("classes/"+api.ADMIN_CONFIG.classCode+"/students/s01");
  check("[2] Firebase에 s01 저장됨", !!c1 && c1.id==="s01");
  check("[8-보안] 원문 PIN 미저장(pinHash만)", !!c1.pinHash && c1.pinHash!==PIN && JSON.stringify(c1).indexOf(PIN)<0);

  console.log("=== B) 다른 브라우저(빈 localStorage) 로그인 ===");
  resetDevice(); api.connectCloud(cloud);                       // 새 기기(로컬 비어있음)
  check("새 기기 로컬 비어있음", Object.keys(api.accounts.students).length===0);
  r=await login("s01",PIN); await flush();
  check("[3] 다른 기기에서 s01 로그인 성공", r.ok===true && api.curStudent==="s01");
  check("로그인 후 로컬 캐시에 s01", !!api.accounts.students.s01);

  console.log("=== C) 진행도 변경 → 동기화 ===");
  api.setGold(500); api.setWins(3); api.saveProfile(); await flush();
  const c2=cloud.get("classes/"+api.ADMIN_CONFIG.classCode+"/students/s01");
  check("[4] B의 골드/전적 클라우드 반영", c2.gold===500 && c2.wins===3);
  resetDevice(); api.connectCloud(cloud);
  r=await login("s01",PIN); await flush();
  check("[5] 다른 기기에서 최신 진행도(500G/3승) 로드", api.gold===500 && api.wins===3);

  console.log("=== D) PIN 검증/재설정 ===");
  r=await login("s01","9999"); await flush();
  check("[6] 잘못된 PIN 로그인 거부", r.ok===false && /PIN|올|비밀/.test(r.msg||""));
  // 교사가 PIN 재설정 후 클라우드 반영
  api.setStudentPin("s01",PIN2); await api.AccountStore.saveCloudStudent(api.accounts.students.s01); await flush();
  resetDevice(); api.connectCloud(cloud);
  r=await login("s01",PIN); await flush();  check("[7a] 옛 PIN 거부", r.ok===false);
  r=await login("s01",PIN2); await flush(); check("[7b] 새 PIN 성공", r.ok===true);

  console.log("=== E) 초기화 / 삭제가 다른 기기에 반영 ===");
  // 초기화(교사) + 클라우드 반영
  api.bindStudent("s01"); api.resetStudent("s01"); await api.AccountStore.saveCloudStudent(api.accounts.students.s01); await flush();
  resetDevice(); api.connectCloud(cloud); r=await login("s01",PIN2); await flush();
  check("[8] 계정 초기화가 다른 기기에 반영(골드 0)", r.ok && api.gold===0);
  // 삭제(교사) + 클라우드 반영
  await api.AccountStore.deleteCloudStudent("s01"); api.deleteStudent("s01"); await flush();
  resetDevice(); api.connectCloud(cloud); r=await login("s01",PIN2); await flush();
  check("[9] 계정 삭제가 다른 기기에 반영(로그인 불가)", r.ok===false && /없/.test(r.msg||""));

  console.log("=== F) 오프라인 캐시 & 재연결 동기화 ===");
  // 재생성 s02
  resetDevice(); api.connectCloud(cloud);
  api.createStudent("s02","달비",PIN); await api.AccountStore.saveCloudStudent(api.accounts.students.s02); await flush();
  r=await login("s02",PIN); await flush(); check("s02 로그인", r.ok);
  // 오프라인 전환 후 진행도 변경 → pending
  api.disconnectCloud();
  api.setGold(999); api.saveProfile(); await flush();
  check("[10] 오프라인 저장은 pending 표시", api.pendingOf("s02")===true);
  const cOff=cloud.get("classes/"+api.ADMIN_CONFIG.classCode+"/students/s02");
  check("[10b] 오프라인 중 클라우드 미변경(옛 골드)", cOff.gold!==999);
  // 오프라인 상태 로그인: 캐시 계정만
  const goldBefore=api.gold;
  r=await login("s02",PIN); await flush();
  check("[10c] 오프라인에서 캐시 계정 로그인 + offline 표시", r.ok===true && r.offline===true);
  // 재연결 → flushPending
  api.connectCloud(cloud); api.AccountStore.flushPending(); await flush();
  const cOn=cloud.get("classes/"+api.ADMIN_CONFIG.classCode+"/students/s02");
  check("[11] 재연결 후 pending(999G) 클라우드 동기화", cOn.gold===999 && api.pendingOf("s02")===false);

  console.log("=== G) 오래된 로컬이 최신 클라우드를 덮지 않음 ===");
  // 클라우드에 더 최신 lastUpdated 심기
  const sref="classes/"+api.ADMIN_CONFIG.classCode+"/students/s02";
  const fresh=Object.assign({},cloud.get(sref),{ gold:1200, lastUpdated: api.nowTs()+100000 });
  cloud.ref(sref).set(fresh);
  const stale=Object.assign({}, api.accounts.students.s02, { gold:10, lastUpdated: api.nowTs()-100000 });
  await api.AccountStore.saveCloudStudent(stale); await flush();
  check("[12a] 오래된 로컬 저장이 최신 클라우드(1200G) 안 덮음", cloud.get(sref).gold===1200);

  console.log("=== H) 학생 간 진행도 격리 ===");
  resetDevice(); api.connectCloud(cloud);
  api.createStudent("s03","별셋",PIN); api.accounts.students.s03.gold=77; api.accounts.students.s03.lastUpdated=api.nowTs();
  await api.AccountStore.saveCloudStudent(api.accounts.students.s03); await flush();
  resetDevice(); api.connectCloud(cloud);
  await login("s03",PIN); await flush(); const g3=api.gold;
  await login("s02",PIN); await flush(); const g2=api.gold;
  check("[12b] s03/s02 진행도 안 섞임", g3===77 && g2===1200 && g3!==g2);

  console.log("\n결과: "+(fails===0?"ALL PASS ✅":("실패 "+fails+"건 ❌")));
  process.exit(fails===0?0:1);
})();
