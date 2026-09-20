(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamDidacticGuides=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  // Every overlay below was measured against the cached crop of Question 4.
  // Chat text may choose one of these keys, but it can never supply coordinates.
  var q4Crop={x:.055,y:.015,w:.285,h:.68};
  var q4Point={
    A:[.158,.126],E:[.128,.36],D:[.228,.36],B:[.095,.628],C:[.305,.628]
  };

  function q4Angle(name){
    var letters=String(name||"").split("");
    return {
      vertex:q4Point[letters[1]],from:q4Point[letters[0]],to:q4Point[letters[2]],
      label:"∠"+name
    };
  }

  function q4Visual(label,segments,angles){
    return {
      label:label,
      crop:q4Crop,
      segments:segments||[],
      angles:(angles||[]).map(q4Angle)
    };
  }

  var q4ParallelDB=[
    {from:q4Point.E,to:q4Point.D,role:"parallel"},
    {from:q4Point.B,to:q4Point.C,role:"parallel"},
    {from:q4Point.B,to:q4Point.D,role:"transversal"}
  ];
  var q4ParallelAC=[
    {from:q4Point.E,to:q4Point.D,role:"parallel"},
    {from:q4Point.B,to:q4Point.C,role:"parallel"},
    {from:q4Point.A,to:q4Point.C,role:"transversal"}
  ];

  var proofVisuals={
    "q4a-base-angles":q4Visual("זוויות הבסיס במשולש EDB",[],["EBD","EDB"]),
    "q4a-bisector":q4Visual("הזוויות שיוצר חוצה הזווית",[
      {from:q4Point.B,to:q4Point.D,role:"emphasis"}
    ],["EBD","DBC"]),
    "q4a-alternate":q4Visual("הזוויות המתחלפות והישר החותך",q4ParallelDB,["DBC","EDB"]),
    "q4a-angle-ebd":q4Visual("הזווית ∠EBD",[],["EBD"]),
    "q4a-angle-edb":q4Visual("הזווית ∠EDB",[],["EDB"]),
    "q4a-angle-abd":q4Visual("הזווית ∠ABD",[],["ABD"]),
    "q4a-angle-dbc":q4Visual("הזווית ∠DBC",[],["DBC"])
  };

  var calculationVisuals={
    "q4b-bisector":q4Visual("שתי הזוויות שיוצר חוצה הזווית",[
      {from:q4Point.B,to:q4Point.D,role:"emphasis"}
    ],["ABD","DBC"]),
    "q4b-isosceles":q4Visual("זוויות הבסיס במשולש EDB",[],["EBD","EDB"]),
    "q4b-parallel":q4Visual("הזוויות המתאימות בין הישרים המקבילים",q4ParallelAC,["ADE","ACB"]),
    "q4b-angle-abd":q4Visual("הזווית ∠ABD",[],["ABD"]),
    "q4b-angle-dbc":q4Visual("הזווית ∠DBC",[],["DBC"]),
    "q4b-angle-ebd":q4Visual("הזווית ∠EBD",[],["EBD"]),
    "q4b-angle-edb":q4Visual("הזווית ∠EDB",[],["EDB"]),
    "q4b-angle-ade":q4Visual("הזווית ∠ADE",[],["ADE"]),
    "q4b-angle-acb":q4Visual("הזווית ∠ACB",[],["ACB"])
  };

  var guides={
    "G9-T15-E-Q04א":{
      kind:"geometry-proof",
      goal:"להוכיח ED = EB",
      canonicalFacts:[
        "E נמצאת על AB, ולכן הקרן BE היא אותה קרן כמו BA.",
        "BD חוצה את ∠ABC, ולכן ∠ABD = ∠DBC.",
        "DE ∥ BC והישר DB חותך אותם, ולכן ∠DBC = ∠EDB."
      ],
      canonicalChain:"∠EBD = ∠ABD = ∠DBC = ∠EDB; לכן במשולש EDB זוויות הבסיס שוות, ומכאן ED = EB.",
      forbidden:[
        "אסור להשתמש ב-ED = EB לפני סוף ההוכחה; זו המטרה ולא נתון.",
        "∠EBD אינה זווית מתחלפת של הישרים DE ו-BC, מפני שאף אחת מקרניה אינה מונחת על DE או על BC.",
        "הזוג המתחלף הדרוש הוא ∠EDB ו-∠DBC, והחותך הוא DB."
      ],
      modelPrompt:"מדריך מאומת לתרגיל. המטרה: להוכיח ED = EB; זה אינו נתון. השרשרת המאומתת: E על AB ⇒ ∠EBD = ∠ABD; BD חוצה את ∠ABC ⇒ ∠ABD = ∠DBC; DE ∥ BC והחותך DB ⇒ ∠DBC = ∠EDB; לכן ∠EBD = ∠EDB, ובמשולש EDB מתקבל ED = EB. ∠EBD אינה זווית מתחלפת; הזוג הוא ∠DBC ו־∠EDB. תן רק את הצעד הבא.",
      hints:[
        "כדי להוכיח ED = EB, חפשו במשולש EDB שתי זוויות בסיס שוות. התמקדו ב־∠EBD וב־∠EDB.",
        "מכיוון ש־E נמצאת על AB ו־BD חוצה את ∠ABC, מתקבל ∠EBD = ∠DBC. כעת השתמשו במקבילים.",
        "הישר DB חותך את המקבילים DE ו־BC, ולכן ∠DBC = ∠EDB. חברו זאת לשוויון הקודם."
      ],
      angleHelp:"סמנו את ∠EDB ליד D ואת ∠DBC ליד B. מאחר ש־DE ∥ BC והישר DB חותך אותם, אלו זוויות מתחלפות פנימיות ולכן הן שוות.",
      nextStep:"נכון שצריך להגיע ל־∠EBD = ∠EDB. קודם ∠EBD = ∠DBC בגלל חוצה הזווית והעובדה ש־E על AB; אחר כך השתמשו ב־DE ∥ BC כדי לקשר את ∠DBC ל־∠EDB.",
      visuals:proofVisuals,
      defaultVisualKey:"q4a-alternate",
      hintVisualKeys:["q4a-base-angles","q4a-bisector","q4a-alternate"],
      angleVisualKeys:{EBD:"q4a-angle-ebd",EDB:"q4a-angle-edb",ABD:"q4a-angle-abd",DBC:"q4a-angle-dbc"},
      anglePairVisualKeys:{"EBD|EDB":"q4a-base-angles","DBC|EBD":"q4a-bisector","DBC|EDB":"q4a-alternate"},
      angleHelpVisualKey:"q4a-alternate",
      intentVisualKeys:{base:"q4a-base-angles",bisector:"q4a-bisector",parallel:"q4a-alternate"},
      visualFocus:proofVisuals["q4a-alternate"]
    },
    "G9-T15-E-Q04ב":{
      kind:"geometry-angle-calculation",
      goal:"לחשב את ∠EDB ואת ∠ADE",
      canonicalFacts:[
        "BD חוצה את ∠ABC = 70°, ולכן ∠ABD = ∠DBC = 35°.",
        "מסעיף א׳ ∠EBD = ∠EDB, ולכן ∠EDB = 35°.",
        "∠ACB = 180° − 70° − 60° = 50°, ומכיוון ש-DE ∥ BC מתקבל ∠ADE = ∠ACB = 50°."
      ],
      canonicalChain:"∠EDB = 35° ו-∠ADE = 50°.",
      forbidden:[
        "אין לחבר או לחסר זוויות לפי מראה השרטוט.",
        "יש להשתמש בתוצאת סעיף א׳ רק לאחר שזוהתה במפורש."
      ],
      modelPrompt:"מדריך מאומת לתרגיל. BD חוצה את ∠ABC = 70°, ולכן ∠ABD = ∠DBC = 35°. מסעיף א׳ ∠EBD = ∠EDB, ולכן ∠EDB = 35°. במשולש ABC מתקבל ∠ACB = 180° − 70° − 60° = 50°; DE ∥ BC ולכן ∠ADE = ∠ACB = 50°. תן רק את הצעד הבא.",
      hints:[
        "התחילו מחוצה הזווית: BD מחלק את ∠ABC = 70° לשתי זוויות שוות.",
        "מסעיף א׳, המשולש EDB שווה שוקיים ולכן ∠EDB = ∠EBD. חשבו תחילה את ∠EBD.",
        "כדי למצוא את ∠ADE, חשבו את ∠ACB במשולש ABC, ואז השתמשו ב־DE ∥ BC."
      ],
      angleHelp:"ל־∠ADE מתאימה הזווית ∠ACB: הקרן DA נמצאת על CA, והישר DE מקביל ל־BC.",
      nextStep:"חשבו תחילה 70° : 2. התוצאה היא ∠EBD, ומסעיף א׳ היא שווה גם ל־∠EDB.",
      visuals:calculationVisuals,
      defaultVisualKey:"q4b-bisector",
      hintVisualKeys:["q4b-bisector","q4b-isosceles","q4b-parallel"],
      angleVisualKeys:{ABD:"q4b-angle-abd",DBC:"q4b-angle-dbc",EBD:"q4b-angle-ebd",EDB:"q4b-angle-edb",ADE:"q4b-angle-ade",ACB:"q4b-angle-acb"},
      anglePairVisualKeys:{"ABD|DBC":"q4b-bisector","EBD|EDB":"q4b-isosceles","ACB|ADE":"q4b-parallel"},
      angleHelpVisualKey:"q4b-parallel",
      intentVisualKeys:{base:"q4b-isosceles",bisector:"q4b-bisector",parallel:"q4b-parallel"},
      visualFocus:calculationVisuals["q4b-bisector"]
    }
  };

  function get(exerciseId){
    return guides[String(exerciseId||"")]||null;
  }

  function asksWhichAngle(text){
    return /איז(?:ו|ה)\s+זווית|קשה\s+לי\s+לזהות|לא\s+(?:רואה|מזהה).*זווית|סמ(?:ן|ני)\s+לי.*זווית/i.test(String(text||""));
  }

  function asksForNextStep(text){
    return /ואז\s+מה|מה\s+עכשיו|איך\s+ממשיכ|מה\s+השלב\s+הבא/i.test(String(text||""));
  }

  function asksToEnlarge(text){
    var value=String(text||"");
    return /(?:שרטוט|ציור|תמונה).*(?:קטן|הגדל)|(?:קטן|הגדל).*(?:שרטוט|ציור|תמונה)/i.test(value);
  }

  function namedVisualKey(guide,text){
    var value=String(text||"").toUpperCase();
    var keys=Object.keys(guide.angleVisualKeys||{});
    var named=keys.filter(function(name){
      var pattern=new RegExp("(?:∠\\s*|זווית(?:\\s+של)?\\s*)"+name+"(?![A-Z])","i");
      return pattern.test(value);
    });
    if(named.length===1){return guide.angleVisualKeys[named[0]];}
    if(named.length===2){
      return (guide.anglePairVisualKeys||{})[named.slice().sort().join("|")]||"";
    }
    return "";
  }

  function verifiedVisual(guide,key){
    if(!guide||!guide.visuals||!Object.prototype.hasOwnProperty.call(guide.visuals,key)){return null;}
    return {key:key,focus:guide.visuals[key]};
  }

  function resolveVisual(exerciseId,options){
    var guide=get(exerciseId);
    if(!guide||!guide.visuals){return null;}
    var settings=options||{};
    var explicit=String(settings.key||settings.focusKey||"");
    var selected=verifiedVisual(guide,explicit);
    if(selected){return selected;}

    // A named angle in the student's own question has the highest semantic
    // priority. The answer is considered only if it names exactly one angle.
    var studentMessage=String(settings.studentMessage||"");
    var answer=String(settings.answer||"");
    var named=namedVisualKey(guide,studentMessage)||namedVisualKey(guide,answer);
    if(named){return verifiedVisual(guide,named);}

    var helpKind=String(settings.helpKind||"");
    var progressValue=settings.hintIndex;
    if(progressValue===undefined||progressValue===null||progressValue===""){
      progressValue=settings.progress;
    }
    if(helpKind==="hint"){
      var hintIndex=Math.max(0,Math.min((guide.hintVisualKeys||[]).length-1,Number(progressValue)||0));
      selected=verifiedVisual(guide,(guide.hintVisualKeys||[])[hintIndex]);
      if(selected){return selected;}
    }

    var combined=studentMessage+" "+answer;
    var intent=guide.intentVisualKeys||{};
    if(/מקביל|מתחלפ|מתאימ|ישר\s+חותך/i.test(combined)){
      selected=verifiedVisual(guide,intent.parallel);
      if(selected){return selected;}
    }
    if(/חוצה\s+(?:את\s+)?(?:ה)?זווית/i.test(combined)){
      selected=verifiedVisual(guide,intent.bisector);
      if(selected){return selected;}
    }
    if(/זוויות?\s+בסיס|שווה\s+שוקיים/i.test(combined)){
      selected=verifiedVisual(guide,intent.base);
      if(selected){return selected;}
    }
    if(asksWhichAngle(studentMessage)){
      selected=verifiedVisual(guide,guide.angleHelpVisualKey);
      if(selected){return selected;}
    }

    // For a free follow-up such as "ואז מה?", progress is the number of hints
    // already shown. It selects the next verified diagram in the proof chain.
    if(settings.progress!==undefined&&settings.progress!==null&&(guide.hintVisualKeys||[]).length){
      var progress=Math.max(0,Math.min(guide.hintVisualKeys.length-1,Number(settings.progress)||0));
      selected=verifiedVisual(guide,guide.hintVisualKeys[progress]);
      if(selected){return selected;}
    }
    return verifiedVisual(guide,guide.defaultVisualKey);
  }

  function respond(exerciseId,options){
    var guide=get(exerciseId);
    if(!guide){return null;}
    var settings=options||{};
    var helpKind=String(settings.helpKind||"");
    var message=String(settings.studentMessage||"");
    var visual=resolveVisual(exerciseId,settings);
    if(helpKind==="hint"){
      var hintIndex=Math.max(0,Math.min(2,Number(settings.hintIndex)||0));
      return {text:guide.hints[hintIndex],visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    if(asksToEnlarge(message)){
      return {text:"הנה השרטוט המלא כשהחלק הגאומטרי מוגדל והזוויות הדרושות מסומנות.",visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    if(asksWhichAngle(message)){
      return {text:guide.angleHelp,visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    if(asksForNextStep(message)){
      return {text:guide.nextStep,visual:null,focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    return null;
  }

  function prompt(exerciseId){
    var guide=get(exerciseId);
    if(!guide){return "";}
    if(guide.modelPrompt){return guide.modelPrompt;}
    return [
      "מדריך דידקטי מאומת לתרגיל הזה:",
      "המטרה: "+guide.goal,
      "עובדות וסדר היסק:",
      guide.canonicalFacts.map(function(item,index){return (index+1)+". "+item;}).join("\n"),
      "שרשרת מאומתת: "+guide.canonicalChain,
      "איסורים:",
      guide.forbidden.map(function(item){return "- "+item;}).join("\n"),
      "השתמש במדריך כדי לבדוק את הדיוק, אך תן לתלמיד רק את הצעד הבא."
    ].join("\n");
  }

  return {get:get,respond:respond,prompt:prompt,resolveVisual:resolveVisual};
});
