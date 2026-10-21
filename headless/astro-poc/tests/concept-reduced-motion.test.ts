import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

it('parks an ordinary concept loop when reduced motion changes, and resumes when disabled', async () => {
  const {document,window}=parseHTML('<html><body><div data-loop="para-rect"><button data-el="toggle"></button></div></body></html>');
  let reduce=true, change:()=>void=()=>{};
  window.matchMedia=()=>({get matches(){return reduce;},addEventListener(_event:string,fn:()=>void){change=fn;}}) as any;
  Object.assign(globalThis,{document,window,MutationObserver:window.MutationObserver,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}});
  const {initConceptLoops}=await import('../src/lib/conceptLoops');
  initConceptLoops();
  const root=document.querySelector('[data-loop]') as any;
  assert.equal(root.__loop.state().static,true);
  assert.equal(root.__loop.state().playing,false);
  reduce=false; change();
  assert.equal(root.__loop.state().static,false);
  reduce=true; change();
  assert.equal(root.__loop.state().static,true);
  assert.equal(root.__loop.state().playing,false);
});
