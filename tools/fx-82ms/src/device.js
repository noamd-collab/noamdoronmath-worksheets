(function(){
 'use strict';
 const storageKey='noam-fx82ms-settings-v1';let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch(_){}
 const calc=createMS82(createEngine(math),createAlgorithms(math),saved);
 const stage=document.querySelector('.ms-stage'),device=document.querySelector('.ms-device'),lcd=document.getElementById('ms-lcd'),readable=document.getElementById('ms-readable');
 function resize(){device.style.transform='scale('+stage.clientWidth/464+')';}
 if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(stage);window.addEventListener('resize',resize);resize();
 function render(){const d=calc.display();lcd.innerHTML=MS82Display.render(d,calc.state.settings.contrast,calc.state.on);lcd.dataset.expression=d.expression;lcd.dataset.result=d.result;readable.textContent=[d.expression,d.result].filter(Boolean).join(' = ');device.dataset.mode=calc.state.mode;
  for(const id of ['shift','alpha']){const b=device.querySelector(`[data-key="${id}"]`);b.classList.toggle('active',calc.state[id]);b.setAttribute('aria-pressed',String(calc.state[id]));}
  try{localStorage.setItem(storageKey,JSON.stringify(calc.save()));}catch(_){}
 }
 function press(key){calc.press(key);render();const b=device.querySelector(`[data-key="${CSS.escape(key)}"]`);if(b){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),110);}}
 device.addEventListener('click',event=>{const key=event.target.closest('[data-key]');if(key)press(key.dataset.key);});
 document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('summary,a,input,textarea,select'))return;
  const map={Enter:'equals','=':'equals',Escape:'ac',Backspace:'del',Delete:'del',ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','*':'mul','×':'mul','/':'div','÷':'div','+':'+','-':'-','(':'open',')':'close','.':'dot',',':'comma','^':'power'};
  const key=/^\d$/.test(event.key)?event.key:map[event.key];
  if(key){event.preventDefault();press(key);}else if(event.key==='%'||event.key==='!'){event.preventDefault();press('shift');press(event.key==='%'?'equals':'inverse');}
 });
 render();
})();
