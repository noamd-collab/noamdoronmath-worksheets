"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const {createHash}=require("node:crypto");
const build=require("../tools/ramzi-hints/build-ramzi-hints.cjs");

const RULE="------------------------------------------------------------";
function block(id,meta,exercise){
  return [
    "סעיף א ("+id+") ["+meta+"]",
    "* נוסח התרגיל: "+exercise,
    "* פתרון מלא: סוד הפתרון "+id,
    "* תשובה סופית: סוד התשובה "+id,
    "* רמז 1 (כיוון מחשבה): חשבו על כיוון מתאים עם 'גרש'",
    "* רמז 2 (ביצוע פעולות): פעולה ל-"+id,
    "* רמז 3 (צעד לפני פתרון): צעד ל-"+id,
    RULE
  ].join("\n");
}

const bank=[
  "################################################################################",
  "נושא 1: מספרים מכוונים — ישר המספרים וערך מוחלט",
  "################################################################################",
  "",
  block("G7-T01-A-Q01א","רמה A, שאלה 1","צוללן ירד לעומק"),
  block("G7-T01-C-Q01א","רמה C, שאלה 1","מרחק 6 מאפס"),
  block("G8-T04-A-Q01א","נושא 4: יחס ופרופורציה, רמה A","יחס בנים לבנות"),
  block("G9-T16-A-Q01א","נושא 16: חוקי חזקות, רמה A","פשטו חזקות"),
  block("G7-T16-A-Q01א","רמה A, שאלה 1","זוויות שווה-צלעות"),
  block("G8-T04-A-Q01א","נושא 4: יחס ופרופורציה, רמה A","יחס בנים לבנות"),
  "סעיף א (G8-T06-A-Q01א) [נושא 6: אחוזים — ייצוגים, רמה A]"
].join("\n");

const site=build.loadSite(path.join(__dirname,".."));

test("E2 parts bind to their own PDF-only worksheets and never borrow native E data",()=>{
  const expected={"G8-T45":"e4da722565a942e482c9e4dbf6ee41b5","G8-T51":"0b79f523d8ea4598a85d5320d6acd823"};
  for(const [prefix,pdf] of Object.entries(expected)){
    const topic=site.find(topic=>topic.prefix===prefix),id=prefix+"-E2-Q01א";
    assert.equal(topic.levels.E2.source_pdf_hash,pdf);
    assert.equal(topic.levels.E2.source_native_sha256,null);
    assert.equal(topic.levels.E2.exercises.size,prefix==="G8-T45"?81:82);
    const loaded=build.loadRows([{exercise_id:id,hints:["בדקו את הנתונים","חפשו קשר מתאים","נמקו את הצעד שבחרתם"]}],build.liveExercises(site));
    assert.deepEqual(loaded.rejected,[]);
    const bound=build.bindRows(site,loaded.rows).rows[0];
    assert.equal(bound.source_pdf_hash,pdf);assert.equal(bound.source_native_sha256,null);
    assert.match(build.toSql([bound]),new RegExp(prefix+"-E2-Q01א"));
    assert.equal(build.nativeExercise(path.join(__dirname,".."),id),null);
    assert.ok(build.nativeExercise(path.join(__dirname,".."),prefix+"-E-Q01א"));
    assert.throws(()=>build.bindRows(site,[{...bound,exercise_id:prefix+"-E-Q01א"}]),/Stale or conflicting/);
    const parsed=build.parseBank(block(id,"נושא "+Number(prefix.slice(-2))+": "+topic.title+", רמה E2","משימה לבדיקה"));
    assert.equal(parsed.entries[0].bankLevel,"E2");
    assert.equal(build.normalize(site,parsed).rows[0].exercise_id,id);
  }
  for(const level of ["E22","E3","C2","AE2","E20"]){assert.equal(build.SITE_ID_RE.test("G8-T45-"+level+"-Q01א"),false);}
  const schema=fs.readFileSync(path.join(__dirname,"..","learning/ramzi-hints-schema.sql"),"utf8");
  const idConstraint=new RegExp(schema.match(/exercise_id ~ '([^']+)'/)[1]);
  assert.ok(idConstraint.test("G8-T45-E2-Q01א"));
  assert.ok(!idConstraint.test("G8-T45-E22-Q01א"));
});

