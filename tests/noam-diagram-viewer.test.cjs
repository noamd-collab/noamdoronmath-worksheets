"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../worksheet-viewer-noam.html"),"utf8");
const helpers=html.slice(html.indexOf("function noamGeometryContext(text){"),html.indexOf("function postJson(endpoint,payload){"));
const local=html.slice(html.indexOf("function noamParsedLocalVisual(exercise){"),html.indexOf("function insertNoamMath(kind){"));
const drawing=html.slice(html.indexOf("function setNoamDiagramButtonLabel("),html.indexOf("function ensureNoamGlossaryPopover("));
// 8a09802 (restore PR26 AI fix) made addTranscriptBubble, inside the drawing
// slice above, render assistant text through noamStripMarkdownEmphasis, which is
// declared later in the same viewer script; noam-hints-concepts-matrix.test.cjs
// asserts that helper. Load it from the viewer instead of stubbing it.
const markdown=html.slice(html.indexOf("function noamStripMarkdownEmphasis(text){"),html.indexOf("function makeNoamGlossaryTerm(match){"));
const plan={version:1,status:"ok",points:{A:[0,0],B:[4,0],C:[1,3]},
  segments:[["A","B"],["B","C"],["C","A"]],highlights:[{from:"A",to:"B",color:"blue",label:"AB"}],
  angles:[],equalGroups:[],rightAngles:[],evidence:[]};
function el(name){const node={name,children:[],attributes:{},textContent:"",handlers:{},dataset:{},style:{},
  appendChild(n){this.children.push(n);},setAttribute(k,v){this.attributes[k]=String(v);},
  addEventListener(k,fn){this.handlers[k]=fn;}};
  node.classList={contains:token=>(node.className||"").split(" ").includes(token),add:token=>{node.className=((node.className||"")+" "+token).trim();}};
  return node;}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
  const exercise={id:"G8-T38-A-Q02א",text:"נתון משולש ABC."};
  const message={role:"assistant",text:"סמנו את הקטע AB."};
  const thread={hintIndex:2,history:[],messages:[{role:"user",text:"אפשר רמז 2?",kind:"רמז 2"},message]};
  const calls=[],statusCalls=[],notices=[],renders=[];
  const context={manifest:{prefix:"G8-T38",sourceSha256:"source-v1",exercises:[exercise]},pdf:"public-pdf-id",
    selectedExercise:exercise,threads:{[exercise.id]:thread},busy:false,noamDrafts:{},
    API:"https://api.test/_functions",g:8,lv:"a",LEVEL:{a:"A"},ttl:"משולשים",
    ownerKey:"owner-key-1234567890",STATUS_POLL_MS:0,ASYNC_JOB_MAX_WAIT:1000,
    noamSourceCropRequested:()=>false,noamNativeDataUrl:()=>"",
    noamSourceVisualIdentity:e=>e.id+":"+context.manifest.sourceSha256,
    noamAppendSourceCropHelp(){},
    currentAttachments:()=>[],exerciseThread(id){return context.threads[id];},
    saveNoamState(){},renderNoamChat(){renders.push(context.selectedExercise.id);},announceNoam(s){notices.push(s);},
    exerciseLabel:()=>"שאלה 2",localVisualExerciseSource:e=>e.text,
    getExerciseAnalysis:async (_exercise,worksheetOnly)=>{assert.equal(worksheetOnly,true);return {readable:true,transcription:exercise.text,student_work:"AB = AC"};},
    postJson:async (url,payload)=>{calls.push({url,payload});return {ok:true,accepted:true,jobId:"job-1",status:"pending"};},
    isBotProtectionError:e=>!!(e&&e.status===403),
    document:{createElement:el,createElementNS:(_ns,name)=>el(name),getElementById:()=>null}};
  context.window=context;
  vm.createContext(context);
  for(const name of ["noam-geometry.js","noam-diagram-plan.js"]){vm.runInContext(fs.readFileSync(path.join(__dirname,"..",name),"utf8"),context);}
  context.NoamLocalVisual={wantsDrawing:()=>true,wantsVisualSupport:()=>true,parseFactoredQuadraticInequality:()=>null,render:()=>null};
  vm.runInContext(helpers+local+drawing+markdown,context);
  context.pollNoamDiagramJob=async jobId=>{statusCalls.push(jobId);return {ok:true,plan};};
  // Mock HTTP JSON deserialization inside the same realm as the browser.
  const inspect=context.NoamDiagramPlan.inspect,compile=context.NoamDiagramPlan.compile;
  const clone=value=>vm.runInContext("JSON.parse("+JSON.stringify(JSON.stringify(value))+")",context);
  context.NoamDiagramPlan.inspect=(p,c)=>inspect(clone(p),clone(c));
  context.NoamDiagramPlan.compile=(p,c)=>compile(clone(p),clone(c));
  return {ctx:context,exercise,thread,message,calls,statusCalls,notices,renders};
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
  assert.equal(f.calls[0].payload.ownerKey,"owner-key-1234567890");
  assert.equal(f.calls[0].payload.imageDataUrl,"");
  assert.equal(f.statusCalls.length,1);
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
  gate.resolve({ok:true,accepted:true,jobId:"job-1",status:"pending"});await Promise.all([first,second]);
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  assert.equal(calls,1);assert.equal(f.ctx.noamDiagramRuntime().messages.size,0);
});

