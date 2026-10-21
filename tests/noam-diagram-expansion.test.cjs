'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('../headless/astro-poc/node_modules/linkedom');
for(const file of ['worksheet-viewer-noam.html','headless/astro-poc/public/worksheet-viewer-noam.html']){
  test(file+': expansion preserves the original SVG, closes and restores focus without network/storage',()=>{
    const html=fs.readFileSync(file,'utf8');
    const fn=html.slice(html.indexOf('function noamAddDiagramExpansion('),html.indexOf('function noamDiagramRuntime('));
    const {document,window}=parseHTML('<html><body><div id="bubble"><figure><svg viewBox="0 0 320 224"><path d="M0 0L5 5"/></svg><p><button class="noam-term">זווית</button></p></figure></div></body></html>');
    const figure=document.querySelector('figure'),original=figure.outerHTML;
    let opened=0,focus=null;
    const create=document.createElement.bind(document);
    document.createElement=tag=>{
      const el=create(tag);
      el.focus=()=>{focus=el;};
      if(tag==='dialog'){
        el.showModal=()=>{opened++;el.setAttribute('open','');};
        el.close=()=>{el.removeAttribute('open');el.dispatchEvent(new window.Event('close'));};
      }
      return el;
    };
    const context=vm.createContext({document,window:{
      addEventListener:window.addEventListener.bind(window),
      removeEventListener:window.removeEventListener.bind(window)
    }}); // resize events only; no fetch, storage or model available
    vm.runInContext(fn,context);
    context.noamAddDiagramExpansion(document.querySelector('#bubble'),figure);
    const button=document.querySelector('.noam-diagram-expand');
    assert.equal(button.getAttribute('aria-haspopup'),'dialog');
    for(let i=0;i<2;i++){
      button.click();
      const dialog=document.querySelector('dialog');
      assert.ok(dialog.hasAttribute('open'));
      assert.equal(dialog.querySelector('svg').outerHTML,figure.querySelector('svg').outerHTML);
      assert.equal(figure.outerHTML,original);
      assert.equal(dialog.querySelectorAll('.noam-term').length,0);
      assert.match(dialog.textContent,/זווית/);
      assert.equal(dialog.querySelector('.noam-diagram-dialog-content').getAttribute('tabindex'),'0');
      dialog.querySelector('.noam-diagram-dialog-close').click();
      assert.equal(document.querySelector('dialog'),null);
      assert.equal(focus,button);
    }
    assert.equal(opened,2);
    assert.match(html,/noamAddDiagramExpansion\(bubble,visualElement\)/);
  });
}
