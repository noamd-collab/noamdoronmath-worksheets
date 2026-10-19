'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Exercise the shipped UMD loader too; the Astro public folder is ESM-scoped.
for(const file of ['noam-bot-client.js','headless/astro-poc/public/noam-bot-client.js']) {
  function fixture({scriptFails=false,denied=false,emptyToken=false}={}) {
    const scripts=[],actions=[],posts=[];
    const window={};
    const document={createElement:()=>({}),head:{appendChild(script){
      scripts.push(script);
      script.parentNode={removeChild(){}};
      queueMicrotask(()=>{
        if(scriptFails){script.onerror();return;}
        window.grecaptcha={ready(fn){queueMicrotask(()=>{
          window.grecaptcha.execute=async(key,options)=>{
            actions.push({key,action:options.action});
            return emptyToken?'':'token-'+actions.length;
          };
          fn();
        });}};
        script.onload();
      });
    }}};
    const sandbox={window,setTimeout,clearTimeout};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
    const api='https://api.example.test/_functions';
    const client=window.NoamBotClient.create({window,document,api,enabled:true,verificationTimeoutMs:300,
      fetch:async(url,options)=>{
        if(url.endsWith('/noamBotConfig'))return {ok:true,json:async()=>({ok:true,provider:'recaptcha-v3',mode:'enforce',siteKey:'public-site-key'})};
        posts.push(JSON.parse(options.body));
        return {ok:!denied,status:denied?403:200,json:async()=>denied?{ok:false,code:'BOT_REJECTED'}:{ok:true}};
      }});
    return {client,api,scripts,actions,posts};
  }
  test(file+': supported host, delayed ready, fixed actions and fresh single-use proofs',async()=>{
    const f=fixture();
    await f.client.postJson(f.api+'/noamImageSolve',{exerciseId:'test'});
    await f.client.postJson(f.api+'/noamDiagramPlan',{exerciseId:'test'});
    assert.equal(f.scripts.length,1);
    assert.equal(f.scripts[0].src,'https://www.recaptcha.net/recaptcha/api.js?render=public-site-key');
    assert.deepEqual(f.actions,[{key:'public-site-key',action:'noam_image_solve'},{key:'public-site-key',action:'noam_diagram_plan'}]);
    assert.deepEqual(f.posts.map(p=>p.botVerification),[{provider:'recaptcha-v3',token:'token-1'},{provider:'recaptcha-v3',token:'token-2'}]);
  });
  test(file+': failed Google script sends no AI request',async()=>{
    const f=fixture({scriptFails:true});
    await assert.rejects(f.client.postJson(f.api+'/noamImageSolve',{}),e=>e.code==='BOT_CLIENT_UNAVAILABLE');
    assert.equal(f.posts.length,0);assert.equal(f.actions.length,0);
  });
  test(file+': empty proof sends no AI request',async()=>{
    const f=fixture({emptyToken:true});
    await assert.rejects(f.client.postJson(f.api+'/noamImageSolve',{}),e=>e.code==='BOT_VERIFICATION_FAILED');
    assert.equal(f.posts.length,0);
  });
  test(file+': server denial is preserved without retry',async()=>{
    const f=fixture({denied:true});
    await assert.rejects(f.client.postJson(f.api+'/noamImageSolve',{}),e=>e.code==='BOT_REJECTED'&&e.status===403);
    assert.equal(f.posts.length,1);assert.equal(f.actions.length,1);
  });
}
