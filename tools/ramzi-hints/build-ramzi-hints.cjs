#!/usr/bin/env node
"use strict";
/*
 * Turns a "Zero-Spoiler" hint bank (plain text, three graded hints per part)
 * into rows for public.noam_ramzi_hints.
 *
 * Only the three hints and non-answer metadata leave this script.
 * Full solutions and final answers are dropped: the repository is public and
 * the hints table is readable with the publishable key.
 *
 * Bank IDs are normalized to the live viewer IDs:
 *  - level C is the site's מצוינות level, E;
 *  - grade 8 and 9 banks number topics by the manifest topicId, so the topic
 *    title (and topicId) decide the site prefix, never the bank number alone.
 *
 * Usage:
 *   node tools/ramzi-hints/build-ramzi-hints.cjs <bank.txt> [--keep rows.json] [--reviews reviews.json] [--packets dir]
 *   node tools/ramzi-hints/build-ramzi-hints.cjs --rows rows.json [--keep rows.json] [--reviews reviews.json]
 *
 * --rows rebuilds from published rows (learning/ramzi-hints.json) when the
 * bank file is not at hand. --keep adds rows from another published file for
 * parts the input does not cover, so a new bank never drops checked hints.
 */
const fs=require("fs");
const path=require("path");
const {createHash}=require("node:crypto");

const REPO=path.resolve(__dirname,"..","..");
const SOURCE="zero-spoiler-v2.1";
const LEVELS={A:"A",B:"B",C:"E",E2:"E2"};
const LEVEL_CODES=new Set(["A","B","E","E2"]);
// Same package names as PACKAGE_ALIASES in headless/astro-poc/public/noam-native-visual.js.
const NATIVE_ALIAS={
  "G7-T50":"G7-ASSESS1",
  "G8-T61":"G8-INTERP",
  "G8-T63":"G8-CIRCLE",
  "G8-T64":"G8-ASSESS1",
  "G8-T66":"G8-TWOSRC",
  "G9-T37":"G9-3060",
  "G9-T38":"G9-SIDEANG",
  "G9-T39":"G9-TRAP",
  "G9-T46":"G9-KITE"
};
const ID_RE=/^G([1-9])-T(\d{2})-([ABC]|E2)-Q(\d{2})([א-ת]?)$/;
const SITE_ID_RE=/^G[1-9]-T\d{2}-(?:[ABE]|E2)-Q\d{2}[א-ת]?$/;
const MAX_HINT=600;
const PDF_HASH_RE=/^[a-f0-9]{32}$/;
const NATIVE_HASH_RE=/^[a-f0-9]{64}$/;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const FIRST_NUMBER_WORDS="אפס|אחד|אחת|שניים|שתיים|שני|שתי|שלוש|שלושה|שלושת|ארבע|ארבעה|ארבעת|חמש|חמישה|חמשת|שש|שישה|ששת|שבע|שבעה|שבעת|שמונה|שמונת|תשע|תשעה|תשעת|עשר|עשרה|עשרת|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים|אלפים|חצי|מחצית|רבע";
const FIRST_NUMBER_RE=new RegExp("(?<![\\p{L}])[ובכלמשה]{0,3}(?:"+FIRST_NUMBER_WORDS+")(?![\\p{L}])","u");

function clean(text){
  return String(text||"").replace(/\r/g,"").replace(/[ \t]+/g," ").trim();
}

// Noam, 18.10.2026: every fraction uses a horizontal bar. Ramzi renders $…$
// with KaTeX, so a numeric slash fraction such as 1/4 becomes $\frac{1}{4}$.
function barFractions(text){
  return clean(text).replace(/(?<![\d.$\\{])(\d+)\/(\d+)(?![\d}]|\.\d)/g,"$\\frac{$1}{$2}$");
}

