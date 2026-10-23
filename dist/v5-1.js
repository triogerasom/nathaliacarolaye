  function v5Tomb(bucket,id){v5Shape();S.v5._deleted[bucket][String(id)]=now()}
  function v5ClearTomb(bucket,id){v5Shape();delete S.v5._deleted[bucket][String(id)]}
  function v5Add(bucket,obj){v5Shape();const x=v5Stamp({id:obj.id||uid(),...obj});v5ClearTomb(bucket,x.id);S.v5[bucket].push(x);return x}
  function v5Update(bucket,id,patch){const x=S.v5[bucket].find(v=>String(v.id)===String(id));if(!x)return null;Object.assign(x,patch);return v5Stamp(x)}
  function currentUserLabel(){const e=String(CLOUD_USER?.email||'').toLowerCase();if(e.includes('juniotaylon'))return 'Taylon';if(e.includes('eu15933220620'))return 'Nathalia';return e||'Usuário'}
  function audit(action,detail,kind='system',entityId=''){
    v5Shape();S.v5.audit.unshift(v5Stamp({id:uid(),at:isoNow(),by:currentUserLabel(),action,detail,kind,entityId}));
    S.v5.audit=S.v5.audit.slice(0,500);
  }

  // Auditoria automática para alterações do núcleo legado.
  let lastCore='';
  function coreSnapshot(){
    try{return JSON.stringify({tx:S.tx,rec:S.rec,acc:S.acc,ev:S.ev,vr:S.vr,pd:S.pd,cash:S.cash,budget:S.budget,obraIni:S.obraIni})}catch(e){return''}
  }
  function coreDiff(before){
    let p;try{p=before?JSON.parse(before):null}catch(e){}
    if(!p)return '';
    const dif=[];
    const check=(key,label)=>{
      const a=Array.isArray(p[key])?p[key]:[],b=Array.isArray(S[key])?S[key]:[],am=new Map(a.map(x=>[String(x.id),x])),bm=new Map(b.map(x=>[String(x.id),x]));
      for(const [id,x] of bm)if(!am.has(id))dif.push(`${label} adicionado: ${x.desc||x.t||x.name||x.brand||id}`);
      for(const [id,x] of am)if(!bm.has(id))dif.push(`${label} removido: ${x.desc||x.t||x.name||x.brand||id}`);
      for(const [id,x] of bm)if(am.has(id)&&JSON.stringify(am.get(id))!==JSON.stringify(x))dif.push(`${label} alterado: ${x.desc||x.t||x.name||x.brand||id}`);
    };
    check('tx','Lançamento');check('rec','Recorrência');check('acc','Conta');check('ev','Compromisso');check('vr','VR');
    if(JSON.stringify(p.pd||{})!==JSON.stringify(S.pd||{}))dif.push('Status de pagamento atualizado');
    if(n(p.cash)!==n(S.cash))dif.push('Saldo de dinheiro em mãos atualizado');
    return dif.slice(0,4).join(' · ');
  }
  lastCore=coreSnapshot();
  const oldSave=save;
  save=function(){
    v5Shape();const d=coreDiff(lastCore);if(d)audit('Alteração financeira',d,'core');
    oldSave();lastCore=coreSnapshot();
  };

  // Lixeira para exclusões do núcleo.
  function trashCore(type,obj){if(!obj)return;v5Add('trash',{type,original:structuredClone(obj),deletedAt:isoNow(),deletedBy:currentUserLabel()});audit('Movido para lixeira',obj.desc||obj.t||obj.name||obj.brand||type,'trash',obj.id)}
  const oldDel=del;del=function(id){const x=S.tx.find(t=>t.id===id);trashCore('tx',x);oldDel(id)};
  const oldDelRec=delRec;delRec=function(id){const x=S.rec.find(t=>t.id===id);trashCore('rec',x);oldDelRec(id)};
  const oldDelEv=delEv;delEv=function(id){const x=S.ev.find(t=>t.id===id);trashCore('ev',x);oldDelEv(id)};
  const oldDelAcc=delAcc;delAcc=function(){const x=S.acc.find(t=>t.id===md.acc);trashCore('acc',x);oldDelAcc()};
  const oldDelVR=delVR;delVR=function(){const x=S.vr.find(t=>t.id===md.vr);trashCore('vr',x);oldDelVR()};

  // UI helpers.
  function page(title,sub,body,actions=''){
    return `<div class="hd sl"><b class="ttl">${escA(title)}</b>${sub?`<small>${escA(sub)}</small>`:''}</div><main>${actions}${body}</main>`;
  }
  function stat(label,value,cls=''){return `<div class="v5stat"><span>${escA(label)}</span><b class="${cls}">${value}</b></div>`}
  function chip(t,c=''){return `<span class="v5chip ${c}">${escA(t)}</span>`}
  function empty(t){return `<div class="emp mu">${escA(t)}</div>`}
  function walletSelect(id='v5wallet',cur=''){return `<select id="${id}">${walletKeys().map(w=>`<option value="${w.key}"${w.key===cur?' selected':''}>${escA(w.label)} · ${brl(w.balance)}</option>`).join('')}</select>`}
  function mInput(label,id,value='',type='text',extra=''){return `<label>${label}</label><input id="${id}" type="${type}" value="${escA(value)}" ${extra}>`}
  function textArea(label,id,value=''){return `<label>${label}</label><textarea id="${id}" rows="3">${escA(value)}</textarea>`}
  function selectInput(label,id,opts,cur=''){return `<label>${label}</label><select id="${id}">${opts.map(([v,l])=>`<option value="${escA(v)}"${String(v)===String(cur)?' selected':''}>${escA(l)}</option>`).join('')}</select>`}
  function v5Go(t){tab=t;render();scrollTo(0,0)}window.v5Go=v5Go;

  function pendingBetween(days){const end=addD(TD,days);return events(TD,end).filter(x=>x.type==='out'&&!S.pd[pdk(x)])}
  function incomeBetween(days){const end=addD(TD,days);return events(TD,end).filter(x=>x.type==='in'&&!S.pd[pdk(x)])}
