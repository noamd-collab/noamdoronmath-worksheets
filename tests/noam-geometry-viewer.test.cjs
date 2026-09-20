"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const Geometry=require("../noam-geometry.js");
const Guides=require("../noam-geometry-guides.js");
const html=fs.readFileSync(path.join(__dirname,"../worksheet-viewer-noam.html"),"utf8");
const helpers=html.slice(html.indexOf("function noamGeometryContext(text){"),html.indexOf("function postJson(endpoint,payload){"));
const local=html.slice(html.indexOf("function tryNoamLocalVisual(studentMessage){"),html.indexOf("function insertNoamMath(kind){"));
const manifest=require("../noam-ai/manifests/7a9d853a35664317b4f3ecf2156acf5f.json");
const exercise=manifest.exercises.find(e=>e.id==="G9-T19-E-Q06א");
function fixture(thread={hintIndex:0,messages:[],history:[]}){
  const ctx={window:{NoamGeometry:Geometry,NoamGeometryGuides:Guides,NoamLocalVisual:{
    wantsDrawing:()=>true,parseFactoredQuadraticInequality:()=>null
  }},manifest,selectedExercise:exercise,busy:false,noamDrafts:{},
  currentAttachments:()=>[],exerciseThread:()=>thread,
  saveNoamState(){},renderNoamChat(){},announceNoam(){},exerciseLabel:()=>"שאלה 6",
  ttl:"המעוין",localVisualExerciseSource:()=>exercise.geometrySource,postJson(){throw new Error("Drawing must not call AI");},
  document:{createElement:element,createElementNS:(_ns,name)=>element(name)}};
  vm.createContext(ctx);vm.runInContext(helpers+local,ctx);return ctx;
}
function element(name){return {name,children:[],attributes:{},textContent:"",appendChild(n){this.children.push(n);},setAttribute(k,v){this.attributes[k]=String(v);}};}
function scene(spec){return Guides.resolve(exercise,spec.options);}

test("the exact current live PDF source supports constructed graphics",()=>{
  assert.equal(exercise.geometrySourcePdfSha256,manifest.sourceSha256);
  const c=fixture();
  const visual=c.noamConstructedVisual(exercise,{answer:"מחשבים EO = AO - AE וגם OF = CO - CF."});
  assert.equal(visual.type,"geometry-guide");
  assert.equal(scene(visual).key,"q6-subtraction");
  assert.ok(c.noamRenderGeometryGuide(visual));
  assert.equal(Object.hasOwn(visual,"points"),false);
});

test("clicking an old answer uses its own hint, never the latest question",()=>{
  const first={role:"assistant",text:"אלכסוני המעוין חוצים זה את זה, לכן AO = OC."};
  const thread={hintIndex:3,history:[],messages:[
    {role:"user",text:"אפשר רמז 1?",kind:"רמז 1"},first,
    {role:"user",text:"הדגם BD מאונך ל-EF"},
    {role:"assistant",text:"BD מאונך ל-EF."}
  ]};
  const c=fixture(thread),visual=c.noamManualVisual(exercise,thread,first);
  assert.equal(scene(visual).key,"q6-halves");
  assert.equal(visual.options.hintIndex,0);
  assert.equal(visual.options.studentMessage,"אפשר רמז 1?");
  assert.equal(scene(visual).rightAngles.length,0);
});

test("a source replaced under the same exercise ID cannot reuse a saved graphic",()=>{
  const c=fixture(),spec=c.noamConstructedVisual(exercise,{answer:"AO = OC"});
  c.manifest={exercises:[{id:exercise.id,text:"חשבו שטח מעוין לפי אורך הצלע"}]};
  assert.equal(c.noamRenderGeometryGuide(spec),null);
  c.manifest={exercises:[]};
  assert.equal(c.noamRenderGeometryGuide(spec),null);
});

test("a typed draw request gives a local SVG and preserves its context on repeat",()=>{
  const thread={hintIndex:1,history:[],messages:[{role:"user",text:"אפשר רמז?",kind:"רמז 1"},
    {role:"assistant",text:"כתבו את ההפרשים EO = AO - AE וגם OF = CO - CF."}]};
  const c=fixture(thread);
  assert.equal(c.tryNoamLocalVisual("הדגם באמצעות שרטוט"),true);
  let reply=thread.messages.at(-1);
  assert.equal(scene(reply.visual).key,"q6-subtraction");
  assert.equal(scene(reply.visual).equalGroups.length,1);
  assert.equal(c.tryNoamLocalVisual("אפשר שוב להראות בשרטוט?"),true);
  reply=thread.messages.at(-1);
  assert.equal(scene(reply.visual).key,"q6-subtraction");
  assert.equal(thread.hintIndex,1);
  assert.doesNotMatch(thread.history.at(-1).content,/פרבולה/);
});

test("a new named drawing request takes precedence over the earlier hint",()=>{
  const thread={hintIndex:1,history:[],messages:[{role:"user",text:"אפשר רמז 1?",kind:"רמז 1"},
    {role:"assistant",text:"בדקו את חצאי האלכסון AO ו-OC."}]};
  const c=fixture(thread);
  assert.equal(c.tryNoamLocalVisual("הדגם באמצעות שרטוט את EO ואת OF"),true);
  const visual=thread.messages.at(-1).visual;
  assert.equal(scene(visual).key,"q6-remainders");
  assert.equal(scene(visual).equalGroups.length,0);
});

test("attachments and unsupported source versions continue through normal AI flow",()=>{
  const c=fixture();c.currentAttachments=()=>[{}];
  assert.equal(c.tryNoamLocalVisual("הדגם באמצעות שרטוט"),false);
  c.currentAttachments=()=>[];c.selectedExercise={id:exercise.id,text:"שאלה אחרת"};
  assert.equal(c.tryNoamLocalVisual("הדגם באמצעות שרטוט"),false);
});

test("saved original-image replies offer the new constructed drawing without repeating a hint",()=>{
  const answer={role:"assistant",text:"AO = OC כי אלכסוני המעוין חוצים זה את זה.",visual:{type:"question-image",exerciseId:exercise.id}};
  const thread={hintIndex:1,history:[],messages:[{role:"user",text:"אפשר רמז 1?",kind:"רמז 1"},answer]};
  const c=fixture(thread);
  assert.equal(c.noamCanOfferDrawing(exercise,thread,answer),true);
  answer.visual=c.noamManualVisual(exercise,thread,answer);
  assert.equal(answer.visual.type,"geometry-guide");
  assert.equal(c.noamCanOfferDrawing(exercise,thread,answer),false);
  assert.equal(thread.hintIndex,1);
});

test("LaTeX angle notation in an AI answer identifies the same vertex as visible notation",()=>{
  const q=require("../noam-ai/manifests/d6ee4238793f49e881c9b2a70915efa6.json").exercises.find(e=>e.id==="G9-T15-E-Q04א");
  const output=Guides.resolve(q,{answer:"סמנו את \\(\\angle EDB\\)."});
  assert.equal(output.angles.length,1);
  assert.equal(output.angles[0].vertex,"D");
  assert.deepEqual([output.angles[0].from,output.angles[0].to],["E","B"]);
});
