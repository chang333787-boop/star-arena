// 넷코드 다듬기 하니스(2026-09-28): 입력 번호 화해 — 지연·흔들림·패킷 유실에서 내 캐릭터가 뒤로 끌리지 않는지 수치 검증
const fs=require("fs"); const noop=()=>{};
const ctxStub=new Proxy({},{get(t,p){if(p==="createLinearGradient"||p==="createRadialGradient")return()=>({addColorStop:noop});if(p==="measureText")return()=>({width:10});if(p==="canvas")return{width:1280,height:720};return(typeof t[p]==="function")?t[p]:noop;},set(){return true;}});
const canvasStub={width:1280,height:720,style:{},getContext:()=>ctxStub};
const LS={}; const ls={getItem:k=>k in LS?LS[k]:null,setItem:(k,v)=>{LS[k]=String(v);},removeItem:k=>{delete LS[k];}};
globalThis.window={innerWidth:1366,innerHeight:768,devicePixelRatio:2,addEventListener:noop,localStorage:ls,prompt:()=>"AB12"};
globalThis.document={getElementById:()=>canvasStub,addEventListener:noop,hidden:false,createElement:()=>({}),head:{appendChild:noop}};
globalThis.localStorage=ls; globalThis.requestAnimationFrame=cb=>{globalThis.__r=cb;return 1;}; globalThis.cancelAnimationFrame=noop;
globalThis.setTimeout=(fn)=>0;
const TS={".sv":"timestamp"};
// 온라인긴급 P0: 실서버식 엄격 검증 — undefined/NaN/함수가 패킷에 있으면 set/update 전체 거부(mock 관대함 제거)
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
    set(v){ const errs=[]; fbValidate(v,"set("+p+")",errs); if(errs.length) throw new Error("FB_REJECT "+errs[0]); setAt(p,resolveTS(clone(v))); fire(); return thenable(); },
    update(o){ const errs=[]; fbValidate(o,"update("+p+")",errs); if(errs.length) throw new Error("FB_REJECT "+errs[0]); for(const k in o) setAt(p+"/"+k,resolveTS(clone(o[k]))); fire(); return thenable(); },
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
globalThis.firebase={ initializeApp:()=>({}), auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:"hostUID"}})}),
  database:Object.assign(()=>null,{ServerValue:{TIMESTAMP:TS}}) };
const path=require("path");
let s=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
s+=`;globalThis.__n={ predictMoveAim, onlineReconcile, netNewRecon, netOnSnapshot, netApplyCorr, netLogFrame, netStampInput, netHostTrackInput, netAckPack,
  emptyInput, OM:OnlineManager, netStats, setObs:v=>{OBSTACLES=v;}, get netInputSeq(){return netInputSeq;} };`;
let api; try{ (0,eval)(s); api=globalThis.__n; }catch(e){ console.log("LOAD_FAIL:",e.stack); process.exit(1); }
let fails=0; const check=(n,c)=>{console.log((c?"  ok  ":"FAIL  ")+n); if(!c)fails++;};
api.setObs([]);

// 결정적 난수(흔들림)
let seed=7; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };

/* 시뮬: 60fps. 게스트 입력 스크립트 → (변화/0.75초) 전송 → 업링크 지연 후 호스트 도착 →
   호스트는 최신 입력을 매 프레임 적용, 15Hz로 상태 전송 → 다운링크 지연 후 게스트 도착(순서 유지).
   정답(ideal) = 게스트 입력만으로 순수 로컬 이동(물리 동일하므로 지연 없는 진짜 내 위치). */
