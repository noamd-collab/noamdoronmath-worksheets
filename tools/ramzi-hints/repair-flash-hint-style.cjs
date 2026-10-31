#!/usr/bin/env node
"use strict";
// Repair syntax in already-authored Flash candidates. This is not a math judge,
// source reader or alternate authoring route; printed source/images never enter
// the request. The unchanged builder is the final acceptance gate.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const author=require("./author-flash-hints.cjs");
const {hintIssue,privatePacketDirectory}=require("./build-ramzi-hints.cjs");
const {MODEL,PROVENANCE}=author,REPO=path.resolve(__dirname,"../..");
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
function problem(code){const error=new Error(code);error.code=code;return error;}
const NUMBER_WORDS="אפס|אחד|אחת|שניים|שתיים|שני|שתי|שלוש|שלושה|שלושת|ארבע|ארבעה|ארבעת|חמש|חמישה|חמשת|שש|שישה|ששת|שבע|שבעה|שבעת|שמונה|שמונת|תשע|תשעה|תשעת|עשר|עשרה|עשרת|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים|אלפים|חצי|מחצית|רבע";
const OTHER_PATTERN="^[^=<>≠≤≥/]*$";
// No regex flags are assumed by the provider. The local Unicode-aware builder
// still catches every numeric character and pointed Hebrew variant afterwards.
const FIRST_PATTERN="^(?![\\s\\S]*(?:^|[^א-תA-Za-z])[ובכלמשה]{0,3}(?:"+NUMBER_WORDS+")(?:$|[^א-תA-Za-z]))[^0-9٠-٩۰-۹０-９=<>≠≤≥/]*\\?$";
const SAFE=["איזה קשר עשוי לעזור?","בדקו את הקשר לנתונים.","בחרו כיצד להמשיך."];
const QUESTION_ISSUE="first hint must end with a guiding question mark";
function hintProblems(hints){return hints.map((hint,index)=>{
  const probe=SAFE.slice();probe[index]=hint;
  return hintIssue(probe)||(index===0&&!hint.trim().endsWith("?")?QUESTION_ISSUE:null);
});}
function validateProposal(proposal){
  if(!proposal||typeof proposal!=="object"||Array.isArray(proposal)||Object.keys(proposal).some(k=>!["task","hints","issue"].includes(k))||
      !Array.isArray(proposal.hints)||proposal.hints.length!==3||proposal.hints.some(h=>typeof h!=="string"||!h.trim()||h.length>3000)||
      typeof proposal.issue!=="string"||!proposal.issue||proposal.issue.length>250)throw problem("INVALID_STYLE_PROPOSAL");
  author.validateTask(proposal.task);
  const issues=hintProblems(proposal.hints);
  if(!issues.some(Boolean))throw problem("STYLE_REPAIR_NOT_NEEDED");
  // A source ambiguity, missing image, transport failure or arbitrary assertion
  // is never converted into permission for a style-only rewrite.
  if(!issues.includes(proposal.issue))throw problem("ISSUE_NOT_STRUCTURAL_MATCH");
  return proposal;
}
function proposalFingerprint(proposal){return author.fingerprint(proposal);}
function schemaFor(proposal){
  validateProposal(proposal);const issues=hintProblems(proposal.hints);
  return {type:"json_schema",json_schema:{name:"ramzi_hint_style_repair",strict:true,schema:{
    type:"object",additionalProperties:false,required:["exercise_id","hints"],properties:{
      exercise_id:{type:"string",const:proposal.task.exercise_id},
      hints:{type:"array",minItems:3,maxItems:3,prefixItems:proposal.hints.map((hint,index)=>issues[index]?
        {type:"string",minLength:1,maxLength:600,pattern:index===0?FIRST_PATTERN:OTHER_PATTERN}:
        {type:"string",const:hint}),items:false}
    }
  }}};
}
const INSTRUCTIONS=[
  "בצעו תיקון ניסוח בלבד בשלושה רמזים שכבר נכתבו עם Qwen3.8 Flash. אין כאן בקשה לפתור תרגיל, לבדוק נכונות מתמטית, לשפוט תוכן או להוסיף רמז חדש.",
  "שמרו על המשמעות ועל סדר ההתקדמות של הנוסח הנתון. אין להוסיף נתון, מסקנה, תשובה, חישוב או הסבר חדש. אין לשחזר מקור או לנחש נתונים חסרים.",
  "שנו רק רמז שמסומן כבלתי תקין. כל רמז תקין חייב להישאר זהה לחלוטין, כולל רווחים וסימני פיסוק. אין לשנות ניסוח תקין לשם שיפור סגנון.",
  "הרמז הראשון יהיה שאלה מכוונת המסתיימת בסימן שאלה, בלי למסור כלל או מסקנה הפותרים את הסעיף. אסור לכתוב בו ספרות או מספרים במילים, גם עם קידומות עבריות.",
  "המילים האסורות ברמז הראשון: "+NUMBER_WORDS.split("|").join(", ")+". גם ניסוחים כמו כל אחד, שני הצדדים, משני צדי האפס אסורים. נסחו את הקשר הרעיוני במילים איכותיות כאשר המשמעות מאפשרת זאת, למשל נקודת ייחוס; אל תבצעו החלפת מילים עיוורת ואל תשנו את התוכן המתמטי.",
  "בכל רמז עד שש מאות תווים, בלי סימני שוויון או השוואה ובלי לוכסן. אין קוד, קישורים, תמונות, איורים או שרטוטים. פלט JSON בלבד בהתאם לסכמה; אל תוסיפו שדות."
].join("\n");
function payloadFor(proposal,feedback,format="json_schema"){
  if(!["json_schema","json_object"].includes(format))throw problem("INVALID_RESPONSE_FORMAT");
  validateProposal(proposal);
  return {model:MODEL,enable_thinking:false,temperature:0.2,max_tokens:2200,response_format:format==="json_object"?{type:"json_object"}:schemaFor(proposal),messages:[
    {role:"system",content:INSTRUCTIONS},
    {role:"user",content:JSON.stringify({exercise_id:proposal.task.exercise_id,hints:proposal.hints,
      structural_issues:hintProblems(proposal.hints),immutable_hint_indices:hintProblems(proposal.hints).map((issue,index)=>issue?null:index).filter(index=>index!==null),
      output_contract:{exercise_id:proposal.task.exercise_id,hints:"exactly three strings; unchanged immutable hint slots; no other fields"},
      first_hint_offending_number_literals:author.firstNumberMatches(proposal.hints[0]),
      ...(feedback?{previous_repair_failure:feedback}:{})})}
  ]};
}
function checkResponse(content,proposal){
  let data;try{data=JSON.parse(content);}catch(_){return {issue:"INVALID_JSON"};}
  if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).some(k=>!["exercise_id","hints"].includes(k))||
      data.exercise_id!==proposal.task.exercise_id||!Array.isArray(data.hints)||data.hints.length!==3||data.hints.some(h=>typeof h!=="string"))return {issue:"INVALID_REPAIR_SHAPE"};
  const originalIssues=hintProblems(proposal.hints);
  if(data.hints.some((hint,index)=>!originalIssues[index]&&hint!==proposal.hints[index]))return {issue:"PRESERVED_HINT_CHANGED"};
  const issue=hintIssue(data.hints)||hintProblems(data.hints).find(Boolean)||null;
  return issue?{issue,hints:data.hints.map(h=>h.slice(0,3000)),offending:author.firstNumberMatches(data.hints[0])}:{hints:data.hints};
}
function atomic(file,value,key){const temp=file+"."+crypto.randomUUID()+".tmp";
  fs.writeFileSync(temp,author.redact(JSON.stringify(value,null,2)+"\n",key),{flag:"wx",mode:0o600});fs.renameSync(temp,file);
}
function lock(out){const file=path.join(out,".authoring.lock"),token=crypto.randomUUID();
  try{fs.writeFileSync(file,JSON.stringify({pid:process.pid,token}),{flag:"wx",mode:0o600});}catch(_){throw problem("OUTPUT_BUSY");}
  return ()=>{try{if(JSON.parse(fs.readFileSync(file,"utf8")).token===token)fs.unlinkSync(file);}catch(_){}};
}
async function complete(payload,config,fetchImpl,timeoutMs,save){
  const controller=new AbortController();let timer;
  const work=Promise.resolve().then(async()=>{
    const response=await fetchImpl(config.endpoint,{method:"POST",redirect:"error",headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:controller.signal});
    const text=await response.text();if(text.length>2*1024*1024)throw problem("RESPONSE_TOO_LARGE");
    save(response.ok?{httpStatus:response.status,body:author.redact(text,config.apiKey)}:{httpStatus:response.status,bodyOmitted:"non_success_response"});
    if(!response.ok)throw problem(response.status===400&&payload.response_format.type==="json_schema"?"SCHEMA_REQUEST_REJECTED_HTTP_400":"HTTP_"+String(response.status).replace(/\D/g,"").slice(0,3));
    let data;try{data=JSON.parse(text);}catch(_){throw problem("PROVIDER_JSON_INVALID");}
    if(data.model!==MODEL)throw problem("MODEL_MISMATCH");
    if(data.choices?.[0]?.finish_reason&&data.choices[0].finish_reason!=="stop")throw problem("PROVIDER_INCOMPLETE_RESPONSE");
    if(typeof data.choices?.[0]?.message?.content!=="string")throw problem("PROVIDER_CONTENT_MISSING");
    return {content:data.choices[0].message.content,usage:data.usage||null};
  });
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(problem("REQUEST_TIMEOUT"));},timeoutMs);});
  try{return await Promise.race([work,timeout]);}catch(error){throw problem(/^(?:HTTP_\d{3}|SCHEMA_REQUEST_REJECTED_HTTP_400|RESPONSE_TOO_LARGE|PROVIDER_JSON_INVALID|MODEL_MISMATCH|PROVIDER_INCOMPLETE_RESPONSE|PROVIDER_CONTENT_MISSING|REQUEST_TIMEOUT)$/.test(error?.code||"")?error.code:"TRANSPORT_FAILED");}finally{clearTimeout(timer);}
}
async function run(options){
  if(own(options,"model"))throw problem("MODEL_OVERRIDE_FORBIDDEN");
  if(!Array.isArray(options.proposals))throw problem("INVALID_PROPOSALS");
  const proposals=options.proposals.map(validateProposal),seen=new Set();
  for(const proposal of proposals){if(seen.has(proposal.task.exercise_id))throw problem("DUPLICATE_TASK_ID");seen.add(proposal.task.exercise_id);}
  const retries=options.retries??2,timeoutMs=options.requestTimeoutMs??120000;
  if(!Number.isInteger(retries)||retries<0||retries>2||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw problem("INVALID_LIMIT");
  const format=options.format??"json_schema";if(!["json_schema","json_object"].includes(format))throw problem("INVALID_RESPONSE_FORMAT");
  const config=options.config;if(!config?.apiKey||!config.endpoint?.startsWith("https://"))throw problem("INVALID_CONFIG");
  const out=privatePacketDirectory(REPO,options.out);fs.mkdirSync(out,{recursive:true,mode:0o700});
  for(const dir of ["rows","attempts"]){const target=path.join(out,dir);fs.mkdirSync(target,{recursive:true,mode:0o700});if(fs.realpathSync(target)!==target)throw problem("OUTPUT_SYMLINK");}
  const release=lock(out),done=new Map(),failures=new Map();let fatal=null;
  const summary=()=>({model:MODEL,provenance:PROVENANCE,total:proposals.length,completed:done.size,failed:failures.size,pending:proposals.length-done.size-failures.size});
  const sleep=options.sleepImpl||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  function snapshot(){
    const usage={requests:0,prompt_tokens:0,completion_tokens:0,total_tokens:0};
    for(const filename of fs.readdirSync(path.join(out,"attempts")).filter(n=>n.endsWith(".usage.json"))){
      let record;try{record=JSON.parse(fs.readFileSync(path.join(out,"attempts",filename),"utf8"));}catch(_){throw problem("USAGE_LEDGER_INVALID");}
      usage.requests++;for(const key of ["prompt_tokens","completion_tokens","total_tokens"]){const n=record.usage&&record.usage[key];if(Number.isFinite(n)&&n>=0)usage[key]+=n;}
    }
    atomic(path.join(out,"rows.json"),proposals.filter(p=>done.has(p.task.exercise_id)).map(p=>done.get(p.task.exercise_id).row),config.apiKey);
    atomic(path.join(out,"failures.json"),[...failures.values()],config.apiKey);
    const taskFingerprints=proposals.map(({task})=>({exercise_id:task.exercise_id,taskFingerprint:author.fingerprint(task),source_pdf_hash:task.source_pdf_hash,source_native_sha256:task.source_native_sha256,source_exercise_sha256:task.source_exercise_sha256}));
    atomic(path.join(out,"manifest.json"),{...summary(),authoring_model:MODEL,review:PROVENANCE,userAutomaticApproval:true,
      approvalBasis:"user_authorized_automatic_publication_without_model_review",repairMode:"text_only_style_repair_of_existing_flash_candidates",requested_response_format:format,
      taskSetFingerprint:author.fingerprint(proposals.map(p=>p.task)),taskFingerprints,
      proposalFingerprints:proposals.map(p=>({exercise_id:p.task.exercise_id,proposalFingerprint:proposalFingerprint(p)})),
      usage,usageScope:"all successful provider responses in this private output directory",updatedAt:new Date().toISOString()},config.apiKey);
  }
  try{
    for(const proposal of proposals){
      const task=proposal.task,file=path.join(out,"rows",author.fingerprint(task)+".json");if(!fs.existsSync(file))continue;
      let record;try{record=JSON.parse(fs.readFileSync(file,"utf8"));}catch(_){throw problem("CHECKPOINT_INVALID");}
      if(record.proposalFingerprint!==proposalFingerprint(proposal))throw problem("CHECKPOINT_PROPOSAL_MISMATCH");
      const old=author.loadCheckpoint(out,task);
      if(checkResponse(JSON.stringify({exercise_id:task.exercise_id,hints:old.row.hints}),proposal).issue)throw problem("CHECKPOINT_INVALID");
      done.set(task.exercise_id,old);
    }
    snapshot();
    for(const proposal of proposals){
      const task=proposal.task,id=task.exercise_id;if(done.has(id))continue;
      if(fatal){failures.set(id,{exercise_id:id,taskFingerprint:author.fingerprint(task),code:fatal});continue;}
      let feedback=null;
      for(let attempt=0;attempt<=retries;attempt++){
        const requestId=crypto.randomUUID();let issue;
        try{
          const payload=payloadFor(proposal,feedback,format);
          atomic(path.join(out,"attempts",requestId+".request.json"),{model:MODEL,attempt,taskFingerprint:author.fingerprint(task),proposalFingerprint:proposalFingerprint(proposal),payload},config.apiKey);
          const result=await complete(payload,config,options.fetchImpl||fetch,timeoutMs,response=>atomic(path.join(out,"attempts",requestId+".response.json"),response,config.apiKey));
          atomic(path.join(out,"attempts",requestId+".usage.json"),{model:MODEL,usage:result.usage},config.apiKey);
          const checked=checkResponse(result.content,proposal);
          if(!checked.issue){
            const record={taskFingerprint:author.fingerprint(task),proposalFingerprint:proposalFingerprint(proposal),model:MODEL,provenance:PROVENANCE,row:author.preparedRow(task,checked.hints)};
            atomic(path.join(out,"rows",record.taskFingerprint+".json"),record,config.apiKey);done.set(id,record);break;
          }
          issue=checked.issue;feedback=checked;
        }catch(error){issue=/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code||"")?error.code:"STYLE_REPAIR_FAILED";feedback={issue};}
        atomic(path.join(out,"attempts",requestId+".error.json"),{model:MODEL,attempt,code:issue},config.apiKey);
        if(["SCHEMA_REQUEST_REJECTED_HTTP_400","MODEL_MISMATCH","HTTP_400","HTTP_401","HTTP_403"].includes(issue)){fatal=issue;}
        if(fatal||attempt===retries){failures.set(id,{exercise_id:id,taskFingerprint:author.fingerprint(task),code:issue});break;}
        await sleep(Math.min(4000,1000*(attempt+1)));
      }
      snapshot();if(options.log)options.log(summary());
    }
    snapshot();return summary();
  }finally{release();}
}
const USAGE="Usage: node tools/ramzi-hints/repair-flash-hint-style.cjs --proposals private-proposals.json --env-file ignored.env.local --out /private/style-output [--retries 2] [--format json_schema|json_object]\nText-only qwen3.8-flash; strict JSON Schema by default. JSON object mode requires explicit selection and retains all local checks. No automatic model/format fallback or content review. Inputs: [{task:fullPinnedTask,hints:[old3],issue:exactAutomaticReason}]. Outputs: rows.json, manifest.json, failures.json and private attempt/checkpoint records. Use a dedicated output directory; reuse it to resume exact proposals.";
async function main(argv){
  if(argv.length===1&&["--help","-h"].includes(argv[0])){process.stdout.write(USAGE+"\n");return;}
  const args={};for(let i=0;i<argv.length;i+=2){if(!["--proposals","--env-file","--out","--retries","--format"].includes(argv[i])||!argv[i+1]||argv[i+1].startsWith("--")||own(args,argv[i]))throw problem("INVALID_ARGUMENTS");args[argv[i]]=argv[i+1];}
  for(const field of ["--proposals","--env-file","--out"])if(!args[field])throw problem("MISSING_ARGUMENTS");
  let proposals,env;try{proposals=JSON.parse(fs.readFileSync(args["--proposals"],"utf8"));}catch(_){throw problem("PROPOSALS_FILE_INVALID");}
  try{env=fs.readFileSync(args["--env-file"],"utf8");}catch(_){throw problem("ENV_FILE_UNREADABLE");}
  const result=await run({proposals,config:author.envConfig(env),out:args["--out"],retries:Number(args["--retries"]??2),format:args["--format"]??"json_schema",log:value=>process.stdout.write(JSON.stringify(value)+"\n")});
  process.stdout.write(JSON.stringify(result)+"\n");if(result.failed)process.exitCode=1;
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code||"")?error.code:"STYLE_REPAIR_FAILED");process.exitCode=1;});
module.exports={MODEL,PROVENANCE,INSTRUCTIONS,FIRST_PATTERN,OTHER_PATTERN,hintProblems,validateProposal,proposalFingerprint,schemaFor,payloadFor,checkResponse,run,USAGE};
