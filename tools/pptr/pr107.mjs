import puppeteer from 'puppeteer-core';
const H=process.argv[2];const O=process.argv[3];const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const res={};
const desk={width:1366,height:900},ph={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
const info=pg=>pg.evaluate(()=>{const q=s=>document.querySelector(s);const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
 const card=q('.exact-topic-demo,.concept-loop__card,.ka-film');const a11y=q('#noam-accessibility');const panel=q('#noam-site-companion-panel');
 const ov=(x,y)=>x&&y&&x[0]<y[2]&&x[2]>y[0]&&x[1]<y[3]&&x[3]>y[1];const rc=R(card),ra=R(a11y),rp=R(panel);
 let vis=null;if(rc){const t=Math.max(rc[1],0),bt=Math.min(rc[3],innerHeight);const pt=rp&&panel.offsetParent?rp[1]:innerHeight;vis=[t,bt,pt]}
 return {answer:(q('#noam-site-companion-answer')||{}).textContent,primary:q('#noam-site-companion-primary')&&!q('#noam-site-companion-primary').hidden?q('#noam-site-companion-primary').textContent:null,
 chips:[...document.querySelectorAll('#noam-site-companion-chips a,#noam-site-companion-chips button')].map(e=>e.textContent.trim()+'|'+(e.getAttribute('href')||'')),
 input:(q('#noam-site-companion-input')||{}).value,active:document.activeElement&&document.activeElement.id,close:(q('#noam-site-companion-close')||{}).textContent,
 card:rc,a11y:ra,panel:rp,panelShown:!!(panel&&panel.offsetParent),a11yOnCard:ov(ra,rc),panelOnCard:ov(rp,rc),cardVis:vis,engaged:document.documentElement.classList.contains('noam-ai-engaged'),docW:document.documentElement.scrollWidth}});
for(const p of (process.argv[4]||'/kite-grade-9,/grade-9').split(','))for(const[n,vp]of[['desk',desk],['phone',ph]]){const tag=n+p.replace(/\//g,'_');const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const r=await pg.goto(H+p,{waitUntil:'networkidle0',timeout:90000});await S(2000);const out={status:r.status(),errs};
 const L=await pg.$('#noam-site-companion-launch');if(!L){out.err='no launcher';res[tag]=out;await pg.close();continue}
 await L.click();await S(1200);await pg.type('#noam-site-companion-input','יש מרובעים?');
 if(n==='desk')await pg.click('#noam-site-companion-form button[type=submit]').catch(async()=>{await pg.keyboard.press('Enter')});else await pg.keyboard.press('Enter');
 await S(600);out.inputRightAfter=await pg.$eval('#noam-site-companion-input',e=>e.value);
 await S(9000);out.after=await info(pg);await pg.screenshot({path:`${O}/${tag}-ask.png`});
 const cl=await pg.$('#noam-site-companion-close');if(cl){await cl.click();await S(1000);out.closed=await info(pg);await pg.screenshot({path:`${O}/${tag}-closed.png`})}
 out.errs=errs;res[tag]=out;await pg.close()}
console.log(JSON.stringify(res,null,1));await b.close();