test("all T40 manifests match exact native selected tasks and have no T32 exercise IDs",()=>{
  const root=path.join(__dirname,".."),pdfs={A:"043606cd6c8e4c199b148424caf7ef36",B:"9fdee3c1708d4726998df6526d437f4c",E:"8f86fe9850874c4f935f16ddddc51c83"};
  let count=0;
  for(const [level,pdf] of Object.entries(pdfs)){
    const relative="noam-ai/manifests/"+pdf+".json",bytes=fs.readFileSync(path.join(root,relative)),manifest=JSON.parse(bytes);
    assert.deepEqual(fs.readFileSync(path.join(root,"headless/astro-poc/public",relative)),bytes);
    const nativeBytes=fs.readFileSync(path.join(root,manifest.nativeExportUrl)),native=JSON.parse(nativeBytes);
    assert.equal(createHash("sha256").update(nativeBytes).digest("hex"),manifest.nativeExportSha256);
    assert.equal(manifest.prefix,"G9-T40");assert.equal(native.package,"G9-T32","legacy package metadata stays unchanged");
    for(const ex of manifest.exercises){
      count++;assert.equal(ex.id,"G9-T40-"+level+"-Q"+String(ex.q).padStart(2,"0")+ex.part);
      const question=native.questions.find(q=>q.id===ex.nativeQuestionId),part=question.items.find(p=>p.id===ex.nativeItemId);
      assert.equal(question.id,"q"+ex.q);assert.equal(part.label,ex.part);assert.equal(part.text,ex.text);assert.equal(question.text,ex.context);
      assert.equal(ex.nativeFigureId||null,part.figure_id||question.figure_id||null);
      const bare={exercise_id:ex.id,topic:"דמיון משולשים"},bound=build.bindRows(site,[bare]).rows[0];
      assert.equal(bound.source_pdf_hash,pdf);assert.equal(bound.source_native_sha256,manifest.nativeExportSha256);
      assert.throws(()=>build.bindRows(site,[{...bound,exercise_id:ex.id.replace("G9-T40-","G9-T32-")}]),/Stale or conflicting|Unresolved/);
    }
  }
  assert.equal(count,183);
});

