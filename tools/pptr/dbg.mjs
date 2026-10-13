import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.goto('https://sgkbqz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/kite-grade-9',{waitUntil:'networkidle0'});
console.log(pg.url(),await pg.evaluate(()=>[document.querySelectorAll('[data-loop]').length,document.title,document.body.innerText.slice(0,200)]));await b.close();
