// Casa & Obra - universal back navigation for iPhone/PWA
(function(){
  const ROOT=new Set(['home','agenda','casa','obra','mais']);
  const PARENT={
    dashboard:'home',patrimonio:'mais',
    cards:'mais',budgets:'mais',suppliers:'mais',goals:'mais',shopping:'mais',
    quotes:'mais',search:'mais',activity:'mais',trash:'mais',closemonth:'mais',
    assistant:'mais',settings:'mais',projects:'mais',filters:'mais',
    relv5:'rel',prev:'mais',contas:'mais',vr:'mais',rel:'mais'
  };

  function modalOpen(){return !!document.querySelector('#md.show')}
  function fallbackPage(){
    const cur=String(window.tab||'home');
    const target=PARENT[cur]||'home';
    try{
      if(typeof window.appBackV6==='function'){window.appBackV6();return}
      if(typeof window.v5Go==='function'){window.v5Go(target);return}
      if(typeof window.go==='function'){window.go(target);return}
      window.tab=target;if(typeof window.render==='function')window.render();
    }catch(e){
      window.tab='home';try{window.render&&window.render()}catch(_){}
    }
  }

  window.coUniversalBack=function(){
    if(modalOpen()){
      if(typeof window.coModalBack==='function'){window.coModalBack();return}
      try{window.closeM&&window.closeM()}catch(e){}
      return;
    }
    fallbackPage();
  };

  function injectModalBack(){
    const md=document.getElementById('md'),sh=document.getElementById('sh');
    if(!md||!sh||!md.classList.contains('show'))return;
    if(!sh.querySelector('.co-modal-back')){
      sh.insertAdjacentHTML('afterbegin','<button class="co-modal-back" type="button" onclick="coUniversalBack()" aria-label="Voltar">&#8249; <span>Voltar</span></button>');
    }
  }

  function injectPageBack(){
    const cur=String(window.tab||'home'),app=document.getElementById('app');
    if(!app)return;
    let b=document.getElementById('coUniversalPageBack');
    const needs=!ROOT.has(cur);
    if(!needs){if(b)b.remove();return}
    if(!b){
      b=document.createElement('button');
      b.id='coUniversalPageBack';
      b.className='co-page-back';
      b.type='button';
      b.setAttribute('aria-label','Voltar');
      b.innerHTML='&#8249; <span>Voltar</span>';
      b.onclick=window.coUniversalBack;
      document.body.appendChild(b);
    }
  }

  function ensure(){injectModalBack();injectPageBack()}
  const mo=new MutationObserver(()=>requestAnimationFrame(ensure));
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('pageshow',ensure);
  window.addEventListener('hashchange',ensure);
  setInterval(ensure,1200);
  ensure();
})();