// Syntax checks cannot establish pedagogical correctness. They prevent known
// unsafe imports from replacing an independently reviewed catalogue.
function hintIssue(hints){
  if(!Array.isArray(hints)||hints.length!==3||hints.some(h=>typeof h!=="string"||!h.trim()||h.length>MAX_HINT)){
    return "needs three plain-text hints of 1-"+MAX_HINT+" characters";
  }
  const first=hints[0].normalize("NFD").replace(/\p{M}/gu,"");
  if(/\p{N}/u.test(first)||FIRST_NUMBER_RE.test(first)){return "first hint contains a number";}
  for(const hint of hints){
    if(/[=<>≠≤≥]/u.test(hint)||/&(?:lt|gt|equals|#(?:0*6[012]|x0*3[cde]));/i.test(hint)){
      return "hint contains a comparison or equality";
    }
    if(hint.includes("/")){return "hint contains a slash; use text or a horizontal-bar fraction";}
    if(/פתרון\s+מלא\s*:|תשובה\s+סופית\s*:|data:image|!\[[^\]]*\]\s*\(|```/i.test(hint)){
      return "hint contains private-bank fields or non-text content";
    }
  }
  return null;
}

function assertSafeHints(rows){
  for(const row of rows){
    const issue=hintIssue(row.hints);
    if(issue){throw new Error("Unsafe hints for "+row.exercise_id+": "+issue);}
  }
}

function privatePacketDirectory(repo,directory){
  let ancestor=path.resolve(directory);
  const suffix=[];
  while(!fs.existsSync(ancestor)){
    suffix.unshift(path.basename(ancestor));
    const parent=path.dirname(ancestor);
    if(parent===ancestor){throw new Error("Cannot resolve review packet directory");}
    ancestor=parent;
  }
  const physical=path.resolve(fs.realpathSync(ancestor),...suffix);
  const relative=path.relative(fs.realpathSync(repo),physical);
  if(relative===""||(!relative.startsWith(".."+path.sep)&&relative!==".."&&!path.isAbsolute(relative))){
    throw new Error("Review packets contain private context; choose a directory outside the public repository");
  }
  return physical;
}

function normalizeTitle(text){
  return clean(text)
    .replace(/[׳’'`]/g,"׳")
    .replace(/\s*[—–-]\s*(?:לכיתה|כיתה)\s+[זחט]׳?\s*$/,"")
    .replace(/[־‐-―\-]/g," ")
    .replace(/[()]/g," ")
    .replace(/°/g,"")
    .replace(/\s+/g," ")
    .trim();
}

function field(block,label){
  const re=new RegExp("^\\*\\s*"+label+"[^:]*:\\s*(.*)$","m");
  const match=block.match(re);
  return match?clean(match[1]):"";
}

// Every part block starts with "סעיף X (ID) [...]" and ends at a dashed rule.
function parseBank(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n");
  const entries=[];
  const incomplete=[];
  let topic="";
  let block=null;
  function close(){
    if(!block){return;}
    const body=block.lines.join("\n");
    const entry={
      sourceId:block.id,
      topicNumber:block.topicNumber,
      topic:block.topic,
      bankLevel:block.bankLevel,
      exerciseText:field(body,"נוסח התרגיל"),
      hints:[field(body,"רמז 1"),field(body,"רמז 2"),field(body,"רמז 3")]
    };
    if(entry.exerciseText&&entry.hints.every(Boolean)){entries.push(entry);}
    else{incomplete.push(block.id);}
    block=null;
  }
  for(const raw of lines){
    const line=raw.trim();
    const header=line.match(/^נושא\s+(\d+)\s*:\s*(.+)$/);
    if(header){close();topic={number:Number(header[1]),title:clean(header[2])};continue;}
    const start=line.match(/^סעיף\s+\S+\s+\((G\d-T\d+-(?:[ABC]|E2)-Q\d+[א-ת]?)\)\s*\[(.*)\]\s*$/);
    if(start){
      close();
      const meta=start[2];
      const inline=meta.match(/נושא\s+(\d+)\s*:\s*(.+?)\s*,\s*רמה\s+([ABC]|E2)\b/);
      const level=(meta.match(/רמה\s+([ABC]|E2)\b/)||[])[1]||"";
      block={
        id:start[1],
        topicNumber:inline?Number(inline[1]):(topic&&topic.number),
        topic:inline?clean(inline[2]):(topic&&topic.title)||"",
        bankLevel:level,
        lines:[]
      };
      continue;
    }
    if(/^-{20,}$/.test(line)||/^={20,}$/.test(line)){close();continue;}
    if(block){block.lines.push(raw);}
  }
  close();
  // A bank pasted twice must repeat identical content; the copy is dropped.
  const byId=new Map();
  const conflicts=[];
  for(const entry of entries){
    const seen=byId.get(entry.sourceId);
    if(!seen){byId.set(entry.sourceId,entry);continue;}
    if(JSON.stringify(seen)!==JSON.stringify(entry)){conflicts.push(entry.sourceId);}
  }
  return {entries:[...byId.values()],incomplete,conflicts};
}

function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}

