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
    if(file.size>2*1024*1024)throw new Error(file.name+' excede 2 MB');
    if(file.type.startsWith('image/'))return await compressImg(file);
    if(file.type==='application/pdf')return await fileToDataURL(file);
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

  function appendHomeSettings(){
    const main=document.querySelector('main');if(!main||document.getElementById('v51homeprefs'))return;
    const cards=S.v5.settings.homeCards||[];
    const opts=[['projection','Resumo e projeção'],['budgets','Orçamentos'],['goals','Metas'],['sync','Sincronização']];
    main.insertAdjacentHTML('beforeend',`<div class="card" id="v51homeprefs"><h2>Tela inicial</h2>${opts.map(([k,l])=>`<label class="v5toggle"><span>${l}</span><input type="checkbox" data-v51home="${k}" ${cards.includes(k)?'checked':''}></label>`).join('')}<button class="ghost v5full" onclick="saveV51HomePrefs()">Salvar tela inicial</button></div>`);
  }
  window.saveV51HomePrefs=function(){S.v5.settings.homeCards=[...document.querySelectorAll('[data-v51home]:checked')].map(x=>x.dataset.v51home);S.v5.settings._u=xnow();save();render();toast('Tela inicial atualizada.')};

  window.printV51Report=function(){document.body.classList.add('print-report');window.print();setTimeout(()=>document.body.classList.remove('print-report'),500)};
  function appendReportActions(){const main=document.querySelector('main');if(!main||document.getElementById('v51reportactions'))return;main.insertAdjacentHTML('beforeend','<div id="v51reportactions" class="row" style="margin:12px 0"><button class="ghost" style="flex:1" onclick="printV51Report()">🖨️ Imprimir / Salvar PDF</button><button class="ghost" style="flex:1" onclick="backup()">💾 Backup JSON</button></div>')}

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
    if(tab==='mais'&&!document.getElementById('v51menu'))main.insertAdjacentHTML('afterbegin',`<div class="card" id="v51menu"><h2>Organização</h2><div class="tr" onclick="v5Go('projects')"><div class="ic">🗂️</div><div class="t"><b>Projetos e centros</b><span class="mu">Obra, pessoal, veículo e outros</span></div><span class="mu">›</span></div><div class="tr" onclick="v5Go('filters')"><div class="ic">⚙️</div><div class="t"><b>Filtros avançados</b><span class="mu">Tipo, status, projeto, categoria e período</span></div><span class="mu">›</span></div></div>`);
    if(tab==='settings')appendHomeSettings();
    if(tab==='relv5')appendReportActions();
    if(tab==='home'){
      const q=xqueue();const hd=document.querySelector('.hd');if(q&&hd)hd.insertAdjacentHTML('beforeend',`<div class="v5sync">📴 ${q} alteração(ões) salva(s) offline e aguardando sincronização</div>`);
      const cards=S.v5.settings.homeCards||[];if(!cards.includes('projection'))document.querySelector('.v5hero')?.remove();
    }
  };
})();
