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