test("failed plans never cache or pretend to draw, and a deliberate retry succeeds",async()=>{
  const f=fixture();let calls=0;
  f.ctx.pollNoamDiagramJob=async()=>({ok:true,plan:++calls===1?{version:1,status:"unsupported"}:plan});
  assert.equal(await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message),null);
  assert.equal(f.message.visual,undefined);assert.match(f.message.diagramError,/מדויקת/);
  assert.equal(f.ctx.noamDiagramRuntime().cache.size,0);
  assert.equal((await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message)).type,"ai-diagram");
  assert.equal(calls,2);assert.equal(f.message.diagramError,undefined);
  assert.match(f.calls[1].payload.clientRequestId,/^diagram-review-/);
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
  const other={id:"G8-T38-A-Q03א",text:"שאלה אחרת"};
  f.ctx.selectedExercise=other;f.ctx.threads[other.id]={messages:[],history:[]};
  const renders=f.renders.length,notices=f.notices.length;
  gate.resolve({ok:true,accepted:true,jobId:"job-1",status:"pending"});await pending;
  assert.equal(f.renders.length,renders);assert.equal(f.notices.length,notices);
  assert.equal(f.ctx.threads[other.id].messages.length,0);
  assert.equal(f.message.visual.type,"ai-diagram");
});

test("resetting a conversation cannot redraw the replaced thread when a request completes",async()=>{
  const f=fixture(),gate=deferred();f.ctx.postJson=()=>gate.promise;
  const pending=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  f.ctx.threads[f.exercise.id]={messages:[],history:[]};const renders=f.renders.length;
  gate.resolve({ok:true,accepted:true,jobId:"job-1",status:"pending"});await pending;
  assert.equal(f.renders.length,renders);assert.equal(f.ctx.threads[f.exercise.id].messages.length,0);
});

function scrollFixture(figureHeight=180){
  const f=fixture(),frames=[],scrolled=[];
  const svg={scrollIntoView:options=>scrolled.push({target:"svg",options})};
  const figure={getBoundingClientRect:()=>({height:figureHeight}),
    querySelector:selector=>selector===".noam-geometry-svg"?svg:null,
    scrollIntoView:options=>scrolled.push({target:"figure",options})};
  const retry={scrollIntoView:options=>scrolled.push({target:"retry",options})};
  const expansion={scrollIntoView:options=>scrolled.push({target:"expansion",options})};
  const row={isConnected:true,
    querySelector:selector=>selector===".noam-geometry"?figure:selector===".noam-diagram-expand"?expansion:retry,
    scrollIntoView:options=>scrolled.push({target:"row",options})};
  const transcript={clientHeight:260,children:[{},row]};
  f.ctx.document.getElementById=id=>id==="noamTranscript"?transcript:null;
  f.ctx.requestAnimationFrame=callback=>frames.push(callback);
  return Object.assign(f,{frames,scrolled,row});
}

