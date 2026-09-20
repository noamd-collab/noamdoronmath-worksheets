"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../worksheet-viewer-noam.html"),"utf8");
const helpers=html.slice(html.indexOf("function noamGeometryContext(text){"),html.indexOf("function postJson(endpoint,payload){"));
const local=html.slice(html.indexOf("function tryNoamLocalVisual(studentMessage){"),html.indexOf("function insertNoamMath(kind){"));
const drawing=html.slice(html.indexOf("function addTranscriptBubble("),html.indexOf("function ensureNoamGlossaryPopover("));
const plan={version:1,status:"ok",points:{A:[0,0],B:[4,0],C:[1,3]},
  segments:[["A","B"],["B","C"],["C","A"]],highlights:[{from:"A",to:"B",color:"blue",label:"AB"}],
  angles:[],equalGroups:[],rightAngles:[],evidence:[]};
function el(name){return {name,children:[],attributes:{},textContent:"",handlers:{},
  appendChild(n){this.children.push(n);},setAttribute(k,v){this.attributes[k]=String(v);},
  addEventListener(k,fn){this.handlers[k]=fn;}};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
  const exercise={id:"G8-T09-A-Q02א",text:"נתון משולש ABC."};
  const message={role:"assistant",text:"סמנו את הקטע AB."};
  const thread={hintIndex:2,history:[],messages:[{role:"user",text:"אפשר רמז 2?",kind:"רמז 2"},message]};
  const calls=[],notices=[],renders=[];
  const context={manifest:{sourceSha256:"source-v1",exercises:[exercise]},pdf:"public-pdf-id",
    selectedExercise:exercise,threads:{[exercise.id]:thread},busy:false,noamDrafts:{},
    API:"https://api.test/_functions",g:8,lv:"a",LEVEL:{a:"A"},ttl:"משולשים",
    currentAttachments:()=>[],exerciseThread(id){return context.threads[id];},
    saveNoamState(){},renderNoamChat(){renders.push(context.selectedExercise.id);},announceNoam(s){notices.push(s);},
    exerciseLabel:()=>"שאלה 2",localVisualExerciseSource:e=>e.text,
    getExerciseAnalysis:async (_exercise,worksheetOnly)=>{assert.equal(worksheetOnly,true);return {readable:true,transcription:exercise.text,student_work:"AB = AC"};},
    postJson:async (url,payload)=>{calls.push({url,payload});return {ok:true,plan};},
    isBotProtectionError:e=>!!(e&&e.status===403),
    document:{createElement:el,createElementNS:(_ns,name)=>el(name),getElementById:()=>null}};
  context.window=context;
  vm.createContext(context);
  for(const name of ["noam-geometry.js","noam-diagram-plan.js"]){vm.runInContext(fs.readFileSync(path.join(__dirname,"..",name),"utf8"),context);}
  context.NoamLocalVisual={wantsDrawing:()=>true,wantsVisualSupport:()=>true,parseFactoredQuadraticInequality:()=>null,render:()=>null};
  vm.runInContext(helpers+local+drawing,context);
  // Mock HTTP JSON deserialization inside the same realm as the browser.
  const inspect=context.NoamDiagramPlan.inspect,compile=context.NoamDiagramPlan.compile;
  const clone=value=>vm.runInContext("JSON.parse("+JSON.stringify(JSON.stringify(value))+")",context);
  context.NoamDiagramPlan.inspect=(p,c)=>inspect(clone(p),clone(c));
  context.NoamDiagramPlan.compile=(p,c)=>compile(clone(p),clone(c));
  return {ctx:context,exercise,thread,message,calls,notices,renders};
}

test("an unseen worksheet gets one protected plan request and a real local SVG",async()=>{
  const f=fixture(),c=f.ctx;
  assert.equal(c.noamCanOfferDrawing(f.exercise,f.thread,f.message),true);
  const visual=await c.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(visual.type,"ai-diagram");
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].url,"https://api.test/_functions/noamDiagramPlan");
  assert.equal(f.calls[0].payload.currentHint,"סמנו את הקטע AB.");
  assert.equal(f.calls[0].payload.studentMessage,"אפשר רמז 2?");
  assert.equal(Object.hasOwn(f.calls[0].payload.imageAnalysis,"student_work"),false);
  assert.equal(f.thread.hintIndex,2);
  const node=c.noamRenderAiDiagram(visual);
  assert.ok(node);
  const tags=[];function visit(n){tags.push(n.name);n.children.forEach(visit);}visit(node);
  assert.ok(tags.includes("svg"));assert.ok(!tags.includes("img"));
  assert.equal(c.noamCanOfferDrawing(f.exercise,f.thread,f.message),false);
});

