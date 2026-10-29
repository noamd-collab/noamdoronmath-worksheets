import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

it('OS reduce alone keeps a concept loop moving; the site reduce choice parks it and resumes when cleared', async () => {
  const {document,window}=parseHTML('<html><body><div data-loop="para-rect"><button data-el="toggle"></button></div></body></html>');
  let reduce=true, change:()=>void=()=>{};
  window.matchMedia=()=>({get matches(){return reduce;},addEventListener(_event:string,fn:()=>void){change=fn;}}) as any;
  Object.assign(globalThis,{document,window,MutationObserver:window.MutationObserver,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}});
  const {initConceptLoops}=await import('../src/lib/conceptLoops');
  initConceptLoops();
  const root=document.querySelector('[data-loop]') as any;
  assert.equal(root.__loop.state().static,false,'Safari/macOS reduce motion alone must not freeze lessons');
  document.documentElement.classList.add('noam-a11y-motion'); change();
  await Promise.resolve();
  assert.equal(root.__loop.state().static,true);
  assert.equal(root.__loop.state().playing,false);
  document.documentElement.classList.remove('noam-a11y-motion'); reduce=false; change();
  await Promise.resolve();
  assert.equal(root.__loop.state().static,false);
});


it('site opt-in resumes an in-view loop while the OS still requests reduced motion; stop still wins', async () => {
  const {document,window}=parseHTML('<html><body><div data-loop="para-rect"><button data-el="toggle"></button></div></body></html>');
  window.matchMedia=()=>({matches:true,addEventListener(){}}) as any;
  const pending=new Map<number,FrameRequestCallback>();
  let next=0;
  class InViewObserver {
    constructor(private callback: (entries: {isIntersecting:boolean}[])=>void) {}
    observe(){ this.callback([{isIntersecting:true}]); }
  }
  Object.assign(globalThis,{document,window,MutationObserver:window.MutationObserver,
    IntersectionObserver:InViewObserver,
    requestAnimationFrame:(cb:FrameRequestCallback)=>{pending.set(++next,cb);return next;},
    cancelAnimationFrame:(id:number)=>pending.delete(id)});
  window.IntersectionObserver=InViewObserver as any;
  const {initConceptLoops}=await import('../src/lib/conceptLoops');
  initConceptLoops();
  const root=document.querySelector('[data-loop]') as any;
  const button=root.querySelector('[data-el="toggle"]') as HTMLButtonElement;
  assert.equal(root.__loop.state().static,false,'OS reduce alone does not park the loop');
  document.documentElement.classList.add('nd-motion-enabled');
  await Promise.resolve();
  assert.equal(root.__loop.state().static,false);
  assert.equal(root.__loop.state().playing,true);
  assert.notEqual(button.style.display,'none');
  button.click();
  assert.equal(root.__loop.state().playing,false,'manual pause remains available');
  button.click();
  assert.equal(root.__loop.state().playing,true,'manual play works while OS reduce is still true');
  document.documentElement.classList.add('nd-motion-off');
  await Promise.resolve();
  assert.equal(root.__loop.state().static,true,'an explicit stop beats opt-in');
  assert.equal(root.__loop.state().playing,false);
  assert.equal(pending.size,0,'the stopped loop leaves no animation frame pending');
  document.documentElement.classList.remove('nd-motion-off');
  await Promise.resolve();
  assert.equal(root.__loop.state().playing,true);
  button.click();
  assert.equal(root.__loop.state().playing,false);
  document.documentElement.classList.add('nd-motion-off');
  await Promise.resolve();
  document.documentElement.classList.remove('nd-motion-off');
  await Promise.resolve();
  assert.equal(root.__loop.state().playing,false,'a manual pause survives policy stop and resume');
  document.documentElement.classList.remove('nd-motion-enabled');
  await Promise.resolve();
  assert.equal(root.__loop.state().static,false,'the device preference alone does not park the loop');
});
