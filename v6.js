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
    tomb('rec',id);S.rec=S.rec.filter(x=>String(x.id)!==String(id));rebuildWallets();save();render();
  };

  openAcc=function(id){
    const a=S.acc.find(x=>x.id===id);md.acc=id||null;
    const dateField=a?'':`<label>Data do saldo-base</label><input id="f5" type="date" value="${TD}"><div class="mu" style="font-size:12px;margin-top:4px">Movimentações a partir desta data serão somadas ao saldo-base.</div>`;
    const delButton=a?`<button class="ghost out" style="width:100%;margin-top:8px" onclick="delAcc()">Excluir conta</button>`:'';
    M(`<h2>${a?'Atualizar conta':'Nova conta bancária'}</h2><label>Nome</label><input id="f1" value="${a?esc(a.name):''}" placeholder="Ex.: Sicredi, Nubank"><label>Tipo</label><select id="f3">${AT.map(t=>`<option${a&&a.type===t?' selected':''}>${t}</option>`).join('')}</select><label>${a?'Saldo atual para conciliar':'Saldo-base'} (R$)</label><input id="f2" inputmode="decimal" value="${a?String(a.val).replace('.',','):''}" placeholder="0,00">${dateField}<label>Considerar na previsão de saldo</label><select id="f4"><option value="1"${!a||a.inc!==false?' selected':''}>Sim</option><option value="0"${a&&a.inc===false?' selected':''}>Não</option></select><div id="er" class="out"></div><button class="pri" onclick="saveAcc()">Salvar conta</button>${delButton}${btns()}`);
  };
  saveAcc=function(){
    const name=$('#f1').value.trim(),target=pv($('#f2').value||'0');if(!name||isNaN(target))return $('#er').textContent='Informe o nome e o saldo.';
    const type=$('#f3').value,inc=$('#f4').value==='1';
    if(md.acc){const a=S.acc.find(x=>x.id===md.acc);if(!a)return;rebuildWallets();const diff=r2(target-Number(a.val||0));a.name=name;a.type=type;a.inc=inc;stamp(a);if(diff)addLedger('acc:'+a.id,diff,'Conciliação de saldo',TD,'reconcile','acc-reconcile:'+uid6())}
    else{const id=Date.now()+'';S.acc.push(stamp({id,name,type,inc,baseVal:target,baseDate:$('#f5').value||TD,val:target}))}
    rebuildWallets();save();closeM();render();
  };
  delAcc=function(){const id=md.acc,key='acc:'+id,used=S.tx.some(x=>x.walletKey===key)||S.rec.some(x=>x.walletKey===key)||S.walletLedger.some(x=>x.walletKey===key)||Object.values(S.paypost||{}).some(p=>p.walletKey===key);if(used)return toast('Esta conta possui histórico. Altere ou exclua os lançamentos antes de remover a conta.');tomb('acc',id);S.acc=S.acc.filter(x=>x.id!==id);rebuildWallets();save();closeM();render()};

  openCash=function(){M(`<h2>Dinheiro em mãos</h2><label>Saldo atual para conciliar (R$)</label><input id="f1" inputmode="decimal" value="${String(S.cash||0).replace('.',',')}"><div class="mu" style="font-size:12px;margin-top:4px">O ajuste entra no histórico de hoje; movimentos antigos continuam preservados.</div><div id="er" class="out"></div><button class="pri" onclick="saveCash()">Salvar saldo</button>${btns()}`)};
  saveCash=function(){const v=pv($('#f1').value||'0');if(isNaN(v))return $('#er').textContent='Informe um saldo válido.';rebuildWallets();const diff=r2(v-Number(S.cash||0));if(diff)addLedger('cash',diff,'Conciliação de dinheiro em mãos',TD,'reconcile','cash-reconcile:'+uid6());save();closeM();render()};

  openVR=function(id){
    const v=S.vr.find(x=>x.id===id);md.vr=id||null;
    const dateField=v?'':`<label>Data do saldo-base</label><input id="f6" type="date" value="${TD}">`;
    const delButton=v?`<button class="ghost out" style="width:100%;margin-top:8px" onclick="delVR()">Excluir cartão</button>`:'';
    M(`<h2>${v?'Editar cartão VR':'Novo cartão VR'}</h2><label>Operadora</label><select id="f1"><option${v&&v.brand==='Pluxee'?'':' selected'}>Alelo</option><option${v&&v.brand==='Pluxee'?' selected':''}>Pluxee</option></select><label>Apelido ou final do cartão (opcional)</label><input id="f2" value="${v&&v.nick?esc(v.nick):''}" placeholder="Ex.: Final 4821"><label>${v?'Saldo atual para conciliar':'Saldo-base'} (R$)</label><input id="f3" inputmode="decimal" value="${v?String(v.val).replace('.',','):''}" placeholder="0,00">${dateField}<label>Crédito mensal (R$)</label><input id="f4" inputmode="decimal" value="${v&&v.mo?String(v.mo).replace('.',','):''}" placeholder="0,00"><label>Dia do crédito (1 a 31)</label><input id="f5" type="number" min="1" max="31" value="${v&&v.day?v.day:''}" placeholder="Ex.: 5"><div id="er" class="out"></div><button class="pri" onclick="saveVR()">Salvar cartão</button>${delButton}${btns()}`);
  };
  saveVR=function(){
    const target=pv($('#f3').value||'0'),mo=pv($('#f4').value||'0'),day=parseInt($('#f5').value)||0;if(isNaN(target)||isNaN(mo)||day<0||day>31||(mo>0&&!day))return $('#er').textContent='Confira o saldo, o crédito mensal e o dia.';
    if(md.vr){const v=S.vr.find(x=>x.id===md.vr);if(!v)return;rebuildWallets();const diff=r2(target-Number(v.val||0));v.brand=$('#f1').value;v.nick=$('#f2').value.trim();v.mo=mo;v.day=day;stamp(v);for(const l of S.walletLedger)if(l.kind==='vrMonthly'&&l.ref==='vr:'+v.id)l.delta=mo;if(diff)addLedger('vr:'+v.id,diff,'Conciliação de saldo VR',TD,'reconcile','vr-reconcile:'+uid6())}
    else{const id=Date.now()+'';S.vr.push(stamp({id,brand:$('#f1').value,nick:$('#f2').value.trim(),mo,day,baseVal:target,baseDate:$('#f6').value||TD,val:target,lc:''}))}
    rebuildWallets();save();closeM();render();
  };
  delVR=function(){const id=md.vr,key='vr:'+id,used=S.tx.some(x=>x.walletKey===key)||S.rec.some(x=>x.walletKey===key)||S.walletLedger.some(x=>x.walletKey===key)||Object.values(S.paypost||{}).some(p=>p.walletKey===key);if(used)return toast('Este VR possui histórico. Altere ou exclua os lançamentos antes de removê-lo.');tomb('vr',id);S.vr=S.vr.filter(x=>x.id!==id);rebuildWallets();save();closeM();render()};

  vrTick=function(){
    ensureV6(S);const cm=TD.slice(0,7),[yy,mm]=cm.split('-').map(Number);let changed=false;
    for(const v of S.vr){if(!(v.mo>0)||!v.day)continue;const day=Math.min(v.day,new Date(yy,mm,0).getDate()),date=`${cm}-${String(day).padStart(2,'0')}`;if(date>TD)continue;const ref='vr:'+v.id,cycle='vrMonthly:'+v.id+':'+cm;if(S.walletLedger.some(x=>x.kind==='vrMonthly'&&x.cycle===cycle))continue;S.walletLedger.push({id:uid6(),walletKey:ref,delta:Number(v.mo),note:'Crédito mensal',date,kind:'vrMonthly',ref,cycle,_u:Date.now()});changed=true}
    if(changed){rebuildWallets();save()}
  };
  saveVT=function(){const v=S.vr.find(x=>x.id===md.vr),a=pv($('#f1').value);if(!(a>0))return $('#er').textContent='Informe um valor maior que zero.';rebuildWallets();if(md.vt==='out'&&a>Number(v.val||0))return $('#er').textContent='O gasto é maior que o saldo do cartão.';const d=md.vt==='out'?-a:a;if(!addLedger('vr:'+v.id,d,$('#f2').value.trim()||(d<0?'Gasto':'Recarga'),TD,'manual-vr'))return;save();closeM();render()};

  saveTr=function(){const a=S.acc.find(x=>x.id===$('#f1').value),b=S.acc.find(x=>x.id===$('#f2').value),v=pv($('#f3').value);if(!a||!b||a===b)return $('#er').textContent='Escolha duas contas diferentes.';if(!(v>0))return $('#er').textContent='Informe um valor maior que zero.';const ref='transfer:'+uid6();addLedger('acc:'+a.id,-v,'Transferência para '+b.name,TD,'transfer',ref);addLedger('acc:'+b.id,v,'Transferência de '+a.name,TD,'transfer',ref);save();closeM();render()};

  // Projeção ignora itens futuros já pagos/recebidos.
  forecast=function(days){let bal=accTotal(),start=bal,by={},pts=[];events(addD(TD,1),addD(TD,days)).filter(e=>!S.pd[pdk(e)]).forEach(e=>(by[e.date]=by[e.date]||[]).push(e));for(let i=1;i<=days;i++){const d=addD(TD,i);for(const e of by[d]||[])bal+=e.type==='in'?Number(e.val): -Number(e.val);pts.push({d,bal})}const neg=[];let cur=null;for(const x of pts){if(x.bal<0){if(!cur){cur={a:x.d,b:x.d,n:0,min:x.bal};neg.push(cur)}cur.b=x.d;cur.n++;cur.min=Math.min(cur.min,x.bal)}else cur=null}return{start,days:pts,neg}};

  // Navegação própria para iPhone/PWA.
  function targetParent(t){return navStack.length?navStack[navStack.length-1]:(PARENT[t]||'home')}
  function route(t,push=true){if(!V6_TABS.has(t))t='home';if(push&&tab!==t){navStack.push(tab);if(navStack.length>30)navStack.shift()}tab=t;try{history.pushState({coTab:t},'',location.pathname+(t==='home'?'':'?tab='+encodeURIComponent(t)))}catch(e){}render();scrollTo(0,0)}
  const originalGo=go;go=function(t){route(t,true)};
  window.v5Go=function(t){route(t,true)};
  window.appBackV6=function(){const t=navStack.pop()||PARENT[tab]||'home';tab=t;try{history.replaceState({coTab:t},'',location.pathname+(t==='home'?'':'?tab='+encodeURIComponent(t)))}catch(e){}render();scrollTo(0,0)};
  window.addEventListener('popstate',e=>{const t=e.state?.coTab;if(t&&V6_TABS.has(t)){tab=t;render();scrollTo(0,0)}});
  try{const q=new URLSearchParams(location.search).get('tab');if(q&&V6_TABS.has(q))tab=q;history.replaceState({coTab:tab},'',location.href)}catch(e){}

  const prevRender=render;
  render=function(){
    rebuildWallets();prevRender();
    if(!ROOT_TABS.has(tab)){
      const hd=document.querySelector('.hd');if(hd&&!hd.querySelector('.v6back'))hd.insertAdjacentHTML('afterbegin',`<button class="v6back" onclick="appBackV6()" aria-label="Voltar">‹ <span>Voltar</span></button>`);
    }
  };

  // Garante que estado local vazio não ressuscite dados anteriores.
  rebuildWallets();
  try{localStorage.setItem('fin',JSON.stringify(S));localStorage.setItem('co_data_epoch',EPOCH)}catch(e){}
})();