test("double clicks and simultaneous identical requests share one in-flight job",async()=>{
  const f=fixture(),gate=deferred();let calls=0;
  f.ctx.postJson=()=>{calls++;return gate.promise;};
  const first=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message),first);
  const copy={role:"assistant",text:f.message.text};f.thread.messages.push(copy);
  const second=f.ctx.requestNoamDiagram(f.exercise,f.thread,copy,f.ctx.noamMessageVisualOptions(f.thread,f.message));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  gate.resolve({ok:true,plan});await Promise.all([first,second]);
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(calls,1);assert.equal(f.ctx.noamDiagramRuntime().messages.size,0);
});

test("failed plans never cache or pretend to draw, and a deliberate retry succeeds",async()=>{
  const f=fixture();let calls=0;
  f.ctx.postJson=async()=>({ok:true,plan:++calls===1?{version:1,status:"unsupported"}:plan});
  assert.equal(await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message),null);
  assert.equal(f.message.visual,undefined);assert.match(f.message.diagramError,/מדויקת/);
  assert.equal(f.ctx.noamDiagramRuntime().cache.size,0);
  assert.equal((await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message)).type,"ai-diagram");
  assert.equal(calls,2);assert.equal(f.message.diagramError,undefined);
});

test("a valid plan that cannot render never claims a drawing or enters the success cache",async()=>{
  const f=fixture();
  f.message.diagramTyped=true;f.message.text="מכין המחשה לשלב שעליו שאלת.";
  f.ctx.NoamGeometry.render=()=>null;
  assert.equal(await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message),null);
  assert.equal(f.message.visual,undefined);
  assert.equal(f.message.text,"השרטוט עדיין לא מוכן.");
  assert.match(f.message.diagramError,/מדויקת/);
  assert.equal(f.ctx.noamDiagramRuntime().cache.size,0);
  assert.equal(f.thread.history.length,0);
  assert.ok(!f.notices.some(s=>/נוסף שרטוט/.test(s)));
});

test("switching section while waiting cannot redraw or populate the new conversation",async()=>{
  const f=fixture(),gate=deferred();f.ctx.postJson=()=>gate.promise;
  const pending=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  const other={id:"G8-T09-A-Q03א",text:"שאלה אחרת"};
  f.ctx.selectedExercise=other;f.ctx.threads[other.id]={messages:[],history:[]};
  const renders=f.renders.length,notices=f.notices.length;
  gate.resolve({ok:true,plan});await pending;
  assert.equal(f.renders.length,renders);assert.equal(f.notices.length,notices);
  assert.equal(f.ctx.threads[other.id].messages.length,0);
  assert.equal(f.message.visual.type,"ai-diagram");
});

test("resetting a conversation cannot redraw the replaced thread when a request completes",async()=>{
  const f=fixture(),gate=deferred();f.ctx.postJson=()=>gate.promise;
  const pending=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  f.ctx.threads[f.exercise.id]={messages:[],history:[]};const renders=f.renders.length;
  gate.resolve({ok:true,plan});await pending;
  assert.equal(f.renders.length,renders);assert.equal(f.ctx.threads[f.exercise.id].messages.length,0);
});

test("saved plans are revalidated and invalidated when the PDF or source changes",async()=>{
  const f=fixture(),visual=await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  f.ctx.noamDiagramRuntime.state=null;
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(f.calls.length,1,"restored valid transcript reused without another API call");
  f.ctx.manifest.sourceSha256="replacement-pdf";
  assert.equal(f.ctx.noamRenderAiDiagram(visual),null);
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(f.calls.length,2);
  f.message.visual.plan.points.D=[8,8];
  assert.equal(f.ctx.noamRenderAiDiagram(f.message.visual),null,"tampered unknown point rejected on rendering");
});

test("typed drawing requests use the same plan route and preserve hint progress",async()=>{
  const f=fixture();
  assert.equal(f.ctx.tryNoamLocalVisual("הדגם באמצעות שרטוט את AB"),true);
  const reply=f.thread.messages.at(-1);
  await f.ctx.noamDiagramRuntime().messages.get(reply);
  assert.equal(reply.visual.type,"ai-diagram");assert.equal(f.thread.hintIndex,2);
  assert.equal(f.calls[0].payload.currentHint,"סמנו את הקטע AB.");
  assert.equal(f.calls[0].payload.studentMessage,"הדגם באמצעות שרטוט את AB");
  assert.equal(f.thread.history.length,2);
  assert.doesNotMatch(reply.text,/מכין/);
});

