"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const guides=require("../noam-geometry-guides.js");

const source="במעוין ABCD האלכסונים נפגשים בנקודה O. על האלכסון AC מסמנים שתי נקודות שונות E וכן F, כך שהנקודה O נמצאת ביניהן ומתקיים CF = AE. סדר הנקודות על AC בשרטוט: A,E,O,F,C.";
function q6(part="א",level="E"){
  return {id:`G9-T19-${level}-Q06${part}`,context:source,text:part==="א"?"הוכיחו כי OF = OE.":"הוכיחו כי BEDF מעוין."};
}
function q4(part="א"){
  return {id:`G9-T15-E-Q04${part}`,context:"במשולש △ABC, הנקודה D נמצאת על הצלע AC והנקודה E על הצלע AB. נתון: הקטע BD חוצה את ∡ABC, וכן BC ∥ DE.",text:part==="א"?"הוכיחו EB = ED.":"נתון ∡BAC = 60°, ∡ABC = 70°. חשבו ∡EDB ושל ∡ADE."};
}
const segs=scene=>scene.highlights.map(s=>s.from+s.to);
const equalSets=scene=>scene.equalGroups.map(g=>g.segments.map(s=>s.slice().sort().join("")).sort().join("|"));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const angle=(p,a,b,c)=>{
  const u=[p[a][0]-p[b][0],p[a][1]-p[b][1]],v=[p[c][0]-p[b][0],p[c][1]-p[b][1]];
  return Math.acos((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))*180/Math.PI;
};

test("Q6 is a true rhombus with collinear symmetric interior points",()=>{
  const s=guides.resolve(q6());const p=s.points;
  assert.equal(s.type,"geometry-scene");
  const lengths=["AB","BC","CD","DA"].map(([a,b])=>distance(p[a],p[b]));
  lengths.forEach(n=>assert.ok(Math.abs(n-lengths[0])<1e-10));
  assert.ok(Math.abs(angle(p,"A","O","B")-90)<1e-10);
  assert.ok(Math.abs(distance(p.A,p.E)-distance(p.C,p.F))<1e-10);
  assert.ok(distance(p.A,p.E)<distance(p.A,p.O));
  assert.ok(distance(p.C,p.F)<distance(p.C,p.O));
  assert.ok(p.A[0]<p.C[0]&&p.A[1]>p.C[1]);
  assert.deepEqual(equalSets(s),["AE|CF"]);
});

test("matching source facts work for each level; unknown exercises cannot inherit the drawing",()=>{
  for(const level of ["A","B","E"]){assert.ok(guides.resolve(q6("א",level)));}
  assert.equal(guides.resolve({...q6(),id:"G9-T19-E-Q07א"}),null);
  assert.equal(guides.resolve({id:"G9-T19-E-Q06א",text:"שאלה 6, סעיף א"}),null);
  assert.equal(guides.resolve(null),null);
});

test("changed source facts or the actual different level-B question reject the Q6 proof diagram",()=>{
  const numeric={id:"G9-T19-B-Q06א",context:"במעוין ABCD האלכסונים נפגשים בנקודה O. נתון AC = 30 ס״מ, BD = 16 ס״מ.",text:"חשבו את אורך צלע המעוין."};
  assert.equal(guides.resolve(numeric),null);
  assert.equal(guides.resolve({...q6(),context:source.replace("CF = AE","CF = 2AE")}),null);
  assert.equal(guides.resolve({...q6(),context:source.replace("אלכסון AC","אלכסון BD")}),null);
  assert.equal(guides.resolve({...q6(),context:source.replace("O נמצאת ביניהן","O נמצאת מחוץ לקטע EF")}),null);
});

test("vision-only exercises require independently verified geometrySource",()=>{
  const vision={id:"G9-T19-E-Q06א",context:"",text:"שאלה 6, סעיף א",prompt:"יש לקרוא מתמונת התרגיל בלבד."};
  assert.equal(guides.resolve(vision),null);
  assert.ok(guides.resolve({...vision,geometrySource:source}));
  assert.equal(guides.resolve({...vision,geometrySource:source.replace("מעוין","מלבן")}),null);
});

test("transcript first hint marks diagonal halves without the proof target",()=>{
  const s=guides.resolve(q6(),{helpKind:"hint",hintIndex:0,answer:"האם הנתון שאלכסוני המעוין חוצים זה את זה יכול לעזור לך להשוות בין הקטעים AO ו־OC?"});
  assert.equal(s.key,"q6-halves");
  assert.deepEqual(segs(s),["AO","OC"]);
  assert.deepEqual(equalSets(s),["AO|CO"]);
  assert.deepEqual(s.equations,["AO = OC"]);
  assert.equal(s.rightAngles.length,0);
  assert.ok(!s.equations.some(t=>/EO = OF/.test(t)));
});

