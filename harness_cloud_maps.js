// BIG-BATCH-2 P3 하니스: 맵공방 클라우드화(D10) — A컴 제출 → B컴 승인 → 전 클라이언트 동기화(mock DB)
const fs=require("fs"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"별빛맵"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
const TS={".sv":"timestamp"};
function makeMockDB(){
  const data={};
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function resolveTS(v){ if(v===TS) return 111111; if(v&&typeof v==="object"){ for(const k in v) v[k]=resolveTS(v[k]); } return v; }
  function getAt(p){ const a=p.split("/").filter(Boolean); let n=data; for(const k of a){ if(n==null)return null; n=n[k]; } return n===undefined?null:n; }
  function setAt(p,val){ const a=p.split("/").filter(Boolean); if(!a.length)return; let n=data; for(let i=0;i<a.length-1;i++){ if(typeof n[a[i]]!=="object"||n[a[i]]==null)n[a[i]]={}; n=n[a[i]]; } if(val===null) delete n[a[a.length-1]]; else n[a[a.length-1]]=val; }
  function thenable(v){ return { then(cb){ try{cb&&cb(v);}catch(e){console.log("then err:",e.stack);} return thenable(v);}, catch(){return this;} }; }
  function ref(p){ p=p||""; return {
    child(c){ return ref(p?p+"/"+c:c); },
    set(v){ setAt(p,resolveTS(clone(v))); return thenable(); },
    update(o){ for(const k in o) setAt(p+"/"+k,resolveTS(clone(o[k]))); return thenable(); },
    get(){ return thenable({val:()=>clone(getAt(p))}); },
    once(ev){ return thenable({val:()=>clone(getAt(p))}); },
    on(ev,cb){ cb({val:()=>clone(getAt(p))}); return cb; }, off(){},
    onDisconnect(){ return {set(){return thenable();},remove(){return thenable();},cancel(){return thenable();}}; },
    remove(){ setAt(p,null); return thenable(); },
    transaction(fn,cb2){ const cur=clone(getAt(p)); const res=fn(cur);
      if(res===undefined){ if(cb2)cb2(null); return thenable({committed:false}); }
      setAt(p,resolveTS(res)); if(cb2)cb2(null); return thenable({committed:true}); }
  }; }
  return { ref, _data:data };
}
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"u"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };

const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__t={ OM:OnlineManager, MapStore, loadEditorStore, saveEditorStore, applyApprovedMaps, handleMapReviewKey,
  getMap, MAPS, STATE, setState:v=>{gameState=v;}, setReviewIdx:v=>{reviewIdx=v;}, get cloudMapStatus(){return cloudMapStatus;},
  reviewList };`;
let api; try{ (0,eval)(s); api=globalThis.__t; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
const run=(n,fn)=>{ try{fn(); }catch(e){console.log("THROW ["+n+"]: "+(e.stack||e.message)); fails++;} };
const OM=api.OM, DB=makeMockDB();
const K="starArena.editorMaps.v1";
const mkRec=(id,mode)=>({ id:id, name:"맵"+id, author:"학생A", mode:mode||"tdm", size:[22,10], floor:"basic",
  cellsLeft:[".....................",".*...................",".....................",".....................",".....................",
             ".....................",".....................",".....................",".....................","....................."],
  createdAt:1000 });

console.log("=== 1) A컴퓨터: 오프라인 제출 → 연결 → 동기화 업로드 ===");
run("오프라인 pending → sync 시 클라우드 업로드 + _synced", ()=>{
  OM.available=false; OM.db=null;
  api.saveEditorStore({pending:[mkRec("ed_a1")],approved:[]});
  let r1=null; api.MapStore.sync((ok)=>{ r1=ok; });
  check("오프라인 sync 실패 처리", r1===false && api.cloudMapStatus.indexOf("오프라인")>=0);
  OM.available=true; OM.db=DB;
  api.MapStore.sync(()=>{});
  const cloud=DB._data.starArenaOnline.editorMaps["star-class"];
  check("클라우드 pending 업로드", !!(cloud && cloud.pending && cloud.pending.ed_a1));
  check("로컬 _synced 표시", api.loadEditorStore().pending[0]._synced===true);
});

console.log("=== 2) B컴퓨터: 빈 로컬 → 동기화 → 교사 승인 → 클라우드 반영 ===");
run("B에서 대기 목록 수신 + 승인 → approved 클라우드 이동", ()=>{
  ls.removeItem(K);                                       // B컴퓨터 = 빈 로컬
  api.MapStore.sync(()=>{});
  const st=api.loadEditorStore();
  check("B가 대기 맵 수신", st.pending.length===1 && st.pending[0].id==="ed_a1");
  api.setState("map_review"); api.setReviewIdx(0);
  api.handleMapReviewKey("Enter");                        // 교사 승인
  const cloud=DB._data.starArenaOnline.editorMaps["star-class"];
  check("클라우드 approved 이동", !!(cloud.approved && cloud.approved.ed_a1) && !(cloud.pending && cloud.pending.ed_a1));
  check("B 맵 목록 반영(🛠)", api.getMap("ed_a1").name.indexOf("🛠")===0);
});

console.log("=== 3) A컴퓨터 재부팅: 승인본 수신(맵 목록 등장) ===");
run("A 재동기화 → approved 반영", ()=>{
  ls.removeItem(K);                                       // A 재부팅(로컬 캐시 소실 가정 — 최악 케이스)
  api.MapStore.sync(()=>{});
  const st=api.loadEditorStore();
  check("A도 approved 1건", st.approved.length===1 && st.approved[0].id==="ed_a1");
  check("A 맵 목록 등장", api.getMap("ed_a1").name.indexOf("🛠")===0);
});

console.log("=== 4) 비활성 토글 + 타 기기 전파 ===");
run("D 비활성 → 클라우드 → 타 기기 sync 시 목록 제외", ()=>{
  api.setState("map_review"); api.setReviewIdx(0);
  api.handleMapReviewKey("KeyD");                         // 비활성
  const cloud=DB._data.starArenaOnline.editorMaps["star-class"];
  check("클라우드 disabled=true", cloud.approved.ed_a1.disabled===true);
  ls.removeItem(K);                                       // 타 기기
  api.MapStore.sync(()=>{});
  check("타 기기: 비활성 반영 + 목록 제외", api.loadEditorStore().approved[0].disabled===true && api.getMap("ed_a1").id!=="ed_a1");
});

console.log("=== 5) 삭제 전파(클라우드 우선) ===");
run("B에서 X 삭제 → A의 _synced 레코드 정리", ()=>{
  api.setState("map_review"); api.setReviewIdx(0);
  api.handleMapReviewKey("KeyX");                         // 삭제(승인 취소)
  const cloud=DB._data.starArenaOnline.editorMaps["star-class"];
  check("클라우드에서 제거", !(cloud.approved && cloud.approved.ed_a1));
  // A 기기: 아직 로컬에 _synced 승인본이 남아있는 상태 재현
  api.saveEditorStore({pending:[],approved:[Object.assign(mkRec("ed_a1"),{_synced:true})]});
  api.MapStore.sync(()=>{});
  check("A sync → 삭제 반영(클라우드 우선)", api.loadEditorStore().approved.length===0);
});

console.log("=== 6) 플랫포머 레벨도 공유 ===");
run("platformer 레코드 왕복", ()=>{
  const pf=mkRec("ed_pf1","platformer"); pf.size=[33,12];
  pf.cellsLeft=["................................."]; // 형식 최소(실 검증은 제출 게이트 소관)
  api.saveEditorStore({pending:[],approved:[pf]});
  api.MapStore.sync(()=>{});
  ls.removeItem(K);
  api.MapStore.sync(()=>{});
  const st=api.loadEditorStore();
  check("플랫포머 승인본 공유", st.approved.some(r=>r.id==="ed_pf1" && r.mode==="platformer"));
});

console.log("\n결과: "+(fails===0?"ALL PASS ✅":(fails+"건 실패 ❌")));
process.exit(fails===0?0:1);