test("a malformed catalog cannot treat E2 as a single-level alias of E",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"ramzi-e2-")),pdf="a".repeat(32);
  try{
    fs.mkdirSync(path.join(root,"headless/catalog"),{recursive:true});
    fs.mkdirSync(path.join(root,"noam-ai/manifests"),{recursive:true});
    fs.writeFileSync(path.join(root,"headless/catalog/catalog.v1.json"),JSON.stringify({grades:[{grade:8,topics:[{noamTopicId:"G8-T45",title:"דמיון משולשים",levels:[{pdfId:pdf}]}]}]}));
    for(const [levelCode,idLevel] of [["E2","E"],["E","E2"]]){
      fs.writeFileSync(path.join(root,"noam-ai/manifests",pdf+".json"),JSON.stringify({prefix:"G8-T45",pdfHash:pdf,levelCode,exercises:[{id:"G8-T45-"+idLevel+"-Q01א",text:"משימה"}]}));
      assert.throws(()=>build.loadSite(root),/E2 worksheet identity mismatch/);
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("the parser keeps hints and exercise wording and drops a truncated or repeated block",()=>{
  const parsed=build.parseBank(bank);
  assert.equal(parsed.entries.length,5);
  assert.deepEqual(parsed.incomplete,["G8-T06-A-Q01א"]);
  assert.deepEqual(parsed.conflicts,[]);
  const first=parsed.entries[0];
  assert.equal(first.topic,"מספרים מכוונים — ישר המספרים וערך מוחלט");
  assert.equal(first.exerciseText,"צוללן ירד לעומק");
  assert.deepEqual(first.hints,["חשבו על כיוון מתאים עם 'גרש'","פעולה ל-G7-T01-A-Q01א","צעד ל-G7-T01-A-Q01א"]);
});

test("bank IDs become live viewer IDs: C is מצוינות and grade 8/9 numbers are topic IDs",()=>{
  const {rows,rejected}=build.normalize(site,build.parseBank(bank));
  const ids=Object.fromEntries(rows.map(row=>[row.source_id,row.exercise_id]));
  assert.equal(ids["G7-T01-A-Q01א"],"G7-T01-A-Q01א");
  assert.equal(ids["G7-T01-C-Q01א"],"G7-T01-E-Q01א");
  assert.equal(ids["G8-T04-A-Q01א"],"G8-T24-A-Q01א","יחס ופרופורציה is G8-T24 on the site, not אי־שוויון");
  assert.equal(ids["G9-T16-A-Q01א"],"G9-T01-A-Q01א","חוקי חזקות is G9-T01 on the site");
  assert.deepEqual(rejected.map(item=>item.sourceId),["G7-T16-A-Q01א"],"the single-level worksheet has no level A part");
  assert.ok(rows.every(row=>row.status==="review"));
});

test("no solution or final answer leaves the builder",()=>{
  const {rows}=build.normalize(site,build.parseBank(bank));
  const sql=build.toSql(build.bindRows(site,rows).rows);
  assert.doesNotMatch(sql,/סוד הפתרון|סוד התשובה/);
  assert.match(sql,/עם ''גרש''/,"quotes are escaped");
  assert.match(sql,/^on conflict \(exercise_id\) do update set/m);
});

test("numeric slash fractions become bar fractions that Ramzi renders with KaTeX",()=>{
  assert.equal(build.barFractions("השבר 1/4."),"השבר $\\frac{1}{4}$.");
  assert.equal(build.barFractions("(3/2 כפול ו־28/80;"),"($\\frac{3}{2}$ כפול ו־$\\frac{28}{80}$;");
  ["2.5/3","1/2.5","km/h","$\\frac{1}{4}$"].forEach(text=>assert.equal(build.barFractions(text),text));
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,"..","learning/ramzi-hints.json"),"utf8"));
  rows.forEach(row=>row.hints.forEach(hint=>assert.doesNotMatch(hint,/\d\/\d/,row.exercise_id)));
});

test("only a verified review shows a hint, and a verified move claims its part first",()=>{
  const {rows}=build.normalize(site,build.parseBank(bank));
  const live=build.liveExercises(site);
  const applied=build.applyReviews(rows,[
    {exercise_id:"G7-T01-A-Q01א",verified:true,target_exercise_id:"G7-T01-E-Q01א",note:"מתאים לסעיף אחר"},
    {exercise_id:"G7-T01-E-Q01א",verified:false,note:"לא מתאים"},
    {exercise_id:"G8-T24-A-Q01א",verified:true,target_exercise_id:"G7-T02-A-Q01א",note:"דף אחר"},
    {exercise_id:"G9-T01-A-Q01א",verified:true,note:"מתאים"}
  ],live);
  const byId=Object.fromEntries(applied.rows.map(row=>[row.exercise_id,row]));
  assert.equal(byId["G7-T01-E-Q01א"].source_id,"G7-T01-A-Q01א");
  assert.equal(byId["G7-T01-E-Q01א"].status,"verified");
  assert.deepEqual(applied.displaced.map(item=>item.sourceId),["G7-T01-C-Q01א"]);
  assert.equal(byId["G8-T24-A-Q01א"].status,"review","a move to another worksheet is refused");
  assert.equal(byId["G9-T01-A-Q01א"].status,"verified");
});

