import { PKS, resolvePeek, type PeekEntry } from './linkPeek';
import { EXACT_PEEK_BLOCKS } from './exactLinkPeekBlocks';

export type PeekLiveData = {
  topics: Array<{ grade: string; title: string }>;
  posts: string[];
  gradeCounts: Record<string, number>;
};
const EMPTY_DATA: PeekLiveData = { topics: [], posts: [], gradeCounts: {} };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const CALCULATOR_KEYS = ['sin','cos','√','x²','π','7','8','9','÷','^','4','5','6','×','(','1','2','3','−',')','0','.','=','+','C'];
// A decorative, non-interactive display copied from the reference, not a solver.
export const CALCULATOR_PREVIEW = [
  [['√','1','4','4'], '√144', '12'],
  [['sin','3','0'], 'sin(30°)', '0.5'],
  [['2','^','1','0'], '2^10', '1024'],
  [['π','×','5','x²'], 'π×5²', '78.54'],
] as const;

export function resolveExactPeek(key: string, data: PeekLiveData = EMPTY_DATA): PeekEntry | null {
  const current = resolvePeek(key === 'google' ? 'learn' : key, data.gradeCounts);
  if (!current) return null;
  return {
    ...current,
    ...(key === 'google' ? { title: 'התחברות עם Google', tag: 'הלמידה שלי' } : {}),
    blocks: EXACT_PEEK_BLOCKS[key] || current.blocks,
  };
}

function specialPreview(key: string, data: PeekLiveData): string {
  if (key === 'tools') return `<div class="exact-peek-calc"><div class="exact-peek-screen"><span data-live="expr">√144 =</span><span data-live="res">12</span></div><div class="exact-peek-keys">${CALCULATOR_KEYS.map(k => `<span data-key="${escape(k)}" data-kind="${k === '=' ? 'equals' : /^[0-9.]$/.test(k) ? 'number' : 'function'}">${escape(k)}</span>`).join('')}</div></div>`;
  if (key === 'ws' && data.topics.length) return `<div class="exact-peek-rows" dir="rtl">${[0,1,2].map(i => {
    const topic = data.topics[i % data.topics.length];
    return `<div data-live="row"><span data-live="g">${escape(topic.grade)}</span><span data-live="t">${escape(topic.title)}</span><span class="exact-peek-levels"><i></i><i></i><i></i></span></div>`;
  }).join('')}</div>`;
  if (key === 'about') return `<div class="exact-peek-about" dir="rtl"><img data-live="logo" src="/design-exact/assets/logo.png" alt=""><div><strong>נועם דורון</strong><svg viewBox="0 0 100 10"><path data-live="uline" pathLength="1" d="M2 6 C 30 1, 60 9, 98 4" fill="none" stroke="#e5735c" stroke-width="3" stroke-linecap="round" stroke-dasharray="1"></path></svg><span>דפי עבודה במתמטיקה לכיתות א׳–ט׳</span></div></div>`;
  if (key === 'blog' && data.posts.length) return `<div class="exact-peek-blog" dir="rtl"><div><span class="exact-peek-margin"></span><span data-live="bnum">פוסט 1 מתוך ${data.posts.length}</span><span class="exact-peek-headline"><span data-live="btitle">${escape(data.posts[0])}</span><span data-live="caret"></span></span>${[92,78,60].map(width => `<span data-live="bar" style="width:${width}%"></span>`).join('')}</div></div>`;
  return '';
}

