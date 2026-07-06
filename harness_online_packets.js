// 온라인 긴급 진단: 실서버(Firebase)식 엄격 검증 — 패킷의 undefined/NaN을 경로까지 색출
const fs=require("fs"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"AB12"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>0;
const TS={".sv":"timestamp"};

// ── 실서버처럼 undefined/NaN/함수 거부하는 검증기 ──
function fbValidate(v, path, errs){
  if(v===undefined){ errs.push(path+" = undefined"); return; }
  if(typeof v==="number"&&!isFinite(v)){ errs.push(path+" = "+v); return; }
  if(typeof v==="function"){ errs.push(path+" = function"); return; }
  if(v&&typeof v==="object"){ for(const k in v) fbValidate(v[k], path+"."+k, errs); }
}
function makeMockDB(){
  const data={}; const listeners=[];
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function resolveTS(v){ if(v===TS) return 111111; if(v&&typeof v==="object"){ for(const k in v) v[k]=resolveTS(v[k]); } return v; }
  function getAt(p){ const a=p.split("/").filter(Boolean); let n=data; for(const k of a){ if(n==null)return null; n=n[k]; } return n===undefined?null:n; }
  function setAt(p,val){ const a=p.split("/").filter(Boolean); if(!a.length)return; let n=data; for(let i=0;i<a.length-1;i++){ if(typeof n[a[i]]!=="object"||n[a[i]]==null)n[a[i]]={}; n=n[a[i]]; } if(val===null) delete n[a[a.length-1]]; else n[a[a.length-1]]=val; }
  function fire(){ for(const l of listeners.slice()){ try{ l.cb({val:()=>clone(getAt(l.path))}); }catch(e){} } }
  function thenable(v){ return { then(cb){ try{cb&&cb(v);}catch(e){} return thenable(v);}, catch(){return this;} }; }
  function ref(p){ p=p||""; return {
    _path:p, child(c){ return ref(p?p+"/"+c:c); },
    set(v){ const errs=[]; fbValidate(v, "set("+p+")", errs);
      if(errs.length){ globalThis.__fbErrors.push(...errs); throw new Error("FB_REJECT "+errs[0]); }
      setAt(p,resolveTS(clone(v))); fire(); return thenable(); },
    update(o){ const errs=[]; fbValidate(o, "update("+p+")", errs);
      if(errs.length){ globalThis.__fbErrors.push(...errs); throw new Error("FB_REJECT "+errs[0]); }
      for(const k in o) setAt(p+"/"+k,resolveTS(clone(o[k]))); fire(); return thenable(); },
    get(){ return thenable({val:()=>clone(getAt(p))}); },
    on(ev,cb){ listeners.push({path:p,cb}); cb({val:()=>clone(getAt(p))}); return cb; },
    off(ev,cb){ for(let i=listeners.length-1;i>=0;i--) if(listeners[i].cb===cb) listeners.splice(i,1); },
    onDisconnect(){ return {set(){return thenable();},update(){return thenable();},remove(){return thenable();},cancel(){return thenable();}}; },
    remove(){ setAt(p,null); fire(); return thenable(); },
    transaction(fn){ const cur=clone(getAt(p)); const res=fn(cur);
      if(res===undefined||res===null) return thenable({committed:false,snapshot:{val:()=>clone(getAt(p))}});
      setAt(p,resolveTS(res)); fire(); return thenable({committed:true,snapshot:{val:()=>clone(getAt(p))}}); }
  }; }
  return { ref, _data:data };
}
globalThis.__fbErrors=[];
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };

const path=require("path");
let s=fs.readFileSync(require("path").join(__dirname,"index.html"),"utf8");
s=s.match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__t={ OM:OnlineManager, emptyInput, tStartMatch, tHostWriteState, tUpdate,
  get tFighters(){return tFighters;}, setRule:(r)=>{onlineSelectedRule=r;},
  setSel:(c,w)=>{selectedCharacterId=c;selectedWeaponId=w;profile.selectedCharacterId=c;profile.selectedWeaponId=w;},
  get state(){return gameState;} };`;
let api; try{ (0,eval)(s); api=globalThis.__t; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
const OM=api.OM;

function setupRoom(rule, humanCount){   // 교실 재현: humanCount명만 접속, 나머지 슬롯은 봇
  OM.leaveRoom(true);
  OM.available=true; OM.uid="hostUID"; OM.db=makeMockDB();
  api.setSel("student_01","tool_01");
  api.setRule(rule);
  let code=null;
  OM.createTeamRoom("online3v3",(ok,info)=>{ if(ok) code=info; });
  const rr=OM.db.ref("starArenaOnline/rooms/"+code);
  const chars=["student_01","student_02","student_03","student_04","student_05","student_06"];
  for(let i=2;i<=humanCount;i++){
    const team=(i<=3)?"blue":"red";
    rr.child("players/p"+i).set({uid:"p"+i,nickname:"p"+i,slot:"p"+i,team:team,characterId:chars[i-1],weaponId:null,connected:true,ready:false,isBot:false,input:api.emptyInput()});
  }
  return code;
}

const rules=["tdm","siege","hotzone","stargrab","tag","paint"];
let poisoned=0;
for(const rule of rules){
  for(const humans of [2,6]){   // 2명(봇 4) vs 6명(봇 0)
    globalThis.__fbErrors.length=0;
    const code=setupRoom(rule, humans);
    let startErr=null;
    try{ api.tStartMatch(); }catch(e){ startErr=e.message; }
    // 시작 직후 + 몇 틱 후 패킷
    let tickErr=null;
    try{ for(let i=0;i<30;i++){ api.tUpdate(1/60); } api.tHostWriteState(); }catch(e){ tickErr=e.message; }
    const errs=globalThis.__fbErrors.slice();
    const label=rule+" · 사람 "+humans+"명(봇 "+(6-humans)+")";
    if(errs.length){ poisoned++;
      console.log("💥 "+label+" — state 거부! 독성 필드:");
      const uniq=[...new Set(errs.map(e=>e.replace(/fighters\.p\d+/,"fighters.pN")))].slice(0,4);
      for(const u of uniq) console.log("     "+u);
    } else {
      console.log("  ok "+label+" — 패킷 정상");
    }
  }
}
// 온라인긴급 P0 수정 후: 이 하니스는 회귀 방지용 — 12조합 전부 정상이어야 PASS(예전 '재현 성공'이 이제는 실패)
console.log("\n결과: "+(poisoned===0?"ALL PASS ✅ (12조합 패킷 정상 — 실서버식 엄격 검증)":(poisoned+"조합 state 거부 ❌ (독성 필드 재유입)")));
process.exit(poisoned===0?0:1);