test("published rows rebuild without the bank, and kept rows only fill parts the input lacks",()=>{
  const live=build.liveExercises(site);
  const row=(id,extra)=>Object.assign({exercise_id:id,status:"verified",source:"s",source_id:id,topic:"t",source_exercise_text:"x",hints:["א","ב","ג"],review_note:"n"},extra);
  const loaded=build.loadRows([
    row("G7-T01-A-Q01א"),
    row("G7-T01-C-Q01א"),
    row("G7-T16-A-Q01א"),
    row("G7-T01-A-Q01ב",{hints:["א","ב"]}),
    row("G7-T01-B-Q01א",{status:"live"})
  ],live);
  assert.deepEqual(loaded.rows.map(item=>[item.exercise_id,item.status]),[["G7-T01-A-Q01א","verified"],["G7-T01-B-Q01א","review"]]);
  assert.deepEqual(loaded.rejected.map(item=>item.exerciseId),["G7-T01-C-Q01א","G7-T16-A-Q01א","G7-T01-A-Q01ב"]);
  const merged=build.mergeRows(loaded.rows,build.loadRows([row("G7-T01-A-Q01א",{hints:["x","y","z"]}),row("G7-T01-A-Q34א")],live).rows);
  assert.equal(merged.kept,1);
  assert.deepEqual(merged.rows.map(item=>item.exercise_id),["G7-T01-A-Q01א","G7-T01-A-Q34א","G7-T01-B-Q01א"]);
  assert.equal(merged.rows[0].hints[0],"א","the input row wins over a kept row");
});

test("special worksheets read the same native package as the viewer",()=>{
  const viewer=fs.readFileSync(path.join(__dirname,"..","headless/astro-poc/public/noam-native-visual.js"),"utf8");
  const aliases=JSON.parse(viewer.match(/PACKAGE_ALIASES = (\{[^}]+\})/)[1]);
  const prefixes=Object.values(aliases).filter(prefix=>prefix!=="G9-T32");
  assert.ok(prefixes.length>=9);
  for(const prefix of prefixes){
    const exercise=build.nativeExercise(path.join(__dirname,".."),prefix+"-A-Q01א");
    assert.ok(exercise&&exercise.parts.some(part=>part.selected),prefix+" resolves to its native package");
  }
  assert.match(build.nativeExercise(path.join(__dirname,".."),"G8-T64-A-Q01א").stem,/ABD/);
});