// The live viewer resolves each worksheet level to one PDF; its manifest holds
// the exercise IDs Ramzi uses.
function loadSite(repo){
  const catalog=readJson(path.join(repo,"headless","catalog","catalog.v1.json"));
  const manifestDir=path.join(repo,"noam-ai","manifests");
  // Older PDF versions of a worksheet still carry its topicId and title variants.
  const history=new Map();
  for(const name of fs.readdirSync(manifestDir)){
    if(!name.endsWith(".json")){continue;}
    const manifest=readJson(path.join(manifestDir,name));
    if(!manifest.prefix){continue;}
    const seen=history.get(manifest.prefix)||{topicIds:new Set(),titles:new Set()};
    if(manifest.topicId!==null&&manifest.topicId!==undefined){seen.topicIds.add(Number(manifest.topicId));}
    if(manifest.topic){seen.titles.add(manifest.topic);}
    history.set(manifest.prefix,seen);
  }
  const topics=[];
  for(const grade of catalog.grades){
    for(const topic of grade.topics||[]){
      const prefix=topic.noamTopicId||(topic.routing&&topic.routing.resolvedNoamPrefix);
      if(!prefix){continue;}
      const levels={};
      for(const level of topic.levels||[]){
        const file=path.join(manifestDir,level.pdfId+".json");
        if(!fs.existsSync(file)){continue;}
        const manifest=readJson(file);
        // A single-level worksheet ("one") keeps the level code of its PDF,
        // and if its exercise IDs use another level code (e.g. G8-T56..T60 use A),
        // index that level code too when unused.
        const code=manifest.levelCode;
        if(!LEVEL_CODES.has(code)){continue;}
        const exercises=new Set((manifest.exercises||[]).map(item=>item.id));
        if([...exercises].some(id=>(/^G[1-9]-T\d{2}-E2-Q/.test(id))!==(code==="E2"))){
          throw new Error("E2 worksheet identity mismatch in "+level.pdfId);
        }
        const binding={pdfId:level.pdfId,exercises,source_pdf_hash:manifest.pdfHash,
          source_native_sha256:manifest.nativeExportSha256==null?null:manifest.nativeExportSha256,
          exerciseTexts:new Map((manifest.exercises||[]).map(item=>[item.id,item.text]))};
        levels[code]=binding;
        const firstEx=(manifest.exercises||[])[0]&&manifest.exercises[0].id||"";
        const exLevel=(firstEx.match(/^G[1-9]-T\d{2}-([ABE]|E2)-Q/)||[])[1];
        if(exLevel&&exLevel!==code&&code!=="E2"&&exLevel!=="E2"&&!levels[exLevel]){
          levels[exLevel]=binding;
        }
      }
      const seen=history.get(prefix)||{topicIds:new Set(),titles:new Set()};
      topics.push({grade:grade.grade,prefix,title:topic.title,levels,topicIds:seen.topicIds,titles:seen.titles});
    }
  }
  return topics;
}

function titlesOf(topic){
  const out=new Set([normalizeTitle(topic.title)]);
  topic.titles.forEach(title=>out.add(normalizeTitle(title)));
  return out;
}

function resolvePrefix(site,entry){
  const match=entry.sourceId.match(ID_RE);
  const grade=Number(match[1]);
  const bankNumber=Number(match[2]);
  const wanted=normalizeTitle(entry.topic);
  const inGrade=site.filter(topic=>topic.grade===grade);
  // The catalog title wins; older manifest titles only break a tie of none.
  let candidates=inGrade.filter(topic=>normalizeTitle(topic.title)===wanted);
  if(!candidates.length){candidates=inGrade.filter(topic=>titlesOf(topic).has(wanted));}
  if(candidates.length!==1){
    return {error:candidates.length?"ambiguous topic title":"no site topic with this title"};
  }
  const topic=candidates[0];
  const prefixNumber=Number(topic.prefix.split("-T")[1]);
  // The title must agree with the bank number, either as the site prefix or
  // as the manifest topicId that grade 8 and 9 banks use.
  if(prefixNumber!==bankNumber&&!topic.topicIds.has(bankNumber)){
    return {error:"topic title and bank number disagree"};
  }
  return {topic};
}

