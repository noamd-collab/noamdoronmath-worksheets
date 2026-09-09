'use strict';
// Acceptance tests use the real published HTML and physical key clicks.
// Expectations describe the supplied hardware photographs, not serialized strings.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const buildDir=fs.mkdtempSync(path.join(os.tmpdir(),'casio-training-'));
execFileSync(process.execPath,[path.join(__dirname,'build.cjs'),buildDir]);
const html=fs.readFileSync(path.join(buildDir,'index.html'),'utf8');
test.after(()=>fs.rmSync(buildDir,{recursive:true,force:true}));

async function training(name,run){
 return test(name,async()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://calculator.test/',pretendToBeVisual:true});
  try{
   if(dom.window.document.readyState==='loading')await new Promise(resolve=>dom.window.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
   const doc=dom.window.document,device=dom.window.casioDevice;
   assert.ok(device,'The published bundle must initialize');
   const press=(...keys)=>{for(const key of keys){const button=doc.querySelector('[data-key="'+key+'"]');assert.ok(button,'Physical key '+key);button.click();assert.equal(device.error,null,'No calculator error after '+key);}};
   const caret=()=>doc.querySelector('#lcd-expression [data-caret]');
   const visibleResult=()=>{const result=doc.querySelector('#lcd-result');return !result.hidden&&dom.window.getComputedStyle(result).visibility!=='hidden'&&dom.window.getComputedStyle(result).display!=='none';};
   await run({doc,device,press,caret,visibleResult});
  }finally{dom.window.casioDevice?.destroy();dom.window.close();}
 });
}

training('photographed 3/2: one RIGHT exits denominator, without invented parentheses',({doc,device,press,caret,visibleResult})=>{
 assert.equal(visibleResult(),false,'Cleared LCD has no phantom result zero');
 press('fraction','3','right','2');
 assert.ok(caret()?.closest('mfrac'),'Caret starts in denominator');
 assert.equal(visibleResult(),false,'Only the expression appears during entry');
 press('right');
 assert.ok(caret(),'Caret remains visible');
 assert.equal(caret().closest('mfrac'),null,'RIGHT moves visibly outside fraction');
 assert.equal(Array.from(doc.querySelectorAll('#lcd-expression mo')).some(e=>['(',')'].includes(e.textContent)),false,'Generated wrappers are never shown');
 press('add','1','equals');
 assert.equal(device.state.last,2.5,'The next addition applies to the complete fraction');
 assert.equal(visibleResult(),true);
 press('ac');assert.equal(visibleResult(),false);
});

training('LEFT re-enters the completed denominator for editing',({device,press,caret})=>{
 press('fraction','3','right','2','right','left');
 assert.ok(caret()?.closest('mfrac'));
 press('0','equals');assert.equal(device.state.last,.15,'Denominator becomes20, not an outside zero');
});

training('nested fractions leave one structural level per RIGHT',({device,press,caret})=>{
 press('fraction','1','right','2','fraction','3');
 assert.ok(caret()?.closest('mfrac')?.parentElement.closest('mfrac'),'Initially inside nested denominator');
 press('right');
 assert.ok(caret()?.closest('mfrac'),'Still inside outer denominator');
 assert.equal(caret().closest('mfrac').parentElement.closest('mfrac'),null);
 press('right');assert.equal(caret().closest('mfrac'),null);
 press('add','1','equals');assert.equal(device.state.last,2.5);
});

training('explicitly entered grouping remains visible inside a fraction',({doc,device,press})=>{
 press('fraction','lparen','1','add','2','rparen','right','3','equals');
 assert.equal(device.state.last,1);
 const numerator=doc.querySelector('#lcd-expression mfrac')?.firstElementChild;
 assert.ok(numerator,'Natural numerator rendered');
 assert.ok(numerator.textContent.includes('(')&&numerator.textContent.includes(')'), 'Intentional grouping is preserved');
});

