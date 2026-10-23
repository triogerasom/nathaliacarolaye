// Casa & Obra V6 — navegação iPhone + razão financeiro retroativo
(function(){
  const EPOCH='v6-reset-20261023-1';
  const ROOT_TABS=new Set(['home','agenda','casa','obra','mais']);
  const PARENT={dashboard:'home',cards:'mais',budgets:'mais',suppliers:'mais',goals:'mais',shopping:'mais',quotes:'mais',search:'mais',activity:'mais',trash:'mais',closemonth:'mais',assistant:'mais',settings:'mais',projects:'mais',filters:'mais',relv5:'rel',prev:'mais',contas:'mais',vr:'mais',rel:'mais'};
  const V6_TABS=new Set([...ROOT_TABS,...Object.keys(PARENT)]);
  let navStack=[];
  let rebuilding=false;
  const r2=v=>Math.round(Number(v||0)*100)/100;
  const uid6=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);

  function emptyV6(){
    return {
      tx:[],budget:0,obraIni:0,obraDt:'',acc:[],rec:[],pd:{},paypost:{},cash:0,cashlog:[],alog:[],ev:[],vr:[],vlog:[],
      walletLedger:[],cashBaseVal:0,cashBaseDate:TD,dataEpoch:EPOCH,
      _deleted:{tx:{},rec:{},acc:{},ev:{},vr:{},pd:{},paypost:{},walletLedger:{}},_fieldUpdated:{},v5:{version:'6.0.0'}
    };
  }
  function clearOldLocal(){
    try{
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&(k.startsWith('fatt_')||k.startsWith('fdoc_')||k==='fin'||k==='cloud_revision'||k==='cloud_dirty'||k==='co_offline_queue'))localStorage.removeItem(k)}
      localStorage.setItem('co_data_epoch',EPOCH);
      localStorage.setItem('cloud_dirty','0');
      localStorage.setItem('cloud_revision','0');
    }catch(e){}
    S=ensureStateShape(emptyV6());
    try{localStorage.setItem('fin',JSON.stringify(S))}catch(e){}
  }
  if(localStorage.getItem('co_data_epoch')!==EPOCH)clearOldLocal();

  function ensureV6(x=S){
    x=ensureStateShape(x);
    x.walletLedger=Array.isArray(x.walletLedger)?x.walletLedger:[];
    x.cashBaseVal=Number.isFinite(Number(x.cashBaseVal))?Number(x.cashBaseVal):Number(x.cash||0);
    x.cashBaseDate=x.cashBaseDate||TD;
    x.dataEpoch=EPOCH;
    x._deleted=x._deleted||{};x._deleted.walletLedger=x._deleted.walletLedger||{};
    for(const a of x.acc||[]){if(a.baseVal==null)a.baseVal=Number(a.val||0);if(!a.baseDate)a.baseDate=TD}
    for(const v of x.vr||[]){if(v.baseVal==null)v.baseVal=Number(v.val||0);if(!v.baseDate)v.baseDate=TD}
    return x;
  }
  S=ensureV6(S);

  const prevEnsure=ensureStateShape;
  ensureStateShape=function(x=S){
    const o=prevEnsure(x);
    o.walletLedger=Array.isArray(o.walletLedger)?o.walletLedger:[];
    o.cashBaseVal=Number.isFinite(Number(o.cashBaseVal))?Number(o.cashBaseVal):Number(o.cash||0);
    o.cashBaseDate=o.cashBaseDate||TD;o.dataEpoch=EPOCH;
    o._deleted=o._deleted||{};o._deleted.walletLedger=o._deleted.walletLedger||{};
    for(const a of o.acc||[]){if(a.baseVal==null)a.baseVal=Number(a.val||0);if(!a.baseDate)a.baseDate=TD}
    for(const v of o.vr||[]){if(v.baseVal==null)v.baseVal=Number(v.val||0);if(!v.baseDate)v.baseDate=TD}
    return o;
  };

  const prevMerge=mergeState;
  mergeState=function(a0,b0){
    const ae=String(a0?.dataEpoch||''),be=String(b0?.dataEpoch||'');
    if(be===EPOCH&&ae!==EPOCH)return ensureStateShape(structuredClone(b0));
