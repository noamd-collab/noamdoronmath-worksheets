import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { EXACT_PEEK_BLOCKS } from '../src/lib/exactLinkPeekBlocks';
import { CALCULATOR_PREVIEW, exactPeekPosition, initExactLinkPeek, peekMotionBlocked, renderExactPeek, resolveExactPeek } from '../src/lib/exactLinkPeek';

const live = { topics: [{grade:'ז׳',title:'נתון אמיתי <ולא HTML>'},{grade:'א׳',title:'תרגול אמיתי'}], posts:['כותרת אמת & מקור'], gradeCounts:{'7':43} };

test('source decorative coordinates are complete and remain left-based in an LTR preview', () => {
  assert.equal(EXACT_PEEK_BLOCKS.ws.length,25);
  assert.equal(EXACT_PEEK_BLOCKS.elem.length,17);
  assert.equal(EXACT_PEEK_BLOCKS.topic.length,13);
  const markup=renderExactPeek('home',live)!;
  assert.match(markup,/dir="ltr" aria-hidden="true"/);
  assert.match(markup,/left:156px;top:26.400000000000002px/);
  assert.doesNotMatch(markup,/inset-inline-start/);
});

test('worksheet and blog previews use supplied real data, never reference TP sample content', () => {
  const worksheets=renderExactPeek('ws',live)!;
  assert.match(worksheets,/נתון אמיתי &lt;ולא HTML&gt;/);
  assert.match(worksheets,/תרגול אמיתי/);
  assert.doesNotMatch(worksheets,/50 נושאים|חיבור עד 20|href=/);
  assert.match(renderExactPeek('blog',live)!,/כותרת אמת &amp; מקור/);
  assert.doesNotMatch(renderExactPeek('ws',{...live,topics:[]})!,/data-live="row"/);
});

test('split worksheets nav previews reuse the exact live rows, filtered to their school band', () => {
  const ysodi=renderExactPeek('ws-ysodi',live)!;
  assert.match(ysodi,/תרגול אמיתי/);
  assert.doesNotMatch(ysodi,/נתון אמיתי/);
  assert.match(ysodi,/דפי עבודה ליסודי/);
  const hatzava=renderExactPeek('ws-hatzava',live)!;
  assert.match(hatzava,/נתון אמיתי/);
  assert.doesNotMatch(hatzava,/תרגול אמיתי/);
  assert.match(hatzava,/דפי עבודה לחטיבת הביניים/);
  assert.equal(resolveExactPeek('ws-hatzava',live)!.blocks,EXACT_PEEK_BLOCKS.ws);
});

test('actual grade counts survive and unknown keys do not reuse a previous tooltip', () => {
  assert.match(resolveExactPeek('g:7',live)!.tag,/43 נושאים/);
  assert.equal(resolveExactPeek('g:42',live),null);
  assert.equal(renderExactPeek('nonexistent',live),null);
  assert.equal(resolveExactPeek('google',live)!.title,'התחברות עם Google');
});

test('calculator is the exact four decorative reference frames, never an input or solver', () => {
  assert.deepEqual(CALCULATOR_PREVIEW.map(row=>row.slice(1)),[['√144','12'],['sin(30°)','0.5'],['2^10','1024'],['π×5²','78.54']]);
  const markup=renderExactPeek('tools',live)!;
  assert.equal([...markup.matchAll(/data-key=/g)].length,25);
  assert.doesNotMatch(markup,/<(?:button|input|form)|onclick|href=/i);
});

test('reference position prefers below, then above, and avoids the grade genie', () => {
  const r={left:500,right:600,top:100,bottom:140,width:100,height:40};
  assert.deepEqual(exactPeekPosition(r,1440,900),{x:400,y:150});
  assert.deepEqual(exactPeekPosition({...r,top:800,bottom:840},1440,900),{x:400,y:528});
  assert.deepEqual(exactPeekPosition({...r,top:300,bottom:340},1440,400,true),{x:612,y:130});
});

test('off, reduced motion, hidden tab and existing accessibility stop always suppress motion', () => {
  const enabled={hidden:false,reduced:false,stopped:false,mode:'full'};
  assert.equal(peekMotionBlocked(enabled),false);
  for(const flags of [{hidden:true},{reduced:true},{stopped:true},{mode:'off'},{mode:'כבוי'}])assert.equal(peekMotionBlocked({...enabled,...flags}),true);
  assert.equal(peekMotionBlocked({...enabled,mode:'relaxed'}),false);
});

