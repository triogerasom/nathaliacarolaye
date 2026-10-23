    if(ae===EPOCH&&be!==EPOCH)return ensureStateShape(structuredClone(a0));
    const a=ensureStateShape(structuredClone(a0||{})),b=ensureStateShape(structuredClone(b0||{})),o=ensureStateShape(prevMerge(a,b));
    const am=new Map((a.walletLedger||[]).map(x=>[String(x.id),x])),bm=new Map((b.walletLedger||[]).map(x=>[String(x.id),x]));
    const ids=new Set([...am.keys(),...bm.keys(),...Object.keys(a._deleted?.walletLedger||{}),...Object.keys(b._deleted?.walletLedger||{})]);
    o.walletLedger=[];
    for(const id of ids){
      const x=am.get(id),y=bm.get(id),del=Math.max(Number(a._deleted?.walletLedger?.[id]||0),Number(b._deleted?.walletLedger?.[id]||0));
      const ux=Number(x?._u||0),uy=Number(y?._u||0),pick=ux>=uy?x:y;
      if(pick&&Math.max(ux,uy)>=del)o.walletLedger.push(pick);
    }
    o.walletLedger.sort((x,y)=>Number(y._u||0)-Number(x._u||0));
    o.dataEpoch=EPOCH;return o;
  };

  function walletBase(key){
    if(key==='cash')return {value:Number(S.cashBaseVal||0),date:S.cashBaseDate||TD,label:'Dinheiro em mãos'};
    if(key?.startsWith('acc:')){const a=S.acc.find(x=>x.id===key.slice(4));return a?{value:Number(a.baseVal||0),date:a.baseDate||TD,label:a.name}:null}
    if(key?.startsWith('vr:')){const v=S.vr.find(x=>x.id===key.slice(3));return v?{value:Number(v.baseVal||0),date:v.baseDate||TD,label:v.brand+(v.nick?' · '+v.nick:'')}:null}
    return null;
  }
  function resolvePaid(k,p){
    const cut=k.lastIndexOf('|');if(cut<0)return null;
    const id=k.slice(0,cut),date=k.slice(cut+1);let x=null;
    if(id.startsWith('r'))x=S.rec.find(r=>String(r.id)===id.slice(1));else x=S.tx.find(t=>String(t.id)===id);
    if(!x)return null;
    const walletKey=x.walletKey||p?.walletKey||'';if(!walletKey)return null;
    return {id:'pay:'+k,walletKey,date,delta:x.type==='out'?-Number(x.val||0):Number(x.val||0),note:(x.type==='out'?'Pagamento: ':'Recebimento: ')+(x.desc||'Lançamento'),kind:'payment',ref:k,_u:Number(p?._u||S.pd?.[k]?._u||0)};
  }
  function allMovements(){
    const out=[];
    for(const l of S.walletLedger||[])out.push({...l,delta:Number(l.delta||0),kind:l.kind||'ledger'});
    for(const [k,p] of Object.entries(S.paypost||{})){const m=resolvePaid(k,p);if(m)out.push(m)}
    return out.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||Number(a._u||0)-Number(b._u||0)||String(a.id).localeCompare(String(b.id)));
  }
  function movementApplies(m,key){const b=walletBase(key);return !!b&&m.walletKey===key&&String(m.date||TD)>=String(b.date||TD)}
  function rebuildWallets(){
    if(rebuilding)return;rebuilding=true;
    try{
      ensureV6(S);const keys=['cash',...S.acc.map(a=>'acc:'+a.id),...S.vr.map(v=>'vr:'+v.id)],bal=new Map();
      for(const k of keys){const b=walletBase(k);bal.set(k,Number(b?.value||0))}
      const al=[],vl=[],cl=[];
      for(const k of keys){const b=walletBase(k);if(!b||!b.value)continue;const row={id:'base:'+k,d:b.date,a:b.label,v:Number(b.value),n:'Saldo-base',_u:0};if(k==='cash')cl.push(row);else if(k.startsWith('acc:'))al.push(row);else vl.push(row)}
      for(const m of allMovements()){
        if(!bal.has(m.walletKey)||!movementApplies(m,m.walletKey))continue;
