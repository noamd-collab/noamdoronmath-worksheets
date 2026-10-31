"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {execFileSync}=require("node:child_process");
const repair=require("../tools/ramzi-hints/repair-flash-hint-style.cjs"),author=require("../tools/ramzi-hints/author-flash-hints.cjs"),builder=require("../tools/ramzi-hints/build-ramzi-hints.cjs");
const HINTS=["איזה קשר לנקודת הייחוס עשוי לעזור?","  בדקו את הקשר לנתונים.  ","השוו בין 2 דרכי פעולה ובחרו כיצד להמשיך."];
const SECRET="fake-secret-style-key",config={apiKey:SECRET,endpoint:"https://example.invalid/chat/completions"};
function task(id="G7-T01-A-Q01א"){const text="מקור פרטי שאסור לשלוח לבקשת סגנון";return {exercise_id:id,source_pdf_hash:"a".repeat(32),source_native_sha256:"b".repeat(64),source_exercise_sha256:builder.sourceTaskHash(text),grade:Number(id[1]),topic:"מספרים",stage:"q01",source:{manifest_selected_text:text,private_context:"must-not-send",answer:"must-not-send-answer"}};}
function proposal(id){return {task:task(id),hints:["איך נתייחס לשני צדי האפס?",...HINTS.slice(1)],issue:"first hint contains a number"};}
function dir(t){const out=fs.mkdtempSync(path.join(os.tmpdir(),"ramzi-style-test-"));t.after(()=>fs.rmSync(out,{recursive:true,force:true}));return out;}
function response(id,hints=HINTS,extra={}){return {ok:true,status:200,text:async()=>JSON.stringify({model:repair.MODEL,choices:[{finish_reason:"stop",message:{content:JSON.stringify({exercise_id:id,hints})}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},...extra})};}
function read(out,file){return JSON.parse(fs.readFileSync(path.join(out,file),"utf8"));}
function allText(out){return fs.readdirSync(out,{withFileTypes:true}).map(e=>e.isDirectory()?allText(path.join(out,e.name)):fs.readFileSync(path.join(out,e.name),"utf8")).join("\n");}

test("strict text-only schema pins identity and valid slots; provider receives no source or images",async t=>{
 const p=proposal(),out=dir(t),original=JSON.stringify(p);let calls=0;
 const result=await repair.run({proposals:[p],out,config,fetchImpl:async(_,init)=>{
  calls++;const body=JSON.parse(init.body);assert.equal(body.model,"qwen3.8-flash");assert.equal(body.enable_thinking,false);assert.equal(body.response_format.type,"json_schema");assert.equal(body.response_format.json_schema.strict,true);assert.equal(init.redirect,"error");
  const schema=body.response_format.json_schema.schema;assert.equal(schema.properties.exercise_id.const,p.task.exercise_id);assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.hints.items,false);assert.equal(schema.properties.hints.prefixItems[1].const,p.hints[1]);assert.equal(schema.properties.hints.prefixItems[2].const,p.hints[2]);assert.equal(schema.properties.hints.prefixItems[0].maxLength,600);
  assert.ok(body.messages.every(m=>typeof m.content==="string"));assert.doesNotMatch(JSON.stringify(body),/must-not-send|מקור פרטי|image_url|source_pdf_hash|source_native_sha256|manifest_selected_text/);
  assert.deepEqual(JSON.parse(body.messages[1].content).first_hint_offending_number_literals,["לשני","האפס"]);return response(p.task.exercise_id);
 }});
 assert.equal(calls,1);assert.equal(result.completed,1);assert.equal(JSON.stringify(p),original);const row=read(out,"rows.json")[0];assert.deepEqual(row.hints,HINTS);assert.equal(row.source_pdf_hash,p.task.source_pdf_hash);assert.equal(row.source_exercise_sha256,p.task.source_exercise_sha256);assert.equal(row.source,"ramzi-flash-authored-20261031");
 const manifest=read(out,"manifest.json");assert.equal(manifest.model,"qwen3.8-flash");assert.equal(manifest.review,author.PROVENANCE);assert.equal(manifest.usage.total_tokens,30);assert.equal(manifest.taskFingerprints[0].taskFingerprint,author.fingerprint(p.task));assert.equal(manifest.repairMode,"text_only_style_repair_of_existing_flash_candidates");
 await repair.run({proposals:[p],out,config,fetchImpl:async()=>{throw Error("must resume");}});assert.equal(read(out,"rows.json").length,1);
});
test("schema rejects number words, digits, comparison and slash while later slots may contain numbers",()=>{
 const first=new RegExp(repair.FIRST_PATTERN),other=new RegExp(repair.OTHER_PATTERN);
 assert.ok(first.test(HINTS[0]));for(const text of ["איך נתייחס לשני הצדדים?","איך נבחר משני כיוונים?","איך נביט באפס?","איך יתקבל 2?","איך x=2?","איך x<y?","איך x/y?","חשבו על הקשר."]){assert.equal(first.test(text),false,text);}
 assert.ok(other.test(HINTS[2]));for(const text of ["x=y","x>y","x≤y","a/b"]){assert.equal(other.test(text),false);}
 const p=proposal();for(const firstHint of ["איך נביט בִּשְׁנֵי הצדדים?","איך נביט ב²?"]){assert.equal(repair.checkResponse(JSON.stringify({exercise_id:p.task.exercise_id,hints:[firstHint,...p.hints.slice(1)]}),p).issue,"first hint contains a number");}
});
test("valid or nonstructural proposals never call a provider; source hashes and duplicate IDs remain pinned",async t=>{
 const out=dir(t),p=proposal();let calls=0;const opts={out,config,fetchImpl:async()=>{calls++;throw Error("must not call");}};
 await assert.rejects(repair.run({...opts,proposals:[{...p,hints:HINTS}]}),{code:"STYLE_REPAIR_NOT_NEEDED"});
 await assert.rejects(repair.run({...opts,proposals:[{...p,hints:[HINTS[0]+" ",...HINTS.slice(1)]}]}),{code:"STYLE_REPAIR_NOT_NEEDED"});
 await assert.rejects(repair.run({...opts,proposals:[{...p,issue:"SOURCE_AMBIGUOUS"}]}),{code:"ISSUE_NOT_STRUCTURAL_MATCH"});
 await assert.rejects(repair.run({...opts,proposals:[{...p,issue:"HTTP_400"}]}),{code:"ISSUE_NOT_STRUCTURAL_MATCH"});
 await assert.rejects(repair.run({...opts,proposals:[{...p,task:{...p.task,source_exercise_sha256:"c".repeat(64)}}]}),{code:"TASK_TEXT_HASH_MISMATCH"});
 await assert.rejects(repair.run({...opts,proposals:[p,p]}),{code:"DUPLICATE_TASK_ID"});
 await assert.rejects(repair.run({...opts,proposals:[p],model:"qwen3.8-flash"}),{code:"MODEL_OVERRIDE_FORBIDDEN"});assert.equal(calls,0);
});
test("explicit JSON object mode preserves every local gate and records the requested format without fallback",async t=>{
 const p=proposal(),out=dir(t);let calls=0;
 const result=await repair.run({proposals:[p],out,config,format:"json_object",sleepImpl:async()=>{},fetchImpl:async(_,init)=>{
  calls++;const payload=JSON.parse(init.body),packet=JSON.parse(payload.messages[1].content);
  assert.deepEqual(payload.response_format,{type:"json_object"});assert.equal(payload.model,"qwen3.8-flash");assert.deepEqual(packet.immutable_hint_indices,[1,2]);assert.equal(packet.output_contract.exercise_id,p.task.exercise_id);
  return response(p.task.exercise_id,calls===1?[HINTS[0],"אסור לשנות רמז תקין.",HINTS[2]]:HINTS);
 }});
 assert.equal(calls,2);assert.equal(result.completed,1);assert.deepEqual(read(out,"rows.json")[0].hints,HINTS);assert.equal(read(out,"manifest.json").requested_response_format,"json_object");
 const rejected=dir(t);let deniedCalls=0;await repair.run({proposals:[p],out:rejected,config,format:"json_object",fetchImpl:async()=>{deniedCalls++;return {ok:false,status:400,text:async()=>"error"};}});
 assert.equal(deniedCalls,1);assert.equal(read(rejected,"manifest.json").requested_response_format,"json_object");assert.deepEqual(read(rejected,"rows.json"),[]);
 await assert.rejects(repair.run({proposals:[p],out:dir(t),config,format:"text"}),{code:"INVALID_RESPONSE_FORMAT"});
});
test("const preservation and final builder gates reject malicious or noncompliant responses",()=>{
 const p=proposal(),content=value=>JSON.stringify(value);
 for(const data of [{exercise_id:"G7-T01-A-Q01ב",hints:HINTS},{exercise_id:p.task.exercise_id,hints:HINTS,answer:"new answer"},{exercise_id:p.task.exercise_id,hints:HINTS.slice(0,2)},{rows:[{exercise_id:p.task.exercise_id,hints:HINTS}]}])assert.equal(repair.checkResponse(content(data),p).issue,"INVALID_REPAIR_SHAPE");
 assert.equal(repair.checkResponse("{broken",p).issue,"INVALID_JSON");
 assert.equal(repair.checkResponse(content({exercise_id:p.task.exercise_id,hints:[HINTS[0],HINTS[1].trim(),HINTS[2]]}),p).issue,"PRESERVED_HINT_CHANGED");
 for(const first of ["איך הקשר &lt; אחר?","איך מתקבל a/b?","תשובה סופית: כך?","a".repeat(601)+"?"]){assert.ok(repair.checkResponse(content({exercise_id:p.task.exercise_id,hints:[first,...p.hints.slice(1)]}),p).issue);}
 const secondBad={...p,hints:[HINTS[0],"בדקו x=y.",HINTS[2]],issue:"hint contains a comparison or equality"};const slots=repair.schemaFor(secondBad).json_schema.schema.properties.hints.prefixItems;assert.equal(slots[0].const,HINTS[0]);assert.equal(slots[2].const,HINTS[2]);assert.equal(slots[1].pattern,repair.OTHER_PATTERN);
});
test("failed style repairs retry at most twice with exact feedback and never publish invalid rows",async t=>{
 const p=proposal(),out=dir(t);let calls=0;
 const result=await repair.run({proposals:[p],out,config,sleepImpl:async()=>{},fetchImpl:async(_,init)=>{
  calls++;const body=JSON.parse(init.body),packet=JSON.parse(body.messages[1].content);assert.equal(body.model,"qwen3.8-flash");assert.equal(body.response_format.type,"json_schema");if(calls>1){assert.equal(packet.previous_repair_failure.issue,"first hint contains a number");assert.deepEqual(packet.previous_repair_failure.offending,["לשני","האפס"]);}return response(p.task.exercise_id,p.hints);
 }});assert.equal(calls,3);assert.equal(result.failed,1);assert.deepEqual(read(out,"rows.json"),[]);assert.equal(read(out,"failures.json")[0].code,"first hint contains a number");
});
test("schema rejection stops immediately and omits error bodies; never downgrades model or response format",async t=>{
 const out=dir(t),ps=[proposal(),proposal("G7-T01-A-Q01ב")];let calls=0;
 const result=await repair.run({proposals:ps,out,config,fetchImpl:async()=>{calls++;return {ok:false,status:400,text:async()=>SECRET+" schema pattern unsupported"};}});
 assert.equal(calls,1);assert.equal(result.failed,2);assert.ok(read(out,"failures.json").every(r=>r.code==="SCHEMA_REQUEST_REJECTED_HTTP_400"));assert.doesNotMatch(allText(out),new RegExp(SECRET));assert.match(allText(out),/non_success_response/);assert.deepEqual(read(out,"rows.json"),[]);
});
test("wrong model is fatal, incomplete output is rejected, and hanging body aborts within the attempt deadline",async t=>{
 const p=proposal(),out=dir(t);let calls=0;
 const result=await repair.run({proposals:[p,proposal("G7-T01-A-Q01ב")],out,config,fetchImpl:async()=>{calls++;return response(p.task.exercise_id,HINTS,{model:"unexpected-model"});}});assert.equal(calls,1);assert.equal(result.failed,2);
 const truncated=dir(t);await repair.run({proposals:[p],out:truncated,config,retries:0,fetchImpl:async()=>response(p.task.exercise_id,HINTS,{choices:[{finish_reason:"length",message:{content:JSON.stringify({exercise_id:p.task.exercise_id,hints:HINTS})}}]})});assert.equal(read(truncated,"failures.json")[0].code,"PROVIDER_INCOMPLETE_RESPONSE");
 let signal;const hung=dir(t);await repair.run({proposals:[p],out:hung,config,retries:0,requestTimeoutMs:5,fetchImpl:async(_,init)=>{signal=init.signal;return {ok:true,status:200,text:()=>new Promise(()=>{})};}});assert.equal(signal.aborted,true);assert.equal(read(hung,"failures.json")[0].code,"REQUEST_TIMEOUT");
});
test("changed proposals and corrupt checkpoints cannot silently reuse or overwrite accepted repairs",async t=>{
 const out=dir(t),p=proposal();await repair.run({proposals:[p],out,config,fetchImpl:async()=>response(p.task.exercise_id)});
 let calls=0;const opts={out,config,fetchImpl:async()=>{calls++;throw Error("must not call");}};
 await assert.rejects(repair.run({...opts,proposals:[{...p,hints:["איך נבחר שני כיוונים?",...p.hints.slice(1)]}]}),{code:"CHECKPOINT_PROPOSAL_MISMATCH"});
 fs.writeFileSync(path.join(out,"rows",author.fingerprint(p.task)+".json"),"broken");await assert.rejects(repair.run({...opts,proposals:[p]}),{code:"CHECKPOINT_INVALID"});assert.equal(calls,0);
});
test("private output lock, safe errors and --help keep credentials and artifacts out of the public checkout",async t=>{
 const p=proposal(),out=dir(t);let release,entered;const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const first=repair.run({proposals:[p],out,config,fetchImpl:async()=>{entered();await waiting;return response(p.task.exercise_id);}});await started;
 await assert.rejects(repair.run({proposals:[p],out,config}),{code:"OUTPUT_BUSY"});release();await first;
 await assert.rejects(repair.run({proposals:[p],out:path.join(__dirname,"../private-style-output"),config}));
 const secretOut=dir(t);let calls=0;await repair.run({proposals:[p],out:secretOut,config,sleepImpl:async()=>{},fetchImpl:async()=>{calls++;throw Error("Bearer "+SECRET);}});assert.equal(calls,3);assert.doesNotMatch(allText(secretOut),new RegExp(SECRET));
 const help=execFileSync(process.execPath,[path.join(__dirname,"../tools/ramzi-hints/repair-flash-hint-style.cjs"),"--help"],{encoding:"utf8"});assert.match(help,/qwen3\.8-flash/);assert.match(help,/rows\.json/);
});