function siteId(prefix,level,question,part){
  return prefix+"-"+level+"-Q"+question+part;
}

function normalize(site,parsed){
  const rows=[];
  const rejected=[];
  for(const entry of parsed.entries){
    const match=entry.sourceId.match(ID_RE);
    if(!match){rejected.push({sourceId:entry.sourceId,reason:"bad bank id"});continue;}
    const resolved=resolvePrefix(site,entry);
    if(resolved.error){rejected.push({sourceId:entry.sourceId,reason:resolved.error});continue;}
    const level=LEVELS[match[3]];
    const exerciseId=siteId(resolved.topic.prefix,level,match[4],match[5]);
    const live=resolved.topic.levels[level];
    if(!live||!live.exercises.has(exerciseId)){
      rejected.push({sourceId:entry.sourceId,exerciseId,reason:"exercise is not in the live worksheet"});
      continue;
    }
    const hints=entry.hints.map(barFractions);
    const tooLong=hints.find(hint=>hint.length>MAX_HINT);
    if(tooLong){rejected.push({sourceId:entry.sourceId,exerciseId,reason:"hint longer than "+MAX_HINT});continue;}
    rows.push({
      exercise_id:exerciseId,
      source:SOURCE,
      source_id:entry.sourceId,
      grade:Number(match[1]),
      level,
      topic:resolved.topic.title,
      source_exercise_text:entry.exerciseText,
      hints,
      status:"review",
      review_note:"טרם נבדק מול התרגיל באתר."
    });
  }
  rows.sort((a,b)=>a.exercise_id.localeCompare(b.exercise_id,"en"));
  return {rows,rejected};
}

function liveExercises(site){
  const ids=new Set();
  site.forEach(topic=>Object.values(topic.levels).forEach(level=>level.exercises.forEach(id=>ids.add(id))));
  return ids;
}

// Q01 coverage is per canonical worksheet/level, not per stored row. A hidden
// or stale row cannot make a worksheet appear covered, and reused T40/T32 IDs
// never substitute for a different canonical PDF.
function firstPartCoverage(site,rows){
  const groups=new Map();
  for(const topic of site){
    if(![7,8,9].includes(topic.grade)){continue;}
    for(const level of Object.values(topic.levels)){
      for(const id of level.exercises){
        if(!/^G[789]-T\d{2}-(?:[ABE]|E2)-Q01[אב]$/.test(id)||!id.startsWith(topic.prefix+"-")){continue;}
        const key=id.split("-").slice(0,3).join("-");
        const group=groups.get(key)||{worksheet:key,candidates:[]};
        group.candidates.push({id,pdf:level.source_pdf_hash,native:level.source_native_sha256});
        groups.set(key,group);
      }
    }
  }
  const verified=new Map(rows.filter(r=>r.status==="verified").map(r=>[r.exercise_id,r]));
  const missing=[...groups.values()].filter(group=>!group.candidates.some(candidate=>{
    const row=verified.get(candidate.id);
    return row&&row.source_pdf_hash===candidate.pdf&&row.source_native_sha256===candidate.native;
  })).map(group=>group.worksheet).sort();
  return {eligible:groups.size,verified:groups.size-missing.length,missing};
}

function bindingText(value){
  return clean(value).replace(/\$|\\[()]/g,"").replace(/[־‐-―\-]/g," ").replace(/\s+/g," ").trim();
}
function sourceTaskHash(value){
  // A revision fingerprint must preserve arithmetic signs. The permissive
  // bank-wording matcher above is deliberately not suitable for this hash.
  const text=clean(value).normalize("NFC");
  if(!text){throw new Error("Missing current source task text");}
  return createHash("sha256").update(text).digest("hex");
}