export function renderExactPeek(key: string, data: PeekLiveData = EMPTY_DATA): string | null {
  const entry = resolveExactPeek(key, data);
  if (!entry) return null;
  const blocks = entry.blocks.map(([x,y,w,h,kind]) => {
    const style = Object.entries(PKS[kind] || {}).map(([k,v]) => `${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}:${v}`).join(';');
    return `<span data-pk style="position:absolute;left:${x*12}px;top:${y*12}px;width:${w*12}px;height:${h*12}px;box-sizing:border-box;${style}"></span>`;
  }).join('');
  const ai = entry.ai ? `<div class="exact-peek-ai"><span class="exact-peek-ai-icon"><span data-ai="ring"></span><span>AI</span></span><span class="exact-peek-ai-copy"><strong>נועם AI זמין בכל דף</strong><span><span data-ai="type">מסביר צעד אחר צעד</span><span class="exact-peek-dots"><i data-ai="dot"></i><i data-ai="dot"></i><i data-ai="dot"></i></span></span></span></div>` : '';
  return `<div class="exact-peek-preview" dir="ltr" aria-hidden="true">${blocks}${specialPreview(key,data)}</div><div class="exact-peek-heading"><strong>${escape(entry.title)}</strong><span>${escape(entry.tag)}</span></div><p>${escape(entry.desc)}</p>${ai}`;
}

export function exactPeekPosition(r: Pick<DOMRect, 'left'|'right'|'top'|'bottom'|'width'|'height'>, width: number, height: number, genie = false) {
  const W=300,H=262,gx=genie?86:0;
  const x=Math.max(12,Math.min(width-W-12,r.left+r.width/2-W/2));
  let y=r.bottom+10;
  if(y+H>height-8){
    y=r.top-H-10-gx;
    if(y<8){
      y=Math.max(8,r.top-H-10);
      if(gx){
        const sx=r.right+12+W<=width-12?r.right+12:r.left-W-12;
        if(sx>=12)return {x:Math.round(sx),y:Math.round(Math.max(8,Math.min(height-H-8,r.top+r.height/2-H/2)))};
      }
    }
  }
  return {x:Math.round(x),y:Math.round(y)};
}

export function peekMotionBlocked(flags: { hidden: boolean; reduced: boolean; stopped: boolean; mode?: string }): boolean {
  return flags.hidden || flags.reduced || flags.stopped || flags.mode === 'off' || flags.mode === 'כבוי';
}

