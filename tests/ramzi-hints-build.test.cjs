"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const build=require("../tools/ramzi-hints/build-ramzi-hints.cjs");

const RULE="------------------------------------------------------------";
function block(id,meta,exercise){
  return [
    "סעיף א ("+id+") ["+meta+"]",
    "* נוסח התרגיל: "+exercise,
    "* פתרון מלא: סוד הפתרון "+id,
    "* תשובה סופית: סוד התשובה "+id,
    "* רמז 1 (כיוון מחשבה): כיוון ל-"+id+" עם 'גרש'",
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

test("the parser keeps hints and exercise wording and drops a truncated or repeated block",()=>{
  const parsed=build.parseBank(bank);
  assert.equal(parsed.entries.length,5);
  assert.deepEqual(parsed.incomplete,["G8-T06-A-Q01א"]);
  assert.deepEqual(parsed.conflicts,[]);
  const first=parsed.entries[0];
  assert.equal(first.topic,"מספרים מכוונים — ישר המספרים וערך מוחלט");
  assert.equal(first.exerciseText,"צוללן ירד לעומק");
  assert.deepEqual(first.hints,["כיוון ל-G7-T01-A-Q01א עם 'גרש'","פעולה ל-G7-T01-A-Q01א","צעד ל-G7-T01-A-Q01א"]);
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
  const sql=build.toSql(rows);
  assert.doesNotMatch(sql,/סוד הפתרון|סוד התשובה/);
  assert.match(sql,/עם ''גרש''/,"quotes are escaped");
  assert.match(sql,/^on conflict \(exercise_id\) do update set/m);
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
    assert.equal(row.hints.length,3);
    row.hints.forEach(hint=>{
      assert.ok(hint.length>0&&hint.length<=build.MAX_HINT);
      assert.ok(!hint.includes("/"),row.exercise_id+" has no slash fraction");
    });
    assert.ok(sql.includes("('"+row.exercise_id+"',"),row.exercise_id+" is in the seed");
  }
  assert.equal(sql.match(/^\('G\d-T\d{2}-[ABE]-Q\d{2}/gm).length,rows.length);
  assert.doesNotMatch(sql,/פתרון מלא:|תשובה סופית:/);
});

test("the public key reads only the id and the three hints that Ramzi asks for",()=>{
  const root=path.join(__dirname,"..");
  const schema=fs.readFileSync(path.join(root,"learning/ramzi-hints-schema.sql"),"utf8");
  const client=fs.readFileSync(path.join(root,"headless/astro-poc/public/noam-curated-hints.js"),"utf8");
  const grants=schema.match(/^grant .*$/gm);
  assert.deepEqual(grants,["grant select (exercise_id,hint_1,hint_2,hint_3) on public.noam_ramzi_hints to anon, authenticated;"]);
  assert.match(client,/select=exercise_id,hint_1,hint_2,hint_3"/);
});
