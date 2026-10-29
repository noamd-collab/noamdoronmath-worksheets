'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
for(const file of ['headless/astro-poc/public/worksheet-viewer-noam.html']) {
  test(file+': first tap finds a rebuilt pin even before decoration catches up',()=>{
    const html=fs.readFileSync(file,'utf8');
    const callback=html.match(/hit.addEventListener\('click',function\(event\)\{([\s\S]*?)\n            \}\);/)[1];
    let opened=0, ai=0;
    const current={dataset:{exerciseIds:'q7a q7b'},isConnected:true,click(){opened++;}};
    const ctx={hit:{dataset:{exerciseId:'q7b'},_exactPin:{isConnected:false}},page:{querySelectorAll(){return [current];}},setAiMode(){ai++;},event:{detail:1,preventDefault(){},stopPropagation(){}}};
    vm.runInNewContext('(function(){'+callback+'})()',ctx);
    assert.equal(opened,1); assert.equal(ai,1);
    ctx.hit.dataset.exactDrag='1';
    vm.runInNewContext('(function(){'+callback+'})()',ctx);
    assert.equal(opened,1,'a swipe must not activate a question');
  });
}