export function initExactLinkPeek(data: PeekLiveData = EMPTY_DATA): () => void {
  if(typeof document==='undefined')return ()=>{};
  let tip: HTMLElement|null=null,anchor: Element|null=null,key='',dismissed:Element|null=null;
  let showTimer=0,hideTimer=0,liveTimer=0,revision=0;
  let eventOff=false;
  const animations=new Set<Animation>(), listeners:Array<()=>void>=[];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const hover=window.matchMedia('(hover: hover)');
  const html=document.documentElement;
  const blocked=()=>peekMotionBlocked({hidden:document.hidden,reduced:reduced.matches,stopped:eventOff||html.classList.contains('nd-motion-off')||html.classList.contains('noam-a11y-motion'),mode:html.dataset.ndMotion||html.dataset.motion});
  function listen(target:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  function animate(el:Element,frames:Keyframe[],options:KeyframeAnimationOptions){
    if(blocked()||!el.animate)return null;
    const a=el.animate(frames,options);animations.add(a);
    a.addEventListener('finish',()=>animations.delete(a),{once:true});a.addEventListener('cancel',()=>animations.delete(a),{once:true});return a;
  }
  function stop(){revision++;window.clearInterval(liveTimer);liveTimer=0;animations.forEach(a=>a.cancel());animations.clear();}
  function unrelate(){
    if(!anchor)return;const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='exact-link-peek');
    if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');
  }
  function hide(){window.clearTimeout(showTimer);window.clearTimeout(hideTimer);stop();unrelate();if(tip)tip.hidden=true;anchor=null;key='';}
  function staticDisplay(){
    if(!tip)return;
    if(key==='tools'){tip.querySelector('[data-live="expr"]')!.textContent='√144 =';tip.querySelector('[data-live="res"]')!.textContent='12';}
    if(key==='blog'&&data.posts.length){tip.querySelector('[data-live="btitle"]')!.textContent=data.posts[0];tip.querySelector('[data-live="bnum"]')!.textContent=`פוסט 1 מתוך ${data.posts.length}`;tip.querySelectorAll<HTMLElement>('[data-live="bar"]').forEach(el=>el.style.transform='none');}
  }
  function startLive(){
    stop();if(!tip||tip.hidden)return;if(blocked()){staticDisplay();return;}
    const p=tip,version=revision,q=(name:string)=>p.querySelector<HTMLElement>(`[data-live="${name}"]`),qa=(name:string)=>[...p.querySelectorAll<HTMLElement>(`[data-live="${name}"]`)];
    p.querySelectorAll('[data-ai="ring"]').forEach(el=>animate(el,[{transform:'rotate(0)'},{transform:'rotate(360deg)'}],{duration:2200,iterations:Infinity}));
    p.querySelectorAll('[data-ai="dot"]').forEach((el,i)=>animate(el,[{transform:'translateY(0)',opacity:.35},{transform:'translateY(-3px)',opacity:1},{transform:'translateY(0)',opacity:.35}],{duration:900,delay:i*150,iterations:Infinity,easing:'ease-in-out'}));
    p.querySelectorAll('[data-ai="type"]').forEach(el=>animate(el,[{clipPath:'inset(0 0 0 100%)'},{clipPath:'inset(0 0 0 0)',offset:.5},{clipPath:'inset(0 0 0 0)',offset:.85},{clipPath:'inset(0 0 0 100%)'}],{duration:3200,iterations:Infinity,easing:'steps(18, end)'}));
    if(key==='tools'){
      let si=0,ki=0;const ex=q('expr')!,rs=q('res')!;ex.textContent=rs.textContent='';
      const flash=(k:string)=>{const el=p.querySelector(`[data-key="${k}"]`);if(el)animate(el,[{transform:'scale(1)',background:'#f2c46b'},{transform:'scale(.88)',background:'#f2c46b',offset:.3},{transform:'scale(1)'}],{duration:300});};
      liveTimer=window.setInterval(()=>{if(blocked())return;const [ks,display,result]=CALCULATOR_PREVIEW[si];if(ki<ks.length){flash(ks[ki]);ki++;ex.textContent=display.slice(0,Math.ceil(display.length*ki/ks.length));rs.textContent='';}else if(ki===ks.length){flash('=');ex.textContent=display+' =';rs.textContent=result;animate(rs,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:250});ki++;}else if(ki<ks.length+4)ki++;else{flash('C');ex.textContent=rs.textContent='';ki=0;si=(si+1)%CALCULATOR_PREVIEW.length;}},330);
    }
    if(key==='ws'&&data.topics.length){
      let off=0;const rows=qa('row');
      const fill=()=>rows.forEach((row,i)=>{const topic=data.topics[(off+i)%data.topics.length];row.querySelector('[data-live="g"]')!.textContent=topic.grade;row.querySelector('[data-live="t"]')!.textContent=topic.title;});fill();
      liveTimer=window.setInterval(()=>{if(blocked())return;rows.forEach((row,i)=>{const a=animate(row,[{transform:'none',opacity:1},{transform:'translateY(-44px)',opacity:i?1:0}],{duration:380,easing:'cubic-bezier(.5,0,.3,1)'});if(a&&i===rows.length-1)a.onfinish=()=>{if(version!==revision||blocked())return;off++;fill();animate(row,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:260});};});},1700);
    }
    if(key==='about'){
      const u=q('uline'),logo=q('logo');if(u)animate(u,[{strokeDashoffset:1},{strokeDashoffset:0,offset:.35},{strokeDashoffset:0}],{duration:2600,iterations:Infinity,fill:'both',easing:'ease-out'});
      if(logo)animate(logo,[{transform:'rotate(0)'},{transform:'rotate(-7deg) translateY(-3px)',offset:.15},{transform:'rotate(5deg)',offset:.3},{transform:'rotate(0)',offset:.45},{transform:'rotate(0)'}],{duration:2600,iterations:Infinity,delay:200});
    }
    if(key==='blog'&&data.posts.length){
      const title=q('btitle')!,number=q('bnum')!,bars=qa('bar'),caret=q('caret')!;let ti=0,ci=0,hold=0;
      animate(caret,[{opacity:1},{opacity:0}],{duration:500,iterations:Infinity,direction:'alternate',easing:'steps(1)'});
      const reset=()=>{number.textContent=`פוסט ${ti+1} מתוך ${data.posts.length}`;title.textContent='';ci=0;hold=0;bars.forEach(b=>b.style.transform='scaleX(0)');};reset();
      liveTimer=window.setInterval(()=>{if(blocked())return;const text=data.posts[ti];if(ci<text.length){ci++;title.textContent=text.slice(0,ci);if(ci===text.length)bars.forEach((b,i)=>animate(b,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:400,delay:i*140,fill:'forwards',easing:'cubic-bezier(.3,1,.5,1)'}));}else if(++hold>28){ti=(ti+1)%data.posts.length;bars.forEach(b=>{b.getAnimations().forEach(a=>a.cancel());});reset();}},55);
    }
  }
  function ensure(){
    if(tip)return tip;tip=document.createElement('div');tip.id='exact-link-peek';tip.className='exact-link-peek';tip.dir='rtl';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
    // Hover persistence and Escape dismissal preserve accessibility even though
    // the non-interactive reference uses pointer-events:none.
    listen(tip,'pointerenter',()=>window.clearTimeout(hideTimer));listen(tip,'pointerleave',()=>{hideTimer=window.setTimeout(hide,120);});return tip;
  }
  function showFor(target:Element){
    window.clearTimeout(hideTimer);
    if(dismissed===target||anchor===target)return;const next=target.getAttribute('data-peek')||'';
    if(!resolveExactPeek(next,data)){hide();return;}
    hide();anchor=target;window.clearTimeout(hideTimer);
    showTimer=window.setTimeout(()=>{
      if(!target.isConnected||anchor!==target||document.hidden)return;
      const markup=renderExactPeek(next,data);if(!markup)return;key=next;const el=ensure();el.innerHTML=markup;el.hidden=false;
      const pos=exactPeekPosition(target.getBoundingClientRect(),innerWidth,innerHeight,!!target.querySelector('[data-genie]'));el.style.left=pos.x+'px';el.style.top=pos.y+'px';
      const ids=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!ids.includes(el.id))ids.push(el.id);target.setAttribute('aria-describedby',ids.join(' '));
      startLive();animate(el,[{opacity:0,transform:'translateY(-4px) scale(.97)'},{opacity:1,transform:'none'}],{duration:160,easing:'cubic-bezier(.16,1,.3,1)'});
      el.querySelectorAll('[data-pk]').forEach((b,i)=>animate(b,[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:220,delay:40+i*18,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'}));
    },220);
  }
  function targetOf(event:Event){return (event.target as Element|null)?.closest?.('[data-peek]')||null;}
  listen(document,'pointerover',event=>{if(!hover.matches||(event as PointerEvent).pointerType==='touch')return;const target=targetOf(event);if(target)showFor(target);}, {capture:true});
  listen(document,'focusin',event=>{const target=targetOf(event);if(target)showFor(target);}, {capture:true});
  const leave=(event:Event)=>{const target=targetOf(event),related=(event as FocusEvent).relatedTarget as Node|null;if(!target||related&&target.contains(related))return;if(event.type==='pointerout'&&document.activeElement&&target.contains(document.activeElement))return;if(dismissed===target)dismissed=null;if(tip&&related&&tip.contains(related))return;window.clearTimeout(showTimer);hideTimer=window.setTimeout(hide,120);};
  listen(document,'pointerout',leave,{capture:true});listen(document,'focusout',leave,{capture:true});
  listen(document,'keydown',event=>{if((event as KeyboardEvent).key==='Escape'){dismissed=anchor;hide();}});
  listen(window,'scroll',hide,{passive:true});listen(window,'resize',hide,{passive:true});
  listen(document,'visibilitychange',()=>{if(document.hidden)hide();else startLive();});
  listen(window,'nd:motion-off',event=>{const off=(event as CustomEvent).detail?.off;eventOff=typeof off==='boolean'?off:true;startLive();});
  const observer=new MutationObserver(startLive);observer.observe(html,{attributes:true,attributeFilter:['class','data-nd-motion','data-motion']});
  reduced.addEventListener('change',startLive);
  return ()=>{hide();observer.disconnect();reduced.removeEventListener('change',startLive);listeners.splice(0).forEach(remove=>remove());tip?.remove();};
}
