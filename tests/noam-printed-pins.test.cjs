const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const section=s=>s.slice(s.indexOf('var noamPrintedPinPages ='),s.indexOf('var noamNarrowPinsMedia ='));
const fixtures=require('./fixtures/printed-pins.json');
function load(){const ctx={};vm.runInNewContext(section(read('worksheet-viewer-noam.html')),ctx);return ctx;}
function resolve(f,items=f.items){return load().noamResolvePrintedPins(f.exercises,items,{width:f.width,height:f.height,convertToViewportPoint(x,y){return [x,f.height-y];}},f.page);}
test('real PDF markers align across trapezoid, kite, functions and existing maps',()=>{
 for(const f of fixtures){const pins=resolve(f);assert.equal(Object.keys(pins).length,f.exercises.length,f.pdfHash);}
 const f=fixtures[0],pins=resolve(f);
 assert.ok(Math.abs(pins['G9-T39-A-Q14א'].y-.374925)<.00001);
 assert.ok(Math.abs(pins['G9-T39-A-Q14ב'].y-.444462)<.00001);
 assert.ok(Math.abs(pins['G9-T39-A-Q14ג'].y-.545822)<.00001);
 assert.ok(f.exercises.find(e=>e.part==='ג'&&e.q===14).pin.y-pins['G9-T39-A-Q14ג'].y>.18);
});
test('missing, duplicate or out-of-order printed markers never shift the wrong question',()=>{
 const f=fixtures[0];
 assert.equal(Object.keys(resolve(f,[])).length,0);
 assert.equal(Object.keys(resolve(f,f.items.filter(i=>i.str!=='א.'))).length,0);
 const a=f.items.find(i=>i.str==='א.');
 assert.equal(Object.keys(resolve(f,[...f.items,a])).length,0);
 const swapped=f.items.map(i=>({...i,str:i.str==='א.'?'ה.':i.str}));
 assert.equal(Object.keys(resolve(f,swapped)).length,0);
});
test('normalized anchors remain aligned at different display scales',()=>{
 const f=fixtures[0],pin=resolve(f)['G9-T39-A-Q14א'];
 for(const height of [400,842,1684])assert.ok(Math.abs(pin.y*height-.374925*height)<.02);
});
test('both viewers use identical resolver and refresh after PDF text arrives',()=>{
 const a=read('worksheet-viewer-noam.html'),b=read('headless/astro-poc/public/worksheet-viewer-noam.html');
 assert.equal(section(a),section(b));
 for(const s of [a,b]){assert.match(s,/noamReadPrintedPinPage\(pageNumber,page\);\s*return renderTask.promise/);assert.match(s,/var pin = noamPrintedPin\(exercise\)/);}
});
test('text failure preserves the existing map and a late manifest resolves cached text',async()=>{
 const f=fixtures[0],ctx=load();ctx.manifestReady=false;ctx.renderManifestPins=()=>{};
 const page={getTextContent:()=>Promise.resolve({items:f.items}),getViewport:()=>({width:f.width,height:f.height,convertToViewportPoint(x,y){return[x,f.height-y];}})};
 ctx.noamReadPrintedPinPage(f.page,page);await Promise.resolve();
 ctx.manifestReady=true;ctx.manifest={exercises:f.exercises};
 assert.ok(ctx.noamPrintedPin(f.exercises[3]).y<.4);
 ctx.noamReadPrintedPinPage(9,{getTextContent:()=>Promise.reject(new Error('no text'))});await Promise.resolve();await Promise.resolve();
 const e={id:'unknown',pin:{page:9,x:.8,y:.5}};assert.equal(ctx.noamPrintedPin(e),e.pin);
});
