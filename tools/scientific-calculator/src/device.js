/* Physical-key controller for the independent ES PLUS-style web calculator.
 * No firmware is used. Arithmetic lives in core.js; mode flows in modes.js.
 * Reference: Casio fx-570ES PLUS / fx-991ES PLUS (2nd edition) User's Guide.
 */
(function (global) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MODE_NAMES = ['COMP','CMPLX','STAT','BASE-N','EQN','MATRIX','TABLE','VECTOR'];
  const ALPHA = {negative:'A',dms:'B',hyp:'C',sin:'D',cos:'E',tan:'F',rparen:'X',sd:'Y',mplus:'M',eng:'i',exp:'e',calc:'=',integral:':',dot:'RanInt(□,□)'};
  const DEFAULTS = {mode:'COMP',angle:'deg',format:'norm',digits:10,display:'math',mathOutput:true,complex:'rect',mixed:false,decimal:'dot',freq:false,base:10,overwrite:false,contrast:5};
  const valueExpression = value => typeof value === 'number' ? String(value) : value && value.isComplex ? '('+value.re+')+('+value.im+')*i' : Array.isArray(value) ? '['+value.map(valueExpression).join(',')+']' : String(value);

  function mathMarkup(math, engine, source, activeHole = -1, cursorPosition = -1) {
    const original=String(source||'');
    if(cursorPosition>=0&&activeHole<0){
      // Presentation-only symbol places the caret inside fractions and powers.
      // Avoid splitting function names while users navigate with arrows.
      while(cursorPosition<original.length&&cursorPosition>0&&/[A-Za-z]/.test(original[cursorPosition-1])&&/[A-Za-z]/.test(original[cursorPosition]))cursorPosition++;
      source=original.slice(0,cursorPosition)+' ZzCursor '+original.slice(cursorPosition);
    }
    let holeIndex = 0;
    let text = String(source || '').replace(/□/g, () => 'slot'+(holeIndex++));
    // The parser is used for presentation only. Input is evaluated by core.js.
    try {
      const mixed = text.match(/^([−-]?)(\d+) (\d+)\/(\d+)$/);
      if (mixed) return '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>'+(mixed[1]?'<mo>−</mo>':'')+'<mn>'+mixed[2]+'</mn><mfrac><mn>'+mixed[3]+'</mn><mn>'+mixed[4]+'</mn></mfrac></mrow></math>';
      if (/[+*/^,-]$/.test(text)) text += 'slot'+holeIndex;
      let normalized;
      try { normalized = engine.normalize(text); }
      catch (_) { normalized = text.replace(/π/g,'pi').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-'); }
      // normalize does not register presentation-only calculus function names.
      normalized = normalized.replace(/\b(integral|derivative|sum)\*\(/g,'$1(');
      const tree = math.parse(normalized);
      let count = 0;
      const row = a => '<mrow>'+a.join('')+'</mrow>';
      const op = t => '<mo>'+escape(t)+'</mo>';
      function render(n) {
        if (++count > 300) throw new Error('display bound');
        if (n.type === 'ConstantNode') return '<mn>'+escape(n.value)+'</mn>';
        if (n.type === 'SymbolNode') {
          if(n.name==='ZzCursor')return '<mo class="lcd-math-cursor">▏</mo>';
          const slot = n.name.match(/^slot(\d+)$/);
          if (slot) return '<mi data-hole="'+slot[1]+'"'+(+slot[1]===activeHole?' mathbackground="#344532" mathcolor="#e3eacb"':'')+'>□</mi>';
          return '<mi>'+escape(n.name==='pi'?'π':n.name)+'</mi>';
        }
        if (n.type === 'ParenthesisNode') return row([op('('),render(n.content),op(')')]);
        if (n.type === 'ArrayNode') return row([op('['),...n.items.map(render).flatMap((a,i)=>i?[op(','),a]:[a]),op(']')]);
        if (n.type === 'OperatorNode') {
          const a = n.args.map(render);
          if (n.fn === 'divide') return '<mfrac>'+n.args.map(v=>render(v.type==='ParenthesisNode'?v.content:v)).join('')+'</mfrac>';
          if (n.fn === 'pow') return '<msup>'+a[0]+render(n.args[1].type==='ParenthesisNode'?n.args[1].content:n.args[1])+'</msup>';
          if (n.fn === 'factorial') return row([a[0],op('!')]);
          if (a.length === 1) return row([op(n.op==='-'?'−':n.op),a[0]]);
          return row(a.flatMap((x,i)=>i?[op(n.implicit?'':n.op==='*'?'×':n.op==='-'?'−':n.op),x]:[x]));
        }
        if (n.type === 'FunctionNode') {
          const name = n.fn.name, a = n.args.map(render);
          if (name === 'sqrt') return '<msqrt>'+a[0]+'</msqrt>';
          if (name === 'cbrt' || name === 'nthRoot') return '<mroot>'+a[0]+(a[1]||'<mn>3</mn>')+'</mroot>';
          if (name === 'log' && a.length===2) return row(['<msub><mi>log</mi>'+a[0]+'</msub>',op('('),a[1],op(')')]);
          if (name === 'integral' && a.length>=3) return row(['<msubsup><mo>∫</mo>'+a[1]+a[2]+'</msubsup>',a[0],'<mi>dX</mi>']);
          if (name === 'derivative' && a.length>=2) return row(['<mfrac><mi>d</mi><mi>dX</mi></mfrac>',op('('),a[0],op(')'),'<msub><mo>|</mo><mrow><mi>X</mi><mo>=</mo>'+a[1]+'</mrow></msub>']);
          if (name === 'sum' && a.length>=3) return row(['<munderover><mo>∑</mo><mrow><mi>X</mi><mo>=</mo>'+a[1]+'</mrow>'+a[2]+'</munderover>',a[0]]);
          const inverse = {asin:'sin',acos:'cos',atan:'tan',asinh:'sinh',acosh:'cosh',atanh:'tanh'};
          const label = inverse[name] ? '<msup><mi>'+inverse[name]+'</mi><mn>−1</mn></msup>' : '<mi>'+escape(name)+'</mi>';
          return row([label,op('('),...a.flatMap((x,i)=>i?[op(','),x]:[x]),op(')')]);
        }
        throw new Error('presentation node');
      }
      return '<math xmlns="http://www.w3.org/1998/Math/MathML" dir="ltr"><mrow>'+render(tree)+'</mrow></math>';
    } catch (_) { return '<span class="lcd-linear">'+(cursorPosition>=0?escape(original.slice(0,cursorPosition))+'<span class="lcd-cursor">▏</span>'+escape(original.slice(cursorPosition)):escape(original))+'</span>'; }
  }

  function createCasioDevice(options) {
    const root = options.root, doc = root.ownerDocument, win = doc.defaultView || global;
    const $ = id => root.querySelector('#'+id);
    const math = options.math || global.math;
    const engine = options.engine || global.createEngine(math);
    const alg = options.alg || global.createAlgorithms(math);
    const input = $('lcd-input'), expression = $('lcd-expression'), result = $('lcd-result'), menuEl = $('lcd-menu'), status = $('lcd-status');
    if (!input || !expression || !result || !menuEl || !status) throw new Error('Calculator LCD elements are missing');
    const state = Object.assign({}, DEFAULTS, {scope:{A:0,B:0,C:0,D:0,E:0,F:0,X:0,Y:0,M:0,Ans:0},last:0,lastExpr:'',exact:null,style:'decimal',history:[],historyIndex:-1,shift:false,alpha:false,off:false,afterResult:false,engPower:0,stats:null});
    let menu = null, errorState = null, memoryAction = null, multi = null, autoOff = null, modes;
    const storage = options.storage === undefined ? (()=>{try{return win.localStorage;}catch(_){return null;}})() : options.storage;
    const storageKey = 'noam-casio-esplus-v1';
    function persist() {
      if (!storage) return;
      try {storage.setItem(storageKey,JSON.stringify({settings:Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,state[k]])),scope:state.scope}));}catch(_){}
    }
    try {
      const saved = storage && JSON.parse(storage.getItem(storageKey)||'null');
      if (saved && saved.settings && saved.scope) {
        for (const [k,v] of Object.entries(DEFAULTS)) if (typeof saved.settings[k]===typeof v) state[k]=saved.settings[k];
        if (!MODE_NAMES.includes(state.mode)) state.mode='COMP';
        if (!['deg','rad','gra'].includes(state.angle)) state.angle='deg';
        if (!['norm','norm2','fix','sci'].includes(state.format)) state.format='norm';
        state.digits=Math.max(0,Math.min(10,state.digits));
        for (const name of ['A','B','C','D','E','F','X','Y','M','Ans','MatA','MatB','MatC','MatAns','VctA','VctB','VctC','VctAns']) {
          const v=saved.scope[name];
          if (typeof v==='number' && Number.isFinite(v)) state.scope[name]=v;
          else if (v && typeof v.re==='number' && typeof v.im==='number' && Number.isFinite(v.re)&&Number.isFinite(v.im)) state.scope[name]=math.complex(v.re,v.im);
          else if (Array.isArray(v)&&v.length<=3&&v.every(a=>typeof a==='number'&&Number.isFinite(a)||Array.isArray(a)&&a.length<=3&&a.every(b=>typeof b==='number'&&Number.isFinite(b)))) state.scope[name]=v;
        }
      }
    } catch (_) {}
    const announce = text => {const el=$('calc-announcer') || doc.getElementById('calc-announcer'); if(el)el.textContent=String(text);};
    const opts = extra => ({angle:state.angle,mode:state.mode,scope:state.scope,complex:state.resultComplex||state.complex,format:state.format,digits:state.digits,...extra});
    function format(value) {
      if (typeof value==='string') return value;
      const text=engine.format(value,{angle:state.angle,complex:state.resultComplex||state.complex,format:state.format,digits:state.digits});
      return state.decimal==='comma'?text.replace(/(\d)\.(\d)/g,'$1,$2'):text;
    }
    function ev(text, scope) {return evaluateExpression(String(text),Object.assign({},state.scope,scope));}
    function finite(text,scope) {const v=ev(text,scope);if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Real number required');return v;}
    function evaluateExpression(source, scope) {
      if (source.length>1000 || source.includes('□')) throw Object.assign(new Error(source.includes('□')?'Fill each box before calculating.':'Expression is too long.'),{code:'Syntax ERROR'});
      let depth=0;
      for(const c of source){if(c==='(')depth++;if(c===')')depth--;if(depth<0)throw Object.assign(new Error('Check parentheses.'),{code:'Syntax ERROR'});}
      if(depth>40)throw Object.assign(new Error('Too many parentheses.'),{code:'Stack ERROR'});
      source+=')'.repeat(depth);
      let calculations=0;
      while (/\b(integral|derivative|sum)\s*\(/.test(source)) {
        if(++calculations>3)throw Object.assign(new Error('Too many numerical operations.'),{code:'Stack ERROR'});
        const match=/\b(integral|derivative|sum)\s*\(/.exec(source), start=match.index, argStart=start+match[0].length;
        let end=argStart, level=1;
        for(;end<source.length&&level;end++){if(source[end]==='(')level++;if(source[end]===')')level--;}
        const inside=source.slice(argStart,end-1), args=[]; let at=0,nesting=0;
        for(let i=0;i<=inside.length;i++){if(inside[i]==='('||inside[i]==='[')nesting++;if(inside[i]===')'||inside[i]===']')nesting--;if(i===inside.length||inside[i]===','&&nesting===0){args.push(inside.slice(at,i));at=i+1;}}
        const allowedCount=match[1]==='derivative'?[2,3]:match[1]==='integral'?[3,4]:[3];
        if(!allowedCount.includes(args.length)||args.some(a=>!a.trim())||/\b(integral|derivative|sum)\s*\(/.test(inside))throw Object.assign(new Error('Check the numerical template.'),{code:'Syntax ERROR'});
        const calcOpts=opts({scope,onCoordinates:undefined}), val=a=>engine.evaluate(a,calcOpts);
        const f=x=>engine.evaluate(args[0],opts({scope:{...scope,X:x},onCoordinates:undefined}));
        const a=val(args[1]),b=args[2]===undefined?undefined:val(args[2]);
        const value=match[1]==='integral'?alg.integrate(f,a,b,args[3]===undefined?undefined:val(args[3])).value:match[1]==='derivative'?alg.derivative(f,a,b).value:alg.summation(f,a,b);
        source=source.slice(0,start)+'('+String(value)+')'+source.slice(end);
      }
      return engine.evaluate(source,opts({scope,onCoordinates:pair=>{scope.X=pair[0];scope.Y=pair[1];}}));
    }
    function activeInput(){return menu&&menu.type==='input'?$('lcd-prompt'):input;}
    function focusInput(el=activeInput()){if(el){try{el.focus({preventScroll:true});}catch(_){el.focus();}}}
    function touch(){if(autoOff)win.clearTimeout(autoOff);if(!options.noAutoOff){autoOff=win.setTimeout(()=>powerOff(),600000);if(autoOff&&autoOff.unref)autoOff.unref();}}
    function renderStatus(){
      const modeStatus=modes&&modes.getStatus?modes.getStatus():state.mode;
      status.textContent=state.off?'':[state.shift?'S':'',state.alpha?'A':'',memoryAction||'',state.scope.M!==0?'M':'',modeStatus==='COMP'?'':modeStatus,{deg:'D',rad:'R',gra:'G'}[state.angle],state.format==='fix'?'FIX':state.format==='sci'?'SCI':'',state.display==='math'?'Math':'',state.overwrite?'INS':'',multi?'Disp':'',state.history.length?'↕':''].filter(Boolean).join(' ');
      root.classList.toggle('is-off',state.off);root.classList.toggle('is-shift',state.shift);root.classList.toggle('is-alpha',state.alpha);root.classList.toggle('is-menu-open',!!menu||!!errorState);root.classList.toggle('is-error',!!errorState);
      root.style.setProperty('--lcd-contrast',String(.65+state.contrast*.07));
      root.querySelectorAll('[data-key="shift"],[data-key="alpha"]').forEach(button=>button.setAttribute('aria-pressed',String(state[button.dataset.key])));
      root.querySelectorAll('[data-key]').forEach(button=>{const original=button.dataset.originalAria || button.getAttribute('aria-label') || button.textContent.trim();button.dataset.originalAria=original;const alternate=state.alpha?ALPHA[button.dataset.key]:state.shift?button.dataset.shift:null;button.setAttribute('aria-label',alternate||original);});
      renderArrayState();input.disabled=state.off;input.setAttribute('aria-hidden',String(!!menu||state.off));menuEl.hidden=state.off||(!menu&&!errorState);
    }
    function renderArrayState(){
      const array=Array.isArray(state.last),visible=state.afterResult&&array&&!menu&&!errorState&&!state.off;
      root.classList.toggle('is-array-result',visible);
      expression.hidden=!!menu||!!errorState||state.off||visible;
      result.hidden=!!menu||!!errorState||state.off||(array&&!state.afterResult);
    }
    function renderNatural(){
      renderArrayState();
      const position=input.selectionStart||0;
      const active=input.value[position]==='□'?input.value.slice(0,position).split('□').length-1:-1;
      const cursor=!state.afterResult&&!menu&&!state.off?position:-1;
      expression.innerHTML=state.display==='math'?mathMarkup(math,engine,input.value,active,cursor):'<span class="lcd-linear">'+(cursor>=0?escape(input.value.slice(0,cursor))+'<span class="lcd-cursor">▏</span>'+escape(input.value.slice(cursor)):escape(input.value))+'</span>';
      expression.setAttribute('aria-label',input.value||'Expression');
      expression.scrollLeft=expression.scrollWidth;
    }
    function renderResult(){
      if(Array.isArray(state.last)){
        const rows=state.last.every(Array.isArray)?state.last:[state.last];
        result.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML" class="lcd-array" dir="ltr"><mrow><mo stretchy="true">[</mo><mtable columnalign="right">'+rows.map(row=>'<mtr>'+row.map(value=>'<mtd>'+mathMarkup(math,engine,format(value)).replace(/^<math[^>]*>/,'').replace(/<\/math>$/,'')+'</mtd>').join('')+'</mtr>').join('')+'</mtable><mo stretchy="true">]</mo></mrow></math>';
      }
      else if(state.style==='exact'&&state.exact){const text=typeof state.exact==='string'?state.exact:state.exact.text;result.innerHTML=state.display==='math'?mathMarkup(math,engine,text):escape(text);}
      else if(state.style==='fraction'){const f=engine.fraction(state.last,{mixed:state.mixed});result.innerHTML=state.display==='math'?mathMarkup(math,engine,f||format(state.last)):escape(f||format(state.last));}
      else if(state.style==='dms')result.textContent=engine.dms(state.last);
      else if(state.style==='engineering'){
        const e=state.last===0?0:Math.floor(Math.log10(Math.abs(state.last))/3)*3+state.engPower;
        result.innerHTML=mathMarkup(math,engine,engine.format(state.last/10**e,{format:'norm2',digits:10})+'*10^('+e+')');
      }else result.textContent=format(state.last);
      if(result.dataset.label){const caption=doc.createElement('span');caption.className='lcd-result-caption';caption.textContent=result.dataset.label;result.prepend(caption);}
      result.setAttribute('aria-label','Result '+(Array.isArray(state.last)?(result.dataset.label||'')+' '+format(state.last):result.textContent));
    }
    function render(){renderStatus();renderNatural();if(!errorState)renderResult();}
    function closeMenu(){menu=null;errorState=null;menuEl.replaceChildren();renderStatus();focusInput(input);}
    function showValue(value,label='',details={}){
      closeMenu();state.last=value;state.lastExpr=details.expr===undefined?input.value:details.expr;state.engPower=0;state.exact=null;state.style='decimal';state.afterResult=true;
      if(typeof value!=='string'){
        if(Array.isArray(value)){if(state.mode==='MATRIX')state.scope.MatAns=value;if(state.mode==='VECTOR')state.scope.VctAns=value;}
        else state.scope.Ans=value;
      }
      state.exactOptions=opts({scope:{...(details.scope||state.scope)}});
      if(details.exact&&engine.exact){try{state.exact=engine.exact(state.lastExpr,{...state.exactOptions,mixed:state.mixed});}catch(_){}if(state.exact&&state.display==='math'&&state.mathOutput&&!['fix','sci'].includes(state.format))state.style='exact';}
      result.dataset.label=String(label||'');render();persist();announce((label?label+' ':'')+format(value));
    }
    function showError(error){
      errorState={error,menu};const code=error.code||'Math ERROR';
      menuEl.innerHTML='<div class="lcd-error-code">'+escape(code)+'</div><div class="lcd-error-detail">'+escape(error.message||error)+'</div><div class="lcd-menu-footer">◀ ▶ Goto · AC Cancel</div>';
      renderStatus();announce(code+': '+(error.message||error));
    }
    function protect(fn){try{return fn();}catch(error){showError(error);return undefined;}}
    function paintMenu(){
      if(!menu)return;
      if(menu.type==='input'){
        menuEl.innerHTML='<label class="lcd-prompt-label" for="lcd-prompt">'+escape(menu.title)+'</label><input id="lcd-prompt" class="lcd-prompt-input" dir="ltr" autocomplete="off" spellcheck="false" inputmode="text"><div class="lcd-prompt-help">= Confirm · AC Cancel</div>';
        const el=$('lcd-prompt');el.value=menu.value;el.maxLength=1000;el.addEventListener('input',()=>{menu.value=el.value;});focusInput(el);el.select();
      }else{
        const size=menu.pageSize||8,start=menu.page*size,items=menu.entries.slice(start,start+size);
        menuEl.innerHTML='<div class="lcd-menu-title">'+escape(menu.title)+'</div><div class="lcd-menu-grid">'+items.map((item,i)=>'<button type="button" class="lcd-menu-item" data-menu-index="'+(start+i)+'">'+escape(item.key===undefined?i+1:item.key)+':'+escape(item.label)+'</button>').join('')+'</div><div class="lcd-menu-footer">'+(menu.page?'▲ ':'')+(start+size<menu.entries.length?'▼ ':'')+'AC Back</div>';
      }
      renderStatus();announce(menu.title);
    }
    function showMenu(title,entries,settings={}){menu={type:'menu',title:String(title),entries,page:0,pageSize:Math.max(1,Math.min(9,Math.floor(settings.pageSize||8)))};errorState=null;paintMenu();}
    function showInput(title,initial,onSubmit){menu={type:'input',title:String(title),value:String(initial===undefined?'':initial),onSubmit};errorState=null;paintMenu();}
    function submitPrompt(){const current=menu;if(!current||current.type!=='input')return;current.value=$('lcd-prompt').value;current.onSubmit(current.value);if(menu===current)closeMenu();}
    function setExpression(text){input.value=String(text||'');state.afterResult=false;state.resultComplex=null;state.historyIndex=-1;input.setSelectionRange(input.value.length,input.value.length);renderNatural();}
    function setResultFormat(complex){
      if(!['polar','rect'].includes(complex))throw new Error('Unknown complex format');
      state.resultComplex=complex;closeMenu();
      if(state.afterResult){
        state.style='decimal';
        if(complex==='rect'&&state.lastExpr&&engine.exact){try{state.exact=engine.exact(state.lastExpr,{...state.exactOptions,complex:'rect',mixed:state.mixed});}catch(_){state.exact=null;}if(state.exact&&state.display==='math'&&state.mathOutput)state.style='exact';}
        renderResult();
      }
      renderStatus();
    }
    function insert(text,options={}){
      const el=activeInput();if(!el)return;
      if(el===input&&state.afterResult){input.value=options.postfix?'Ans':'';input.setSelectionRange(input.value.length,input.value.length);state.afterResult=false;state.resultComplex=null;multi=null;}
      let start=el.selectionStart??el.value.length,end=el.selectionEnd??start;
      if(start===end&&el.value[start]==='□')end=start+1;
      if(el.value.length-(end-start)+text.length>1000)throw Object.assign(new Error('Expression is too long.'),{code:'Stack ERROR'});
      if(state.overwrite&&state.display==='line'&&start===end)end=Math.min(el.value.length,start+text.length);
      el.setRangeText(text,start,end,'end');
      const hole=text.indexOf('□');if(hole>=0)el.setSelectionRange(start+hole,start+hole+1);
      if(menu&&menu.type==='input'){menu.value=el.value;if(menu.autoDigits&&new RegExp('^\\d{'+menu.autoDigits+'}$').test(menu.value)){submitPrompt();return;}}
      focusInput(el);if(el===input)renderNatural();
    }
    function clear(){closeMenu();memoryAction=null;multi=null;input.value='';state.afterResult=false;state.resultComplex=null;state.last=0;state.exact=null;state.style='decimal';state.shift=false;state.alpha=false;state.historyIndex=-1;result.dataset.label='';render();}
    function powerOff(){persist();closeMenu();state.off=true;state.shift=false;state.alpha=false;memoryAction=null;renderStatus();announce('Power off');}
    function on(){state.off=false;clear();touch();announce('Power on');}
    function history(direction){
      if(!state.history.length)return;
      state.historyIndex=Math.max(-1,Math.min(state.history.length-1,state.historyIndex+(direction==='up'?1:-1)));
      if(state.historyIndex<0){input.value='';state.afterResult=false;renderNatural();return;}
      const row=state.history[state.historyIndex];input.value=row.expr;input.setSelectionRange(input.value.length,input.value.length);state.afterResult=true;state.last=row.value;state.exact=row.exact;state.style=row.style;render();
    }
    function move(direction){
      const el=activeInput();if(!el)return;
      if(el===input&&state.afterResult&&(direction==='left'||direction==='right'))el.setSelectionRange(el.value.length,el.value.length);
      const s=el.selectionStart||0,e=el.selectionEnd||0;
      if(el===input&&(direction==='up'||direction==='down')&&!input.value.includes('□'))return history(direction);
      const forward=direction==='right'||direction==='down';
      // Empty template slots are atomic; arrows jump to the next one.
      let pos=forward?el.value.indexOf('□',Math.max(e,s+1)):el.value.lastIndexOf('□',s-1);
      if(pos>=0)el.setSelectionRange(pos,pos+1);
      else {pos=forward?Math.min(el.value.length,e>s?e:s+1):Math.max(0,s-1);el.setSelectionRange(pos,pos);}
      if(el===input){state.afterResult=false;renderNatural();}focusInput(el);
    }
    function del(){const el=activeInput();const start=el.selectionStart||0,end=el.selectionEnd||0;if(start===end&&start>0)el.setRangeText('',start-1,end,'end');else el.setRangeText('',start,end,'end');if(el===input){state.afterResult=false;renderNatural();}else if(menu)menu.value=el.value;focusInput(el);}
    function calculate(){
      if(multi&&state.afterResult){runStatement();return;}
      const source=input.value.trim()||'Ans';
      const pieces=source.split(':').map(s=>s.trim());
      if(pieces.length>20||pieces.some(s=>!s))throw Object.assign(new Error('Check the multi-statement expression.'),{code:'Syntax ERROR'});
      multi={source,pieces,index:0};runStatement();
    }
    function runStatement(){
      const piece=multi.pieces[multi.index], scope={...state.scope}, exactScope={...scope};
      const assignment=piece.match(/^(.*?)→([A-FXYM])$/);const rhs=assignment?assignment[1]:piece;
      const value=evaluateExpression(/^[*/^]/.test(rhs)?'Ans'+rhs:rhs,scope);
      if(assignment){if(Array.isArray(value))throw new Error('Use the matrix or vector memory.');scope[assignment[2]]=value;}
      if(!Array.isArray(value))scope.Ans=value;
      else if(/^(?:Pol|Rec|pol|rec)\s*\(/.test(rhs))scope.Ans=value[0];
      state.scope=scope;const fullSource=multi.source;multi.index++;if(multi.index>=multi.pieces.length)multi=null;
      showValue(value,'',{expr:rhs,exact:!assignment,scope:exactScope});
      if(typeof value==='number'&&/\bdms\(/.test(rhs)&&!/[a-df-zA-DF-Z]/.test(rhs.replace(/dms\([^()]*\)/g,'1'))){state.style='dms';renderResult();}
      state.history.unshift({expr:fullSource,value,exact:state.exact,style:state.style});state.history=state.history.slice(0,40);state.historyIndex=-1;renderStatus();
    }
    function setMode(mode){if(!MODE_NAMES.includes(mode))throw new Error('Unknown mode');closeMenu();if(modes)modes.exit();state.mode=mode;input.value='';state.afterResult=false;state.resultComplex=null;state.exact=null;state.style='decimal';state.last=0;multi=null;state.history=[];state.historyIndex=-1;if(modes)modes.enter(mode);render();persist();}
    function setup(page=0){
      const set=(key,value)=>()=>{state[key]=value;closeMenu();render();persist();};
      const setDisplay=(display,mathOutput)=>{if(display!==state.display&&modes&&modes.resetTable)modes.resetTable();state.display=display;state.mathOutput=mathOutput;closeMenu();render();persist();};
      if(page===1){showMenu('SETUP ▼',[{label:'ab/c',action:set('mixed',true)},{label:'d/c',action:set('mixed',false)},{label:'CMPLX',action:()=>showMenu('CMPLX',[{label:'a+bi',action:set('complex','rect')},{label:'r∠θ',action:set('complex','polar')}])},{label:'STAT',action:()=>showMenu('FREQ',[{label:'ON',action:set('freq',true)},{label:'OFF',action:set('freq',false)}])},{label:'Disp',action:()=>showMenu('Decimal',[{label:'Dot',action:set('decimal','dot')},{label:'Comma',action:set('decimal','comma')}])},{label:'◀ CONT ▶',action:()=>{menu={type:'contrast',title:'Contrast'};menuEl.innerHTML='<div class="lcd-menu-title">Contrast</div><div class="lcd-prompt-help">◀ Light · Dark ▶ · AC</div>';renderStatus();}}]);menu.setupPage=1;return;}
      function digits(kind){showInput(kind+' 0–9','',v=>{if(!/^\d$/.test(v))throw new Error('Enter one digit from 0 to 9.');state.format=kind.toLowerCase();state.digits=+v||(kind==='Sci'?10:0);closeMenu();render();persist();});menu.autoDigits=1;}
      showMenu('SETUP',[{label:'MthIO',action:()=>showMenu('MthIO',[{label:'MathO',action:()=>setDisplay('math',true)},{label:'LineO',action:()=>setDisplay('math',false)}])},{label:'LineIO',action:()=>setDisplay('line',false)},{label:'Deg',action:set('angle','deg')},{label:'Rad',action:set('angle','rad')},{label:'Gra',action:set('angle','gra')},{label:'Fix',action:()=>digits('Fix')},{label:'Sci',action:()=>digits('Sci')},{label:'Norm',action:()=>showMenu('Norm',[{label:'Norm 1',action:set('format','norm')},{label:'Norm 2',action:set('format','norm2')}])}]);menu.setupPage=0;
    }
    function resetMenu(){showMenu('CLR',[{label:'Setup',action:()=>confirmReset('Setup')},{label:'Memory',action:()=>confirmReset('Memory')},{label:'All',action:()=>confirmReset('All')}]);}
    function confirmReset(kind){showInput('Reset '+kind+'? = Yes','',()=>{if(kind==='Setup'||kind==='All'){Object.assign(state,DEFAULTS);if(modes&&modes.resetTable)modes.resetTable();}if(kind==='Memory'||kind==='All'){state.scope={A:0,B:0,C:0,D:0,E:0,F:0,X:0,Y:0,M:0,Ans:0};state.stats=null;state.baseResult=null;}state.history=[];if(modes)modes.exit();clear();persist();announce('Reset '+kind);});}
    function catalogMenu(kind){
      const constants=options.constants||(typeof SCIENTIFIC_CONSTANTS!=='undefined'?SCIENTIFIC_CONSTANTS:global.SCIENTIFIC_CONSTANTS), conversions=options.conversions||(typeof UNIT_CONVERSIONS!=='undefined'?UNIT_CONVERSIONS:global.UNIT_CONVERSIONS);
      const rows=kind==='CONST'?constants:conversions;if(!rows)throw new Error('Catalog is unavailable');
      showInput(kind+' 01–40','',id=>{const padded=String(id).padStart(2,'0'),item=rows.find(r=>String(r.id).padStart(2,'0')===padded);if(!item)throw new Error('Enter a code from 01 to 40.');closeMenu();if(kind==='CONST')insert('('+item.value+')');else {const value=state.afterResult?state.last:finite(input.value||'Ans');const convert=options.convert||global.convertScientificUnit;showValue(convert(value,item.id),item.from+'→'+item.to);}});menu.autoDigits=2;
    }
    function shiftAction(key){
      if(key==='mode'){setup();return true;}if(key==='ac'){powerOff();return true;}if(key==='del'){state.overwrite=state.display==='line'?!state.overwrite:false;announce(state.display==='math'?'Natural input uses insertion.':state.overwrite?'Overwrite':'Insert');renderStatus();return true;}
      if(key==='rcl'){memoryAction='STO';renderStatus();return true;}if(key==='7'||key==='8'){catalogMenu(key==='7'?'CONST':'CONV');return true;}if(key==='9'){resetMenu();return true;}
      if(key==='ans'){showMenu('DRG▶',[{label:'°',action:()=>wrapAngle('deg')},{label:'r',action:()=>wrapAngle('rad')},{label:'g',action:()=>wrapAngle('gra')}]);return true;}
      if(key==='hyp'){insert('Abs(□)');return true;}
      if(key==='dms'){if(state.afterResult)dms();else{calculate();state.style='decimal';renderResult();}return true;}
      if(key==='fraction'){insert('(□+(□)/(□))');return true;}
      if(key==='sd'){state.mixed=!state.mixed;if(state.exact&&state.lastExpr){try{state.exact=engine.exact(state.lastExpr,{...state.exactOptions,mixed:state.mixed});}catch(_){}}if(state.style==='decimal')state.style='fraction';renderResult();persist();return true;}
      if(key==='eng'){engineering(3);return true;}if(key==='mplus'){memoryAdd(-1);return true;}
      if(key==='mul'||key==='div'){wrapBinary(key==='mul'?'nPr':'nCr');return true;}
      if(key==='negative'){wrapBinary('polar');return true;}
      if(key==='power'){wrapBinary('nthRoot',true);return true;}
      const text={integral:'derivative(□,□)',logbase:'sum(□,□,□)',inverse:'!',sqrt:'cbrt(□)',square:'^3',log:'10^(□)',ln:'exp(□)',sin:'asin(□)',cos:'acos(□)',tan:'atan(□)',lparen:'%',rparen:',',add:'Pol(□,□)',sub:'Rec(□,□)',0:'Rnd(□)',dot:'Ran#',exp:'pi'}[key];
      if(text!==undefined){insert(text,{postfix:['inverse','square','lparen'].includes(key)});return true;}return false;
    }
    function wrapAngle(name){closeMenu();const el=activeInput(),source=el.value||'Ans';setExpression(name+'('+source+')');}
    function operandRange(el){
      const end=el.selectionEnd||0,start=el.selectionStart||0;if(end>start)return {start,end,text:el.value.slice(start,end)};
      const before=el.value.slice(0,start);
      const number=before.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/);
      if(number)return {start:start-number[0].length,end:start,text:number[0]};
      const symbol=before.match(/[A-Za-z][A-Za-z0-9_]*$/);if(symbol)return {start:start-symbol[0].length,end:start,text:symbol[0]};
      if(before.endsWith(')')){let balance=1,i=start-2;for(;i>=0;i--){if(before[i]===')')balance++;if(before[i]==='(')balance--;if(balance===0)break;}if(i>=0){const fn=before.slice(0,i).match(/[A-Za-z][A-Za-z0-9_]*$/);if(fn)i-=fn[0].length;return {start:i,end:start,text:before.slice(i)};}}
      return {start,end:start,text:'□'};
    }
    function wrapBinary(name,reverse=false){
      const el=activeInput();if(el===input&&state.afterResult){el.value='Ans';el.setSelectionRange(3,3);state.afterResult=false;}
      const range=operandRange(el);el.setSelectionRange(range.start,range.end);insert(name+'('+(reverse?'□,'+range.text:range.text+',□')+')');
    }
    function fraction(){
      const el=activeInput();
      if(el===input&&state.afterResult){el.value='Ans';el.setSelectionRange(3,3);state.afterResult=false;}
      const range=operandRange(el);el.setSelectionRange(range.start,range.end);insert('('+range.text+')/(□)');
    }
    function engineering(direction){if(typeof state.last!=='number')throw new Error('Engineering notation needs a real number.');state.engPower=state.style==='engineering'?Math.max(-30,Math.min(30,state.engPower+direction)):(direction>0?3:0);state.style='engineering';renderResult();}
    function memoryAdd(sign){const value=state.afterResult?state.last:ev(input.value||'Ans');if(Array.isArray(value)||typeof value==='string')throw new Error('M stores a number.');state.scope.M=engine.evaluate('M'+(sign===1?'+':'-')+'X',opts({scope:{...state.scope,X:value}}));showValue(value,'M'+(sign===1?'+':'−'));persist();}
    function sd(){if(!state.afterResult)return;if(state.style==='exact'||state.style==='fraction')state.style='decimal';else if(state.exact)state.style='exact';else{if(!engine.fraction(state.last,{mixed:state.mixed}))throw new Error('No fraction form for this value.');state.style='fraction';}renderResult();}
    function dms(){
      if(state.afterResult){state.style=state.style==='dms'?'decimal':'dms';renderResult();return;}
      const el=activeInput(),position=el.selectionStart||0;
      const start=el.value.lastIndexOf('dms(',position),end=start>=0?el.value.indexOf(')',start):-1;
      if(start>=0&&(end<0||position<=end)){move('right');return;}
      const range=operandRange(el);el.setSelectionRange(range.start,range.end);insert('dms('+range.text+',□,□)');
    }
    function keyPress(key){
      touch();if(key==='on'){on();return;}if(state.off)return;
      if(errorState){if(['left','right','up','down'].includes(key)){menu=errorState.menu;errorState=null;if(menu)paintMenu();else{menuEl.replaceChildren();render();focusInput();}return;}if(key==='ac'){errorState=null;clear();return;}return;}
      if(key==='shift'){state.shift=!state.shift;state.alpha=false;renderStatus();return;}if(key==='alpha'){state.alpha=!state.alpha;state.shift=false;renderStatus();return;}
      const mods={shift:state.shift,alpha:state.alpha};state.shift=false;state.alpha=false;
      if(mods.shift&&key==='ac'){powerOff();return;}
      if(key==='mode'){memoryAction=null;if(mods.shift)setup();else showMenu('MODE',MODE_NAMES.map(mode=>({label:mode,action:()=>setMode(mode)})));renderStatus();return;}
      if(modes&&modes.handleContextKey&&modes.handleContextKey(key,mods,menu)){renderStatus();persist();return;}
      if(menu&&menu.type==='menu'){
        if(key==='ac'){closeMenu();render();return;}
        if(menu.setupPage!==undefined&&(key==='down'||key==='up')){setup(menu.setupPage===0?1:0);return;}
        if(key==='down'||key==='up'){menu.page=Math.max(0,Math.min(Math.floor((menu.entries.length-1)/(menu.pageSize||8)),menu.page+(key==='down'?1:-1)));paintMenu();return;}
        if(/^\d$/.test(key)){const size=menu.pageSize||8,start=menu.page*size,visible=menu.entries.slice(start,start+size),index=visible.findIndex((item,i)=>String(item.key===undefined?i+1:item.key)===key);if(index>=0){const item=visible[index];item.action();}return;}return;
      }
      if(menu&&menu.type==='contrast'){if(key==='ac'){closeMenu();persist();return;}if(key==='left'||key==='right'){state.contrast=Math.max(0,Math.min(9,state.contrast+(key==='right'?1:-1)));renderStatus();}return;}
      if(menu&&menu.type==='input'){if(key==='equals'){submitPrompt();return;}if(key==='ac'){closeMenu();render();return;}}
      if(memoryAction){const variable=ALPHA[key];if(variable&&/^[A-FXYM]$/.test(variable)){if(memoryAction==='STO'){const value=state.afterResult?state.last:ev(input.value||'Ans');let target=variable;if(Array.isArray(value)){const matrix=state.mode==='MATRIX'&&value.every(Array.isArray),vector=state.mode==='VECTOR'&&value.every(v=>typeof v==='number');if(!/^[ABC]$/.test(variable)||!matrix&&!vector)throw new Error('Use matrix or vector memory A, B or C.');target=(matrix?'Mat':'Vct')+variable;state.scope[target]=value.map(v=>Array.isArray(v)?v.slice():v);}else{if(typeof value==='string')throw new Error('A numeric value is required.');state.scope[target]=value;}memoryAction=null;showValue(value,'→'+target);persist();}else{memoryAction=null;insert(valueExpression(state.scope[variable]||0));}renderStatus();return;}if(key==='ac'){memoryAction=null;clear();return;}return;}
      if(mods.alpha){const text=ALPHA[key];if(text!==undefined)insert(text);renderStatus();return;}
      const canonical=key==='calc'?'CALC':state.mode==='BASE-N'?({square:'DEC',power:'HEX',log:'BIN',ln:'OCT'}[key]||key):key;
      if(!menu&&modes&&modes.handleKey(canonical,mods)){renderStatus();persist();return;}
      if(mods.shift&&shiftAction(key)){renderStatus();return;}
      if(mods.shift){announce('No SHIFT function on this key.');renderStatus();return;}
      if(['up','down','left','right'].includes(key)){move(key);return;}
      if(key==='equals'){calculate();return;}if(key==='ac'){clear();return;}if(key==='del'){del();return;}
      if(key==='fraction'){fraction();return;}
      if(key==='rcl'){memoryAction='RCL';renderStatus();return;}if(key==='sd'){sd();return;}if(key==='eng'){if(state.mode==='CMPLX')insert('i');else engineering(-3);return;}if(key==='mplus'){memoryAdd(1);return;}if(key==='dms'){dms();return;}
      if(key==='rparen'){const el=activeInput();if(el.selectionStart===el.selectionEnd&&el.value[el.selectionStart]===')'){const next=el.selectionStart+1;el.setSelectionRange(next,next);if(el===input)renderNatural();return;}}
      if(key==='hyp'){showMenu('HYP',[{label:'sinh',action:()=>{closeMenu();insert('sinh(□)');}},{label:'cosh',action:()=>{closeMenu();insert('cosh(□)');}},{label:'tanh',action:()=>{closeMenu();insert('tanh(□)');}},{label:'sinh⁻¹',action:()=>{closeMenu();insert('asinh(□)');}},{label:'cosh⁻¹',action:()=>{closeMenu();insert('acosh(□)');}},{label:'tanh⁻¹',action:()=>{closeMenu();insert('atanh(□)');}}]);return;}
      const text={integral:'integral(□,□,□)',inverse:'^(-1)',logbase:'log(□,□)',sqrt:'sqrt(□)',square:'^2',power:'^(□)',log:'log(□)',ln:'ln(□)',negative:'-',sin:'sin(□)',cos:'cos(□)',tan:'tan(□)',lparen:'(',rparen:')',mul:'*',div:'/',add:'+',sub:'-',dot:'.',exp:'*10^(□)',ans:'Ans'}[key];
      if(text!==undefined)insert(text,{postfix:['inverse','square','power','mul','div','add','sub','exp'].includes(key)});else if(/^\d$/.test(key))insert(key);
      renderStatus();
    }
    const modesFactory=options.modesFactory||global.createDeviceModes;
    const api={math,engine,alg,getState:()=>state,ev,showMenu,showInput,showValue,insert,announce,onModeChange:setMode,closeMenu,format,getExpression:()=>input.value,setExpression,setResultFormat};
    modes=modesFactory?modesFactory(api):null;
    const click=event=>{const key=event.target.closest('[data-key]');if(key&&root.contains(key)){event.preventDefault();protect(()=>keyPress(key.dataset.key));return;}const item=event.target.closest('[data-menu-index]');if(item&&menu&&menu.type==='menu'){const entry=menu.entries[+item.dataset.menuIndex];if(entry)protect(()=>entry.action());return;}const hole=event.target.closest('[data-hole]');if(hole&&expression.contains(hole)){let n=+hole.getAttribute('data-hole'),at=-1;do{at=input.value.indexOf('□',at+1);}while(n-->0&&at>=0);if(at>=0){input.setSelectionRange(at,at+1);focusInput(input);renderNatural();}}};
    const keyboard=event=>{
      if(!root.contains(event.target))return;
      // Native focused buttons activate on Enter/Space; Tab remains native too.
      if(event.target.closest('button')&&(event.key==='Enter'||event.key===' '))return;
      const map={Enter:'equals',Escape:'ac',Backspace:'del',Delete:'del',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',F1:'shift',F2:'alpha',F9:'mode'};
      if(map[event.key]){event.preventDefault();protect(()=>keyPress(map[event.key]));return;}
      if(menu&&menu.type==='menu'&&/^\d$/.test(event.key)){event.preventDefault();protect(()=>keyPress(event.key));return;}
      if(state.off){event.preventDefault();return;}
      if(event.target!==input&&event.target!==$('lcd-prompt')&&event.key.length===1&&!event.ctrlKey&&!event.metaKey){event.preventDefault();protect(()=>insert(event.key));}
      else if(event.target===input&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&state.afterResult){input.value=/^[+*/^-]$/.test(event.key)?'Ans':'';state.afterResult=false;state.resultComplex=null;multi=null;}
    };
    root.addEventListener('click',click);root.addEventListener('keydown',keyboard);
    input.addEventListener('input',()=>{if(input.value.length>1000)input.value=input.value.slice(0,1000);state.afterResult=false;multi=null;renderNatural();touch();});
    input.addEventListener('select',renderNatural);input.setAttribute('autocomplete','off');input.setAttribute('spellcheck','false');input.setAttribute('maxlength','1000');input.setAttribute('dir','ltr');
    input.value='';render();touch();
    const device={press:key=>protect(()=>keyPress(String(key))),state,engine,alg,setExpression,calculate:()=>protect(calculate),showMenu,showInput,showValue,render,mathMarkup:source=>mathMarkup(math,engine,source),get menu(){return menu;},get error(){return errorState&&errorState.error;},destroy(){if(autoOff)win.clearTimeout(autoOff);root.removeEventListener('click',click);root.removeEventListener('keydown',keyboard);persist();}};
    root.casioDevice=device;return device;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createCasioDevice,mathMarkup};
  else {global.createCasioDevice=createCasioDevice;const boot=()=>{const root=global.document.getElementById('casio-calc');if(root&&!root.casioDevice)global.casioDevice=createCasioDevice({root});};if(global.document.readyState==='loading')global.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window!=='undefined'?window:globalThis);
