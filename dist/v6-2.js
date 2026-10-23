        bal.set(m.walletKey,r2(bal.get(m.walletKey)+Number(m.delta||0)));
        const base=walletBase(m.walletKey),row={id:m.id,d:m.date||TD,a:base?.label||walletLabel(m.walletKey),v:Number(m.delta||0),n:m.note||'Movimentação',_u:Number(m._u||0)};
        if(m.walletKey==='cash')cl.push(row);else if(m.walletKey.startsWith('acc:'))al.push(row);else if(m.walletKey.startsWith('vr:'))vl.push(row);
      }
      for(const a of S.acc)a.val=r2(bal.get('acc:'+a.id)||0);
      for(const v of S.vr)v.val=r2(bal.get('vr:'+v.id)||0);
      S.cash=r2(bal.get('cash')||0);
      const desc=(a,b)=>String(b.d).localeCompare(String(a.d))||Number(b._u||0)-Number(a._u||0);
      S.alog=al.sort(desc);S.vlog=vl.sort(desc);S.cashlog=cl.sort(desc);
    }finally{rebuilding=false}
  }
  window.rebuildFinancialState=rebuildWallets;

  function addLedger(walletKey,delta,note,date=TD,kind='adjustment',ref=''){
    ensureV6(S);if(!walletBase(walletKey))return false;
    if(walletKey.startsWith('vr:')&&delta<0){rebuildWallets();const v=S.vr.find(x=>x.id===walletKey.slice(3));if(v&&Number(v.val||0)+Number(delta)<-.001){toast('Saldo insuficiente no VR selecionado.');return false}}
    const x={id:uid6(),walletKey,delta:r2(delta),note,date,kind,ref,_u:Date.now()};S.walletLedger.push(x);delete S._deleted.walletLedger[x.id];rebuildWallets();return x;
  }
  function removeLedgerByRef(ref){for(const x of [...S.walletLedger])if(x.ref===ref){S._deleted.walletLedger[x.id]=Date.now();S.walletLedger=S.walletLedger.filter(y=>y!==x)}}

  walletApply=function(walletKey,delta,note){return !!addLedger(walletKey,delta,note,TD,'adjustment')};
  postPayment=function(k,x){
    ensureV6(S);if(S.paypost[k])return true;if(!x.walletKey)return false;
    S.paypost[k]={walletKey:x.walletKey,desc:x.desc,eventDate:x.date,_u:Date.now()};clearTomb('paypost',k);rebuildWallets();return true;
  };
  reversePayment=function(k){ensureV6(S);if(S.paypost[k]){delete S.paypost[k];tomb('paypost',k)}rebuildWallets();return true};

  const prevSave=save;
  save=function(){rebuildWallets();prevSave()};

  const prevAdd=add;
  add=async function(){
    const old=md.ed?structuredClone(md.ed):null;
    const oldKey=old&&!old.freq?String(old.id)+'|'+String(old.date):'';
    await prevAdd();
    if(document.querySelector('#md')?.classList.contains('show'))return;
    if(old){
      if(!old.freq){
        const x=S.tx.find(t=>String(t.id)===String(old.id));
        if(x){const nk=String(x.id)+'|'+String(x.date);if(nk!==oldKey){
          if(S.pd[oldKey]){S.pd[nk]={...S.pd[oldKey],_u:Date.now()};delete S.pd[oldKey];tomb('pd',oldKey);clearTomb('pd',nk)}
          if(S.paypost[oldKey]){S.paypost[nk]={...S.paypost[oldKey],walletKey:x.walletKey,desc:x.desc,eventDate:x.date,_u:Date.now()};delete S.paypost[oldKey];tomb('paypost',oldKey);clearTomb('paypost',nk)}
        }}
      }
      rebuildWallets();save();render();
    }
  };

  delRec=function(id){
    const prefix='r'+id+'|';for(const k of Object.keys(S.pd||{}))if(k.startsWith(prefix)){delete S.pd[k];tomb('pd',k)}
    for(const k of Object.keys(S.paypost||{}))if(k.startsWith(prefix)){delete S.paypost[k];tomb('paypost',k)}