function fixture(run:(f:any)=>void){
  const prior=new Map<string,PropertyDescriptor|undefined>();
  const globals=(values:Record<string,unknown>)=>{for(const [key,value]of Object.entries(values)){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}};
  class Target {
    handlers=new Map<string,Set<Function>>(); attributes=new Map<string,string>();style:any={};dataset:any={};hidden=false;id='';className='';dir='';isConnected=true;innerHTML='';parent:any=null;
    addEventListener(type:string,handler:Function){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type)!.add(handler);}
    removeEventListener(type:string,handler:Function){this.handlers.get(type)?.delete(handler);}
    emit(type:string,event:any={}){for(const handler of this.handlers.get(type)||[])handler({type,target:this,...event});}
    setAttribute(k:string,v:string){this.attributes.set(k,v);}getAttribute(k:string){return this.attributes.get(k)??null;}removeAttribute(k:string){this.attributes.delete(k);}
    contains(other:Target){return other===this||other?.parent===this;}
    closest(selector:string){return selector==='[data-peek]'&&this.attributes.has('data-peek')?this:null;}
    querySelector(){return null;}querySelectorAll(){return [];}
    getBoundingClientRect(){return {left:500,right:600,top:100,bottom:140,width:100,height:40};}
    remove(){this.isConnected=false;}
    animate(_frames:unknown,options:unknown){const a:any=new Target();a.cancel=()=>{state.cancelled++;a.emit('cancel');};state.animations.push(options);return a;}
  }
  const state={animations:[] as unknown[],cancelled:0,created:[] as Target[],time:0,seq:0,timers:new Map<number,{fn:Function,at:number,interval:number}>(),mutation:()=>{}};
  const document:any=new Target(),window:any=new Target(),html:any=new Target(),body:any=new Target();
  const flags=new Set();html.classList={contains:(flag:string)=>flags.has(flag)};document.documentElement=html;document.body=body;document.hidden=false;document.activeElement=null;
  document.createElement=()=>{const element=new Target();state.created.push(element);return element;};body.appendChild=(el:Target)=>el.parent=body;
  const reduce:any=new Target();reduce.matches=false;const hover:any=new Target();hover.matches=true;
  window.matchMedia=(query:string)=>query.includes('reduced')?reduce:hover;
  window.setTimeout=(fn:Function,ms:number)=>{const id=++state.seq;state.timers.set(id,{fn,at:state.time+ms,interval:0});return id;};
  window.setInterval=(fn:Function,ms:number)=>{const id=++state.seq;state.timers.set(id,{fn,at:state.time+ms,interval:ms});return id;};
  window.clearTimeout=window.clearInterval=(id:number)=>state.timers.delete(id);
  globals({document,window,innerWidth:1440,innerHeight:900,MutationObserver:class{constructor(fn:()=>void){state.mutation=fn;}observe(){}disconnect(){}}});
  function advance(ms:number){const end=state.time+ms;for(;;){const next=[...state.timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;state.time=next[1].at;if(next[1].interval)next[1].at+=next[1].interval;else state.timers.delete(next[0]);next[1].fn();}state.time=end;}
  const anchor=new Target();anchor.setAttribute('data-peek','home');anchor.setAttribute('href','/unchanged');anchor.setAttribute('aria-describedby','original-help');
  try{run({document,window,state,anchor,advance,reduce,hover,flags,Target});}finally{for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else delete(globalThis as any)[key];}}
}

test('hover timing, child transitions, hover persistence and Escape preserve the actual link',()=>fixture(f=>{
  const cleanup=initExactLinkPeek(live);f.document.emit('pointerover',{target:f.anchor,pointerType:'mouse'});f.advance(219);assert.equal(f.state.created.length,0);f.advance(1);
  const tip=f.state.created[0];assert.equal(tip.hidden,false);assert.equal(tip.getAttribute('role'),'tooltip');assert.equal(f.anchor.getAttribute('href'),'/unchanged');assert.equal(f.anchor.getAttribute('aria-describedby'),'original-help exact-link-peek');
  const child=new f.Target();child.parent=f.anchor;f.document.emit('pointerout',{target:f.anchor,relatedTarget:child});f.advance(200);assert.equal(tip.hidden,false);
  f.document.emit('pointerout',{target:f.anchor,relatedTarget:tip});tip.emit('pointerenter');f.advance(200);assert.equal(tip.hidden,false);
  f.document.emit('keydown',{key:'Escape'});assert.equal(tip.hidden,true);assert.equal(f.anchor.getAttribute('aria-describedby'),'original-help');
  f.document.emit('pointerover',{target:f.anchor,pointerType:'mouse'});f.advance(300);assert.equal(tip.hidden,true);cleanup();assert.equal(f.state.timers.size,0);
}));

test('keyboard previews remain available without hover and stop immediately under reduced motion',()=>fixture(f=>{
  f.hover.matches=false;f.reduce.matches=true;const cleanup=initExactLinkPeek(live);
  f.document.emit('pointerover',{target:f.anchor,pointerType:'touch'});f.advance(300);assert.equal(f.state.created.length,0);
  f.document.activeElement=f.anchor;f.document.emit('focusin',{target:f.anchor});f.advance(220);assert.equal(f.state.created[0].hidden,false);assert.equal(f.state.animations.length,0);
  f.document.emit('pointerout',{target:f.anchor,relatedTarget:null});f.advance(300);assert.equal(f.state.created[0].hidden,false);
  f.document.emit('focusout',{target:f.anchor,relatedTarget:null});f.advance(120);assert.equal(f.state.created[0].hidden,true);cleanup();
}));

test('unknown target, off event and cleanup cancel only preview-owned work',()=>fixture(f=>{
  const cleanup=initExactLinkPeek(live);f.document.emit('focusin',{target:f.anchor});f.advance(220);assert.equal(f.state.animations.length,1);
  f.window.emit('nd:motion-off',{detail:{off:true}});assert.equal(f.state.cancelled,1);
  const unknown=new f.Target();unknown.setAttribute('data-peek','not-real');f.document.emit('focusin',{target:unknown});f.advance(300);assert.equal(f.state.created[0].hidden,true);cleanup();
  assert.equal(f.state.timers.size,0);assert.equal(f.document.handlers.get('focusin')?.size,0);
}));

test('component reads current content without changing source data or importing math engines',()=>{
  const component=readFileSync(new URL('../src/components/LinkPeek.astro',import.meta.url),'utf8');
  assert.match(component,/loadCatalog\(\)\.grades/);assert.match(component,/learningGaps\.h1, readingGraphs\.h1/);assert.match(component,/g\.topics\.length/);
  assert.doesNotMatch(component,/ConceptLoop|HeroLoop|conceptLoops|SEARCH_TERMS|localStorage|sessionStorage/);
  const controller=readFileSync(new URL('../src/lib/exactLinkPeek.ts',import.meta.url),'utf8');
  assert.doesNotMatch(controller,/fetch\(|localStorage|sessionStorage|preventDefault\(|\.href\s*=/);
});