test("a subtraction answer redraws removed pieces and remainders without giving the conclusion",()=>{
  const s=guides.resolve(q6(),{studentMessage:"AO-AE=CO-CF",answer:"הביטוי AO-AE שווה ל־EO והביטוי CO-CF שווה ל־OF. מה ניתן להסיק לגבי EO ו־OF?"});
  assert.equal(s.key,"q6-subtraction");
  assert.deepEqual(segs(s),["AE","CF","EO","OF"]);
  assert.deepEqual(s.equations,["EO = AO − AE","OF = CO − CF"]);
  assert.deepEqual(equalSets(s),["AE|CF"]);
});

test("remaining segments are located without granting a student's equality claim",()=>{
  const s=guides.resolve(q6(),{studentMessage:"אני יודע ש־EO=OF. תראה לי את EO ואת OF",answer:"כדי להוכיח EO = OF, השתמשו בנתונים."});
  assert.equal(s.key,"q6-remainders");
  assert.deepEqual(segs(s),["EO","OF"]);
  assert.deepEqual(s.equalGroups,[]);
  assert.deepEqual(s.equations,[]);
});

test("an established equality can be marked, including reverse segment order and latex",()=>{
  for(const answer of ["לכן EO = OF.","מכאן \\(\\mathrm{OE} = \\mathrm{FO}\\)."]){
    const s=guides.resolve(q6(),{answer});
    assert.equal(s.key,"q6-remainders");
    assert.deepEqual(equalSets(s),["EO|FO"]);
    assert.deepEqual(s.equations,["EO = OF"]);
  }
});

test("questions, goals and negated statements never authorize target equality marks",()=>{
  for(const answer of ["האם EO = OF?","EO = OF?","צריך להוכיח EO = OF.","כדי להראות EO = OF, נעזר בחיסור קטעים.","לא נכון ש־EO = OF.","מדוע EO = OF?"]){
    const s=guides.resolve(q6(),{answer});
    assert.ok(!equalSets(s).includes("EO|FO"),answer);
    assert.ok(!s.equations.includes("EO = OF"),answer);
  }
});

test("only an answer establishing the result adds equality after subtraction",()=>{
  const s=guides.resolve(q6(),{answer:"בחיסור קטעים שווים מקטעים שווים מתקבלים הפרשים שווים. לכן EO = OF."});
  assert.equal(s.key,"q6-subtraction");
  assert.deepEqual(equalSets(s),["AE|CF","EO|FO"]);
  assert.equal(s.equations.at(-1),"EO = OF");
});

test("a perpendicular-diagonals explanation marks a right angle and no future length conclusions",()=>{
  const s=guides.resolve(q6("ב"),{answer:"BD מאונך ל־EF כי EF מונח על האלכסון AC."});
  assert.equal(s.key,"q6-diagonals");
  assert.deepEqual(segs(s),["BD","EF"]);
  assert.deepEqual(s.rightAngles,[["B","O","F"]]);
  assert.deepEqual(s.equalGroups,[]);
  assert.deepEqual(s.equations,["BD ⊥ EF"]);
});

test("BEDF focus highlights the perimeter without asserting all sides are equal",()=>{
  const s=guides.resolve(q6("ב"),{answer:"כעת נבחן את המרובע BEDF."});
  assert.equal(s.key,"q6-inner");
  assert.deepEqual(segs(s),["BE","ED","DF","FB"]);
  assert.deepEqual(s.equalGroups,[]);
  assert.deepEqual(s.equations,[]);
});

test("progress alone cannot advance into an unasked proof step",()=>{
  const s=guides.resolve(q6(),{studentMessage:"תוכל לשרטט?",progress:99});
  assert.equal(s.key,"q6-givens");
  assert.deepEqual(equalSets(s),["AE|CF"]);
  assert.deepEqual(s.rightAngles,[]);
});

test("all matching checked-in Q6 sources resolve but differing or unknown versions do not",()=>{
  const dir=path.join(__dirname,"../noam-ai/manifests");let matching=0,numeric=0,vision=0;
  for(const filename of fs.readdirSync(dir)){
    if(!filename.endsWith(".json")){continue;}
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,filename),"utf8"));
    for(const e of manifest.exercises||[]){
      if(!/^G9-T19-[ABE]-Q06[אבג]$/.test(e.id||"")){continue;}
      const sourceText=e.geometrySource||e.context||"";
      if(/CF\s*=\s*AE|AE\s*=\s*CF/.test(sourceText)&&/A,E,O,F,C/.test(sourceText)){assert.ok(guides.resolve(e),filename+" "+e.id);matching++;}
      else {assert.equal(guides.resolve(e),null,filename+" "+e.id);if(e.context){numeric++;}else{vision++;}}
    }
  }
  assert.ok(matching>=5);assert.ok(numeric>=6);assert.ok(vision>=1);
});

