import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:1366,height:900});
await pg.goto(process.argv[2]+'/grade-9',{waitUntil:'networkidle0',timeout:90000});
console.log(await pg.evaluate(()=>{const out=[];document.querySelectorAll('a,h2,h3,li').forEach(e=>{const t=e.textContent.replace(/\s+/g,' ').trim();if(/דלתון|מקבילית|מלבן|מעוין|ריבוע|טרפז|מרובע/.test(t)&&t.length<120)out.push(e.tagName+' '+(e.getAttribute('href')||'')+' :: '+t)});return [...new Set(out)].join('\n')}));await b.close();
