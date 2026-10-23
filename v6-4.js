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