test("Q4 construction obeys the given angle bisector and parallel instead of tracing a distorted scan",()=>{
  const s=guides.resolve(q4(),{focusKey:"q4a-bisector"});const p=s.points;
  assert.ok(Math.abs(angle(p,"A","B","C")-70)<1e-10);
  assert.ok(Math.abs(angle(p,"B","A","C")-60)<1e-10);
  assert.ok(Math.abs(angle(p,"A","B","D")-angle(p,"D","B","C"))<1e-10);
  assert.ok(Math.abs(p.D[1]-p.E[1])<1e-10);
  assert.ok(Math.abs(distance(p.E,p.D)-distance(p.E,p.B))<1e-10);
  assert.deepEqual(s.angles.map(a=>a.label),["∠EBD","∠DBC"]);
});

test("Q4 each hint gets only its own angle and line marks",()=>{
  const expectedA=[["∠EBD","∠EDB"],["∠EBD","∠DBC"],["∠DBC","∠EDB"]];
  const expectedB=[["∠ABD","∠DBC"],["∠EBD","∠EDB"],["∠ADE","∠ACB"]];
  for(let i=0;i<3;i++){
    for(const [part,expected] of [["א",expectedA],["ב",expectedB]]){
      const s=guides.resolve(q4(part),{helpKind:"hint",hintIndex:i});
      assert.deepEqual(s.angles.map(a=>a.label),expected[i]);
      assert.deepEqual(s.equalGroups,[]);assert.deepEqual(s.equations,[]);
    }
  }
});

test("Q4 a named angle or existing validated focus key gets exactly the right rays",()=>{
  const s=guides.resolve(q4(),{studentMessage:"איפה זווית EBD?"});
  assert.deepEqual(s.angles,[{from:"E",vertex:"B",to:"D",label:"∠EBD"}]);
  const alternate=guides.resolve(q4(),{focusKey:"q4a-alternate"});
  assert.deepEqual(alternate.angles.map(a=>a.label),["∠DBC","∠EDB"]);
  assert.deepEqual(segs(alternate),["DE","BC","DB"]);
});

test("Q4 lacks a redraw when facts cannot be verified",()=>{
  assert.equal(guides.resolve({id:"G9-T15-E-Q04א",text:"שאלה 4"}),null);
  assert.equal(guides.resolve({...q4(),context:q4().context.replace("BC ∥ DE","AB ∥ DE")}),null);
  const defaultScene=guides.resolve(q4(),{studentMessage:"תוכל לצייר?",progress:3});
  assert.deepEqual(defaultScene.angles,[]);
});

test("Q6 locating exactly one segment highlights that segment alone",()=>{
  for(const [question,segment] of [["איפה נמצא הקטע DB?","BD"],["תראה לי את EO","OE"],["סמן את AO","AO"]]){
    const s=guides.resolve(q6(),{studentMessage:question,answer:"האלכסונים חוצים זה את זה ולכן AO = OC."});
    assert.deepEqual(segs(s),[segment]);
    assert.deepEqual(s.equalGroups,[]);assert.deepEqual(s.rightAngles,[]);
  }
});

test("Q4 an explicit student's angle wins over other angles in the answer",()=>{
  const s=guides.resolve(q4(),{studentMessage:"איפה ∠EBD?",answer:"סמנו את ∠DBC ואת ∠EDB."});
  assert.deepEqual(s.angles.map(a=>a.label),["∠EBD"]);
});

test("every supported scene renders with mathematically valid annotations",()=>{
  const Geometry=require("../noam-geometry.js");
  function create(name){return {name,children:[],appendChild(node){this.children.push(node);return node;},setAttribute(){}};}
  const doc={createElement:create,createElementNS(_ns,name){return create(name);}};
  const q6Keys=["q6-givens","q6-halves","q6-subtraction","q6-remainders","q6-diagonals","q6-inner","q6-segment-BD"];
  for(const key of q6Keys){
    const scene=guides.resolve(q6(),{focusKey:key,answer:"נתון AE=CF. לכן EO = OF. וגם OB = OD."});
    assert.ok(Geometry.render(doc,scene),key);
  }
  for(const part of ["א","ב"]){
    for(let i=0;i<3;i++){
      assert.ok(Geometry.render(doc,guides.resolve(q4(part),{helpKind:"hint",hintIndex:i})),part+" "+i);
    }
  }
});

