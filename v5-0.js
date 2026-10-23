// Casa & Obra V5 — camada de gestão avançada
(function(){
  const V5_VERSION='5.0.0';
  const V5_LISTS=['projects','categoryBudgets','cards','cardCharges','suppliers','goals','shopping','quotes','audit','trash','closedMonths','documents'];
  const V5_IC={dashboard:'📈',cards:'💳',budgets:'🎯',suppliers:'🏪',goals:'🏁',shopping:'🛒',quotes:'🧾',activity:'🕘',trash:'🗑️',closemonth:'🔒',search:'🔎',assistant:'✨',settings:'⚙️'};
  const V5_LABEL={dashboard:'Visão gerencial',cards:'Cartões e faturas',budgets:'Orçamentos',suppliers:'Fornecedores',goals:'Metas',shopping:'Lista de compras',quotes:'Cotações',activity:'Atividades',trash:'Lixeira',closemonth:'Fechamento mensal',search:'Busca',assistant:'Assistente financeiro',settings:'Preferências'};
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const now=()=>Date.now();
  const isoNow=()=>new Date().toISOString();
  const n=v=>Number(v||0);
  const pct=(a,b)=>b?Math.min(999,Math.round(a/b*100)):0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const txAll=()=>events('2000-01-01','2999-12-31');
  const monthKey=d=>String(d||TD).slice(0,7);
  const fmtDate=d=>d?fdy(d):'—';
  const escA=s=>esc(String(s??''));
  const walletKeys=()=>[
    ...S.acc.map(a=>({key:'acc:'+a.id,label:'🏦 '+a.name,balance:n(a.val)})),
    ...S.vr.map(v=>({key:'vr:'+v.id,label:'🍽️ '+v.brand+(v.nick?' · '+v.nick:''),balance:n(v.val)})),
    {key:'cash',label:'💵 Dinheiro em mãos',balance:n(S.cash)}
  ];
  function v5Shape(state=S){
    state.v5=state.v5&&typeof state.v5==='object'?state.v5:{};
    for(const k of V5_LISTS) state.v5[k]=Array.isArray(state.v5[k])?state.v5[k]:[];
    state.v5.settings=state.v5.settings&&typeof state.v5.settings==='object'?state.v5.settings:{};
    const def={
      notifyNew:true,notifyDue:true,notifyThreeDays:true,notifyOneDay:true,weeklySummary:true,
      homeCards:['today','projection','budgets','obra','goals','sync'],trashDays:30,assistantScope:'all'
    };
    state.v5.settings={...def,...state.v5.settings};
    state.v5._deleted=state.v5._deleted||{};
    for(const k of V5_LISTS) state.v5._deleted[k]=state.v5._deleted[k]||{};
    state.v5.version=V5_VERSION;
    return state;
  }
  v5Shape();

  // Extende o shape e o merge em nuvem para entidades V5.
  const oldEnsure=ensureStateShape;
  ensureStateShape=function(x=S){return v5Shape(oldEnsure(x))};
  function v5Map(arr){const m={};for(const x of arr||[])if(x&&x.id)m[String(x.id)]=x;return m}
  function v5MergeList(name,a,b){
    const ax=v5Map(a?.v5?.[name]),bx=v5Map(b?.v5?.[name]),ids=new Set([...Object.keys(ax),...Object.keys(bx),...Object.keys(a?.v5?._deleted?.[name]||{}),...Object.keys(b?.v5?._deleted?.[name]||{})]),out=[];
    for(const id of ids){
      const x=ax[id],y=bx[id],del=Math.max(n(a?.v5?._deleted?.[name]?.[id]),n(b?.v5?._deleted?.[name]?.[id])),ux=n(x?._u),uy=n(y?._u),pick=ux>=uy?x:y;
      if(pick&&Math.max(ux,uy)>=del)out.push(pick);
    }
    return out.sort((x,y)=>n(y._u)-n(x._u));
  }
  const oldMerge=mergeState;
  mergeState=function(a0,b0){
    const a=v5Shape(structuredClone(a0||{})),b=v5Shape(structuredClone(b0||{})),o=v5Shape(oldMerge(a,b));
    for(const k of V5_LISTS)o.v5[k]=v5MergeList(k,a,b);
    o.v5._deleted={};
    for(const k of V5_LISTS)o.v5._deleted[k]={...(a.v5._deleted[k]||{}),...(b.v5._deleted[k]||{})};
    const sa=n(a.v5.settings?._u),sb=n(b.v5.settings?._u);o.v5.settings=sa>=sb?a.v5.settings:b.v5.settings;
    o.v5.version=V5_VERSION;return o;
  };

  function v5Stamp(x){x._u=now();return x}
