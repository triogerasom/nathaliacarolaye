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