test("a student's request to mark the mentioned objects uses the current answer as diagram focus",async()=>{
  const f=fixture();
  f.ctx.NoamLocalVisual=require("../noam-local-visual.js");
  const request="כן אתה יכול לסמן לי אותן כי אני לא בטוח שאני מבין";
  assert.equal(f.ctx.NoamLocalVisual.wantsDrawing(request),false);
  assert.equal(f.ctx.tryNoamLocalVisual(request),true);
  const reply=f.thread.messages.at(-1);
  await f.ctx.noamDiagramRuntime().messages.get(reply);
  assert.equal(reply.visual.type,"ai-diagram");
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].payload.currentHint,"סמנו את הקטע AB.");
  assert.equal(f.calls[0].payload.studentMessage,request);
  assert.equal(f.thread.hintIndex,2);
  assert.equal(f.ctx.tryNoamLocalVisual("אפשר רמז נוסף?"),false);
  assert.equal(f.calls.length,1,"ordinary hint requests do not start paid diagram calls");
});

test("drawing control shows pending and retry state without losing the original answer",async()=>{
  const f=fixture(),gate=deferred();f.ctx.postJson=()=>gate.promise;
  let host=el("main");f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  let button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(button.textContent,"לא הופיע שרטוט להמחשה? לחצו כאן");button.handlers.click();
  host=el("main");f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(button.disabled,true);assert.match(button.textContent,/מכין/);
  gate.reject(new Error("network unavailable"));await f.ctx.noamDiagramRuntime().messages.get(f.message);
  host=el("main");f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(button.disabled,false);assert.match(button.textContent,/שוב/);
  assert.equal(f.message.text,"סמנו את הקטע AB.");
});

test("the fallback is limited to missed visual requests and never repeats the question crop after a diagram attempt",()=>{
  const f=fixture();
  f.ctx.NoamLocalVisual.wantsVisualSupport=()=>false;
  let host=el("main");
  f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  assert.equal(host.children[0].children[0].children.some(n=>n.name==="button"),false);

  f.message.visual={type:"question-image",exerciseId:f.exercise.id};
  f.message.diagramError="לא הצלחנו להכין שרטוט מדויק.";
  let renderedOriginal=false;
  f.ctx.NoamLocalVisual.render=()=>{renderedOriginal=true;return el("question-image-card");};
  host=el("main");
  f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",f.message.visual,f.message,f.thread);
  const button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(renderedOriginal,false);
  assert.equal(button.textContent,"השרטוט לא הופיע — נסו שוב");
});

test("restored source-only replies hide their crop even before a retry and retain the edge action",()=>{
  const f=fixture();
  f.message.visual={type:"question-image",exerciseId:f.exercise.id};
  f.ctx.NoamLocalVisual.render=()=>{throw new Error("an assistant reply must never render the source crop");};
  const host=el("main");
  f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",f.message.visual,f.message,f.thread);
  assert.ok(host.children[0].children[0].children.some(n=>n.name==="button"));
  assert.equal(f.message.text,"סמנו את הקטע AB.");
});

test("implicit visual replies and later hints never use a source crop as a constructed diagram",()=>{
  const f=fixture();
  f.ctx.NoamLocalVisual=require("../noam-local-visual.js");
  for(const args of [["קשה לי לזהות","free_question",0],["אפשר רמז נוסף?","hint",1]]){
    assert.equal(f.ctx.noamResponseVisual(f.exercise,f.thread,args[0],"סמנו את הזווית ABC.",args[1],args[2],{}),null);
  }
  assert.equal(f.calls.length,0);
});

test("an unrenderable restored guide never becomes a crop or hides its retry action",async()=>{
  const f=fixture();
  f.message.visual={type:"geometry-guide",exerciseId:f.exercise.id,options:{answer:f.message.text,studentMessage:"סמן לי את AB"}};
  f.ctx.NoamGeometryGuides={resolve:()=>({type:"geometry-scene"})};
  f.ctx.NoamLocalVisual.render=()=>{throw new Error("a failed guide must never render the source crop");};
  const host=el("main");
  f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",f.message.visual,f.message,f.thread);
  const button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.ok(button);
  button.handlers.click();
  const visual=await f.ctx.noamDiagramRuntime().messages.get(f.message);
  assert.equal(visual.type,"ai-diagram");
  assert.equal(f.calls.length,1,"failed local rendering proceeds to the general planner");
});

test("local verified guides do not invoke analysis or the paid diagram endpoint",async()=>{
  const f=fixture();f.ctx.NoamGeometryGuides={resolve:()=>({type:"geometry-scene",points:plan.points,segments:plan.segments})};
  f.ctx.getExerciseAnalysis=()=>{throw new Error("unexpected analysis");};
  const visual=await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(visual.type,"geometry-guide");assert.equal(f.calls.length,0);
});