// Bind to the CURRENT catalog, never whichever historical manifest happens to
// be visited first. Existing bindings are immutable: a new revision needs review.
function bindRows(site,rows){
  const resolutions=[];
  const bound=rows.map(row=>{
    if(own(row,"source_pdf_hash")!==own(row,"source_native_sha256")){
      throw new Error("Incomplete source binding for "+row.exercise_id);
    }
    const candidates=new Map();
    for(const topic of site){
      for(const level of Object.values(topic.levels)){
        if(!level.exercises.has(row.exercise_id)){continue;}
        if(!PDF_HASH_RE.test(level.source_pdf_hash||"")||level.source_pdf_hash!==level.pdfId||
            (level.source_native_sha256!==null&&!NATIVE_HASH_RE.test(level.source_native_sha256||""))){
          throw new Error("Invalid current manifest binding for "+row.exercise_id);
        }
        const key=level.source_pdf_hash+":"+(level.source_native_sha256||"");
        const candidate=candidates.get(key)||{level,owners:[]};
        candidate.owners.push(topic);candidates.set(key,candidate);
      }
    }
    let choices=[...candidates.values()];
    let reason="unique_current_manifest";
    if(choices.length>1){
      const prefix=(row.exercise_id.match(/^(G[1-9]-T\d{2})-/)||[])[1];
      choices=choices.filter(candidate=>{
        const task=candidate.level.exerciseTexts.get(row.exercise_id);
        const raw=typeof row.source_exercise_text==="string"&&row.source_exercise_text.trim();
        return candidate.owners.some(topic=>topic.prefix===prefix&&normalizeTitle(topic.title)===normalizeTitle(row.topic))&&
          bindingText(task)&&(raw?bindingText(raw).includes(bindingText(task)):row.source_exercise_sha256===sourceTaskHash(task));
      });
      reason="canonical_catalog_prefix_topic_and_selected_text";
    }
    if(choices.length!==1){throw new Error("Unresolved current source binding for "+row.exercise_id+" ("+choices.length+" candidates)");}
    const selected=choices[0].level;
    const taskHash=sourceTaskHash(selected.exerciseTexts.get(row.exercise_id));
    if((own(row,"source_pdf_hash")&&row.source_pdf_hash!==selected.source_pdf_hash)||
        (own(row,"source_native_sha256")&&row.source_native_sha256!==selected.source_native_sha256)){
      throw new Error("Stale or conflicting source binding for "+row.exercise_id);
    }
    if(own(row,"source_exercise_sha256")&&row.source_exercise_sha256!==taskHash){
      throw new Error("Stale or conflicting source task fingerprint for "+row.exercise_id);
    }
    resolutions.push({exercise_id:row.exercise_id,reason,source_pdf_hash:selected.source_pdf_hash,
      source_native_sha256:selected.source_native_sha256});
    return Object.assign({},row,{source_pdf_hash:selected.source_pdf_hash,source_native_sha256:selected.source_native_sha256,
      source_exercise_sha256:taskHash});
  });
  return {rows:bound,resolutions};
}

// Reviews come from a side-by-side check of each hint set against the real
// exercise. Only a verified fit makes a row visible to Ramzi. A hint set that
// fits a different part of the same worksheet moves there; its bank ID stays
// in source_id. Verified rows claim their part first; a review row whose part
// is taken is left out and reported.
function applyReviews(rows,reviews,live){
  const byId=new Map((reviews||[]).map(review=>[review.exercise_id,review]));
  const reviewed=rows.map(row=>{
    const review=byId.get(row.exercise_id);
    if(!review){return row;}
    const note=clean(review.note)||row.review_note;
    const target=String(review.target_exercise_id||row.exercise_id);
    if(!review.verified){return Object.assign({},row,{status:"review",review_note:note});}
    const samePrefix=target.split("-").slice(0,2).join("-")===row.exercise_id.split("-").slice(0,2).join("-");
    if(!SITE_ID_RE.test(target)||!samePrefix||(live&&!live.has(target))){
      return Object.assign({},row,{status:"review",review_note:"יעד ההעברה אינו תרגיל באותו דף. "+note});
    }
    return Object.assign({},row,{exercise_id:target,status:"verified",review_note:note});
  });
  const placed=new Map();
  const displaced=[];
  reviewed.filter(row=>row.status==="verified").concat(reviewed.filter(row=>row.status!=="verified")).forEach(row=>{
    if(placed.has(row.exercise_id)){displaced.push({sourceId:row.source_id,exerciseId:row.exercise_id,status:row.status});return;}
    placed.set(row.exercise_id,row);
  });
  const out=[...placed.values()].sort((a,b)=>a.exercise_id.localeCompare(b.exercise_id,"en"));
  return {rows:out,displaced};
}