function simulate(opts){
  const DT=1/60, T=opts.T||8, up=opts.up, down=opts.down, jit=opts.jit||0, loss=opts.loss||0, mode=opts.mode;
  const hostSlow=opts.hostSlow||null;   // [t0,t1] 구간 호스트만 속도 절반(둔화 — 예측 불일치 상황)
  const SPEED=300;
  const host={ x:640, y:360, r:22, facing:0, moveSpeed:SPEED };
  const ideal={ x:640, y:360, r:22, facing:0, moveSpeed:SPEED };
  const pred={ x:640, y:360, r:22, facing:0, moveSpeed:SPEED };
  const R=api.netNewRecon();
  let hostInp=api.emptyInput(); let lastSentStr="", keep=0;
  const toHost=[], toGuest=[]; let lastDownAt=0, lastUpAt=0;
  let writeAcc=0; let t=0; let maxErr=0, sumErr=0, n=0, moveErrSum=0, moveN=0;
  const inputAt=(tt)=>{ // 스크립트: 오른쪽 1.5s → 멈춤 0.5 → 아래 1.2 → 대각 1 → 멈춤 → 왼쪽 짧게 연타
    const i=api.emptyInput();
    if(tt<1.5){ i.mvx=1; } else if(tt<2.0){} else if(tt<3.2){ i.mvy=1; } else if(tt<4.2){ i.mvx=-0.7; i.mvy=-0.7; }
    else if(tt<5){} else if(tt<7){ const ph=Math.floor((tt-5)/0.25)%2; if(ph===0) i.mvx=-1; }
    return i; };
  for(let f=0; f<T/DT; f++, t+=DT){
    // 1) 게스트: 도착한 상태 처리
    let fresh=null; while(toGuest.length && toGuest[0].at<=t){ fresh=toGuest.shift().s; }
    const inp=inputAt(t);
    const str=JSON.stringify(inp); keep+=DT;
    if(str!==lastSentStr || keep>=0.75){ lastSentStr=str; keep=0; const pk=Object.assign({},inp); api.netStampInput(pk);
      { let at=t+up+(rnd()*2-1)*jit; if(at<lastUpAt) at=lastUpAt; lastUpAt=at; toHost.push({at, inp:pk}); } }
    if(mode==="new"){
      if(fresh) api.netOnSnapshot(R, pred, fresh);
      api.predictMoveAim(pred, inp, DT); api.netLogFrame(R, inp, DT);
      if(R.hasAck) api.netApplyCorr(R, pred, DT); else if(fresh) api.onlineReconcile(pred, fresh, DT);
    } else {
      api.predictMoveAim(pred, inp, DT);
      if(R._last||fresh){ R._last=fresh||R._last; api.onlineReconcile(pred, R._last, DT); }
    }
    api.predictMoveAim(ideal, inp, DT);
    // 2) 호스트: 도착 입력 반영 → 한 프레임 시뮬 → 15Hz 전송
    while(toHost.length && toHost[0].at<=t){ hostInp=toHost.shift().inp; }
    const slow = hostSlow && t>=hostSlow[0] && t<hostSlow[1];
    host.moveSpeed = slow ? SPEED/2 : SPEED;
    api.predictMoveAim(host, hostInp, DT);
    api.netHostTrackInput(host, hostInp, DT);
    writeAcc+=DT;
    if(writeAcc>=1/15){ writeAcc-=1/15;
      const o={ x:Math.round(host.x), y:Math.round(host.y), facing:0, aq:host._aq, ad:Math.round((host._ad||0)*1000), ms:Math.round(host.moveSpeed) };
      if(o.aq===undefined){ delete o.aq; delete o.ad; delete o.ms; }
      if(rnd()>=loss){ let at=t+down+(rnd()*2-1)*jit; if(at<lastDownAt) at=lastDownAt; lastDownAt=at; toGuest.push({at, s:o}); } }
    // 3) 측정: 둔화 없는 구간에서 정답과의 차이(화면에 보이는 내 캐릭터가 얼마나 끌리는가)
    if(!hostSlow && t>1.0){ const e=Math.hypot(pred.x-ideal.x, pred.y-ideal.y); maxErr=Math.max(maxErr,e); sumErr+=e; n++;
      const moving=Math.abs(inp.mvx||0)+Math.abs(inp.mvy||0)>0; if(moving){ moveErrSum+=e; moveN++; } }
  }
  // 끝: 입력 멈춘 뒤 정착 — 권한 위치와의 차이
  return { maxErr, avgErr:n?sumErr/n:0, moveErr:moveN?moveErrSum/moveN:0, finalVsHost:Math.hypot(pred.x-host.x,pred.y-host.y) };
}
function settle(opts){ const o=Object.assign({},opts,{T:(opts.T||8)+1.5}); return simulate(o); }