test("a completed diagram reveals its figure after layout instead of the long answer row",()=>{
  const f=scrollFixture();
  f.ctx.noamDiagramRefresh(f.exercise,f.thread,f.message,true);
  assert.equal(f.frames.length,1);
  assert.equal(f.scrolled.length,0,"wait for layout before scrolling");
  f.frames[0]();
  assert.deepEqual(JSON.parse(JSON.stringify(f.scrolled)),[
    {target:"figure",options:{block:"center",inline:"nearest",behavior:"instant"}}
  ],"target the diagram and cancel the transcript's competing smooth scroll");
});

test("a figure taller than the visible transcript reveals expansion, while a failure reveals retry",()=>{
  const f=scrollFixture(500);
  f.ctx.noamDiagramRefresh(f.exercise,f.thread,f.message,true);
  f.frames.shift()();
  assert.equal(f.scrolled[0].target,"expansion");
  f.message.diagramError="לא הצלחתי להכין את השרטוט כרגע.";
  f.ctx.noamDiagramRefresh(f.exercise,f.thread,f.message,true);
  f.frames.shift()();
  assert.equal(f.scrolled[1].target,"retry");
  assert.equal(f.scrolled[1].options.behavior,"instant");
});

test("a scheduled diagram reveal cannot scroll another section, a replaced thread, or a detached row",()=>{
  for(const change of [
    f=>{f.ctx.selectedExercise={id:"another-section"};},
    f=>{f.ctx.threads[f.exercise.id]={messages:[],history:[]};},
    f=>{f.thread.messages=[];},
    f=>{f.row.isConnected=false;}
  ]){
    const f=scrollFixture();
    f.ctx.noamDiagramRefresh(f.exercise,f.thread,f.message,true);
    change(f);
    f.frames[0]();
    assert.equal(f.scrolled.length,0);
  }
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
  assert.equal(button.textContent,"לא הופיע שרטוט להמחשה? לחצו כאן");
  assert.equal(button.children[0].textContent,"(Beta)");button.handlers.click();
  host=el("main");f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(button.disabled,true);assert.match(button.textContent,/מכין/);
  gate.reject(new Error("network unavailable"));await f.ctx.noamDiagramRuntime().messages.get(f.message);
  host=el("main");f.ctx.addTranscriptBubble(host,"assistant",f.message.text,"",null,f.message,f.thread);
  button=host.children[0].children[0].children.find(n=>n.name==="button");
  assert.equal(button.disabled,false);assert.match(button.textContent,/שוב/);
  assert.equal(button.children[0].textContent,"(Beta)");
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

test("typed retry after a failed drawing preserves the current hint and requests independent review",async()=>{
 const f=fixture();f.ctx.NoamLocalVisual.wantsDrawing=()=>false;f.ctx.NoamLocalVisual.wantsVisualSupport=()=>false;
 f.message.diagramError="לא הצלחנו להכין שרטוט";
 f.message.diagramOptions={answer:"סמנו את הקטע AB.",studentMessage:"תוכל לשרטט לי?"};
 assert.equal(f.ctx.tryNoamLocalVisual("נסה שוב"),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls.length,1);assert.match(f.calls[0].payload.clientRequestId,/^diagram-review-/);
 assert.equal(f.calls[0].payload.currentHint,"סמנו את הקטע AB.");
 assert.equal(f.calls[0].payload.studentMessage,"תוכל לשרטט לי?");
 assert.equal(f.thread.messages.at(-1).visual.type,"ai-diagram");
});
test("typed retry without a failed drawing remains a normal tutor question",()=>{
 const f=fixture();f.ctx.NoamLocalVisual.wantsDrawing=()=>false;f.ctx.NoamLocalVisual.wantsVisualSupport=()=>false;
 assert.equal(f.ctx.tryNoamLocalVisual("נסה שוב"),false);assert.equal(f.calls.length,0);
});

test("different hint messages for one question share the first pending drawing without copying its result",async()=>{
  const f=fixture(),gate=deferred();let calls=0;
  f.ctx.postJson=()=>{calls++;return gate.promise;};
  const later={role:"assistant",text:"כעת התבוננו בזווית ABC."};
  f.thread.messages.push({role:"user",text:"אפשר עוד רמז?"},later);
  const first=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  const second=f.ctx.requestNoamDiagram(f.exercise,f.thread,later,{answer:later.text,studentMessage:"שרטוט אחר",drawCurrentStep:true});
  assert.equal(second,first,"the question, not the hint text, owns the pending request");
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);
  gate.resolve({ok:true,accepted:true,jobId:"job-1",status:"pending"});
  const visual=await first;
  assert.equal(f.message.visual,visual);
  assert.equal(later.visual,undefined,"sharing a promise must not append another drawing");
  assert.equal(await f.ctx.requestNoamDiagram(f.exercise,f.thread,later),visual);
  assert.equal(later.visual,undefined);
  assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,later),false);
  assert.equal(calls,1);
});