function nativeExercise(repo,exerciseId){
  const match=exerciseId.match(/^(G\d-T\d{2})-([ABE]|E2)-Q(\d{2})([א-ת]?)$/);
  // E2 has its own PDF-only source, not the native c package of level E.
  if(!match||match[2]==="E2"){return null;}
  const pkg=NATIVE_ALIAS[match[1]]||match[1];
  const level=match[2]==="A"?"a":match[2]==="B"?"b":"c";
  let file=path.join(repo,"noam-ai","native",pkg,level,"noam-ai.json");
  if(!fs.existsSync(file)){
    const existing=["a","b","c"].map(sub=>path.join(repo,"noam-ai","native",pkg,sub,"noam-ai.json")).filter(p=>fs.existsSync(p));
    if(existing.length===1){file=existing[0];}else{return null;}
  }
  const data=readJson(file);
  const question=(data.questions||[]).find(item=>item.id==="q"+Number(match[3]));
  if(!question){return null;}
  const text=value=>Array.isArray(value)?value.join(" "):String(value||"");
  return {
    unit:data.curriculum&&data.curriculum.unit,
    stem:text(question.text),
    table:question.table||null,
    given:question.given||[],
    hasFigure:!!question.figure_id||(question.items||[]).some(item=>item.figure_id),
    parts:(question.items||[]).map(item=>({
      label:item.label,
      text:text(item.text),
      given:item.given||[],
      selected:item.label===match[4]
    }))
  };
}

