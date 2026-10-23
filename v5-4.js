  function advancedReport(){const y=month.slice(0,4),l=evSc('all',y+'-01-01',y+'-12-31'),sup={};for(const x of l.filter(x=>x.type==='out'&&x.sup))sup[x.sup]=(sup[x.sup]||0)+x.val;const top=Object.entries(sup).sort((a,b)=>b[1]-a[1]).slice(0,8);const cats=ALL.map(c=>[c,sum(l.filter(x=>x.type==='out'&&x.cat===c))]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);return page('Relatório avançado',`Ano ${y}`,`<div class="v5grid3">${stat('Receitas',brl(inc(l)),'in')}${stat('Despesas',brl(exp(l)),'out')}${stat('Saldo',brl(inc(l)-exp(l)),inc(l)-exp(l)<0?'out':'in')}</div><div class="card"><h2>Maiores categorias</h2>${cats.map(([c,v])=>`<div class="row sp" style="padding:6px 0"><span>${IC[c]||'📦'} ${escA(c)}</span><b>${brl(v)}</b></div>`).join('')||empty('Sem despesas.')}</div><div class="card"><h2>Maiores fornecedores</h2>${top.map(([s,v])=>`<div class="row sp" style="padding:6px 0"><span>${escA(s)}</span><b>${brl(v)}</b></div>`).join('')||empty('Sem fornecedores informados.')}</div><button class="pri" onclick="exportCSV()">Exportar CSV</button>`)}
  function exportCSV(){const rows=[['Data','Tipo','Escopo','Descrição','Categoria','Fornecedor','Valor','Carteira']];for(const x of S.tx)rows.push([x.date,x.type,x.scope,x.desc,x.cat,x.sup||'',x.val,walletLabel(x)]);const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='casa-obra-lancamentos-'+TD+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);audit('CSV exportado','Lançamentos financeiros','backup');save();}window.exportCSV=exportCSV;

  // Assistente financeiro local (sem enviar dados para terceiros).
  function answerFinance(q){const s=String(q||'').toLowerCase(),cur=mEv('all',TD.slice(0,7)),obra=S.tx.filter(x=>x.scope==='obra'),pend=events(TD,addD(TD,30)).filter(x=>x.type==='out'&&!S.pd[pdk(x)]);if(/quanto.*(tenho|saldo)/.test(s))return `Seu saldo consolidado atual é ${brl(accTotal())}.`;if(/pagar|vence|venc/.test(s))return `Nos próximos 30 dias há ${pend.length} despesas pendentes, totalizando ${brl(sum(pend))}.`;if(/obra/.test(s)&&/gast/.test(s))return `A obra tem ${brl(sum(obra.filter(x=>x.type==='out')))} em despesas lançadas.`;if(/m[eê]s|mensal/.test(s))return `Neste mês: receitas ${brl(inc(cur))}, despesas ${brl(exp(cur))} e saldo ${brl(inc(cur)-exp(cur))}.`;if(/sobra|projet/.test(s)){const f=forecast(30),v=f.days.at(-1)?.bal??accTotal();return `Considerando os lançamentos dos próximos 30 dias, o saldo projetado é ${brl(v)}.`}if(/maior.*gasto/.test(s)){const x=S.tx.filter(x=>x.type==='out').sort((a,b)=>b.val-a.val)[0];return x?`O maior gasto lançado é ${x.desc}, no valor de ${brl(x.val)}.`:'Ainda não há despesas.'}return 'Posso responder sobre saldo, contas a pagar, gastos da obra, mês atual, maior gasto e saldo projetado.'}
  function renderAssistant(){const q=window.v5Ask||'',a=q?answerFinance(q):'';return page('Assistente financeiro','Pergunte sobre seus próprios dados',`<div class="card"><textarea class="v5search" rows="3" placeholder="Ex.: quanto sobra depois de pagar tudo?" oninput="window.v5Ask=this.value">${escA(q)}</textarea><button class="pri" onclick="askFinance()">Analisar</button></div>${a?`<div class="card v5answer"><b>Resposta</b><div style="margin-top:8px">${escA(a)}</div></div>`:empty('Seus dados ficam no próprio sistema; esta análise é local.')}`)}
  function askFinance(){window.v5Ask=document.querySelector('.v5search')?.value||'';render()}window.askFinance=askFinance;

  // Preferências e cards da home.
  function renderSettings(){const st=S.v5.settings,opts=[['notifyNew','Novo lançamento/compromisso'],['notifyThreeDays','3 dias antes'],['notifyOneDay','1 dia antes'],['notifyDue','No vencimento / 90 min'],['weeklySummary','Resumo semanal']];return page('Preferências','Notificações, dashboard e retenção',`<div class="card"><h2>Notificações</h2>${opts.map(([k,l])=>`<label class="v5toggle"><span>${l}</span><input type="checkbox" id="set_${k}" ${st[k]?'checked':''}></label>`).join('')}</div><div class="card"><h2>Lixeira</h2>${mInput('Dias para manter itens excluídos','set_trash',st.trashDays,'number','min="1" max="365"')}</div><button class="pri" onclick="saveV5Settings()">Salvar preferências</button>`)}
  function saveV5Settings(){for(const k of ['notifyNew','notifyThreeDays','notifyOneDay','notifyDue','weeklySummary'])S.v5.settings[k]=$('#set_'+k).checked;S.v5.settings.trashDays=parseInt($('#set_trash').value)||30;S.v5.settings._u=now();audit('Preferências atualizadas','Notificações e lixeira','settings');save();render();toast('Preferências salvas.')}window.saveV5Settings=saveV5Settings;

  function v5Delete(bucket,id){const x=S.v5[bucket].find(v=>String(v.id)===String(id));if(x)v5Add('trash',{type:'v5:'+bucket,original:structuredClone(x),deletedAt:isoNow(),deletedBy:currentUserLabel()});v5Tomb(bucket,id);S.v5[bucket]=S.v5[bucket].filter(v=>String(v.id)!==String(id));audit('Item excluído',x?.name||x?.desc||bucket,'trash',id);save();closeM();render()}window.v5Delete=v5Delete;

  function moreMenu(){const rows=[
    ['dashboard','📈','Visão gerencial','Fluxo de caixa e projeções'],['cards','💳','Cartões e faturas','Limites, compras e parcelas'],['budgets','🎯','Orçamentos','Limites por categoria e projeto'],['suppliers','🏪','Fornecedores','Pix, contatos e gastos'],['goals','🏁','Metas','Reservas e objetivos'],['shopping','🛒','Lista de compras','Planejar antes de gastar'],['quotes','🧾','Cotações','Cotação → aprovado → comprado → pago'],['search','🔎','Busca universal','Encontre qualquer informação'],['activity','🕘','Atividades','Histórico de alterações'],['trash','🗑️','Lixeira','Restaurar exclusões'],['closemonth','🔒','Fechamento mensal','Preservar cada mês'],['assistant','✨','Assistente financeiro','Pergunte sobre seus dados'],['settings','⚙️','Preferências','Notificações e retenção']
  ];return `<div class="card"><h2>Gestão avançada</h2>${rows.map(([k,i,t,s])=>`<div class="tr" onclick="v5Go('${k}')"><div class="ic">${i}</div><div class="t"><b>${t}</b><span class="mu">${s}</span></div><span class="mu">›</span></div>`).join('')}</div>`}

  const oldRender=render;
  render=function(){
    v5Shape();
    if(tab==='dashboard'){$('#app').innerHTML=renderDashboard();$('#nav').innerHTML='';return}
    if(tab==='cards'){$('#app').innerHTML=renderCards();$('#nav').innerHTML='';return}
    if(tab==='budgets'){$('#app').innerHTML=renderBudgets();$('#nav').innerHTML='';return}
    if(tab==='suppliers'){$('#app').innerHTML=renderSuppliers();$('#nav').innerHTML='';return}
    if(tab==='goals'){$('#app').innerHTML=renderGoals();$('#nav').innerHTML='';return}
    if(tab==='shopping'){$('#app').innerHTML=renderShopping();$('#nav').innerHTML='';return}
    if(tab==='quotes'){$('#app').innerHTML=renderQuotes();$('#nav').innerHTML='';return}
    if(tab==='activity'){$('#app').innerHTML=renderActivity();$('#nav').innerHTML='';return}
    if(tab==='trash'){$('#app').innerHTML=renderTrash();$('#nav').innerHTML='';return}
    if(tab==='closemonth'){$('#app').innerHTML=renderCloseMonth();$('#nav').innerHTML='';return}
    if(tab==='search'){$('#app').innerHTML=renderSearch();$('#nav').innerHTML='';return}
    if(tab==='assistant'){$('#app').innerHTML=renderAssistant();$('#nav').innerHTML='';return}
    if(tab==='settings'){$('#app').innerHTML=renderSettings();$('#nav').innerHTML='';return}
    if(tab==='relv5'){$('#app').innerHTML=advancedReport();$('#nav').innerHTML='';return}
    oldRender();
    const main=document.querySelector('main');if(!main)return;
    if(tab==='home')main.insertAdjacentHTML('afterbegin',homeDashboard());
    if(tab==='mais')main.insertAdjacentHTML('afterbegin',moreMenu());
    if(tab==='contas')main.insertAdjacentHTML('beforeend',`<div class="row" style="margin:12px 0"><button class="ghost" style="flex:1" onclick="openWalletTransfer()">⇄ Transferir entre qualquer carteira</button><button class="ghost" style="flex:1" onclick="openReconcile()">⚖️ Conciliar</button></div>${renderWalletStatement()}`);
    if(tab==='obra')main.insertAdjacentHTML('afterbegin',budgetSummaryCard());
    if(tab==='rel')main.insertAdjacentHTML('beforeend',`<button class="pri" onclick="v5Go('relv5')">Abrir relatório avançado</button>`);
    const hd=document.querySelector('.hd');if(hd)hd.insertAdjacentHTML('beforeend',`<div class="v5sync"><span class="offline-dot ${navigator.onLine?'':'off'}"></span>${navigator.onLine?(CLOUD_STATUS||'Online'):'Offline · alterações serão sincronizadas'}</div>`);
  };

  // Atalhos no botão + para módulos V5.
  const oldFab=fabAct;fabAct=function(){if(tab==='shopping')return openShopping();if(tab==='cards'&&S.v5.cards[0])return openCardPurchase(S.v5.cards[0].id);if(tab==='quotes')return openQuote();if(tab==='goals')return openGoal();oldFab()};

  // Notificação local adicional para saldo insuficiente em horizonte curto.
  const oldDaily=dailyReminders;dailyReminders=async function(){await oldDaily();try{const f=forecast(7),low=f.days.reduce((a,b)=>b.bal<a.bal?b:a,{bal:accTotal(),d:TD});if(low.bal<0&&notifOK()&&localStorage.getItem('v5_low_'+TD)!=='1'){await notify('Alerta de caixa',`O saldo projetado pode ficar negativo em ${fmtDate(low.d)}: ${brl(low.bal)}.`,'v5-low-'+TD,{url:'./?tab=home'});localStorage.setItem('v5_low_'+TD,'1')}}catch(e){}};

  // Expõe dados das preferências para o backend via app_state.
  const oldBackup=backupPayload;backupPayload=function(){const b=oldBackup();b.version=5;b.fin=S;return b};

  // limpa lixeira vencida silenciosamente
  try{const lim=Date.now()-n(S.v5.settings.trashDays||30)*864e5;S.v5.trash=S.v5.trash.filter(t=>new Date(t.deletedAt).getTime()>=lim)}catch(e){}
})();