for(const type of ["source-crop","native-source-visual","geometry-guide","ai-diagram","labeled-triangle"]){
  test(`a saved ${type} removes drawing actions for every answer and is reused without generation`,async()=>{
    const f=fixture();
    const visual={type,exerciseId:f.exercise.id};
    f.message.visual=visual;
    const rendered=()=>Object.assign(el("figure"),{className:"noam-geometry"});
    f.ctx.noamRenderSourceCrop=rendered;
    f.ctx.noamRenderSourceVisual=rendered;
    f.ctx.noamRenderGeometryGuide=rendered;
    f.ctx.noamRenderAiDiagram=rendered;
    f.ctx.NoamLocalVisual.render=rendered;
    const later={role:"assistant",text:"רמז נוסף על אותה שאלה."};
    f.thread.messages.push(later);
    for(const message of [f.message,later]){
      assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,message),false);
      const host=el("main");
      f.ctx.addTranscriptBubble(host,"assistant",message.text,"",message.visual,message,f.thread);
      const bubble=host.children[0].children[0];
      assert.equal(bubble.children.some(node=>node.className==="noam-draw-action"),false);
    }
    assert.equal(await f.ctx.requestNoamDiagram(f.exercise,f.thread,later),visual);
    assert.equal(later.visual,undefined);
    assert.equal(f.calls.length,0);
  });
}

test("saved duplicate drawings render only the first valid figure without hiding either answer",()=>{
  const f=fixture();
  f.ctx.noamRenderAiDiagram=()=>Object.assign(el("figure"),{className:"noam-geometry"});
  f.message.visual={type:"ai-diagram",exerciseId:f.exercise.id};
  const later={role:"assistant",text:"זהו הרמז הבא.",visual:{type:"ai-diagram",exerciseId:f.exercise.id}};
  f.thread.messages.push(later);
  const host=el("main");
  for(const message of [f.message,later]){
    f.ctx.addTranscriptBubble(host,"assistant",message.text,"",message.visual,message,f.thread);
  }
  const nodes=[];function visit(node){nodes.push(node);node.children.forEach(visit);}visit(host);
  assert.equal(nodes.filter(node=>node.name==="figure").length,1);
  assert.ok(nodes.some(node=>node.textContent===f.message.text));
  assert.ok(nodes.some(node=>node.textContent===later.text));
  assert.equal(nodes.filter(node=>node.className==="noam-draw-action").length,0);
});

test("typing another drawing request after success reveals the existing drawing without adding messages",async()=>{
  const f=fixture();
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  const messages=f.thread.messages.slice(),history=f.thread.history.slice();
  assert.equal(f.ctx.tryNoamLocalVisual("צייר שוב את המשולש"),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.thread.messages,messages);
  assert.deepEqual(f.thread.history,history);
  assert.equal(f.calls.length,1);
});

