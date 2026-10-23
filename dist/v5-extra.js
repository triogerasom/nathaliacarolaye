// Casa & Obra V5.1 — integrações finais
(function(){
  const xid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const xnow=()=>Date.now();
  const xesc=s=>esc(String(s??''));
  const xbrl=v=>brl(Number(v||0));
  const xproj=id=>S.v5?.projects?.find(p=>String(p.id)===String(id));
  const xdocs=txId=>(S.v5?.documents||[]).filter(d=>String(d.txId)===String(txId)).sort((a,b)=>Number(b._u||0)-Number(a._u||0));
  const xqueue=()=>Number(localStorage.getItem('co_offline_queue')||0);
  const xsetqueue=v=>localStorage.setItem('co_offline_queue',String(Math.max(0,Number(v)||0)));
  S.v5.notificationPrefs=Array.isArray(S.v5.notificationPrefs)?S.v5.notificationPrefs:[];
  const oldEnsurePrefs=ensureStateShape;
  ensureStateShape=function(x=S){const o=oldEnsurePrefs(x);o.v5.notificationPrefs=Array.isArray(o.v5.notificationPrefs)?o.v5.notificationPrefs:[];return o};
  const oldMergePrefs=mergeState;
  mergeState=function(a,b){
    const o=oldMergePrefs(a,b);o.v5.notificationPrefs=Array.isArray(o.v5.notificationPrefs)?o.v5.notificationPrefs:[];
    const m=new Map();
    for(const p of [...(a?.v5?.notificationPrefs||[]),...(b?.v5?.notificationPrefs||[])]){const k=String(p.email||p.id||'').toLowerCase();if(!k)continue;const cur=m.get(k);if(!cur||Number(p._u||0)>=Number(cur._u||0))m.set(k,p)}
    o.v5.notificationPrefs=[...m.values()];return o;
  };
  function myNotifyPref(){
    const email=String(CLOUD_USER?.email||'').toLowerCase(),def={notifyNew:true,notifyDue:true,notifyThreeDays:true,notifyOneDay:true,notifyOverdue:true,notifyBudget:true,notifyLowCash:true,weeklySummary:true};
    return {...def,...(S.v5.notificationPrefs.find(p=>String(p.email||'').toLowerCase()===email)||{}),email,id:email};
  }
  function appendUserNotifyPrefs(){
    const main=document.querySelector('main');if(!main||document.getElementById('v51notifprefs'))return;
    const p=myNotifyPref(),opts=[['notifyNew','Novos lançamentos e compromissos'],['notifyThreeDays','3 dias antes'],['notifyOneDay','1 dia antes'],['notifyDue','No vencimento / 90 min'],['notifyOverdue','Despesas atrasadas'],['notifyBudget','Orçamento ultrapassado'],['notifyLowCash','Risco de saldo negativo'],['weeklySummary','Resumo semanal']];
    main.insertAdjacentHTML('beforeend',`<div class="card" id="v51notifprefs"><h2>Meus avisos</h2><div class="mu" style="font-size:12px;margin-bottom:8px">Preferências deste usuário: ${xesc(p.email||'conta atual')}</div>${opts.map(([k,l])=>`<label class="v5toggle"><span>${l}</span><input type="checkbox" data-v51notify="${k}" ${p[k]!==false?'checked':''}></label>`).join('')}<button class="ghost v5full" onclick="saveMyNotifyPrefs()">Salvar meus avisos</button></div>`);
  }
  window.saveMyNotifyPrefs=function(){
    const email=String(CLOUD_USER?.email||'').toLowerCase();if(!email)return toast('Entre com sua conta para salvar.');
    const p={id:email,email,_u:xnow()};for(const el of document.querySelectorAll('[data-v51notify]'))p[el.dataset.v51notify]=el.checked;
    const i=S.v5.notificationPrefs.findIndex(x=>String(x.email||'').toLowerCase()===email);if(i>=0)S.v5.notificationPrefs[i]=p;else S.v5.notificationPrefs.push(p);
    save();render();toast('Preferências deste usuário salvas.');
  };

  function renderProjectsV51(){
    const list=(S.v5.projects||[]).map(p=>{
      const spent=(S.tx||[]).filter(x=>x.projectId===p.id&&x.type==='out').reduce((t,x)=>t+Number(x.val||0),0);
      const future=events(TD,'2999-12-31').filter(x=>x.projectId===p.id&&x.type==='out'&&!S.pd[pdk(x)]).reduce((t,x)=>t+Number(x.val||0),0);
      const avail=Number(p.budget||0)-spent-future;
      return `<div class="card"><div class="row sp"><div><b>${xesc(p.name)}</b><div class="mu">${xesc(p.type||'Projeto')}</div></div><button class="ghost" onclick="openProject('${p.id}')">Editar</button></div><div class="v5grid3"><div class="v5stat"><span>Orçamento</span><b>${xbrl(p.budget)}</b></div><div class="v5stat"><span>Gasto</span><b class="out">${xbrl(spent)}</b></div><div class="v5stat"><span>Disponível</span><b class="${avail<0?'out':'in'}">${xbrl(avail)}</b></div></div></div>`;
    }).join('');
    return `<div class="hd sl"><b class="ttl">Projetos e centros</b><small>Separe obra, pessoal, veículo e outros objetivos</small></div><main><button class="pri" style="margin:0 0 12px" onclick="openProject()">+ Novo projeto/centro</button>${list||'<div class="emp mu">Nenhum projeto cadastrado.</div>'}</main>`;
  }
  window.renderProjectsV51=renderProjectsV51;

  const oldOpenM51=openM;
  openM=function(ed){
    oldOpenM51(ed);
    try{
      const box=document.querySelector('#md .box'); if(!box)return;
      const btn=box.querySelector('button.pri'); if(!btn)return;
      const projects=(S.v5?.projects||[]);
      const projectHtml=`<label>Projeto / centro</label><select id="v51_project"><option value="">Sem projeto</option>${projects.map(p=>`<option value="${p.id}" ${ed?.projectId===p.id?'selected':''}>${xesc(p.name)}</option>`).join('')}</select>`;
      const docs=xdocs(ed?.id);
      const docsHtml=`<label>Documentos adicionais</label><input id="v51_docs" type="file" multiple accept="image/*,application/pdf" onchange="pickV51Docs(this)"><div id="v51_doclist">${docs.map(d=>`<div class="row sp" style="padding:6px 0"><span class="mu">📎 ${xesc(d.name||'Documento')}</span><span><button type="button" class="ghost" onclick="viewV51Doc('${d.id}')">Abrir</button><button type="button" class="x" onclick="deleteV51Doc('${d.id}')">×</button></span></div>`).join('')}</div><div class="mu" style="font-size:11px">Você pode anexar várias fotos, PDFs, notas, boletos e comprovantes.</div>`;
      btn.insertAdjacentHTML('beforebegin',projectHtml+docsHtml);
      md.v51files=[];
    }catch(e){console.warn('V5.1 openM',e)}
  };

  async function fileToDataUrlV51(file){
    if(file.type==='application/pdf'){
      if(file.size>2*1024*1024)throw new Error(file.name+' excede 2 MB');
      return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Falha ao ler '+file.name));r.readAsDataURL(file)});
    }
    if(file.type.startsWith('image/')){
      if(file.size>8*1024*1024)throw new Error(file.name+' excede 8 MB');
      return await new Promise((resolve,reject)=>{
        const u=URL.createObjectURL(file),im=new Image();
        im.onload=()=>{try{const k=Math.min(1,1200/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.width*k));cv.height=Math.max(1,Math.round(im.height*k));cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);const data=cv.toDataURL('image/jpeg',.72);URL.revokeObjectURL(u);if(dataUrlToBlob(data).size>2*1024*1024)reject(new Error(file.name+' ficou maior que 2 MB após compressão'));else resolve(data)}catch(e){URL.revokeObjectURL(u);reject(e)}};
        im.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Falha ao ler '+file.name))};im.src=u;
      });
    }
    throw new Error('Tipo não suportado: '+file.name);
  }
  window.pickV51Docs=async function(input){
    const files=[...(input.files||[])]; md.v51files=[];
    const list=document.getElementById('v51_doclist');
    for(const file of files){
      try{const data=await fileToDataUrlV51(file);md.v51files.push({name:file.name,type:file.type||'application/octet-stream',data});if(list)list.insertAdjacentHTML('beforeend',`<div class="mu">✓ ${xesc(file.name)}</div>`)}
      catch(e){toast(e.message||'Falha ao preparar documento')}
    }
  };
  async function uploadV51Doc(txId,file){
    const id=xid(),path=`shared/docs/${txId}/${id}`;
    if(SB&&CLOUD_USER){
      const blob=dataUrlToBlob(file.data);
      const {error}=await SB.storage.from('receipts').upload(path,blob,{upsert:true,contentType:blob.type});
      if(error)throw error;
    }else localStorage.setItem('fdoc_'+id,file.data);
    const doc={id,txId,name:file.name,type:file.type,path,createdAt:new Date().toISOString(),by:String(CLOUD_USER?.email||''),_u:xnow()};
    S.v5.documents.push(doc); return doc;
  }
  window.viewV51Doc=async function(id){
    const d=(S.v5.documents||[]).find(x=>x.id===id); if(!d)return;
    let url=localStorage.getItem('fdoc_'+id)||'';
    if(!url&&SB&&CLOUD_USER){const {data,error}=await SB.storage.from('receipts').createSignedUrl(d.path,90);if(error)return toast('Não foi possível abrir o documento.');url=data.signedUrl}
    if(url)window.open(url,'_blank','noopener');
  };
  window.deleteV51Doc=async function(id){
    const d=(S.v5.documents||[]).find(x=>x.id===id); if(!d)return;
    if(SB&&CLOUD_USER)try{await SB.storage.from('receipts').remove([d.path])}catch(e){}
    localStorage.removeItem('fdoc_'+id); S.v5._deleted.documents[id]=xnow(); S.v5.documents=S.v5.documents.filter(x=>x.id!==id); save(); render(); toast('Documento removido.');
  };

  const oldAdd51=add;
  add=async function(){
    const beforeTx=new Set(S.tx.map(x=>String(x.id))),beforeRec=new Set(S.rec.map(x=>String(x.id))),editId=md.ed?.id||null;
    const projectId=document.getElementById('v51_project')?.value||'';
    const files=[...(md.v51files||[])];
    oldAdd51();
    let saved=null;
    if(editId)saved=S.tx.find(x=>String(x.id)===String(editId))||S.rec.find(x=>String(x.id)===String(editId));
    if(!saved)saved=S.tx.find(x=>!beforeTx.has(String(x.id)))||S.rec.find(x=>!beforeRec.has(String(x.id)));
    if(saved){saved.projectId=projectId;stamp(saved);save();}
    if(saved&&files.length&&S.tx.includes(saved)){
      for(const f of files)try{await uploadV51Doc(saved.id,f)}catch(e){console.warn(e);toast('Um documento não foi enviado.')}
      save();render();toast(files.length+' documento(s) salvo(s).');
    }
  };

  const oldRestoreTrashV51=window.restoreTrash;
  window.restoreTrash=function(id){
    const t=(S.v5?.trash||[]).find(x=>String(x.id)===String(id));
    if(t?.type?.startsWith('v5:')){
      const bucket=t.type.slice(3),obj=structuredClone(t.original||{});
      if(Array.isArray(S.v5?.[bucket])){
        obj._u=xnow();S.v5[bucket].push(obj);delete S.v5._deleted?.[bucket]?.[String(obj.id)];
        S.v5._deleted.trash[String(id)]=xnow();S.v5.trash=S.v5.trash.filter(x=>String(x.id)!==String(id));
        if(typeof audit==='function')audit('Item V5 restaurado',obj.name||obj.desc||bucket,'trash',obj.id||'');
        save();render();toast('Item restaurado.');return;
      }
    }
    return oldRestoreTrashV51?.(id);
  };

  window.v51Filter=window.v51Filter||{q:'',type:'all',scope:'all',status:'all',project:'',cat:'',start:'',end:''};
  function renderFiltersV51(){
    const f=window.v51Filter,projects=S.v5.projects||[];
    const rows=(S.tx||[]).filter(x=>{
      const paid=!!S.pd[pdk(x)];
      if(f.q&&!(`${x.desc} ${x.cat} ${x.sup||''}`.toLowerCase().includes(f.q.toLowerCase())))return false;
      if(f.type!=='all'&&x.type!==f.type)return false;
      if(f.scope!=='all'&&x.scope!==f.scope)return false;
      if(f.status==='paid'&&!paid)return false;if(f.status==='pending'&&paid)return false;
      if(f.project&&x.projectId!==f.project)return false;if(f.cat&&x.cat!==f.cat)return false;
      if(f.start&&x.date<f.start)return false;if(f.end&&x.date>f.end)return false;
      return true;
    }).sort((a,b)=>b.date.localeCompare(a.date));
    const total=rows.reduce((t,x)=>t+(x.type==='in'?Number(x.val):-Number(x.val)),0);
    const control=(id,label,html)=>`<label>${label}</label>${html.replace('<select','<select onchange="setV51Filter(\''+id+'\',this.value)"').replace('<input','<input oninput="setV51Filter(\''+id+'\',this.value)"')}`;
    return `<div class="hd sl"><b class="ttl">Filtros avançados</b><small>${rows.length} lançamento(s) · saldo ${xbrl(total)}</small></div><main><div class="card">${control('q','Buscar',`<input class="v5search" value="${xesc(f.q)}" placeholder="Descrição, categoria ou fornecedor">`)}${control('type','Tipo',`<select><option value="all">Todos</option><option value="out" ${f.type==='out'?'selected':''}>Despesas</option><option value="in" ${f.type==='in'?'selected':''}>Receitas</option></select>`)}${control('scope','Escopo',`<select><option value="all">Todos</option><option value="casa" ${f.scope==='casa'?'selected':''}>Casa</option><option value="obra" ${f.scope==='obra'?'selected':''}>Obra</option></select>`)}${control('status','Status',`<select><option value="all">Todos</option><option value="pending" ${f.status==='pending'?'selected':''}>Pendentes</option><option value="paid" ${f.status==='paid'?'selected':''}>Pagos/recebidos</option></select>`)}${control('project','Projeto',`<select><option value="">Todos</option>${projects.map(p=>`<option value="${p.id}" ${f.project===p.id?'selected':''}>${xesc(p.name)}</option>`).join('')}</select>`)}${control('cat','Categoria',`<select><option value="">Todas</option>${ALL.map(c=>`<option ${f.cat===c?'selected':''}>${xesc(c)}</option>`).join('')}</select>`)}${control('start','Data inicial',`<input type="date" value="${xesc(f.start)}">`)}${control('end','Data final',`<input type="date" value="${xesc(f.end)}">`)}</div>${rows.map(x=>`<div class="card"><div class="row sp"><div><b>${xesc(x.desc)}</b><div class="mu">${fdy(x.date)} · ${xesc(x.cat)}${xproj(x.projectId)?' · '+xesc(xproj(x.projectId).name):''}</div></div><b class="${x.type==='out'?'out':'in'}">${x.type==='out'?'−':'+'}${xbrl(x.val)}</b></div></div>`).join('')||'<div class="emp mu">Nenhum lançamento com esses filtros.</div>'}</main>`;
  }
  window.setV51Filter=function(k,v){window.v51Filter[k]=v;render()};
  window.openInstallmentV51=function(){
    const projects=S.v5.projects||[];
    M(`<h2>Parcelar lançamento</h2>
      <label>Tipo</label><select id="v51p_type"><option value="out">Despesa</option><option value="in">Receita</option></select>
      <label>Escopo</label><select id="v51p_scope"><option value="casa">Casa</option><option value="obra">Obra</option></select>
      ${mInput('Descrição','v51p_desc','')}
      ${mInput('Valor total (R$)','v51p_total','','text','inputmode="decimal"')}
      ${mInput('Número de parcelas','v51p_parts',2,'number','min="2" max="60"')}
      ${mInput('Primeiro vencimento','v51p_date',TD,'date')}
      <label>Categoria</label><select id="v51p_cat">${ALL.map(c=>`<option>${xesc(c)}</option>`).join('')}</select>
      <label>Projeto / centro</label><select id="v51p_project"><option value="">Sem projeto</option>${projects.map(p=>`<option value="${p.id}">${xesc(p.name)}</option>`).join('')}</select>
      <label>Conta / VR / dinheiro onde será debitado ou recebido</label>${walletSelect('v51p_wallet')}
      <label>Fornecedor</label><select id="v51p_supplier"><option value="">Não informado</option>${S.v5.suppliers.map(s=>`<option value="${s.name}">${xesc(s.name)}</option>`).join('')}</select>
      <div id="er" class="out"></div><button class="pri" onclick="saveInstallmentV51()">Criar parcelas</button>${btns()}`);
  };
  window.saveInstallmentV51=function(){
    const type=$('#v51p_type').value,scope=$('#v51p_scope').value,desc=$('#v51p_desc').value.trim(),total=pv($('#v51p_total').value),parts=parseInt($('#v51p_parts').value)||0,date=$('#v51p_date').value,cat=$('#v51p_cat').value,projectId=$('#v51p_project').value,walletKey=$('#v51p_wallet').value,sup=$('#v51p_supplier').value;
    if(!desc||!(total>0)||parts<2||parts>60||!date||!walletKey)return $('#er').textContent='Confira descrição, total, parcelas, data e carteira.';
    const group=xid(),base=Math.floor(total*100/parts)/100,last=Math.round((total-base*(parts-1))*100)/100;
    for(let i=0;i<parts;i++){
      const d=new Date(date+'T12:00:00');d.setMonth(d.getMonth()+i);
      S.tx.push(stamp({id:xid(),scope,type,desc:`${desc} · parcela ${i+1}/${parts}`,val:i===parts-1?last:base,cat,sup,date:ymd(d),walletKey,pay:'',pixKey:'',projectId,installmentGroup:group,installment:i+1,installments:parts,_u:xnow()}));
    }
    if(typeof audit==='function')audit('Lançamento parcelado criado',`${desc} · ${parts}x · ${xbrl(total)}`,'installment',group);
    save();closeM();render();toast(`${parts} parcelas criadas.`);
  };

  function appendHomeSettings(){
    const main=document.querySelector('main');if(!main||document.getElementById('v51homeprefs'))return;
    const cards=S.v5.settings.homeCards||[];
    const opts=[['projection','Resumo e projeção'],['budgets','Orçamentos'],['goals','Metas'],['sync','Sincronização']];
    main.insertAdjacentHTML('beforeend',`<div class="card" id="v51homeprefs"><h2>Tela inicial</h2>${opts.map(([k,l])=>`<label class="v5toggle"><span>${l}</span><input type="checkbox" data-v51home="${k}" ${cards.includes(k)?'checked':''}></label>`).join('')}<button class="ghost v5full" onclick="saveV51HomePrefs()">Salvar tela inicial</button></div>`);
  }
  window.saveV51HomePrefs=function(){S.v5.settings.homeCards=[...document.querySelectorAll('[data-v51home]:checked')].map(x=>x.dataset.v51home);S.v5.settings._u=xnow();save();render();toast('Tela inicial atualizada.')};

  window.printV51Report=function(){document.body.classList.add('print-report');window.print();setTimeout(()=>document.body.classList.remove('print-report'),500)};
  window.openBackupImportV51=function(){M(`<h2>Restaurar backup JSON</h2><div class="mu">O arquivo substituirá o estado financeiro atual depois da validação. Faça um backup antes se quiser preservar a versão atual.</div><input id="v51backupfile" type="file" accept="application/json,.json" style="margin-top:12px"><div id="er" class="out"></div><button class="pri" onclick="importBackupV51()">Validar e restaurar</button>${btns()}`)};
  window.importBackupV51=async function(){
    const file=document.getElementById('v51backupfile')?.files?.[0];if(!file)return document.getElementById('er').textContent='Escolha um arquivo JSON.';
    try{
      const raw=JSON.parse(await file.text()),candidate=raw?.fin||raw?.state||raw;
      if(!candidate||!Array.isArray(candidate.tx)||!Array.isArray(candidate.acc))throw new Error('Formato de backup não reconhecido.');
      const restored=ensureStateShape(structuredClone(candidate));
      if(!confirm('Restaurar este backup e substituir os dados atuais?'))return;
      S=restored;v5Shape?.(S);audit?.('Backup restaurado',file.name,'backup');save();closeM();render();toast('Backup restaurado e colocado na fila de sincronização.');
      try{if(typeof cloudSyncNow==='function')await cloudSyncNow()}catch(e){}
    }catch(e){document.getElementById('er').textContent=e?.message||'Não foi possível restaurar o backup.'}
  };
  function appendReportActions(){const main=document.querySelector('main');if(!main||document.getElementById('v51reportactions'))return;main.insertAdjacentHTML('beforeend','<div id="v51reportactions" class="row" style="margin:12px 0"><button class="ghost" style="flex:1" onclick="printV51Report()">🖨️ Imprimir / Salvar PDF</button><button class="ghost" style="flex:1" onclick="backup()">💾 Backup JSON</button><button class="ghost" style="flex:1" onclick="openBackupImportV51()">↩ Restaurar JSON</button></div>')}

  const oldSaveExtra=save;
  save=function(){if(!navigator.onLine)xsetqueue(xqueue()+1);oldSaveExtra()};
  if(typeof cloudPushState==='function'){
    const oldPush=cloudPushState;
    cloudPushState=async function(){const r=await oldPush.apply(this,arguments);if(navigator.onLine&&CLOUD_STATUS==='Sincronizado')xsetqueue(0);return r};
  }
  window.addEventListener('online',()=>{setTimeout(()=>{try{if(typeof cloudSyncNow==='function')cloudSyncNow()}catch(e){}},150)});

  const oldRenderExtra=render;
  render=function(){
    if(tab==='projects'){$('#app').innerHTML=renderProjectsV51();$('#nav').innerHTML='';return}
    if(tab==='filters'){$('#app').innerHTML=renderFiltersV51();$('#nav').innerHTML='';return}
    oldRenderExtra();
    const main=document.querySelector('main');if(!main)return;
    if(tab==='mais'&&!document.getElementById('v51menu'))main.insertAdjacentHTML('afterbegin',`<div class="card" id="v51menu"><h2>Organização</h2><div class="tr" onclick="v5Go('projects')"><div class="ic">🗂️</div><div class="t"><b>Projetos e centros</b><span class="mu">Obra, pessoal, veículo e outros</span></div><span class="mu">›</span></div><div class="tr" onclick="v5Go('filters')"><div class="ic">⚙️</div><div class="t"><b>Filtros avançados</b><span class="mu">Tipo, status, projeto, categoria e período</span></div><span class="mu">›</span></div><div class="tr" onclick="openInstallmentV51()"><div class="ic">🧮</div><div class="t"><b>Parcelar lançamento</b><span class="mu">Cria parcelas mensais automaticamente</span></div><span class="mu">›</span></div></div>`);
    if(tab==='settings'){appendHomeSettings();appendUserNotifyPrefs();}
    if(tab==='relv5')appendReportActions();
    if(tab==='home'){
      const q=xqueue();const hd=document.querySelector('.hd');if(q&&hd)hd.insertAdjacentHTML('beforeend',`<div class="v5sync">📴 ${q} alteração(ões) salva(s) offline e aguardando sincronização</div>`);
      const cards=S.v5.settings.homeCards||[];if(!cards.includes('projection'))document.querySelector('.v5hero')?.remove();
    }
  };
})();
