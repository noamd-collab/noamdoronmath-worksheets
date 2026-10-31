#!/usr/bin/env node
"use strict";
// One-time authoring, never a reviewer or a runtime fallback. All artifacts are
// private; the existing builder remains the separate publication boundary.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {createRequire}=require("node:module");
const {hintIssue,sourceTaskHash,privatePacketDirectory,SITE_ID_RE}=require("./build-ramzi-hints.cjs");
const REPO=path.resolve(__dirname,"../.."),MODEL="qwen3.8-flash";
const PROVENANCE="machine_generated_flash_automatic_checks_no_model_review";
const ROW_SOURCE="ramzi-flash-authored-20261031";
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function problem(code){const error=new Error(code);error.code=code;return error;}
function stable(value){
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
function fingerprint(task){return sha(stable(task));}
function redact(value,apiKey){
  let text=String(value);
  for(const secret of [apiKey,apiKey&&encodeURIComponent(apiKey)].filter(Boolean))text=text.split(secret).join("[REDACTED]");
  return text.replace(/Bearer\s+[^\s"'<>]+/gi,"Bearer [REDACTED]");
}
function envConfig(text){
  const values={};
  for(const line of String(text).split(/\r?\n/)){
    const m=line.match(/^\s*(?:export\s+)?(QWEN_API_KEY|QWEN_BASE_URL)\s*=\s*(.*?)\s*$/);
    if(!m)continue;
    if(own(values,m[1]))throw problem("DUPLICATE_ENV_FIELD");
    let value=m[2];
    if(value.startsWith('"')||value.startsWith("'")){
      const quote=value[0],end=value.lastIndexOf(quote);
      if(end===0||!/^\s*(?:#.*)?$/.test(value.slice(end+1)))throw problem("INVALID_ENV_FIELD");
      value=value.slice(1,end);
    }else value=value.replace(/\s+#.*$/,"").trim();
    values[m[1]]=value;
  }
  const apiKey=values.QWEN_API_KEY;
  if(typeof apiKey!=="string"||apiKey.length<8||/[\r\n]/.test(apiKey))throw problem("MISSING_API_KEY");
  let url;try{url=new URL(values.QWEN_BASE_URL);}catch(_){throw problem("INVALID_BASE_URL");}
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)throw problem("INVALID_BASE_URL");
  url.pathname=url.pathname.replace(/\/+$/,"");
  if(!url.pathname.endsWith("/chat/completions"))url.pathname+="/chat/completions";
  return {apiKey,endpoint:url.href};
}
function imageMime(bytes,filename){
  if(/\.svg$/i.test(filename))return "image/svg+xml";
  if(/\.png$/i.test(filename)&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(/\.jpe?g$/i.test(filename)&&bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  throw problem("TASK_IMAGE_MAGIC_MISMATCH");
}
function validateTask(task){
  if(!task||!SITE_ID_RE.test(task.exercise_id||"")||!/^G[789]-/.test(task.exercise_id)||
      !/^[a-f0-9]{32}$/.test(task.source_pdf_hash||"")||
      !(task.source_native_sha256===null||/^[a-f0-9]{64}$/.test(task.source_native_sha256||""))||
      !/^[a-f0-9]{64}$/.test(task.source_exercise_sha256||"")||
      ![7,8,9].includes(task.grade)||typeof task.topic!=="string"||!task.topic.trim()||
      typeof task.stage!=="string"||!task.stage||!task.source||typeof task.source!=="object"||Array.isArray(task.source)||
      typeof task.source.manifest_selected_text!=="string"||!task.source.manifest_selected_text.trim())throw problem("INVALID_TASK");
  if(sourceTaskHash(task.source.manifest_selected_text)!==task.source_exercise_sha256)throw problem("TASK_TEXT_HASH_MISMATCH");
  if(task.images!==undefined&&!Array.isArray(task.images))throw problem("INVALID_TASK_IMAGES");
  for(const image of task.images||[]){
    if(!image||!path.isAbsolute(image.path||"")||!/\.(svg|png|jpe?g)$/i.test(image.path)||
        !/^[a-f0-9]{64}$/.test(image.sha256||"")||typeof image.figure_id!=="string"||!image.figure_id)throw problem("INVALID_TASK_IMAGE");
    let bytes;try{bytes=fs.readFileSync(image.path);}catch(_){throw problem("TASK_IMAGE_MISSING");}
    if(sha(bytes)!==image.sha256)throw problem("TASK_IMAGE_HASH_MISMATCH");
    imageMime(bytes,image.path);
  }
  return task;
}
function readTasks(file){
  let text;try{text=fs.readFileSync(file,"utf8");}catch(_){throw problem("TASK_FILE_UNREADABLE");}
  let tasks;try{tasks=text.trim().startsWith("[")?JSON.parse(text):text.split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line));}catch(_){throw problem("TASK_FILE_INVALID");}
  if(!Array.isArray(tasks))throw problem("TASK_FILE_INVALID");return tasks;
}
function splitBatches(tasks,size){
  const groups=new Map();
  for(const task of tasks){
    const question=(task.exercise_id.match(/-Q\d+/)||[])[0];
    const key=[task.stage,task.grade,task.source_pdf_hash,task.source_native_sha256,question].join(":");
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);
  }
  const ordered=[...groups.values()].flat(),batches=[];
  for(let i=0;i<ordered.length;i+=size)batches.push(ordered.slice(i,i+size));
  return batches;
}
function firstNumberMatches(hint){
  const normalized=String(hint||"").normalize("NFD").replace(/\p{M}/gu,"");
  const words=new RegExp("(?<![\\p{L}])[ובכלמשה]{0,3}(?:"+FIRST_NUMBER_WORDS+")(?![\\p{L}])","gu");
  return [...new Set([...normalized.matchAll(words),...normalized.matchAll(/\p{N}+/gu)].map(match=>match[0]))].slice(0,32);
}
function candidateFeedback(row,issue){
  const hints=Array.isArray(row&&row.hints)?row.hints.slice(0,3).map(hint=>typeof hint==="string"?hint.slice(0,1200):null):[];
  return {issue,previous_invalid_hints:hints,first_hint_offending_number_literals:firstNumberMatches(hints[0]),
    instruction:"כתבו מחדש את כל סולם הרמזים של הסעיף הזה בלבד. הרמז הפותח חייב להיות שאלה מכוונת שמסתיימת בסימן שאלה, ללא המילים המספריות שנמצאו או מספרים אחרים, ללא קביעה שמוסרת כלל או מסקנה הפותרים את הסעיף."};
}
function validateResponse(content,tasks){
  const asked=new Map(tasks.map(t=>[t.exercise_id,t])),valid=[],invalid=new Map(),feedback=new Map();
  function envelopeFailure(issue){for(const task of tasks){invalid.set(task.exercise_id,issue);feedback.set(task.exercise_id,{issue});}return {valid,invalid,feedback};}
  function fail(task,row,issue){invalid.set(task.exercise_id,issue);feedback.set(task.exercise_id,candidateFeedback(row,issue));}
  let data;try{data=JSON.parse(content);}catch(_){return envelopeFailure("INVALID_JSON");}
  if(!data||Object.keys(data).some(k=>k!=="rows")||!Array.isArray(data.rows))return envelopeFailure("INVALID_RESPONSE_SHAPE");
  if(data.rows.some(row=>!row||typeof row.exercise_id!=="string"||!asked.has(row.exercise_id)))return envelopeFailure("UNASKED_ID");
  const counts=new Map();for(const row of data.rows)counts.set(row.exercise_id,(counts.get(row.exercise_id)||0)+1);
  for(const task of tasks){
    const id=task.exercise_id;
    if(!counts.has(id)){fail(task,null,"MISSING_ID");continue;}
    if(counts.get(id)!==1){fail(task,null,"DUPLICATE_ID");continue;}
    const row=data.rows.find(r=>r.exercise_id===id);
    if(Object.keys(row).some(k=>!["exercise_id","hints","error"].includes(k))){fail(task,row,"UNEXPECTED_ROW_FIELD");continue;}
    if(own(row,"error")){fail(task,row,"SOURCE_AMBIGUOUS");continue;}
    const issue=hintIssue(row.hints)||(!row.hints[0].trim().endsWith("?")?"first hint must end with a guiding question mark":null);
    if(issue){fail(task,row,issue);continue;}
    valid.push({task,hints:row.hints.map(h=>h.trim())});
  }
  return {valid,invalid,feedback};
}
function atomicJson(file,value,apiKey){
  const temporary=file+"."+crypto.randomUUID()+".tmp";
  const text=redact(JSON.stringify(value,null,2)+"\n",apiKey);
  fs.writeFileSync(temporary,text,{flag:"wx",mode:0o600});
  fs.renameSync(temporary,file);
}
function preparedRow(task,hints){return {
  exercise_id:task.exercise_id,source_pdf_hash:task.source_pdf_hash,source_native_sha256:task.source_native_sha256,
  source_exercise_sha256:task.source_exercise_sha256,grade:task.grade,topic:task.topic,
  source:ROW_SOURCE,source_id:task.exercise_id,source_exercise_text:task.source.manifest_selected_text,
  hints,status:"verified",review_note:"נוצר עם Qwen3.8 Flash ועבר בדיקות מבניות אוטומטיות בלבד; לא נערכה בדיקת תוכן או סקירת מודל."
};}
function loadCheckpoint(out,task){
  const key=fingerprint(task),file=path.join(out,"rows",key+".json");
  if(!fs.existsSync(file))return null;
  let value;try{value=JSON.parse(fs.readFileSync(file,"utf8"));}catch(_){throw problem("CHECKPOINT_INVALID");}
  if(value.taskFingerprint!==key||value.model!==MODEL||value.provenance!==PROVENANCE||!value.row||
      stable(preparedRow(task,value.row.hints))!==stable(value.row)||hintIssue(value.row.hints))throw problem("CHECKPOINT_INVALID");
  return value;
}
const FIRST_NUMBER_WORDS="אפס|אחד|אחת|שניים|שתיים|שני|שתי|שלוש|שלושה|שלושת|ארבע|ארבעה|ארבעת|חמש|חמישה|חמשת|שש|שישה|ששת|שבע|שבעה|שבעת|שמונה|שמונת|תשע|תשעה|תשעת|עשר|עשרה|עשרת|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים|אלפים|חצי|מחצית|רבע";
const INSTRUCTIONS=[
  "כתבו שלושה רמזים קצרים, מדורגים ובעברית ניטרלית לכל סעיף שהתבקש. זו כתיבת רמזים, לא פתרון ולא סקירה.",
  "הרמז הראשון חייב להיות שאלה מכוונת שמסתיימת ב־? ופותחת דרך חשיבה בלי למסור כלל או מסקנה שעונים על הסעיף. אין קביעה, תוצאה או חישוב. בלי ספרות, בלי מספרים במילים בעברית ובלי שברים במילים.",
  "מילים אסורות ברמז הפתיחה: "+FIRST_NUMBER_WORDS.split("|").join(", ")+". האיסור חל גם עם קידומות ו, ב, כ, ל, מ, ש, ה. הימנעו במיוחד מהצירופים כל אחד, שני הצדדים, שתי הצלעות. כתבו במקום זאת על הנתונים, על הצלעות המתאימות או על הקשר למטרה בלי לציין כמות.",
  "הרמז הבא מציע דרך פעולה. הרמז האחרון מקדם עד לפני הפתרון, בלי התוצאה הסופית ובלי ביצוע החישוב המכריע.",
  "כל רמז עד שש מאות תווים. אין סימני שוויון או השוואה (= < > ≠ ≤ ≥), אין לוכסן / ואין קוד, תמונות, שרטוטים או קישורים בפלט.",
  "השתמשו רק בנתונים המודפסים בהקשר של אותו סעיף. אל תמציאו נתון או תוצאה. סעיפים קודמים הם הקשר אפשרי, לא פתרונות שכבר הוכחו.",
  "מטרת הוכחה או בנייה אינה נתון. מיקום בקובץ SVG וקואורדינטות ציור אינם מדידות מתמטיות. ציור אינו בקנה מידה, אלא אם יש צירים מסומנים או נתון מפורש.",
  "context_ref מפנה להקשר השאלה בcontexts; previous_part_refs מפנים לסעיפים קודמים בpriorParts. קראו רק את ההפניות של המשימה. כל משימה עצמאית. אין להעביר נתונים בין סעיפים. אם חסר נתון או שהמקור עמום, החזירו עבור הסעיף error במקום להמציא רמזים.",
  "בתיקון יופיעו validation_failures עם הרמזים שנפסלו והמילים המספריות שנמצאו. כתבו מחדש סולם שלם רק למזהים שהתבקשו שוב. החליפו את הניסוח הבעייתי; אל תחזרו על אותם רמזים שנפסלו. זו כתיבה מחדש בעקבות בדיקת מבנה, לא סקירת תוכן.",
  'החזירו JSON בלבד: {"rows":[{"exercise_id":"המזהה המדויק","hints":["רמז","רמז","רמז"]}]}. בסעיף עמום: {"exercise_id":"המזהה המדויק","error":"source_ambiguous"}. כל מזהה פעם אחת, בלי שדות נוספים.'
].join("\n");
function sharpRenderer(modulePath){
  let sharp;
  try{sharp=modulePath?require(path.resolve(modulePath)):require("sharp");}
  catch(_){try{sharp=createRequire(path.join(REPO,"headless/astro-poc/package.json"))("sharp");}catch(_){throw problem("IMAGE_RENDERER_UNAVAILABLE");}}
  return async image=>{
    const bytes=fs.readFileSync(image.path);if(sha(bytes)!==image.sha256)throw problem("TASK_IMAGE_HASH_MISMATCH");
    const text=bytes.toString("utf8");
    if(/<!DOCTYPE|<!ENTITY|(?:href|url)\s*[=(]\s*["']?\s*(?:https?:|file:|\/\/)/i.test(text))throw problem("SVG_EXTERNAL_REFERENCE");
    try{return await sharp(bytes,{density:144,limitInputPixels:20000000}).resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).png().toBuffer();}
    catch(_){throw problem("IMAGE_RENDER_FAILED");}
  };
}
function compactCurriculum(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const compact={};
  for(const key of ["grade","track","topic","unit"]){if(["string","number"].includes(typeof value[key]))compact[key]=value[key];}
  compact.allowed_tools=(Array.isArray(value.allowed_tools)?value.allowed_tools:[]).map(tool=>{
    if(typeof tool==="string")return {name:tool};
    if(!tool||typeof tool!=="object")return null;
    const item={};for(const key of ["id","name"]){if(typeof tool[key]==="string")item[key]=tool[key];}return Object.keys(item).length?item:null;
  }).filter(Boolean);
  compact.method_policy="השתמשו רק בשיטות שברשימת allowed_tools; אין להשתמש בשיטות שטרם נלמדו או להמציא נתונים.";
  return compact;
}
async function contentFor(tasks,issues,render,imageCache){
  const images=new Map();
  for(const task of tasks)for(const image of task.images||[]){
    const item=images.get(image.sha256)||{image,exerciseIds:[],figureIds:[]};
    item.exerciseIds.push(task.exercise_id);item.figureIds.push(image.figure_id);images.set(image.sha256,item);
  }
  const contexts=Object.create(null),priorParts=Object.create(null);
  const packetTasks=tasks.map(task=>{
    const shared={},selected={};
    for(const [key,value] of Object.entries(task.source)){
      if(key==="curriculum"){shared.curriculum=compactCurriculum(value);continue;}
      if(["manifest_selected_text","selected_item","native_item_id","manifest_context","manifest_prompt","manifest_vision_metadata","excluded_private_field_paths"].includes(key)){selected[key]=value;}
      else if(key==="previous_parts"&&Array.isArray(value)){
        selected.previous_part_refs=value.map(part=>{const ref=sha(stable(part));priorParts[ref]=part;return ref;});
      }else shared[key]=value;
    }
    const contextRef=sha(stable(shared));contexts[contextRef]=shared;
    return {exercise_id:task.exercise_id,grade:task.grade,topic:task.topic,source:{context_ref:contextRef,...selected},
      figures:(task.images||[]).map(image=>({sha256:image.sha256,figure_id:image.figure_id}))};
  });
  const payload={contexts,priorParts,tasks:packetTasks,validation_failures:Object.fromEntries(issues),
    imageOrder:[...images].map(([hash,item])=>({sha256:hash,exerciseIds:item.exerciseIds,figureIds:item.figureIds}))};
  const content=[{type:"text",text:JSON.stringify(payload)}];
  for(const [hash,item] of images){
    if(!imageCache.has(hash))imageCache.set(hash,Promise.resolve().then(()=>render(item.image)));
    const rendered=await imageCache.get(hash),bytes=Buffer.isBuffer(rendered)?rendered:rendered&&rendered.bytes,mime=Buffer.isBuffer(rendered)?"image/png":rendered&&rendered.mime;
    if(!Buffer.isBuffer(bytes)||bytes.length>8*1024*1024||!["image/png","image/jpeg"].includes(mime))throw problem("IMAGE_RENDER_INVALID");
    content.push({type:"image_url",image_url:{url:"data:"+mime+";base64,"+bytes.toString("base64")}});
  }
  return content;
}
async function complete(payload,config,fetchImpl,timeoutMs,save){
  const controller=new AbortController();let timer;
  const work=Promise.resolve().then(async()=>{
    const response=await fetchImpl(config.endpoint,{method:"POST",redirect:"error",headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:controller.signal});
    const text=await response.text();
    if(text.length>2*1024*1024)throw problem("RESPONSE_TOO_LARGE");
    save(response.ok?{httpStatus:response.status,body:redact(text,config.apiKey)}:{httpStatus:response.status,bodyOmitted:"non_success_response"});
    if(!response.ok)throw problem("HTTP_"+String(response.status).replace(/\D/g,"").slice(0,3));
    let result;try{result=JSON.parse(text);}catch(_){throw problem("PROVIDER_JSON_INVALID");}
    if(result.model!==MODEL)throw problem("MODEL_MISMATCH");
    if(typeof result.choices?.[0]?.message?.content!=="string")throw problem("PROVIDER_CONTENT_MISSING");
    return {content:result.choices[0].message.content,usage:result.usage||null};
  });
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(problem("REQUEST_TIMEOUT"));},timeoutMs);});
  try{return await Promise.race([work,timeout]);}catch(error){throw problem(/^(?:HTTP_\d{3}|RESPONSE_TOO_LARGE|PROVIDER_JSON_INVALID|MODEL_MISMATCH|PROVIDER_CONTENT_MISSING|REQUEST_TIMEOUT)$/.test(error?.code||"")?error.code:"TRANSPORT_FAILED");}finally{clearTimeout(timer);}
}
function lockOutput(out){
  const file=path.join(out,".authoring.lock"),token=crypto.randomUUID();
  for(let attempt=0;attempt<2;attempt++){
    try{fs.writeFileSync(file,JSON.stringify({pid:process.pid,token}),{flag:"wx",mode:0o600});return ()=>{
      try{if(JSON.parse(fs.readFileSync(file,"utf8")).token===token)fs.unlinkSync(file);}catch(_){}
    };}catch(error){
      if(error.code!=="EEXIST")throw problem("OUTPUT_LOCK_FAILED");
      let old;try{old=JSON.parse(fs.readFileSync(file,"utf8"));}catch(_){throw problem("OUTPUT_LOCK_INVALID");}
      if(!Number.isInteger(old.pid)||old.pid<1)throw problem("OUTPUT_LOCK_INVALID");
      try{process.kill(old.pid,0);throw problem("OUTPUT_BUSY");}catch(probe){
        if(probe.code!=="ESRCH")throw problem("OUTPUT_BUSY");
      }
      fs.unlinkSync(file);
    }
  }
  throw problem("OUTPUT_BUSY");
}
async function run(options){
  if(own(options,"model"))throw problem("MODEL_OVERRIDE_FORBIDDEN");
  const tasks=options.tasks.map(validateTask),seen=new Set();for(const task of tasks){if(seen.has(task.exercise_id))throw problem("DUPLICATE_TASK_ID");seen.add(task.exercise_id);}
  const size=options.batchSize??12,concurrency=options.concurrency??4,retries=options.retries??2;
  if(!Number.isInteger(size)||size<1||size>15||!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!Number.isInteger(retries)||retries<0||retries>2)throw problem("INVALID_LIMIT");
  const out=privatePacketDirectory(REPO,options.out);fs.mkdirSync(out,{recursive:true,mode:0o700});
  for(const dir of ["rows","attempts"]){const p=path.join(out,dir);fs.mkdirSync(p,{recursive:true,mode:0o700});if(fs.realpathSync(p)!==p)throw problem("OUTPUT_SYMLINK");}
  const config=options.config;if(!config?.apiKey||!config.endpoint?.startsWith("https://"))throw problem("INVALID_CONFIG");
  const release=lockOutput(out);
  try{
  const done=new Map(),failures=new Map(),imageCache=new Map();
  for(const task of tasks){const old=loadCheckpoint(out,task);if(old)done.set(task.exercise_id,old);}
  const summary=()=>({model:MODEL,provenance:PROVENANCE,total:tasks.length,completed:done.size,failed:failures.size,pending:tasks.length-done.size-failures.size});
  const taskSetFingerprint=sha(stable(tasks));
  const snapshot=(final=false)=>{
    atomicJson(path.join(out,"failures.json"),[...failures.values()],config.apiKey);
    atomicJson(path.join(out,"checkpoint.json"),{...summary(),taskSetFingerprint,checkpointFormat:"atomic-per-task-files"},config.apiKey);
    if(final){
      atomicJson(path.join(out,"rows.json"),tasks.filter(t=>done.has(t.exercise_id)).map(t=>done.get(t.exercise_id).row),config.apiKey);
      const usage={requests:0,prompt_tokens:0,completion_tokens:0,total_tokens:0};
      for(const name of fs.readdirSync(path.join(out,"attempts")).filter(n=>n.endsWith(".usage.json"))){
        let item;try{item=JSON.parse(fs.readFileSync(path.join(out,"attempts",name),"utf8"));}catch(_){throw problem("USAGE_LEDGER_INVALID");}
        usage.requests++;for(const field of ["prompt_tokens","completion_tokens","total_tokens"]){const value=item.usage&&item.usage[field];if(Number.isFinite(value)&&value>=0)usage[field]+=value;}
      }
      atomicJson(path.join(out,"manifest.json"),{...summary(),authoring_model:MODEL,review:PROVENANCE,
        userAutomaticApproval:true,approvalBasis:"user_authorized_automatic_publication_without_model_review",
        taskSetFingerprint,taskFingerprints:tasks.map(t=>({exercise_id:t.exercise_id,taskFingerprint:fingerprint(t),
          source_pdf_hash:t.source_pdf_hash,source_native_sha256:t.source_native_sha256,source_exercise_sha256:t.source_exercise_sha256})),
        usage,usageScope:"all successful provider responses in this private output directory",updatedAt:new Date().toISOString()},config.apiKey);
    }
  };
  snapshot();
  const phases=new Map();
  for(const task of tasks.filter(t=>!done.has(t.exercise_id))){
    const key=(/-Q01[א-ת]?$/.test(task.exercise_id)?"0":"1")+":"+task.grade;
    if(!phases.has(key))phases.set(key,[]);phases.get(key).push(task);
  }
  let queue=[],cursor=0,fatalStop=null;
  const sleep=options.sleepImpl||(ms=>new Promise(r=>setTimeout(r,ms)));
  let renderer=options.renderImage;
  async function render(image){
    const bytes=fs.readFileSync(image.path);if(sha(bytes)!==image.sha256)throw problem("TASK_IMAGE_HASH_MISMATCH");
    const mime=imageMime(bytes,image.path);
    if(mime!=="image/svg+xml")return {bytes,mime};
    if(!renderer)renderer=sharpRenderer(options.sharpModule);return renderer(image);
  }
  async function worker(){
    while(cursor<queue.length&&!fatalStop){
      const job=queue[cursor++];
      let pending=job.tasks.filter(task=>!done.has(task.exercise_id)&&!failures.has(task.exercise_id));
      let issues=new Map(),feedback=new Map(job.feedback||[]);
      for(let attempt=0;pending.length&&attempt<=retries;attempt++){
        const requestId=crypto.randomUUID(),startedAt=new Date().toISOString();
        try{
          const content=await contentFor(pending,feedback,render,imageCache);
          const payload={model:MODEL,enable_thinking:false,response_format:{type:"json_object"},temperature:0.2,max_tokens:Math.min(12000,Math.max(1200,pending.length*700)),messages:[{role:"system",content:INSTRUCTIONS},{role:"user",content}]};
          atomicJson(path.join(out,"attempts",requestId+".request.json"),{model:MODEL,startedAt,attempt,taskFingerprints:pending.map(fingerprint),tasks:pending,validationFailures:Object.fromEntries(feedback)},config.apiKey);
          const result=await complete(payload,config,options.fetchImpl||globalThis.fetch,options.requestTimeoutMs??120000,
            response=>atomicJson(path.join(out,"attempts",requestId+".response.json"),response,config.apiKey));
          atomicJson(path.join(out,"attempts",requestId+".usage.json"),{model:MODEL,startedAt,finishedAt:new Date().toISOString(),usage:result.usage},config.apiKey);
          const checked=validateResponse(result.content,pending);issues=checked.invalid;feedback=checked.feedback;
          for(const valid of checked.valid){
            // Returned source/model/binding fields are never copied into a row.
            const record={taskFingerprint:fingerprint(valid.task),model:MODEL,provenance:PROVENANCE,requestId,generatedAt:new Date().toISOString(),row:preparedRow(valid.task,valid.hints)};
            atomicJson(path.join(out,"rows",record.taskFingerprint+".json"),record,config.apiKey);done.set(valid.task.exercise_id,record);
          }
          for(const task of pending.filter(t=>issues.get(t.exercise_id)==="SOURCE_AMBIGUOUS"))failures.set(task.exercise_id,{exercise_id:task.exercise_id,taskFingerprint:fingerprint(task),code:"SOURCE_AMBIGUOUS"});
          pending=pending.filter(t=>!done.has(t.exercise_id)&&!failures.has(t.exercise_id));
        }catch(error){
          const code=/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code||"")?error.code:"AUTHORING_FAILED";
          issues=new Map(pending.map(t=>[t.exercise_id,code]));
          feedback=new Map(pending.map(t=>[t.exercise_id,{...(feedback.get(t.exercise_id)||{}),request_error:code}]));atomicJson(path.join(out,"attempts",requestId+".error.json"),{code,attempt,model:MODEL},config.apiKey);
          if(code==="HTTP_400"&&pending.length>1){
            // A provider size/image rejection must not poison unrelated tasks.
            // Split only still-pending rows within this phase. Triples split to
            // singles if needed; each resulting job keeps the bounded retries.
            const chunkSize=pending.length>3?3:1,childSizes=[];
            for(let offset=0;offset<pending.length;offset+=chunkSize){
              const child=pending.slice(offset,offset+chunkSize);childSizes.push(child.length);
              queue.push({tasks:child,feedback:new Map(child.filter(task=>feedback.has(task.exercise_id)).map(task=>[task.exercise_id,feedback.get(task.exercise_id)]))});
            }
            atomicJson(path.join(out,"attempts",requestId+".error.json"),{code,attempt,model:MODEL,split:{from:pending.length,into:childSizes}},config.apiKey);
            const originalSize=pending.length;pending=[];snapshot();
            if(options.log)options.log({...summary(),event:"http400_split",originalSize,childSizes});
            break;
          }
          if(code==="MODEL_MISMATCH")fatalStop=code;
          if(/^IMAGE_|^TASK_IMAGE_|^SVG_|MODEL_MISMATCH/.test(code))break;
        }
        snapshot();if(options.log)options.log(summary());
        if(pending.length&&attempt<retries)await sleep(Math.min(4000,1000*(attempt+1)));
      }
      for(const task of pending)failures.set(task.exercise_id,{exercise_id:task.exercise_id,taskFingerprint:fingerprint(task),code:issues.get(task.exercise_id)||"RETRIES_EXHAUSTED"});
      snapshot();
    }
  }
  for(const key of [...phases.keys()].sort()){
    if(fatalStop)break;queue=splitBatches(phases.get(key),size).map(tasks=>({tasks,feedback:new Map()}));cursor=0;
    await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},worker));
  }
  if(fatalStop)for(const task of tasks)if(!done.has(task.exercise_id)&&!failures.has(task.exercise_id))failures.set(task.exercise_id,{exercise_id:task.exercise_id,taskFingerprint:fingerprint(task),code:fatalStop});
  snapshot(true);return summary();
  }finally{release();}
}
function args(argv){
  const allowed=new Set(["--tasks","--env-file","--out","--batch-size","--concurrency","--limit","--stage","--sharp-module"]),out={};
  for(let i=0;i<argv.length;i+=2){if(!allowed.has(argv[i])||!argv[i+1]||argv[i+1].startsWith("--")||own(out,argv[i]))throw problem("INVALID_ARGUMENTS");out[argv[i]]=argv[i+1];}
  for(const field of ["--tasks","--env-file","--out"])if(!out[field])throw problem("MISSING_ARGUMENTS");
  return out;
}
const USAGE=[
  "Usage: node tools/ramzi-hints/author-flash-hints.cjs --tasks private-tasks.jsonl --env-file ignored.env.local --out /private/output",
  "Options: --batch-size 12 --concurrency 4 --limit 12 --stage q01 --sharp-module /installed/node_modules/sharp",
  "Write option names and values as separate arguments, for example --batch-size 12.",
  "Only qwen3.8-flash; no fallback or model/content review. JSON array and JSONL tasks are supported.",
  "Outputs: rows.json, manifest.json, failures.json, checkpoint.json and private per-task/attempt files.",
  "Reuse --out to resume unchanged task fingerprints. No credentials or artifacts may enter the public repository."
].join("\n");
async function main(argv){
  if(argv.length===1&&["--help","-h"].includes(argv[0])){process.stdout.write(USAGE+"\n");return;}
  const parsed=args(argv);let text;try{text=fs.readFileSync(parsed["--env-file"],"utf8");}catch(_){throw problem("ENV_FILE_UNREADABLE");}
  const config=envConfig(text);let tasks=readTasks(parsed["--tasks"]);
  if(parsed["--stage"])tasks=tasks.filter(t=>t.stage===parsed["--stage"]);
  if(parsed["--limit"]){const limit=Number(parsed["--limit"]);if(!Number.isInteger(limit)||limit<1)throw problem("INVALID_LIMIT");tasks=tasks.slice(0,limit);}
  const result=await run({tasks,config,out:parsed["--out"],batchSize:Number(parsed["--batch-size"]||12),concurrency:Number(parsed["--concurrency"]||4),sharpModule:parsed["--sharp-module"],log:progress=>process.stdout.write(JSON.stringify(progress)+"\n")});
  process.stdout.write(JSON.stringify(result)+"\n");if(result.failed)process.exitCode=1;
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code||"")?error.code:"AUTHORING_FAILED");process.exitCode=1;});
module.exports={MODEL,PROVENANCE,ROW_SOURCE,INSTRUCTIONS,USAGE,imageMime,compactCurriculum,contentFor,firstNumberMatches,candidateFeedback,envConfig,validateTask,readTasks,fingerprint,splitBatches,validateResponse,redact,preparedRow,loadCheckpoint,sharpRenderer,run,args};