for(const route of ["planner","native-source","source-crop"]){
  test(`a saved drawing that rehydrates during ${route} completion keeps the only drawing slot`,async()=>{
    const f=fixture(),gate=deferred();let restored=false;
    const saved={type:"native-source-visual",exerciseId:f.exercise.id};
    f.message.visual=saved;
    f.ctx.noamRenderSourceVisual=()=>restored?Object.assign(el("figure"),{className:"noam-geometry"}):null;
    const later={role:"assistant",text:"מכין המחשה לשלב שעליו שאלת.",diagramTyped:true};
    f.thread.messages.push(later);
    if(route==="planner"){
      f.ctx.pollNoamDiagramJob=()=>gate.promise;
    }else{
      f.ctx.noamSourceVisualOptions=options=>({...options});
      const from=route==="native-source"?"function noamRequestSourceFirst(":"function noamRequestSourceCrop(";
      const to=route==="native-source"?"function noamAttachSourceHint(":"function noamAppendSourceCropHelp(";
      vm.runInContext(html.slice(html.indexOf(from),html.indexOf(to)),f.ctx);
      if(route==="native-source"){
        f.ctx.NoamNativeVisual={};
        f.ctx.noamNativeDataUrl=()=>"/noam-ai/native/G8-T38/a/noam-ai.json";
        f.ctx.noamPrepareSourceVisual=()=>gate.promise;
      }else{
        f.ctx.noamSourceCropRequested=()=>true;
        f.ctx.noamSourceCropIdentity=()=>"source-crop-current";
        f.ctx.noamSourceCropExercise=exercise=>exercise;
        f.ctx.noamLoadSourceCrop=()=>gate.promise;
      }
    }
    const pending=f.ctx.requestNoamDiagram(f.exercise,f.thread,later,{answer:f.message.text,studentMessage:"אפשר רמז 2?"});
    await new Promise(resolve=>setImmediate(resolve));
    restored=true;
    gate.resolve(route==="planner"?{ok:true,plan}:route==="native-source"?{type:"native-source-visual",exerciseId:f.exercise.id}:{dataUrl:"data:image/png;base64,c291cmNl"});
    assert.equal(await pending,saved,"reuse the rehydrated original, not the superseded result");
    assert.equal(f.thread.messages.filter(message=>message.visual).length,1);
    assert.equal(later.visual,undefined);
    assert.equal(later.diagramTyped,undefined);
    assert.match(later.text,/כבר מוצג/);
    assert.equal(f.ctx.noamDiagramRuntime().messages.size,0);
    assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,later),false);
  });
}

test("long conversations retain their first drawing within the message limit, including after reload",async()=>{
  const f=fixture();
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  for(let index=0;index<66;index++)f.thread.messages.push({role:index%2?"assistant":"user",text:`המשך השיחה ${index}`});
  const latest=f.thread.messages.at(-1);
  f.ctx.noamTrimQuestionMessages(f.exercise,f.thread);
  assert.equal(f.thread.messages.length,60);
  assert.equal(f.thread.messages[0],f.message,"trimming text must not restore permission to draw again");
  assert.equal(f.thread.messages.at(-1),latest);
  assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,latest),false);
  f.thread.messages=JSON.parse(JSON.stringify(f.thread.messages));
  f.ctx.noamDiagramRuntime.state=null;
  assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,f.thread.messages.at(-1)),false);
  await f.ctx.requestNoamDiagram(f.exercise,f.thread,f.thread.messages.at(-1));
  assert.equal(f.calls.length,1,"reload after trimming still cannot request regeneration");
  assert.equal(f.thread.messages.filter(message=>message.visual).length,1);
});

test("trimming a long conversation preserves the pending drawing owner until completion",async()=>{
  const f=fixture(),gate=deferred();
  f.ctx.pollNoamDiagramJob=()=>gate.promise;
  const pending=f.ctx.requestNoamDiagram(f.exercise,f.thread,f.message);
  await new Promise(resolve=>setImmediate(resolve));
  for(let index=0;index<66;index++)f.thread.messages.push({role:"assistant",text:`רמז ${index}`});
  f.ctx.noamTrimQuestionMessages(f.exercise,f.thread);
  assert.equal(f.thread.messages.length,60);
  assert.equal(f.thread.messages[0],f.message);
  assert.equal(f.ctx.requestNoamDiagram(f.exercise,f.thread,f.thread.messages.at(-1)),pending);
  gate.resolve({ok:true,plan});
  await pending;
  assert.equal(f.thread.messages.filter(message=>message.visual).length,1);
  assert.equal(f.calls.length,1);
  assert.equal(f.ctx.noamCanOfferDrawing(f.exercise,f.thread,f.thread.messages.at(-1)),false);
});
