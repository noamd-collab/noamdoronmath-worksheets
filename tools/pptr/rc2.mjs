import puppeteer from 'puppeteer-core';
const U='https://mtolhq-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/kite-grade-9';
const O=(process.env.OUT_DIR||'./out/'); const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const meas=pg=>pg.evaluate(()=>{const c=document.querySelector('[data-loop="kite-construct"]');const svg=c.querySelector('svg');
 const P=(e,x,y)=>{const m=svg.getScreenCTM().inverse().multiply(e.getScreenCTM());return [m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]};
 const seg=n=>{const e=c.querySelector(`[data-el="${n}"]`);return [P(e,+e.getAttribute('x1'),+e.getAttribute('y1')),P(e,+e.getAttribute('x2'),+e.getAttribute('y2'))]};
 const map={'tick-ac':'sa1','tick-ad':'sa2','tick-bc':'sb1','tick-bd':'sb2'};const out={};
 for(const[t,s] of Object.entries(map)){const g=c.querySelector(`[data-el="${t}"]`);if(!g){out[t]='missing';continue}
  const [a,bb]=seg(s);const mid=[(a[0]+bb[0])/2,(a[1]+bb[1])/2];
  const res=[...g.querySelectorAll('line')].map(l=>{const p=P(l,+l.getAttribute('x1'),+l.getAttribute('y1')),q=P(l,+l.getAttribute('x2'),+l.getAttribute('y2'));const m=[(p[0]+q[0])/2,(p[1]+q[1])/2];
   const dx=bb[0]-a[0],dy=bb[1]-a[1],L=Math.hypot(dx,dy);const perp=Math.abs(dx*(m[1]-a[1])-dy*(m[0]-a[0]))/L;const along=Math.hypot(m[0]-mid[0],m[1]-mid[1]);
   const cross=Math.abs(((q[0]-p[0])*dx+(q[1]-p[1])*dy)/(Math.hypot(q[0]-p[0],q[1]-p[1])*L));return [+perp.toFixed(2),+along.toFixed(1),+cross.toFixed(2)]});
  out[t]={seg:[a.map(v=>+v.toFixed(1)),bb.map(v=>+v.toFixed(1))],op:getComputedStyle(g.parentNode).opacity,lines:res}}
 const t=c.querySelector('.concept-loop__toggle');out.toggle=t&&{disp:getComputedStyle(t).display,aria:t.getAttribute('aria-label'),pressed:t.getAttribute('aria-pressed'),w:t.getBoundingClientRect().width};
 out.docW=document.documentElement.scrollWidth;return out});
const res={};
async function run(name,vp,o={}){const pg=await b.newPage();await pg.setViewport(vp);
 if(o.nojs)await pg.setJavaScriptEnabled(false);
 if(o.rm)await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await pg.goto(U,{waitUntil:'networkidle0',timeout:90000});await S(1000);
 if(o.full)await pg.screenshot({path:O+name+'-full.png',fullPage:true});
 const c=await pg.$('[data-loop="kite-construct"]');await c.scrollIntoView();
 if(o.waitEnd){ // capture frames until chip-dart visible & ticks visible
  for(let i=0;i<30;i++){await S(500);const ok=await pg.evaluate(()=>{const e=document.querySelector('[data-loop="kite-construct"] [data-el="refl-lbl"]');return +getComputedStyle(e).opacity>0.95});if(ok)break}
  await S(300);
 } else await S(800);
 await c.screenshot({path:O+name+'-card.png'});
 if(!o.nojs){res[name]=await meas(pg);
  if(o.toggle){await pg.click('[data-loop="kite-construct"] .concept-loop__toggle');await S(300);res[name].afterClick=await pg.evaluate(()=>{const t=document.querySelector('[data-loop="kite-construct"] .concept-loop__toggle');return [t.getAttribute('aria-label'),t.getAttribute('aria-pressed')]})}}
 else res[name]=await pg.evaluate(()=>{const t=document.querySelector('[data-loop="kite-construct"] .concept-loop__toggle');return {toggleDisp:t&&getComputedStyle(t).display}});
 await pg.close()}
const ph={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
await run('phone-rm',ph,{rm:true});
await run('desk-rm',{width:1366,height:900},{rm:true});
await run('phone-end',ph,{waitEnd:true,full:true,toggle:true});
await run('desk-end',{width:1366,height:900},{waitEnd:true,full:true});
await run('phone-nojs',ph,{nojs:true});
for(const p of ['rhombus-grade-9','trapezoid-grade-9']){const pg=await b.newPage();await pg.setViewport(ph);const r=await pg.goto(U.replace('kite-grade-9',p),{waitUntil:'networkidle0',timeout:90000});await S(1500);await pg.screenshot({path:O+'reg-'+p+'.png'});res['reg-'+p]=r.status();await pg.close()}
console.log(JSON.stringify(res));await b.close();
