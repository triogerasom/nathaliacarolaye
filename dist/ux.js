// Casa & Obra V6.2 — interface simplificada
(function(){
  const oldRenderUx=render;
  const money=v=>brl(Number(v||0));
  const escU=s=>esc(String(s??''));
  const dailyAcc=()=>S.acc.filter(a=>String(a.type||'')!=='Investimento');
  const investAcc=()=>S.acc.filter(a=>String(a.type||'')==='Investimento');
  const dailyAvailable=()=>dailyAcc().filter(a=>a.inc!==false).reduce((t,a)=>t+Number(a.val||0),0)+Number(S.cash||0);
  const investTotal=()=>investAcc().reduce((t,a)=>t+Number(a.val||0),0);
  const patrimonyTotal=()=>dailyAcc().reduce((t,a)=>t+Number(a.val||0),0)+Number(S.cash||0)+investTotal();

  function pending(a,b,type='out'){
    return events(a,b).filter(x=>x.type===type&&!S.pd?.[pdk(x)]);
  }
  function dailyProjection(days=30){
    let bal=dailyAvailable();
    for(const e of events(addD(TD,1),addD(TD,days)).sort((a,b)=>a.date.localeCompare(b.date))){
      if(S.pd?.[pdk(e)])continue;
      bal+=e.type==='in'?Number(e.val||0):-Number(e.val||0);
    }
    return bal;
  }
  function miniRow(icon,title,sub,value,cls='',onclick=''){
    return `<div class="ux-row"${onclick?` onclick="${onclick}"`:''}><div class="ux-ico">${icon}</div><div class="ux-rowtxt"><b>${escU(title)}</b>${sub?`<span>${sub}</span>`:''}</div>${value?`<b class="ux-value ${cls}">${value}</b>`:''}</div>`;
  }
  function header(title,sub=''){
    return `<div class="hd sl ux-hd"><b class="ttl">${escU(title)}</b>${sub?`<small>${escU(sub)}</small>`:''}</div>`;
  }
  function nextCard(){
    const due=pending(TD,addD(TD,7),'out').sort((a,b)=>a.date.localeCompare(b.date));
    const ev=(S.ev||[]).filter(e=>e.d>=TD&&e.d<=addD(TD,7)).sort((a,b)=>(a.d+(a.h||'')).localeCompare(b.d+(b.h||'')));
    const items=[
      ...due.slice(0,2).map(x=>({kind:'due',date:x.date,title:x.desc,value:money(x.val),id:pdk(x)})),
      ...ev.slice(0,2).map(x=>({kind:'event',date:x.d,title:x.t,value:x.h||'',id:x.id}))
    ].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
    if(!items.length)return `<div class="card ux-card"><div class="ux-titleline"><b>Próximos dias</b><button class="ux-link" onclick="go('agenda')">Agenda</button></div><div class="ux-empty">Nada pendente nos próximos 7 dias.</div></div>`;
    return `<div class="card ux-card"><div class="ux-titleline"><b>Próximos dias</b><button class="ux-link" onclick="go('agenda')">Ver tudo</button></div>${items.map(i=>miniRow(i.kind==='due'?'💸':'📅',i.title,(i.date===TD?'Hoje':fdy(i.date)),i.value,i.kind==='due'?'out':'',i.kind==='due'?`openTx('${i.id}')`:`openEvD('${i.id}')`)).join('')}</div>`;
  }
  function obraCard(){
    const spent=(S.tx||[]).filter(x=>x.scope==='obra'&&x.type==='out'&&x.date<=TD).reduce((t,x)=>t+Number(x.val||0),0);
    const pctv=S.budget?Math.min(100,spent/S.budget*100):0;
    return `<div class="card ux-card ux-click" onclick="go('obra')"><div class="ux-titleline"><b>Obra</b><span class="ux-muted">${S.budget?Math.round(pctv)+'%':'sem orçamento'}</span></div><div class="ux-obrarow"><div><span>Gasto</span><b>${money(spent)}</b></div><div><span>Saldo da obra</span><b>${money(Number(S.obraIni||0)-spent)}</b></div></div>${S.budget?`<div class="bar"><i style="width:${pctv}%;background:var(--o)"></i></div>`:''}</div>`;
  }
  function homeHtml(){
    const due7=pending(TD,addD(TD,7),'out'),proj=dailyProjection(30);
    return `${header('Casa & Obra','Visão simples do que importa agora')}<main class="ux-main">
      <div class="card ux-balance">
        <span>Disponível</span><b>${money(dailyAvailable())}</b>
        <div class="ux-metrics">
          <div><span>A pagar · 7 dias</span><b class="out">${money(due7.reduce((t,x)=>t+Number(x.val||0),0))}</b></div>
          <div><span>Projetado · 30 dias</span><b class="${proj<0?'out':'in'}">${money(proj)}</b></div>
        </div>
      </div>
      <div class="ux-actions">
        <button onclick="openM()">＋ Lançar</button>
        <button onclick="go('contas')">🏦 Contas</button>
        <button onclick="v5Go('cards')">💳 Cartões</button>
      </div>
      ${nextCard()}
      ${obraCard()}
    </main>`;
  }

  const tile=(tabName,icon,label)=>`<button class="ux-tile" onclick="uxGo('${tabName}')"><span>${icon}</span><b>${label}</b></button>`;
  function moreHtml(){
    return `${header('Mais','Tudo organizado por área')}<main class="ux-main">
      <section class="ux-section"><h2>Financeiro</h2><div class="ux-grid">
        ${tile('contas','🏦','Contas')}${tile('cards','💳','Cartões')}${tile('patrimonio','◉','Patrimônio')}${tile('rel','📊','Relatórios')}
      </div></section>
      <section class="ux-section"><h2>Planejamento</h2><div class="ux-grid">
        ${tile('dashboard','↗','Fluxo')}${tile('budgets','🎯','Orçamentos')}${tile('goals','🏁','Metas')}${tile('shopping','🛒','Compras')}
      </div></section>
      <section class="ux-section"><h2>Organização</h2><div class="ux-grid">
        ${tile('projects','🗂️','Projetos')}${tile('suppliers','🏪','Fornecedores')}${tile('quotes','🧾','Cotações')}${tile('search','🔎','Buscar')}
      </div></section>
      <details class="ux-tools"><summary>Ferramentas e sistema</summary>
        <div class="ux-grid ux-tools-grid">
          ${tile('vr','🍽️','Vale-refeição')}${tile('filters','⚙️','Filtros')}${tile('activity','🕘','Atividades')}${tile('closemonth','🔒','Fechamento')}
          ${tile('trash','🗑️','Lixeira')}${tile('assistant','✨','Assistente')}${tile('settings','⚙️','Preferências')}
        </div>
        <div class="ux-backup"><button onclick="backup()">💾 Fazer backup</button>${typeof openBackupImportV51==='function'?'<button onclick="openBackupImportV51()">↩ Restaurar</button>':''}</div>
      </details>
    </main>`;
  }

  function accountsHtml(){
    const normal=dailyAcc();
    return `${header('Contas','Dinheiro disponível no dia a dia')}<main class="ux-main">
      <div class="card ux-balance ux-balance-small"><span>Disponível</span><b>${money(dailyAvailable())}</b></div>
      <div class="ux-actions ux-actions-2"><button onclick="openAcc()">＋ Nova conta</button><button onclick="openWalletTransfer()">⇄ Transferir</button></div>
      <div class="card ux-card"><div class="ux-titleline"><b>Dia a dia</b><button class="ux-link" onclick="openReconcile()">Conciliar</button></div>
        ${normal.map(a=>miniRow(AI[a.type]||'🏦',a.name,a.type||'Conta',money(a.val),Number(a.val)<0?'out':'in',`openAcc('${a.id}')`)).join('')}
        ${miniRow('💵','Dinheiro em mãos','Carteira física',money(S.cash),Number(S.cash)<0?'out':'in','openCash()')}
        ${!normal.length&&!S.cash?'<div class="ux-empty">Cadastre sua primeira conta.</div>':''}
      </div>
      <details class="ux-tools ux-invest">
        <summary>Patrimônio e investimentos</summary>
        <div class="ux-invest-total"><span>Investido</span><b>${money(investTotal())}</b></div>
        <button class="ghost v5full" onclick="uxGo('patrimonio')">Ver patrimônio</button>
      </details>
      <details class="ux-tools"><summary>Histórico e extrato</summary>${typeof renderWalletStatement==='function'?renderWalletStatement():'<div class="ux-empty">Sem movimentações.</div>'}</details>
    </main>`;
  }

  function patrimonyHtml(){
    const inv=investAcc(),daily=dailyAcc();
    return `${header('Patrimônio','Investimentos ficam separados do dinheiro disponível')}<main class="ux-main">
      <div class="card ux-patrimony">
        <span>Patrimônio total</span><b>${money(patrimonyTotal())}</b>
        <div class="ux-metrics"><div><span>Dia a dia</span><b>${money(dailyAvailable())}</b></div><div><span>Investimentos</span><b>${money(investTotal())}</b></div></div>
      </div>
      <div class="card ux-card"><div class="ux-titleline"><b>Investimentos</b><button class="ux-link" onclick="openAcc()">＋</button></div>
        ${inv.map(a=>miniRow('📈',a.name,'Investimento',money(a.val),'',`openAcc('${a.id}')`)).join('')||'<div class="ux-empty">Nenhum investimento cadastrado.</div>'}
      </div>
      <details class="ux-tools"><summary>Outras contas</summary>
        ${daily.map(a=>miniRow(AI[a.type]||'🏦',a.name,a.type||'Conta',money(a.val),'',`openAcc('${a.id}')`)).join('')}
      </details>
    </main>`;
  }

  window.uxGo=function(t){tab=t;render();scrollTo(0,0)};

  render=function(){
    if(tab==='patrimonio'){
      oldRenderUx();
      const app=document.getElementById('app');if(app)app.innerHTML=patrimonyHtml();
      const nav=document.getElementById('nav');if(nav){[...nav.querySelectorAll('button')].forEach(b=>b.classList.remove('on'));nav.querySelector('button:last-child')?.classList.add('on')}
      return;
    }
    oldRenderUx();
    const app=document.getElementById('app');if(!app)return;
    if(tab==='home')app.innerHTML=homeHtml();
    else if(tab==='mais')app.innerHTML=moreHtml();
    else if(tab==='contas')app.innerHTML=accountsHtml();
  };
})();