function sqlText(value){
  if(value===null||value===undefined){return "null";}
  return "'"+String(value).replace(/'/g,"''")+"'";
}

function toSql(rows){
  assertSafeHints(rows);
  if(rows.some(row=>!PDF_HASH_RE.test(row.source_pdf_hash||"")||
      (row.source_native_sha256!==null&&!NATIVE_HASH_RE.test(row.source_native_sha256||"")))){
    throw new Error("SQL seed requires validated source bindings");
  }
  const header=[
    "-- Generated by tools/ramzi-hints/build-ramzi-hints.cjs. Do not edit by hand.",
    "-- Hints only: no solutions or final answers. Rows marked 'review' stay hidden from Ramzi.",
    "insert into public.noam_ramzi_hints (exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256,status,source,source_id) values"
  ];
  const values=rows.map(row=>"("+[
    row.exercise_id,row.hints[0],row.hints[1],row.hints[2],row.source_pdf_hash,row.source_native_sha256,row.status,
    row.source,row.source_id
  ].map(sqlText).join(",")+")");
  return header.join("\n")+"\n"+values.join(",\n")+"\n"+
    "on conflict (exercise_id) do update set hint_1=excluded.hint_1,hint_2=excluded.hint_2,hint_3=excluded.hint_3,"+
    "source_pdf_hash=excluded.source_pdf_hash,source_native_sha256=excluded.source_native_sha256,"+
    "status=excluded.status,source=excluded.source,source_id=excluded.source_id;\n";
}

function publicRows(rows){
  assertSafeHints(rows);
  return rows.map(row=>({
    exercise_id:row.exercise_id,
    source_pdf_hash:row.source_pdf_hash,
    source_native_sha256:row.source_native_sha256,
    status:row.status,
    source:row.source,
    source_id:row.source_id,
    topic:row.topic,
    source_exercise_sha256:row.source_exercise_sha256,
    hints:row.hints
  }));
}

// Published rows (the shape of learning/ramzi-hints.json) back into builder rows.
function loadRows(list,live){
  if(!Array.isArray(list)){throw new Error("Published rows must be an array");}
  const rows=[];
  const rejected=[];
  list.forEach(item=>{
    const id=String(item&&item.exercise_id||"");
    const rawHints=item&&item.hints;
    const hints=Array.isArray(rawHints)&&rawHints.every(h=>typeof h==="string")?rawHints.map(barFractions):[];
    if(!SITE_ID_RE.test(id)){rejected.push({exerciseId:id,reason:"bad exercise id"});return;}
    if(live&&!live.has(id)){rejected.push({exerciseId:id,reason:"exercise is not in the live worksheet"});return;}
    const issue=hintIssue(hints);
    if(issue){rejected.push({exerciseId:id,reason:issue});return;}
    rows.push({
      exercise_id:id,
      ...(own(item,"source_pdf_hash")?{source_pdf_hash:item.source_pdf_hash}:{}),
      ...(own(item,"source_native_sha256")?{source_native_sha256:item.source_native_sha256}:{}),
      ...(own(item,"source_exercise_sha256")?{source_exercise_sha256:item.source_exercise_sha256}:{}),
      source:clean(item.source)||SOURCE,
      source_id:clean(item.source_id)||id,
      topic:clean(item.topic),
      source_exercise_text:item.source_exercise_text==null?null:String(item.source_exercise_text),
      hints,
      status:item.status==="verified"?"verified":"review",
      review_note:clean(item.review_note)
    });
  });
  return {rows,rejected};
}

// Rows from `extra` join only for parts that `rows` does not cover.
function mergeRows(rows,extra){
  const taken=new Set(rows.map(row=>row.exercise_id));
  const kept=extra.filter(row=>!taken.has(row.exercise_id)&&taken.add(row.exercise_id));
  const out=rows.concat(kept).sort((a,b)=>a.exercise_id.localeCompare(b.exercise_id,"en"));
  return {rows:out,kept:kept.length};
}

function main(argv){
  const args=argv.slice(2);
  const option=name=>{const at=args.indexOf(name);return at>=0?args[at+1]:"";};
  const bankFile=args[0]&&!args[0].startsWith("--")?args[0]:"";
  const rowsFile=option("--rows");
  if(!bankFile===!rowsFile){
    console.error("usage: build-ramzi-hints.cjs <bank.txt> | --rows rows.json [--keep rows.json] [--reviews reviews.json] [--packets dir]");
    process.exit(2);
  }
  const site=loadSite(REPO);
  const live=liveExercises(site);
  const parsed=bankFile?parseBank(fs.readFileSync(bankFile,"utf8")):{entries:[],incomplete:[],conflicts:[]};
  if(parsed.incomplete.length||parsed.conflicts.length){throw new Error("Incomplete or conflicting bank blocks; refusing to overwrite output");}
  const normalized=bankFile?normalize(site,parsed):loadRows(readJson(rowsFile),live);
  const keepFile=option("--keep");
  const keep=keepFile?loadRows(readJson(keepFile),live):{rows:[],rejected:[]};
  if((rowsFile&&normalized.rejected.length)||keep.rejected.length){
    throw new Error("Published rows rejected; refusing to overwrite output: "+JSON.stringify(normalized.rejected.concat(keep.rejected)));
  }
  const merged=mergeRows(normalized.rows,keep.rows);
  const reviewsFile=option("--reviews");
  const applied=reviewsFile
    ?applyReviews(merged.rows,readJson(reviewsFile),live)
    :{rows:merged.rows,displaced:[]};
  const binding=bindRows(site,applied.rows);
  const rows=binding.rows;
  assertSafeHints(rows);
  const published=JSON.stringify(publicRows(rows),null,1)+"\n";
  const seed=toSql(rows);
  const packets=option("--packets");
  if(packets){
    const privatePackets=privatePacketDirectory(REPO,packets);
    fs.mkdirSync(privatePackets,{recursive:true});
    rows.forEach(row=>{
      fs.writeFileSync(path.join(privatePackets,row.exercise_id+".json"),JSON.stringify({
        exercise_id:row.exercise_id,
        bank:{source_id:row.source_id,topic:row.topic,exercise_text:row.source_exercise_text,hints:row.hints},
        site:nativeExercise(REPO,row.exercise_id)
      },null,1));
    });
  }
  fs.writeFileSync(path.join(REPO,"learning","ramzi-hints.json"),published);
  fs.writeFileSync(path.join(REPO,"learning","ramzi-hints-seed.sql"),seed);
  const verified=rows.filter(row=>row.status==="verified").length;
  console.log(JSON.stringify({
    parsed:parsed.entries.length,
    incomplete:parsed.incomplete,
    duplicateConflicts:parsed.conflicts,
    kept:merged.kept,
    rows:rows.length,
    verified,
    review:rows.length-verified,
    firstPartCoverage:firstPartCoverage(site,rows),
    bindingResolutions:binding.resolutions.filter(item=>item.reason!=="unique_current_manifest"),
    rejected:normalized.rejected.concat(keep.rejected),
    displaced:applied.displaced
  },null,1));
}

if(require.main===module){main(process.argv);}

module.exports={parseBank,normalizeTitle,loadSite,normalize,applyReviews,liveExercises,firstPartCoverage,loadRows,mergeRows,bindRows,sourceTaskHash,publicRows,barFractions,hintIssue,assertSafeHints,privatePacketDirectory,toSql,nativeExercise,SITE_ID_RE,MAX_HINT};