test("the committed seed matches the committed public rows and hides unreviewed hints",()=>{
  const root=path.join(__dirname,"..");
  const rows=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints.json"),"utf8"));
  const sql=fs.readFileSync(path.join(root,"learning/ramzi-hints-seed.sql"),"utf8");
  const live=build.liveExercises(site);
  const seen=new Set();
  for(const row of rows){
    assert.match(row.exercise_id,build.SITE_ID_RE);
    assert.ok(live.has(row.exercise_id),row.exercise_id+" is a live exercise");
    assert.ok(!seen.has(row.exercise_id));seen.add(row.exercise_id);
    assert.ok(["verified","review"].includes(row.status));
    assert.match(row.source_pdf_hash,/^[a-f0-9]{32}$/);
    assert.ok(row.source_native_sha256===null||/^[a-f0-9]{64}$/.test(row.source_native_sha256));
    assert.equal(row.hints.length,3);
    row.hints.forEach(hint=>assert.ok(hint.length>0&&hint.length<=build.MAX_HINT));
    assert.ok(sql.includes("('"+row.exercise_id+"',"),row.exercise_id+" is in the seed");
  }
  assert.equal(sql.match(/^\('G\d-T\d{2}-(?:[ABE]|E2)-Q\d{2}/gm).length,rows.length);
  assert.doesNotMatch(sql,/פתרון מלא:|תשובה סופית:/);
  assert.equal(sql,build.toSql(rows),"seed round-trips every hint and source binding exactly");
  const loaded=build.loadRows(rows,live);
  assert.deepEqual(loaded.rejected,[]);
  assert.deepEqual(build.publicRows(build.bindRows(site,loaded.rows).rows),rows);
  assert.equal(rows.length,1760);
  assert.equal(rows.filter(row=>row.status==="verified").length,1760);
  assert.equal(rows.filter(row=>row.status==="review").length,0);
  assert.deepEqual(build.firstPartCoverage(site,rows),{eligible:424,verified:424,missing:[]});
  rows.forEach(row=>{
    assert.match(row.source_exercise_sha256,/^[a-f0-9]{64}$/);
    assert.ok(!Object.hasOwn(row,"source_exercise_text"),"answer-bearing bank context stays out of public JSON");
    assert.ok(!Object.hasOwn(row,"review_note"),"private review notes stay out of public JSON");
    assert.equal(build.hintIssue(row.hints),null,row.exercise_id);
  });
});

test("the trapezoid excellence rows from PR316 pass the gates and are pinned to the current revision",()=>{
  const root=path.join(__dirname,"..");
  const rows=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints.json"),"utf8"));
  const ledger=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints-review-20261031.json"),"utf8"));
  const review=new Map(ledger.rows.map(row=>[row.exercise_id,row.review]));
  const pilot=rows.filter(row=>row.source==="ramzi-writer-pilot-20261031");
  assert.equal(pilot.length,39);
  pilot.forEach(row=>{
    assert.match(row.exercise_id,/^G9-T39-E-Q\d{2}[א-ת]$/);
    assert.equal(row.status,"verified");
    assert.equal(row.source_pdf_hash,"e020549ff713406fb0c0f07443b09b18");
    assert.equal(row.source_native_sha256,"0d13e656ba7f89ca2cd9fc5b394ba95ede2e274a45cdd83ff88b2c1c528f6201");
    assert.equal(build.hintIssue(row.hints),null,row.exercise_id);
    assert.equal(review.get(row.exercise_id),"authored_against_native_source_agent_reviewed_pending_noam_approval");
  });
  // Q04ד, Q05ד and Q08ד come from PR319; this PR does not add a second ladder for them.
  for(const id of ["G9-T39-E-Q04ד","G9-T39-E-Q05ד","G9-T39-E-Q08ד"]){
    assert.ok(!pilot.some(row=>row.exercise_id===id),id);
  }
});

test("the public key reads only verified hints and the two safe source bindings",()=>{
  const root=path.join(__dirname,"..");
  const schema=fs.readFileSync(path.join(root,"learning/ramzi-hints-schema.sql"),"utf8");
  const client=fs.readFileSync(path.join(root,"headless/astro-poc/public/noam-curated-hints.js"),"utf8");
  const grants=schema.match(/^grant .*$/gm);
  assert.deepEqual(grants,["grant select (exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256) on public.noam_ramzi_hints to anon, authenticated;",
    "grant select,insert,update,delete on public.noam_ramzi_hints to service_role;"]);
  assert.match(client,/select=exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256"/);
  assert.match(schema,/enable row level security/);
  assert.match(schema,/revoke all on public\.noam_ramzi_hints from public, anon, authenticated/);
  assert.match(schema,/for select to anon, authenticated using \(status='verified'\)/);
  assert.match(schema,/source_pdf_hash text not null check/);
  assert.match(schema,/source_native_sha256 text check/);
});

test("T32 rows retain their current bindings after T40 receives its own IDs; legacy ambiguous sources still fail closed",()=>{
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,"..","learning/ramzi-hints.json"),"utf8"));
  const expected={A:"1484d3da89c246e0bf6f7c6ccf7fd6f5",B:"6bfa684eb9b644f684bea0cde1c5c9a1",E:"9e98f366feb74e129b7c9d1f1d33285d"};
  const originals=rows.filter(row=>/^G9-T32-[ABE]-Q01א$/.test(row.exercise_id)).map(row=>{
    const copy={...row};delete copy.source_pdf_hash;delete copy.source_native_sha256;return copy;
  });
  const bound=build.bindRows(site,originals);
  assert.equal(bound.rows.length,3);
  bound.rows.forEach(row=>assert.equal(row.source_pdf_hash,expected[row.exercise_id.split("-")[2]]));
  assert.ok(bound.resolutions.every(row=>row.reason==="unique_current_manifest"));
  const originalTopic=site.find(topic=>topic.prefix==="G9-T32");
  const imposter={...originalTopic,prefix:"G9-T40",levels:{A:{...originalTopic.levels.A,
    pdfId:"f".repeat(32),source_pdf_hash:"f".repeat(32)}}};
  const ambiguous=site.concat(imposter);
  assert.equal(build.bindRows(ambiguous,[originals[0]]).resolutions[0].reason,"canonical_catalog_prefix_topic_and_selected_text");
  assert.throws(()=>build.bindRows(ambiguous,[{...originals[0],source_exercise_text:"משימה אחרת"}]),/Unresolved/);
  assert.throws(()=>build.bindRows(ambiguous,[{...originals[0],topic:"נושא אחר"}]),/Unresolved/);
});

test("source binding never silently refreshes a stale review or guesses an ambiguous revision",()=>{
  const id="G9-T39-E-Q03ב",pdf="a".repeat(32),native="b".repeat(64);
  const row={exercise_id:id,topic:"הטרפז",source_exercise_text:"הוכיחו את הטענה.",hints:["א","ב","ג"]};
  const level=(p=pdf,n=native)=>({pdfId:p,source_pdf_hash:p,source_native_sha256:n,
    exercises:new Set([id]),exerciseTexts:new Map([[id,"הוכיחו את הטענה."]])});
  const catalog=[{prefix:"G9-T39",title:"הטרפז",levels:{E:level()}}];
  const correct=build.bindRows(catalog,[row]).rows[0];
  assert.equal(correct.source_pdf_hash,pdf);assert.equal(correct.source_native_sha256,native);
  assert.deepEqual(build.bindRows(catalog,[correct]).rows,[correct]);
  for(const change of [{source_pdf_hash:"c".repeat(32)},{source_pdf_hash:null},
    {source_native_sha256:"c".repeat(64)},{source_native_sha256:null},{source_native_sha256:"bad"}]){
    assert.throws(()=>build.bindRows(catalog,[{...correct,...change}]),/Stale or conflicting/);
  }
  assert.throws(()=>build.bindRows(catalog,[{...row,source_pdf_hash:pdf}]),/Incomplete source binding/);
  assert.throws(()=>build.bindRows(catalog,[{...row,source_native_sha256:native}]),/Incomplete source binding/);
  assert.throws(()=>build.bindRows(catalog,[{...correct,source_exercise_sha256:"d".repeat(64)}]),/source task fingerprint/);
  assert.throws(()=>build.bindRows([],[row]),/Unresolved/);
  const duplicate={prefix:"G9-T39",title:"הטרפז",levels:{E:level()}};
  assert.equal(build.bindRows([...catalog,duplicate],[row]).rows[0].source_pdf_hash,pdf,"identical PDF/native pairs deduplicate");
  assert.throws(()=>build.bindRows([...catalog,{...duplicate,levels:{E:level("c".repeat(32))}}],[row]),/Unresolved/);
  assert.throws(()=>build.bindRows([{...catalog[0],levels:{E:{...level(),pdfId:"d".repeat(32)}}}],[row]),/Invalid current/);
  assert.throws(()=>build.bindRows([{...catalog[0],levels:{E:level(pdf,"malformed")}}],[row]),/Invalid current/);
  assert.equal(build.bindRows([{...catalog[0],levels:{E:level(pdf,null)}}],[row]).rows[0].source_native_sha256,null);
  assert.throws(()=>build.toSql([row]),/requires validated source bindings/);
});

test("malformed published-row containers cannot silently rebuild an empty catalog",()=>{
  for(const value of [null,{},"[]",{rows:[]},42]){
    assert.throws(()=>build.loadRows(value,build.liveExercises(site)),/must be an array/);
  }
});

test("unsafe hint imports fail before JSON or SQL can publish their content",()=>{
  const base={exercise_id:"G7-T01-A-Q01א",source_pdf_hash:"a".repeat(32),source_native_sha256:null,
    hints:["איזה רעיון יכול לעזור כאן?","התבוננו בנתונים.","בדקו את דרך הפתרון."]};
  const cases=[
    ["השתמשו בנתון 7",base.hints[1],base.hints[2]],
    ["השתמשו בנתון ٧",base.hints[1],base.hints[2]],
    ["מה הקשר בין שתי הזוויות?",base.hints[1],base.hints[2]],
    ["מה הקשר בין ארבעת הקודקודים?",base.hints[1],base.hints[2]],
    ["חשבו על מֵאָה מעלות",base.hints[1],base.hints[2]],
    [base.hints[0],"x=7",base.hints[2]],
    [base.hints[0],"x≤7",base.hints[2]],
    [base.hints[0],"x&lt;y",base.hints[2]],
    [base.hints[0],"היחס 2.5/3",base.hints[2]],
    [base.hints[0],"תשובה סופית: ערך כלשהו",base.hints[2]],
    [base.hints[0],"![איור](image.png)",base.hints[2]],
    [base.hints[0],{text:"not plain text"},base.hints[2]]
  ];
  for(const hints of cases){
    const row={...base,hints};
    assert.ok(build.hintIssue(hints));
    assert.equal(build.loadRows([row]).rejected.length,1);
    assert.throws(()=>build.publicRows([row]),/Unsafe hints/);
    assert.throws(()=>build.toSql([row]),/Unsafe hints/);
  }
  assert.equal(build.hintIssue(base.hints),null);
  assert.equal(build.hintIssue([base.hints[0],"השבר $\\frac{1}{4}$.",base.hints[2]]),null);
});

test("first-part coverage requires a verified current-bound canonical worksheet row",()=>{
  const id="G8-T66-A-Q01א",pdf="a".repeat(32),native="b".repeat(64);
  const level={exercises:new Set([id]),source_pdf_hash:pdf,source_native_sha256:native};
  const site=[{grade:8,prefix:"G8-T66",levels:{A:level,B:level}},
    {grade:8,prefix:"G8-T65",levels:{A:level}}];
  const row={exercise_id:id,status:"verified",source_pdf_hash:pdf,source_native_sha256:native};
  assert.deepEqual(build.firstPartCoverage(site,[row]),{eligible:1,verified:1,missing:[]});
  for(const change of [{status:"review"},{source_pdf_hash:"c".repeat(32)},{source_native_sha256:null}]){
    assert.deepEqual(build.firstPartCoverage(site,[{...row,...change}]),{eligible:1,verified:0,missing:["G8-T66-A"]});
  }
});

test("rebuilding public rows excludes private solution fields even when supplied by the input",()=>{
  const row={exercise_id:"G7-T01-A-Q01א",hints:["איזה רעיון מתאים?","בדקו את הנתונים.","בדקו את התוצאה בעצמכם."],
    source_pdf_hash:"a".repeat(32),source_native_sha256:null,source_exercise_text:"PRIVATE_CONTEXT_ANSWER_SENTINEL",review_note:"PRIVATE_REVIEW_ANSWER_SENTINEL",
    full_solution:"PRIVATE_SOLUTION_SENTINEL",final_answer:"PRIVATE_ANSWER_SENTINEL"};
  const loaded=build.loadRows([row]);
  assert.deepEqual(loaded.rejected,[]);
  for(const text of [JSON.stringify(build.publicRows(loaded.rows)),build.toSql(loaded.rows)]){
    assert.doesNotMatch(text,/PRIVATE_SOLUTION_SENTINEL|PRIVATE_ANSWER_SENTINEL|PRIVATE_CONTEXT_ANSWER_SENTINEL|PRIVATE_REVIEW_ANSWER_SENTINEL|full_solution|final_answer/);
  }
});

test("private review packets cannot enter the public repository through a symlink",()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"ramzi-packet-scope-"));
  try{
    const repo=path.join(tmp,"repo");fs.mkdirSync(repo);
    const link=path.join(tmp,"outside-link");fs.symlinkSync(repo,link,"dir");
    assert.throws(()=>build.privatePacketDirectory(repo,path.join(repo,"packets")),/private context/);
    assert.throws(()=>build.privatePacketDirectory(repo,path.join(link,"new","packets")),/private context/);
    const outside=path.join(tmp,"private","packets");
    assert.equal(build.privatePacketDirectory(repo,outside),path.join(fs.realpathSync(tmp),"private","packets"));
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test("a source-task fingerprint preserves mathematical signs",()=>{
  assert.notEqual(build.sourceTaskHash("x-4"),build.sourceTaskHash("x 4"));
  assert.notEqual(build.sourceTaskHash("x+4"),build.sourceTaskHash("x-4"));
  assert.throws(()=>build.sourceTaskHash(""),/Missing current source task/);
});

test("every published ladder and source binding matches its recorded approval revision",()=>{
  const root=path.join(__dirname,"..");
  const rows=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints.json")));
  const ledger=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints-review-20261031.json")));
  const approved=new Map(ledger.rows.map(row=>[row.exercise_id,row]));
  assert.equal(approved.size,rows.length);
  assert.equal(ledger.rows.length,rows.length);
  for(const row of rows){
    const review=approved.get(row.exercise_id);assert.ok(review,row.exercise_id);
    assert.equal(review.hints_sha256,createHash('sha256').update(JSON.stringify(row.hints)).digest('hex'),row.exercise_id+' differs from its recorded approval');
    for(const key of ['source_pdf_hash','source_native_sha256','source_exercise_sha256'])assert.equal(review[key],row[key],row.exercise_id+' source changed');
  }
});

test("all current Q01 parts have a source-bound ladder, including E2 and canonical T40",()=>{
  const root=path.join(__dirname,"..");
  const rows=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints.json")));
  const byId=new Map(rows.map(row=>[row.exercise_id,row]));
  const expected=new Map();
  for(const topic of site){
    if(![7,8,9].includes(topic.grade))continue;
    for(const level of Object.values(topic.levels))for(const id of level.exercises){
      if(!/-Q01[א-ת]?$/.test(id))continue;
      const key=level.source_pdf_hash+":"+id;
      expected.set(key,{id,level});
    }
  }
  assert.equal(expected.size,1653);
  for(const {id,level}of expected.values()){
    const row=byId.get(id);assert.ok(row,id+" is missing");
    assert.equal(row.status,"verified");
    assert.equal(row.source_pdf_hash,level.source_pdf_hash,id);
    assert.equal(row.source_native_sha256,level.source_native_sha256,id);
    assert.equal(row.source_exercise_sha256,build.sourceTaskHash(level.exerciseTexts.get(id)),id);
    assert.equal(build.hintIssue(row.hints),null,id);
  }
  const generated=rows.filter(row=>row.source==="ramzi-flash-authored-20261031");
  assert.equal(generated.length,1217);
  const ledger=JSON.parse(fs.readFileSync(path.join(root,"learning/ramzi-hints-review-20261031.json")));
  for(const row of generated){
    const entry=ledger.rows.find(item=>item.exercise_id===row.exercise_id);
    assert.equal(entry.authoring_model,"qwen3.8-flash");
    assert.equal(entry.review,"machine_generated_flash_automatic_checks_no_model_review");
  }
});

test("the newly approved proof row contains only student-facing hints and a current revision binding",()=>{
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,"..","learning/ramzi-hints.json"),"utf8"));
  const row=rows.find(row=>row.exercise_id==="G9-T39-E-Q03ב");
  assert.equal(row.status,"verified");assert.equal(row.source,"ramzi-reviewed-20261031");
  assert.equal(row.source_pdf_hash,"e020549ff713406fb0c0f07443b09b18");
  assert.equal(row.source_native_sha256,"0d13e656ba7f89ca2cd9fc5b394ba95ede2e274a45cdd83ff88b2c1c528f6201");
  assert.match(row.hints[1],/^אם הוכחתם/);
  assert.match(row.hints[2],/אם נימקתם/);
  assert.doesNotMatch(row.hints.join(" "),/SAS|צלע.זווית.צלע|expectedStudentStep|internalMathematicalOracle|AD=BC/);
  assert.deepEqual(Object.keys(row).sort(),["exercise_id","hints","source","source_exercise_sha256","source_id","source_native_sha256","source_pdf_hash","status","topic"].sort());
});