training('RIGHT exits a root and a power before a following addition',({device,press,caret})=>{
 press('sqrt','9','right');assert.equal(caret()?.closest('msqrt'),null);
 press('add','1','equals');assert.equal(device.state.last,4);
 press('ac','2','power','3','right');assert.equal(caret()?.closest('msup'),null);
 press('add','1','equals');assert.equal(device.state.last,9);
});

training('completed fraction remains visually stable when calculation and editing alternate',({doc,device,press,caret,visibleResult})=>{
 press('fraction','3','right','2','right','equals');assert.equal(device.state.last,1.5);
 assert.equal(doc.querySelector('#lcd-expression mfrac')?.textContent,'32');
 press('left');assert.equal(visibleResult(),false);
 assert.equal(caret()?.closest('mfrac'),null,'First replay LEFT resumes at the completed expression end');
 press('left');
 assert.ok(caret()?.closest('mfrac'));
 press('del','4','equals');assert.equal(device.state.last,.75);
});

training('actual shell exposes fifty distinct physical keys and structured mathematical labels',({doc})=>{
 const keys=Array.from(doc.querySelectorAll('[data-key]'));
 assert.equal(keys.length,50);assert.equal(new Set(keys.map(e=>e.dataset.key)).size,50);
 for(const key of ['fraction','integral','logbase','power','sd'])assert.ok(doc.querySelector('[data-key="'+key+'"] svg'),'Drawn physical mathematical label for '+key);
 assert.equal(doc.querySelectorAll('script[src],link[rel="stylesheet"]').length,0);
});

training('manual fraction examples work with both preceding numerator and DOWN entry',({device,press})=>{
 press('2','fraction','3','right','add','1','fraction','2','equals');
 assert.ok(Math.abs(device.state.last-7/6)<1e-12);
 press('ac','fraction','2','down','3','right','add','fraction','1','down','2','equals');
 assert.ok(Math.abs(device.state.last-7/6)<1e-12);
});

training('manual nested-root example stops inside numerator before advancing to denominator',({doc,device,press,caret})=>{
 press('fraction','2','add','sqrt','2','right');
 assert.equal(caret()?.closest('msqrt'),null);
 const fraction=doc.querySelector('#lcd-expression mfrac');
 assert.ok(fraction?.firstElementChild.contains(caret()),'First RIGHT remains in numerator');
 press('right');
 assert.ok(doc.querySelector('#lcd-expression mfrac')?.lastElementChild.contains(caret()),'Second RIGHT enters denominator');
 press('1','add','sqrt','2','equals');
 assert.ok(Math.abs(device.state.last-Math.SQRT2)<1e-12);
});

training('manual replay edit begins at expression end and gives5',({device,press})=>{
 press('4','mul','3','add','2','equals','left','del','del','sub','7','equals');
 assert.equal(device.state.last,5);
});

training('manual Natural INS captures the fraction to the right as a root argument',({doc,device,press})=>{
 press('1','add','7','fraction','6','left','left','left','left','shift','del','sqrt');
 assert.ok(doc.querySelector('#lcd-expression msqrt mfrac'),'The root contains the entire fraction');
 press('equals');assert.ok(Math.abs(device.state.last-(1+Math.sqrt(7/6)))<1e-12);
});

training('vertical movement in a filled fraction never replaces it with calculation history',({doc,device,press,caret})=>{
 press('8','add','1','equals','ac','3','fraction','2','up');
 assert.ok(doc.querySelector('#lcd-expression mfrac')?.firstElementChild.contains(caret()));
 press('down','0','equals');assert.equal(device.state.last,.15);
});

training('empty root deletes atomically without leaving implementation text',({doc,device,press})=>{
 press('sqrt','del');assert.equal(doc.querySelector('#lcd-expression msqrt'),null);
 press('2','equals');assert.equal(device.state.last,2);
});

training('manual repeated immediate square does not add a second exponent',({device,press})=>{
 press('2','square','square','equals');assert.equal(device.state.last,4);
});

training('original silver PLUS selects MthIO directly from SETUP',({device,press})=>{
 press('shift','mode','2');assert.equal(device.state.display,'line');
 press('shift','mode','1');assert.equal(device.menu,null);assert.equal(device.state.display,'math');
});
