import { runVisualCompilerInNewContext } from './helpers/visual-compiler-vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const source=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
const helper='function noamAddDiagramExpansion'+source.split('function noamAddDiagramExpansion')[1].split('function noamDiagramRuntime')[0];
it('zooms only a copy, bounds the scale, resets, closes and restores focus without a request',()=>{
 const {document,window}=parseHTML('<html><body><div id="row"><figure class="noam-geometry"><svg class="noam-geometry-svg" viewBox="0 0 320 224"><text>A</text></svg><span class="noam-term">זווית</span></figure></div></body></html>');
 const create=document.createElement.bind(document);
 document.createElement=(name:string)=>{const el=create(name);if(name==='dialog'){el.showModal=()=>el.setAttribute('open','');el.close=()=>el.dispatchEvent(new window.Event('close'));}return el;};
 const row=document.getElementById('row')!,figure=row.querySelector('figure')!;
 runVisualCompilerInNewContext(helper+';noamAddDiagramExpansion(row,figure);',{document,window,row,figure});
 const before=figure.outerHTML;
 const trigger=row.querySelector('button')!;let focused=false;trigger.focus=()=>{focused=true;};trigger.click();
 const dialog=document.querySelector('dialog')!,zoom=dialog.querySelector('.noam-diagram-zoom')!;
 const [minus,plus,fit]=zoom.querySelectorAll('button');
 assert.equal(dialog.querySelectorAll('.noam-term').length,0);
 assert.equal(minus.disabled,true);
 plus.click();assert.equal(dialog.querySelector('output')!.textContent,'125%');
 for(let i=0;i<10;i++)plus.click();
 assert.equal(dialog.querySelector('output')!.textContent,'250%');assert.equal(plus.disabled,true);
 assert.equal(dialog.querySelector('.noam-diagram-canvas')!.style.width,'250%');
 minus.click();assert.equal(dialog.querySelector('output')!.textContent,'225%');
 fit.click();assert.equal(dialog.querySelector('output')!.textContent,'100%');
 assert.equal(figure.outerHTML,before,'the inline drawing must be unchanged');
 dialog.querySelector('.noam-diagram-dialog-close')!.click();
 assert.equal(document.querySelector('dialog'),null);assert.equal(focused,true);
 trigger.click();assert.equal(document.querySelector('output')!.textContent,'100%');
});

it('fits a tall source figure to the available height as well as width and refits on load or resize',()=>{
 const {document,window}=parseHTML('<html><body><div id="row"><figure class="noam-geometry noam-native-figure"><img class="noam-geometry-svg" src="/graph.svg"><figcaption>גרף המקור</figcaption></figure></div></body></html>');
 const create=document.createElement.bind(document);
 let availableHeight=600;
 document.createElement=(name:string)=>{
  const el=create(name);
  if(name==='dialog'){
   el.showModal=()=>{
    el.setAttribute('open','');
    const content=el.querySelector('.noam-diagram-dialog-content')!;
    const image=el.querySelector('img')!;
    const renderedHeight=()=>1000*parseFloat(el.querySelector('.noam-diagram-canvas')!.style.width)/100;
    image.getBoundingClientRect=()=>({height:renderedHeight()});
    Object.defineProperty(content,'clientHeight',{get:()=>availableHeight});
    Object.defineProperty(content,'scrollHeight',{get:()=>Math.max(availableHeight,renderedHeight()+100)});
   };
   el.close=()=>el.dispatchEvent(new window.Event('close'));
  }
  return el;
 };
 const row=document.getElementById('row')!,figure=row.querySelector('figure')!;
 runVisualCompilerInNewContext(helper+';noamAddDiagramExpansion(row,figure);',{document,window,row,figure});
 row.querySelector('button')!.click();
 const dialog=document.querySelector('dialog')!;
 const [minus,plus,fit]=dialog.querySelectorAll('.noam-diagram-zoom button');
 assert.equal(dialog.querySelector('output')!.textContent,'50%');
 assert.equal(minus.disabled,true);
 assert.ok(dialog.querySelector('img')!.getBoundingClientRect().height+100<=availableHeight);
 plus.click();assert.equal(dialog.querySelector('output')!.textContent,'75%');
 fit.click();assert.equal(dialog.querySelector('output')!.textContent,'50%');
 availableHeight=400;window.dispatchEvent(new window.Event('resize'));
 assert.equal(dialog.querySelector('output')!.textContent,'30%');
 availableHeight=700;dialog.querySelector('img')!.dispatchEvent(new window.Event('load'));
 assert.equal(dialog.querySelector('output')!.textContent,'60%');
 // Vertical gestures over a zoomed image can reach the outer dialog scroller.
 assert.match(source,/\.noam-diagram-viewport\{[^}]*overscroll-behavior-y:auto/);
 dialog.querySelector('.noam-diagram-dialog-close')!.click();
 window.dispatchEvent(new window.Event('resize'));
 assert.equal(document.querySelector('dialog'),null);
});