const fmt=r=>"평균 "+r.avgErr.toFixed(1)+"px · 이동 중 "+r.moveErr.toFixed(1)+"px · 최대 "+r.maxErr.toFixed(1)+"px";
// (가) 흔들림 없는 순수 지연: '뒤로 끌림'은 전부 지연 탓 → 새 방식은 거의 0이어야
for(const c of [ { name:"편도 150ms(왕복 300ms), 흔들림 없음", up:0.15, down:0.15 }, { name:"직통 LAN 편도 10ms", up:0.01, down:0.01 } ]){
  const o=simulate(Object.assign({mode:"old"},c)), nw=simulate(Object.assign({mode:"new"},c));
  console.log("["+c.name+"]  기존: "+fmt(o)+"  →  새: "+fmt(nw));
  check(c.name+": 새 방식 이동 중 오차 ≤ 6px(1프레임 이동량)", nw.moveErr<=6);
}
// (나) 흔들림: 입력 도착 간격이 달라 호스트가 '실제로' 다르게 움직임 → 남는 차이는 진짜 차이(끌림 아님). 기존 대비 크게 줄고, 멈추면 정확히 맞아야
for(const c of [ { name:"Firebase 보통(편도 120ms ±40ms)", up:0.12, down:0.12, jit:0.04 }, { name:"Firebase 나쁨(편도 180ms ±80ms)", up:0.18, down:0.18, jit:0.08 },
                 { name:"상태 패킷 10% 유실(편도 150ms ±60ms)", up:0.15, down:0.15, jit:0.06, loss:0.1 } ]){
  const o=simulate(Object.assign({mode:"old"},c)), nw=simulate(Object.assign({mode:"new"},c));
  console.log("["+c.name+"]  기존: "+fmt(o)+"  →  새: "+fmt(nw)+"  · 멈춘 뒤 권한과 차이 "+nw.finalVsHost.toFixed(1)+"px");
  check(c.name+": 이동 중 오차가 기존의 1/2 이하", nw.moveErr<=o.moveErr/2);
  check(c.name+": 멈춘 뒤 권한 위치와 ≤ 3px", nw.finalVsHost<=3);
}
{ const r=simulate({ mode:"new", up:0.15, down:0.15, jit:0.05, hostSlow:[0.5,3.5], T:9 });
  console.log("[호스트만 둔화 3초 → 정착]  마지막 권한 위치와의 차이 "+r.finalVsHost.toFixed(1)+"px");
  check("예측 불일치(둔화) 후 정착: 권한 위치와 ≤ 3px", r.finalVsHost<=3);
}
{ // 구버전 호스트(aq 없음) 하위호환: 기존 방식으로 동작해야
  const R=api.netNewRecon(), pred={x:100,y:100,r:22,facing:0,moveSpeed:300};
  check("aq 없는 패킷 → netOnSnapshot=false(기존 방식 폴백)", api.netOnSnapshot(R,pred,{x:120,y:100})===false && !R.hasAck);
}
{ // 패킷 필드: 사람 게스트만 aq/ad/ms, 봇·호스트 본인은 없음
  const f={ x:1,y:1,moveSpeed:300 }; const o1=api.netAckPack({},f);
  api.netHostTrackInput(f, Object.assign(api.emptyInput(),{iq:5}), 0.05); const o2=api.netAckPack({},f);
  check("입력 번호 없으면 aq 필드 없음(패킷 증가 0)", o1.aq===undefined && o1.ad===undefined);
  check("입력 번호 있으면 aq/ad/ms 숫자 ("+JSON.stringify(o2)+")", o2.aq===5 && o2.ad===50 && typeof o2.ms==="number" && o2.ms>0);
}
{ // 흐름 제어(원인 B): 서버 확인 전 쓰기가 8개면 더 쌓지 않고 최신 1개만 보관 → 확인 오면 그 최신 것을 보냄
  const OM=api.OM; const sent=[]; const pend=[];
  const ref={ child:()=>({ set:(v)=>{ sent.push(v.n); let res; const p=new Promise(r=>{res=r;}); pend.push(res); return p; } }) };
  OM.leaveRoom(true); OM.roomRef=ref;
  for(let i=1;i<=20;i++) OM._rtdbSetState({n:i});
  check("확인 전 쓰기 8개에서 멈춤(20개 중)", sent.length===8 && OM._stInflight===8);
  check("보관된 것은 가장 최신(20)", OM._stPend && OM._stPend.n===20);
  pend.shift()();
  Promise.resolve().then(()=>Promise.resolve()).then(()=>{
    check("확인 1개 도착 → 최신(20) 전송, 중간(9~19)은 버림", sent.length===9 && sent[8]===20 && !OM._stPend);
    OM.roomRef=null; OM._stInflight=0;
    console.log(fails?("결과: "+fails+"건 실패 ❌"):"결과: ALL PASS ✅");
  });
}