test("unproven hypotheses cannot add equality marks even when written as equations",()=>{
  for(const answer of ["אם EO = OF, אפשר להמשיך.","נניח כי EO = OF.","הטענה EO = OF עדיין אינה מוכחת.","EO = OF + 1.","לכן 2EO = OF."]){
    const s=guides.resolve(q6(),{answer});
    assert.ok(!equalSets(s).includes("EO|FO"),answer);
    assert.ok(!s.equations.includes("EO = OF"),answer);
  }
});

test("arithmetic expressions must not be mistaken for the verified equal-length source fact",()=>{
  for(const invalid of ["CF=AE+1","2CF=AE","CF=AE/2","CF=AE+OF"]){
    assert.equal(guides.resolve({...q6(),context:source.replace("CF = AE",invalid)}),null,invalid);
  }
});

test("naming diagonals or halves does not disclose perpendicularity or equality",()=>{
  for(const answer of ["בדקו את BD ואת EF. מה אפשר להסיק?","כעת נבחן את הקטעים BD ו-EF."]){
    const s=guides.resolve(q6("ב"),{answer});
    assert.equal(s.key,"q6-diagonals");assert.deepEqual(s.rightAngles,[]);assert.deepEqual(s.equations,[]);
  }
  const halves=guides.resolve(q6(),{answer:"בדקו את הקטעים AO ו-OC."});
  assert.deepEqual(halves.equalGroups,[]);assert.deepEqual(halves.equations,[]);
  const subtraction=guides.resolve(q6(),{answer:"היעזרו בחיסור קטעים."});
  assert.deepEqual(subtraction.equations,[]);
});

test("explicit named angle requests use known geometry and unknown targets safely decline",()=>{
  const angleScene=guides.resolve(q6(),{studentMessage:"צייר לי את זווית EBF",answer:"היעזרו בחיסור קטעים."});
  assert.deepEqual(angleScene.angles,[{from:"E",vertex:"B",to:"F",label:"∠EBF"}]);
  assert.deepEqual(angleScene.equalGroups,[]);assert.deepEqual(angleScene.highlights,[]);
  assert.equal(guides.resolve(q6(),{studentMessage:"צייר לי את זווית XYZ"}),null);
  assert.equal(guides.resolve(q6(),{studentMessage:"צייר לי את הקטע GH"}),null);
  assert.equal(guides.resolve(q6(),{studentMessage:"צייר לי את זווית AOC"}),null);
  const triangleScene=guides.resolve(q4(),{studentMessage:"שרטט את זווית ABC"});
  assert.deepEqual(triangleScene.angles,[{from:"A",vertex:"B",to:"C",label:"∠ABC"}]);
});

test("Q6 cannot silently swap E and F when the point ordering is not verified",()=>{
  assert.equal(guides.resolve({...q6(),context:source.replace("A,E,O,F,C","A,F,O,E,C")}),null);
  assert.equal(guides.resolve({...q6(),context:source.replace(" סדר הנקודות על AC בשרטוט: A,E,O,F,C.","")}),null);
});

test("changed explicit angle values do not reuse the numeric Q4 construction",()=>{
  assert.ok(guides.resolve(q4("ב")));
  assert.equal(guides.resolve({...q4("ב"),text:q4("ב").text.replace("70°","80°")}),null);
  assert.equal(guides.resolve({...q4("ב"),text:q4("ב").text.replace("60°","40°")}),null);
});

test("an illustration attached to an answer uses its named angles and refuses unknown objects",()=>{
  const scene=guides.resolve(q6(),{answer:"הסתכלו על הזווית ∠EBF."});
  assert.deepEqual(scene.angles,[{from:"E",vertex:"B",to:"F",label:"∠EBF"}]);
  assert.equal(guides.resolve(q6(),{answer:"סמנו את זווית XYZ."}),null);
  assert.equal(guides.resolve(q6(),{answer:"הקטע GH משלים את התמונה."}),null);
});

test("explicit outer-edge and mixed-segment requests highlight exactly the requested pieces",()=>{
  for(const [question,expected] of [["הדגם את AB",["AB"]],["הדגם את AE ואת OF",["AE","OF"]]]){
    const scene=guides.resolve(q6(),{studentMessage:question,answer:"לכן AO = OC. בחיסור קטעים מתקבל EO = OF."});
    assert.deepEqual(segs(scene),expected);
    assert.deepEqual(scene.equalGroups,[]);assert.deepEqual(scene.rightAngles,[]);assert.deepEqual(scene.equations,[]);
  }
  const remainders=guides.resolve(q6(),{studentMessage:"הדגם באמצעות שרטוט את EO ואת OF",answer:"בדקו את חצאי האלכסון AO ו-OC."});
  assert.equal(remainders.key,"q6-remainders");assert.deepEqual(segs(remainders),["EO","OF"]);
});
