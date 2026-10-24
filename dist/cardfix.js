// Casa & Obra — cartões/faturas V6.1
(function(){
  const oldRenderCardsFix=render;
  const oldSaveCardsFix=save;
  const oldPayCardsFix=pay;
  const oldOpenCardPurchaseFix=window.openCardPurchase;
  const oldSaveCardPurchaseFix=window.saveCardPurchase;

  const money=v=>brl(Number.isFinite(Number(v))?Number(v):0);
  const amount=x=>{const v=Number(x?.amount ?? x?.val ?? 0);return Number.isFinite(v)?v:0};
  const round2=v=>Math.round(Number(v||0)*100)/100;
  const escC=s=>esc(String(s??''));
  const uidC=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const cardById=id=>S.v5?.cards?.find(c=>String(c.id)===String(id));
  const chargesFor=(cardId,month,onlyOpen=false)=>(S.v5?.cardCharges||[]).filter(x=>String(x.cardId)===String(cardId)&&(!month||x.invoiceMonth===month)&&(!onlyOpen||!x.paid));
  const invoiceTotal=(cardId,month,onlyOpen=true)=>round2(chargesFor(cardId,month,onlyOpen).reduce((t,x)=>t+amount(x),0));
  const cardUsed=cardId=>round2(chargesFor(cardId,'',true).reduce((t,x)=>t+amount(x),0));
  const accountName=key=>{if(!key)return 'Não definida';const id=String(key).replace(/^acc:/,'');return S.acc.find(a=>String(a.id)===id)?.name||'Conta não encontrada'};
  const accountOptions=(selected='')=>S.acc.map(a=>`<option value="acc:${a.id}" ${selected===`acc:${a.id}`?'selected':''}>🏦 ${escC(a.name)} · ${money(a.val)}</option>`).join('');
  const invoiceKey=(cardId,month)=>String(cardId)+'|'+String(month);
  const invoiceTxFor=(cardId,month)=>S.tx.find(x=>x.cardInvoiceKey===invoiceKey(cardId,month));
  const invoiceMonthForFix=(card,date)=>{const d=new Date(date+'T12:00:00');if(d.getDate()>Number(card.closingDay||31))d.setMonth(d.getMonth()+1);return ymd(d).slice(0,7)};
  const invoiceDueDateFix=(card,m)=>{const [y,mo]=m.split('-').map(Number),day=Math.min(Number(card.dueDay)||10,new Date(y,mo,0).getDate());return `${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
  const isPaidTx=tx=>!!(tx&&S.pd?.[`${tx.id}|${tx.date}`]);

  function invoiceScope(charges){
    const scopes=[...new Set(charges.map(x=>x.scope).filter(Boolean))];
    return scopes.length===1?scopes[0]:'casa';
  }
  function invoiceCategory(charges){
    const cats=[...new Set(charges.map(x=>x.cat).filter(Boolean))];
    return cats.length===1?cats[0]:'Outros';
  }

  function syncCardInvoices(){
    if(!S.v5?.cards||!S.v5?.cardCharges)return false;
    let changed=false;
    for(const card of S.v5.cards){
      const months=[...new Set(chargesFor(card.id,'',false).map(x=>x.invoiceMonth).filter(Boolean))];
      for(const month of months){
        const all=chargesFor(card.id,month,false),open=all.filter(x=>!x.paid),total=round2(open.reduce((t,x)=>t+amount(x),0));
        let tx=invoiceTxFor(card.id,month);
        if(tx&&isPaidTx(tx)){
          for(const ch of all)if(!ch.paid){ch.paid=true;ch.paidAt=ch.paidAt||new Date().toISOString();ch.walletKey=tx.walletKey;ch._u=Date.now();changed=true}
          continue;
        }
        if(total<=0)continue;
        const due=invoiceDueDateFix(card,month),walletKey=card.accountKey||'';
        if(!tx){
          tx=stamp({
            id:'cardinv_'+String(card.id).replace(/[^a-zA-Z0-9_-]/g,'')+'_'+month.replace('-',''),
            scope:invoiceScope(open),type:'out',desc:'Fatura '+card.name,val:total,
            cat:invoiceCategory(open),sup:'',date:due,walletKey,pay:'Cartão de crédito',pixKey:'',
            cardInvoiceKey:invoiceKey(card.id,month),cardId:card.id,invoiceMonth:month,_u:Date.now()
          });
          clearTomb('tx',tx.id);S.tx.push(tx);changed=true;
        }else{
          const oldKey=`${tx.id}|${tx.date}`;
          const next={desc:'Fatura '+card.name,val:total,date:due,walletKey,scope:invoiceScope(open),cat:invoiceCategory(open)};
          if(tx.desc!==next.desc||Number(tx.val)!==next.val||tx.date!==next.date||tx.walletKey!==next.walletKey||tx.scope!==next.scope||tx.cat!==next.cat){
            if(S.pd?.[oldKey])continue;
            Object.assign(tx,next);stamp(tx);changed=true;
          }
        }
      }
    }
    return changed;
  }
  window.syncCardInvoices=syncCardInvoices;

  save=function(){syncCardInvoices();oldSaveCardsFix()};

  function statCard(label,value,cls=''){
    return `<div class="cardfix-stat"><span>${escC(label)}</span><b class="${cls}">${value}</b></div>`;
  }
  function dueStatus(date){
    if(date<TD)return '<span class="cardfix-badge late">Em atraso</span>';
    if(date===TD)return '<span class="cardfix-badge today">Vence hoje</span>';
    return '';
  }
  function renderCardInvoices(card){
    const months=[...new Set(chargesFor(card.id,'',true).map(x=>x.invoiceMonth).filter(Boolean))].sort();
    if(!months.length)return '<div class="mu cardfix-empty">Nenhuma fatura em aberto.</div>';
    return months.slice(0,6).map((m,i)=>{
      const total=invoiceTotal(card.id,m,true),due=invoiceDueDateFix(card,m),tx=invoiceTxFor(card.id,m);
      return `<div class="cardfix-invoice ${i===0?'current':''}">
        <div class="row sp"><div><b>${i===0?'Fatura em aberto':'Fatura futura'} · ${m}</b><div class="mu">Vence ${fdy(due)} · ${dueStatus(due)}</div></div><b class="out">${money(total)}</b></div>
        <div class="cardfix-account">🏦 Débito: <b>${escC(accountName(card.accountKey))}</b>${tx&&tx.date>TD?' · lançamento futuro criado':''}</div>
        <button class="ghost v5full" onclick="openInvoice('${card.id}','${m}')">Ver detalhes / pagar</button>
      </div>`;
    }).join('');
  }

  function renderCardsFixed(){
    syncCardInvoices();
    const cards=(S.v5?.cards||[]).map(c=>{
      const used=cardUsed(c.id),avail=round2(Number(c.limit||0)-used),noAccount=!c.accountKey;
      return `<div class="card cardfix-card">
        <div class="row sp"><div><b class="cardfix-title">${escC(c.name)}</b><div class="mu">Fecha dia ${c.closingDay} · vence dia ${c.dueDay}</div></div><button class="ghost" onclick="openCard('${c.id}')">Editar</button></div>
        ${noAccount?`<div class="alert cardfix-alert">⚠️ Defina a conta bancária onde a fatura será debitada.</div>`:`<div class="cardfix-linked">🏦 Conta da fatura: <b>${escC(accountName(c.accountKey))}</b></div>`}
        <div class="cardfix-grid">${statCard('Limite',money(c.limit))}${statCard('Utilizado',money(used),'out')}${statCard('Disponível',money(avail),avail<0?'out':'in')}</div>
        ${renderCardInvoices(c)}
        <button class="pri" onclick="openCardPurchase('${c.id}')">+ Compra no cartão</button>
      </div>`;
    }).join('');
    return `<div class="hd sl cardfix-hd"><b class="ttl">Cartões e faturas</b><small>Limites, compras, conta de débito e vencimentos</small></div><main class="cardfix-main"><button class="pri cardfix-new" onclick="openCard()">+ Novo cartão</button>${cards||'<div class="card emp mu">Cadastre seu primeiro cartão.</div>'}</main>`;
  }

  window.openCard=function(id){
    const x=cardById(id);md.v5id=id||null;
    const opts=accountOptions(x?.accountKey||'');
    M(`<h2>${x?'Editar cartão':'Novo cartão'}</h2>
      <label>Nome</label><input id="cf1" value="${escC(x?.name||'')}" placeholder="Ex.: Sicredi Visa">
      <label>Limite (R$)</label><input id="cf2" inputmode="decimal" value="${x?String(x.limit).replace('.',','):''}" placeholder="0,00">
      <label>Dia do fechamento</label><input id="cf3" type="number" min="1" max="31" value="${x?.closingDay||5}">
      <label>Dia do vencimento</label><input id="cf4" type="number" min="1" max="31" value="${x?.dueDay||10}">
      <label>Conta bancária para débito da fatura</label>
      <select id="cf5"><option value="">Selecione a conta</option>${opts}</select>
      ${S.acc.length?'':'<div class="alert">Cadastre primeiro uma conta bancária em Mais → Contas.</div>'}
      <div id="er" class="out"></div>
      <button class="pri" onclick="saveCardFixed()">Salvar cartão</button>
      ${x?`<button class="ghost out v5full" onclick="v5Delete('cards','${x.id}')">Excluir cartão</button>`:''}
      ${btns()}`);
  };
  window.saveCardFixed=function(){
    const name=$('#cf1').value.trim(),limit=pv($('#cf2').value),closingDay=parseInt($('#cf3').value),dueDay=parseInt($('#cf4').value),accountKey=$('#cf5').value;
    if(!name||!(limit>0)||closingDay<1||closingDay>31||dueDay<1||dueDay>31)return $('#er').textContent='Confira nome, limite, fechamento e vencimento.';
    if(!accountKey)return $('#er').textContent='Escolha a conta bancária onde a fatura será debitada.';
    const p={name,limit,closingDay,dueDay,accountKey,_u:Date.now()};
    if(md.v5id){const c=cardById(md.v5id);if(!c)return;Object.assign(c,p)}
    else S.v5.cards.push({id:uidC(),...p});
    save();closeM();render();
  };
  window.saveCard=window.saveCardFixed;

  window.openCardPurchase=function(cardId){
    const c=cardById(cardId);if(!c)return;
    if(!c.accountKey){toast('Defina primeiro a conta banária da fatura.');window.openCard(cardId);return}
    oldOpenCardPurchaseFix(cardId);
    const box=document.querySelector('#sh');
    const h=box?.querySelector('h2');
    if(h)h.insertAdjacentHTML('afterend',`<div class="cardfix-account" style="margin:8px 0 12px">🏦 Esta compra entrará na fatura debitada de <b>${escC(accountName(c.accountKey))}</b>.</div>`);
  };
  window.saveCardPurchase=function(){
    const c=cardById(md.cardId);if(!c?.accountKey){const er=document.getElementById('er');if(er)er.textContent='Defina a conta bancária da fatura antes de laçar compras.';return}
    return oldSaveCardPurchaseFix();
  };

  window.openInvoice=function(cardId,m){
    syncCardInvoices();
    const c=cardById(cardId),L=chargesFor(cardId,m,true),tot=invoiceTotal(cardId,m,true),due=c?invoiceDueDateFix(c,m):'';
    if(!c)return;
    const tx=invoiceTxFor(cardId,m);
    M(`<h2>Fatura · ${escC(c.name)}</h2>
      <div class="big2 out">${money(tot)}</div>
      <div class="mu">Competência ${m} · vence ${fdy(due)}</div>
      <div class="cardfix-account" style="margin-top:10px">🏦 Débito programado em <b>${escC(accountName(c.accountKey))}</b></div>
      <div class="card" style="margin-top:10px">${L.map(x=>`<div class="it"><div class="t"><b>${escC(x.desc)}</b><span class="mu">Parcela ${x.installment||1}/${x.installments||1}${x.cat?' · '+escC(x.cat):''}</span></div><b>${money(amount(x))}</b></div>`).join('')||'<div class="emp mu">Sem itens em abert.</div>'}</div>
      ${tx?`<div class="mu">Lançamento financeiro: ${fdy(tx.date)} · ${escC(accountName(tx.walletKey))}</div>`:''}
      <div id="er" class="out"></div>
      ${L.length?`<button class="pri" onclick="payInvoice('${cardId}','${m}')">Pagar fatura pela conta definida</button>`:''}
      <button class="ghost v5full" onclick="openCard('${cardId}')">Alterar conta / vencimento</button>
      ${btns().replace('Cancelar','Fechar')}`);
  };

  window.payInvoice=function(cardId,m){
    syncCardInvoices();const c=cardById(cardId),tx=invoiceTxFor(cardId,m),L=chargesFor(cardId,m,true);
    if(!c?.accountKey){const er=document.getElementById('er');if(er)er.textContent='Defina a conta bancária da fatura.';return}
    if(!tx||!L.length)return toast('Fatura já está paga ou não possui lançamentos.');
    tx.walletKey=c.accountKey;stamp(tx);save();
    oldPayCardsFix(`${tx.id}|${tx.date}`);
    const paid=!!S.pd?.[`${tx.id}|${tx.date}`];
    if(paid){for(const ch of chargesFor(cardId,m,false)){ch.paid=true;ch.paidAt=new Date().toISOString();ch.walletKey=c.accountKey;ch._u=Date.now()}}
    save();closeM();render();
  };

  pay=function(k){
    const [id,date]=String(k).split('|'),tx=S.tx.find(t=>String(t.id)===id),cardKey=tx?.cardInvoiceKey,before=!!S.pd?.[k];
    oldPayCardsFix(k);
    if(cardKey){
      const after=!!S.pd?.[k];
      if(after!==before){
        const [cardId,month]=cardKey.split('|');
        for(const ch of chargesFor(cardId,month,false)){ch.paid=after;ch.paidAt=after?new Date().toISOString():null;ch.walletKey=tx.walletKey;ch._u=Date.now()}
        save();render();
      }
    }
  };

  render=function(){
    if(tab==='cards'){
      const changed=syncCardInvoices();
      document.getElementById('app').innerHTML=renderCardsFixed();
      document.getElementById('nav').innerHTML='';
      if(changed)oldSaveCardsFix();
      return;
    }
    oldRenderCardsFix();
  };

  try{if(syncCardInvoices())oldSaveCardsFix()}catch(e){console.warn('card invoice sync',e)}
})();
