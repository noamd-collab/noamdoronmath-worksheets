"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createHash}=require("node:crypto"),{execFileSync}=require("node:child_process");
const author=require("../tools/ramzi-hints/author-flash-hints.cjs"),builder=require("../tools/ramzi-hints/build-ramzi-hints.cjs");
const HINTS=["איזה קשר בין הנתונים למטרה עשוי לעזור?","בחרו פעולה מתאימה ובדקו את השפעתה.","השלימו את הצעד בעצמכם ובדקו מול הנתונים."];
const SECRET="fake-private-api-key-for-test",config={apiKey:SECRET,endpoint:"https://example.invalid/chat/completions"};
function task(id="G7-T01-A-Q01א",extra={}){const text="חשבו את הביטוי שבע פחות המשתנה.";return {exercise_id:id,source_pdf_hash:"a".repeat(32),source_native_sha256:"b".repeat(64),source_exercise_sha256:builder.sourceTaskHash(text),grade:Number(id[1]),topic:"ביטויים",stage:/Q01/.test(id)?"q01":"q02plus",source:{manifest_selected_text:text,native_item_id:id,stem:"הקשר משותף",given:[],selected_item:{text},previous_parts:[]},...extra};}
function directory(t){const out=fs.mkdtempSync(path.join(os.tmpdir(),"ramzi-author-test-"));t.after(()=>fs.rmSync(out,{recursive:true,force:true}));return out;}
function response(rows,extra={}){return {ok:true,status:200,text:async()=>JSON.stringify({model:author.MODEL,choices:[{message:{content:JSON.stringify({rows})}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},...extra})};}
function requested(init){return JSON.parse(JSON.parse(init.body).messages[1].content[0].text).tasks;}
function read(out,name){return JSON.parse(fs.readFileSync(path.join(out,name),"utf8"));}
function allText(out){return fs.readdirSync(out,{withFileTypes:true}).map(d=>d.isDirectory()?allText(path.join(out,d.name)):fs.readFileSync(path.join(out,d.name),"utf8")).join("\n");}

test("credentials parse without eval, invalid URLs fail closed, no model override exists",()=>{
 const cfg=author.envConfig('QWEN_API_KEY="'+SECRET+'"\nQWEN_BASE_URL=https://example.invalid/compatible-mode/v1\nQWEN_MODEL=forbidden-model\n');
 assert.equal(cfg.endpoint,"https://example.invalid/compatible-mode/v1/chat/completions");assert.equal(cfg.apiKey,SECRET);assert.equal(author.MODEL,"qwen3.8-flash");
 for(const base of ["http://example.invalid/v1","https://user:pass@example.invalid/v1","https://example.invalid/v1?key=secret"]){assert.throws(()=>author.envConfig(`QWEN_API_KEY=${SECRET}\nQWEN_BASE_URL=${base}`),{code:"INVALID_BASE_URL"});}
 assert.throws(()=>author.args(["--model","another-model"]),{code:"INVALID_ARGUMENTS"});
 assert.throws(()=>author.envConfig(`QWEN_API_KEY=${SECRET}\nQWEN_API_KEY=another-secret`),{code:"DUPLICATE_ENV_FIELD"});
});
test("source text hashes preserve arithmetic signs and task fingerprints bind every source field",()=>{
 const first=task();const changed=JSON.parse(JSON.stringify(first));changed.source.manifest_selected_text="שבע ועוד המשתנה";
 assert.throws(()=>author.validateTask(changed),{code:"TASK_TEXT_HASH_MISMATCH"});changed.source_exercise_sha256=builder.sourceTaskHash(changed.source.manifest_selected_text);
 assert.notEqual(author.fingerprint(first),author.fingerprint(changed));assert.notEqual(builder.sourceTaskHash("7−2n"),builder.sourceTaskHash("7+2n"));
 assert.notEqual(author.fingerprint(first),author.fingerprint({...first,source_pdf_hash:"c".repeat(32)}));
 assert.equal(author.fingerprint({...first,topic:"ביטויים"}),author.fingerprint(first));
});
test("malformed, duplicate, missing, unasked and binding-bearing response rows are rejected structurally",()=>{
 const a=task(),b=task("G7-T01-A-Q01ב");
 assert.equal(author.validateResponse("not json",[a]).invalid.get(a.exercise_id),"INVALID_JSON");
 assert.equal(author.validateResponse(JSON.stringify({rows:[{exercise_id:a.exercise_id,hints:HINTS}]}),[a,b]).invalid.get(b.exercise_id),"MISSING_ID");
 assert.equal(author.validateResponse(JSON.stringify({rows:[{exercise_id:a.exercise_id,hints:HINTS},{exercise_id:a.exercise_id,hints:HINTS}]}),[a]).invalid.get(a.exercise_id),"DUPLICATE_ID");
 assert.equal(author.validateResponse(JSON.stringify({rows:[{exercise_id:b.exercise_id,hints:HINTS}]}),[a]).invalid.get(a.exercise_id),"UNASKED_ID");
 assert.equal(author.validateResponse(JSON.stringify({rows:[{exercise_id:a.exercise_id,hints:HINTS,source_pdf_hash:"d".repeat(32)}]}),[a]).invalid.get(a.exercise_id),"UNEXPECTED_ROW_FIELD");
 for(const first of ["חשבו על שני מספרים.","חשבו על 2 מספרים.","חשבו אם x=2.","חשבו על 1/2."]){assert.ok(author.validateResponse(JSON.stringify({rows:[{exercise_id:a.exercise_id,hints:[first,...HINTS.slice(1)]}]}),[a]).invalid.size);}
});
test("one Flash call produces explicit automatic provenance; unchanged tasks resume with zero calls",async t=>{
 const out=directory(t),tasks=[task(),task("G7-T01-A-Q01ב")];let calls=0;
 const fetchImpl=async(_,init)=>{calls++;const payload=JSON.parse(init.body);assert.equal(payload.model,"qwen3.8-flash");assert.equal(payload.enable_thinking,false);assert.equal(payload.temperature,0.2);assert.deepEqual(payload.response_format,{type:"json_object"});assert.equal(init.redirect,"error");return response(requested(init).map(x=>({exercise_id:x.exercise_id,hints:HINTS})));};
 const result=await author.run({tasks,out,config,fetchImpl});assert.equal(result.completed,2);assert.equal(calls,1);
 const rows=read(out,"rows.json"),manifest=read(out,"manifest.json");assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==="verified"&&r.source==="ramzi-flash-authored-20261031"));assert.equal(manifest.provenance,author.PROVENANCE);assert.equal(manifest.userAutomaticApproval,true);assert.equal(manifest.model,"qwen3.8-flash");assert.equal(manifest.usage.total_tokens,30);assert.equal(manifest.taskFingerprints.length,2);
 await author.run({tasks,out,config,fetchImpl:()=>{throw new Error("must resume");}});assert.equal(calls,1);assert.equal(read(out,"rows.json").length,2);
});
test("limit then expanded task list resumes prior rows; changed task fingerprint never reuses old binding",async t=>{
 const out=directory(t),a=task(),b=task("G7-T01-A-Q01ב"),asked=[];
 const fetchImpl=async(_,init)=>{const tasks=requested(init);asked.push(tasks.map(x=>x.exercise_id));return response(tasks.map(x=>({exercise_id:x.exercise_id,hints:HINTS})));};
 await author.run({tasks:[a],out,config,fetchImpl});await author.run({tasks:[a,b],out,config,fetchImpl});assert.deepEqual(asked,[[a.exercise_id],[b.exercise_id]]);
 const moved={...a,source_pdf_hash:"c".repeat(32)};await author.run({tasks:[moved],out,config,fetchImpl});assert.equal(asked.length,3);assert.equal(read(out,"rows.json")[0].source_pdf_hash,moved.source_pdf_hash);
});
test("only invalid ladders are repaired; explicit ambiguity stops without inventing or reviewing content",async t=>{
 const out=directory(t),tasks=[task(),task("G7-T01-A-Q01ב"),task("G7-T01-A-Q01ג")],calls=[];
 const fetchImpl=async(_,init)=>{const ask=requested(init);calls.push(ask.map(x=>x.exercise_id));return response(calls.length===1?[{exercise_id:tasks[0].exercise_id,hints:HINTS},{exercise_id:tasks[1].exercise_id,hints:["שני מספרים",...HINTS.slice(1)]},{exercise_id:tasks[2].exercise_id,error:"source_ambiguous"}]:ask.map(x=>({exercise_id:x.exercise_id,hints:HINTS})));};
 const result=await author.run({tasks,out,config,fetchImpl,sleepImpl:async()=>{}});assert.equal(result.completed,2);assert.equal(result.failed,1);assert.deepEqual(calls[1],[tasks[1].exercise_id]);assert.equal(read(out,"failures.json")[0].code,"SOURCE_AMBIGUOUS");
});
test("network failures retry at most twice using the same Flash model and never persist raw secrets",async t=>{
 const out=directory(t),logs=[];let calls=0;
 const result=await author.run({tasks:[task()],out,config,sleepImpl:async()=>{},log:x=>logs.push(x),fetchImpl:async(_,init)=>{calls++;assert.equal(JSON.parse(init.body).model,author.MODEL);throw new Error("Bearer "+SECRET);}});
 assert.equal(calls,3);assert.equal(result.failed,1);assert.doesNotMatch(allText(out),new RegExp(SECRET));assert.doesNotMatch(JSON.stringify(logs),new RegExp(SECRET));assert.equal(read(out,"failures.json")[0].code,"TRANSPORT_FAILED");
 assert.equal(author.redact("Bearer "+SECRET+" "+SECRET,SECRET).includes(SECRET),false);
});
test("non-success provider bodies are omitted; a different returned model stops and never falls back",async t=>{
 const out=directory(t);let calls=0;
 await author.run({tasks:[task()],out,config,retries:0,fetchImpl:async()=>({ok:false,status:401,text:async()=>SECRET})});assert.doesNotMatch(allText(out),new RegExp(SECRET));
 const result=await author.run({tasks:[task()],out,config,fetchImpl:async()=>{calls++;return response([],{model:"unexpected-model"});}});assert.equal(calls,1);assert.equal(result.failed,1);assert.equal(read(out,"failures.json")[0].code,"MODEL_MISMATCH");
});
test("a body that never resolves is aborted within the attempt deadline",async t=>{
 const out=directory(t);let signal;
 const result=await author.run({tasks:[task()],out,config,retries:0,requestTimeoutMs:5,fetchImpl:async(_,init)=>{signal=init.signal;return {ok:true,status:200,text:()=>new Promise(()=>{})};}});
 assert.equal(signal.aborted,true);assert.equal(result.failed,1);assert.equal(read(out,"failures.json")[0].code,"REQUEST_TIMEOUT");
});
test("checkpoint corruption, duplicate tasks and repository outputs cannot silently cause fresh calls",async t=>{
 const out=directory(t),a=task();let calls=0;const fetchImpl=async()=>{calls++;return response([{exercise_id:a.exercise_id,hints:HINTS}]);};
 await author.run({tasks:[a],out,config,fetchImpl});const row=path.join(out,"rows",author.fingerprint(a)+".json");fs.writeFileSync(row,"broken");await assert.rejects(author.run({tasks:[a],out,config,fetchImpl}),{code:"CHECKPOINT_INVALID"});assert.equal(calls,1);
 await assert.rejects(author.run({tasks:[a,a],out,config,fetchImpl}),{code:"DUPLICATE_TASK_ID"});await assert.rejects(author.run({tasks:[a],out:path.join(__dirname,"../private-output"),config,fetchImpl}));
 await assert.rejects(author.run({tasks:[a],out,config,fetchImpl,model:author.MODEL}),{code:"MODEL_OVERRIDE_FORBIDDEN"});
});
test("same-question contexts and original images are deduplicated within the single authoring call",async t=>{
 const out=directory(t),svg=path.join(out,"figure.svg");fs.writeFileSync(svg,'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');const hash=createHash("sha256").update(fs.readFileSync(svg)).digest("hex"),images=[{path:svg,sha256:hash,figure_id:"q1"}];
 const tasks=[task(undefined,{images}),task("G7-T01-A-Q01ב",{images})];let renders=0;
 await author.run({tasks,out,config,renderImage:async()=>{renders++;return Buffer.from("test-rendered-png");},fetchImpl:async(_,init)=>{const content=JSON.parse(init.body).messages[1].content,packet=JSON.parse(content[0].text);assert.equal(Object.keys(packet.contexts).length,1);assert.equal(content.length,2);assert.equal(packet.imageOrder[0].exerciseIds.length,2);assert.match(content[1].image_url.url,/^data:image\/png;base64,/);return response(tasks.map(x=>({exercise_id:x.exercise_id,hints:HINTS})));}});assert.equal(renders,1);
});
test("PNG/JPEG crops keep their MIME type and require matching hash and binary magic",async t=>{
 const out=directory(t),png=path.join(out,"crop.png"),jpg=path.join(out,"crop.jpg");fs.writeFileSync(png,Buffer.from([137,80,78,71,13,10,26,10,0]));fs.writeFileSync(jpg,Buffer.from([255,216,255,0]));
 const images=[png,jpg].map((file,i)=>({path:file,sha256:createHash("sha256").update(fs.readFileSync(file)).digest("hex"),figure_id:"crop"+i})),a=task(undefined,{images});
 await author.run({tasks:[a],out,config,fetchImpl:async(_,init)=>{const content=JSON.parse(init.body).messages[1].content;assert.match(content[1].image_url.url,/^data:image\/png;base64,/);assert.match(content[2].image_url.url,/^data:image\/jpeg;base64,/);return response([{exercise_id:a.exercise_id,hints:HINTS}]);}});
 fs.writeFileSync(png,"not png");assert.throws(()=>author.validateTask(a),{code:"TASK_IMAGE_HASH_MISMATCH"});images[0].sha256=createHash("sha256").update(fs.readFileSync(png)).digest("hex");assert.throws(()=>author.validateTask(a),{code:"TASK_IMAGE_MAGIC_MISMATCH"});
});
test("Q01 phase completes before Q02+, and later grades follow grade7→8→9",async t=>{
 const out=directory(t),tasks=[task("G9-T01-A-Q02א"),task("G8-T01-A-Q01א"),task("G7-T01-A-Q02א"),task("G7-T01-A-Q01א"),task("G8-T01-A-Q02א")],order=[];
 await author.run({tasks,out,config,batchSize:1,concurrency:4,fetchImpl:async(_,init)=>{const ask=requested(init);order.push(ask[0].exercise_id);return response(ask.map(x=>({exercise_id:x.exercise_id,hints:HINTS})));}});
 assert.deepEqual(order,["G7-T01-A-Q01א","G8-T01-A-Q01א","G7-T01-A-Q02א","G8-T01-A-Q02א","G9-T01-A-Q02א"]);
});
test("--help performs no credential read or provider call",()=>{
 const text=execFileSync(process.execPath,[path.join(__dirname,"../tools/ramzi-hints/author-flash-hints.cjs"),"--help"],{encoding:"utf8"});assert.match(text,/qwen3\.8-flash/);assert.match(text,/rows\.json/);assert.match(text,/resume/);
});
test("curriculum transport is compact without changing task fingerprints or printed givens",async t=>{
 const out=directory(t),a=task();a.source.given=[{printed:"נתון מדויק"}];a.source.curriculum={grade:"7",track:"ז",topic:"numbers",unit:"מספרים",allowed_tools:[{id:"a",name:"כלי מותר",extra:"omit"}],not_yet_allowed:Array.from({length:242},()=>({id:"x",name:"not allowed",description:"large private context"}))};
 const fingerprint=author.fingerprint(a);
 await author.run({tasks:[a],out,config,fetchImpl:async(_,init)=>{const packet=JSON.parse(JSON.parse(init.body).messages[1].content[0].text),context=Object.values(packet.contexts)[0];assert.deepEqual(context.given,a.source.given);assert.deepEqual(context.curriculum.allowed_tools,[{id:"a",name:"כלי מותר"}]);assert.equal(context.curriculum.not_yet_allowed,undefined);assert.match(context.curriculum.method_policy,/allowed_tools/);assert.doesNotMatch(JSON.stringify(packet),/large private context|not_yet_allowed/);return response([{exercise_id:a.exercise_id,hints:HINTS}]);}});
 assert.equal(author.fingerprint(a),fingerprint);assert.equal(read(out,"manifest.json").taskFingerprints[0].taskFingerprint,fingerprint);
 for(const word of ["אחד","אחת","שני","שתי","מחצית","רבע"]){assert.ok(author.INSTRUCTIONS.includes(word));}
});
test("one private output directory cannot run two authoring processes concurrently",async t=>{
 const out=directory(t);let finish;const pending=new Promise(r=>finish=r);let entered;const started=new Promise(r=>entered=r);
 const first=author.run({tasks:[task()],out,config,fetchImpl:async()=>{entered();await pending;return response([{exercise_id:task().exercise_id,hints:HINTS}]);}});
 await started;await assert.rejects(author.run({tasks:[task()],out,config,fetchImpl:()=>{throw Error("duplicate paid call");}}),{code:"OUTPUT_BUSY"});finish();await first;assert.equal(fs.existsSync(path.join(out,".authoring.lock")),false);
});
test("repair feedback carries the exact rejected candidate and matched prefixed number words",async t=>{
 const out=directory(t),a=task(),b=task("G7-T01-A-Q01ב"),bad=["איך בודקים את שני הצדדים משני צדי האפס?",...HINTS.slice(1)];let calls=0;
 assert.deepEqual(author.firstNumberMatches(bad[0]),["שני","משני","האפס"]);assert.deepEqual(author.firstNumberMatches("איך כל אחד קשור לאפס ולשתי קבוצות?"),["אחד","לאפס","ולשתי"]);
 const original=author.fingerprint(a);
 await author.run({tasks:[a,b],out,config,sleepImpl:async()=>{},fetchImpl:async(_,init)=>{
  calls++;const payload=JSON.parse(init.body),packet=JSON.parse(payload.messages[1].content[0].text);
  if(calls===1)return response([{exercise_id:a.exercise_id,hints:bad},{exercise_id:b.exercise_id,hints:HINTS}]);
  assert.deepEqual(packet.tasks.map(x=>x.exercise_id),[a.exercise_id]);const feedback=packet.validation_failures[a.exercise_id];assert.deepEqual(feedback.previous_invalid_hints,bad);assert.deepEqual(feedback.first_hint_offending_number_literals,["שני","משני","האפס"]);assert.match(feedback.instruction,/כל סולם/);assert.match(payload.messages[0].content,/שאלה מכוונת/);return response([{exercise_id:a.exercise_id,hints:HINTS}]);
 }});
 assert.equal(calls,2);assert.equal(read(out,"rows.json").length,2);assert.equal(author.fingerprint(a),original);
});
test("new hint1 must end in a question mark; already accepted checkpoints remain immutable",async t=>{
 const a=task(),declarative=["חשבו על הקשר לנתונים.",...HINTS.slice(1)],checked=author.validateResponse(JSON.stringify({rows:[{exercise_id:a.exercise_id,hints:declarative}]}),[a]);
 assert.equal(checked.valid.length,0);assert.equal(checked.invalid.get(a.exercise_id),"first hint must end with a guiding question mark");assert.deepEqual(checked.feedback.get(a.exercise_id).previous_invalid_hints,declarative);
 const out=directory(t);fs.mkdirSync(path.join(out,"rows"));const key=author.fingerprint(a),record={taskFingerprint:key,model:author.MODEL,provenance:author.PROVENANCE,row:author.preparedRow(a,declarative)};fs.writeFileSync(path.join(out,"rows",key+".json"),JSON.stringify(record));
 const result=await author.run({tasks:[a],out,config,fetchImpl:()=>{throw Error("accepted checkpoint must not be regenerated");}});assert.equal(result.completed,1);assert.deepEqual(read(out,"rows.json")[0].hints,declarative);
});
test("HTTP400 batches split to triples then singles; unrelated tasks succeed and singleton retries stay bounded",async t=>{
 const out=directory(t),tasks=Array.from({length:12},(_,i)=>task("G7-T01-A-Q01"+String.fromCharCode(1488+i))),bad=tasks[1].exercise_id,calls=[],accepted=new Set(),logs=[],fingerprints=tasks.map(author.fingerprint);
 const result=await author.run({tasks,out,config,concurrency:4,sleepImpl:async()=>{},log:entry=>logs.push(entry),fetchImpl:async(_,init)=>{
  const ask=requested(init),ids=ask.map(x=>x.exercise_id);calls.push(ids);assert.equal(JSON.parse(init.body).model,author.MODEL);
  assert.ok(ids.every(id=>!accepted.has(id)),"accepted rows must never be sent again");
  if(ids.length>3||ids.includes(bad))return {ok:false,status:400,text:async()=>"private error "+SECRET};
  ids.forEach(id=>accepted.add(id));return response(ids.map(exercise_id=>({exercise_id,hints:HINTS})));
 }});
 assert.equal(result.completed,11);assert.equal(result.failed,1);assert.equal(calls.filter(ids=>ids.length===12).length,1);assert.equal(calls.filter(ids=>ids.length===3&&ids.includes(bad)).length,1);assert.equal(calls.filter(ids=>ids.length===1&&ids[0]===bad).length,3);
 assert.deepEqual(logs.filter(x=>x.event==="http400_split").map(x=>x.childSizes),[[3,3,3,3],[1,1,1]]);assert.ok(logs.filter(x=>x.event==="http400_split").every(x=>x.failed===0));
 assert.deepEqual(read(out,"failures.json").map(x=>[x.exercise_id,x.code]),[[bad,"HTTP_400"]]);assert.doesNotMatch(allText(out),new RegExp(SECRET));assert.deepEqual(tasks.map(author.fingerprint),fingerprints);
 const recovery=[];const resumed=await author.run({tasks,out,config,fetchImpl:async(_,init)=>{const ids=requested(init).map(x=>x.exercise_id);recovery.push(ids);return response(ids.map(exercise_id=>({exercise_id,hints:HINTS})));}});assert.equal(resumed.completed,12);assert.deepEqual(recovery,[[bad]]);
});
test("HTTP400 after partial validation preserves invalid-candidate feedback and never repeats accepted rows",async t=>{
 const out=directory(t),tasks=[task(),task("G7-T01-A-Q01ב"),task("G7-T01-A-Q01ג")],calls=[],badHints=["איך שני נתונים קשורים?",...HINTS.slice(1)];
 const result=await author.run({tasks,out,config,concurrency:2,sleepImpl:async()=>{},fetchImpl:async(_,init)=>{
  const packet=JSON.parse(JSON.parse(init.body).messages[1].content[0].text),ids=packet.tasks.map(x=>x.exercise_id);calls.push(ids);
  if(calls.length===1)return response([{exercise_id:tasks[0].exercise_id,hints:HINTS},...tasks.slice(1).map(x=>({exercise_id:x.exercise_id,hints:badHints}))]);
  assert.ok(!ids.includes(tasks[0].exercise_id));
  if(ids.length===2)return {ok:false,status:400,text:async()=>"omitted"};
  const feedback=packet.validation_failures[ids[0]];assert.deepEqual(feedback.previous_invalid_hints,badHints);assert.deepEqual(feedback.first_hint_offending_number_literals,["שני"]);assert.equal(feedback.request_error,"HTTP_400");return response(ids.map(exercise_id=>({exercise_id,hints:HINTS})));
 }});
 assert.equal(result.completed,3);assert.equal(result.failed,0);assert.deepEqual(calls.map(x=>x.length),[3,2,1,1]);
});
test("split children finish inside their original grade phase before later-grade jobs start",async t=>{
 const out=directory(t),tasks=[task(),task("G7-T01-A-Q01ב"),task("G8-T01-A-Q01א")];let completedGrade7=0;const calls=[];
 await author.run({tasks,out,config,concurrency:4,sleepImpl:async()=>{},fetchImpl:async(_,init)=>{
  const ask=requested(init);calls.push(ask.map(x=>x.exercise_id));
  if(ask.length===2)return {ok:false,status:400,text:async()=>"omitted"};
  if(ask[0].grade===8)assert.equal(completedGrade7,2);else completedGrade7++;
  return response(ask.map(x=>({exercise_id:x.exercise_id,hints:HINTS})));
 }});
 assert.deepEqual(calls.map(x=>x.length),[2,1,1,1]);
});
