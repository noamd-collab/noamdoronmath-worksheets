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

  var q4AngleHelpByName={
    EBD:"∠EBD נמצאת בקודקוד B, בין הקרניים BE ו־BD. מכיוון ש־E נמצאת על AB, הקרן BE מונחת על הקרן BA.",
    EDB:"∠EDB נמצאת בקודקוד D, בין הקרניים DE ו־DB. זו הזווית שבתוך המשולש EDB ליד D.",
    ABD:"∠ABD נמצאת בקודקוד B, בין הקרניים BA ו־BD. זו הזווית שבין הצלע AB לחוצה הזווית BD.",
    DBC:"∠DBC נמצאת בקודקוד B, בין הקרניים BD ו־BC. זו הזווית שבין חוצה הזווית BD לצלע BC.",
    ADE:"∠ADE נמצאת בקודקוד D, בין הקרניים DA ו־DE. חפשו אותה ליד D, מעל הקטע DE.",
    ACB:"∠ACB נמצאת בקודקוד C, בין הקרניים CA ו־CB. זו הזווית של המשולש ABC ליד C."
  };

  var guides={
    "G9-T20-E-Q06א":{
      kind:"geometry-proof",
      goal:"להוכיח MN ∥ AC",
      canonicalFacts:[
        "ABCD ריבוע, ולכן כל הזוויות ישרות וכל הצלעות שוות.",
        "M על AB, N על BC, ו־BM = BN = x.",
        "במשולש BMN מתקבל BM = BN, ולכן זוויות הבסיס שוות.",
        "∠ABC = 90°, ולכן זוויות הבסיס במשולש BMN הן 45° כל אחת.",
        "האלכסון AC יוצר עם AB את ∠BAC = 45°.",
        "∠BMN ו־∠BAC הן זוויות מתאימות ביחס לחותך AB (לא מתחלפות)."
      ],
      canonicalChain:"BM = BN ⇒ ∠BMN = ∠BNM = 45°; ∠BAC = 45°; לכן ∠BMN = ∠BAC כזוויות מתאימות עם החותך AB, ומכאן MN ∥ AC.",
      forbidden:[
        "אסור להשתמש ב־MN ∥ AC לפני סוף ההוכחה; זו המטרה ולא נתון.",
        "אסור לקרוא ל־∠BMN ו־∠BAC זוויות מתחלפות; בזיהוי זה הן זוויות מתאימות.",
        "אל תמציאו אורכים או נקודות אמצע שאינם בנתונים."
      ],
      modelPrompt:"מדריך מאומת לתרגיל. המטרה: להוכיח MN ∥ AC בריבוע ABCD כאשר M על AB, N על BC ו־BM = BN = x. שרשרת מאומתת: משולש BMN שווה־שוקיים ⇒ זוויות הבסיס שוות; עם ∠ABC = 90° מתקבלות 45°; ∠BAC באלכסון גם 45°; ∠BMN ו־∠BAC הן זוויות מתאימות עם החותך AB (לא מתחלפות) ⇒ MN ∥ AC. תן רק את הצעד הבא לרמת הרמז המבוקשת, בלי פתרון מלא ובלי נתונים מומצאים.",
      hints:[
        "הסתכלו על המשולש BMN ליד הקודקוד B. מה אפשר לומר עליו לפי השוויון BM = BN?",
        "חשבו את זוויות הבסיס במשולש BMN בעזרת הזווית הישרה ב־B, והשוו ל־∠BAC שיוצר האלכסון AC עם הצלע AB.",
        "עכשיו יש שתי זוויות שוות על החותך AB. זהו זוג זוויות מתאימות — השתמשו בכך כדי להסיק על MN ו־AC."
      ],
      angleHelp:"∠BMN נמצאת בקודקוד M בין AB ל־MN, ו־∠BAC נמצאת בקודקוד A בין AB ל־AC. עם אותו חותך AB הן במקומות מתאימים — זוויות מתאימות.",
      nextStep:"התקדמו משוויון הצלעות BM = BN אל שוויון זוויות, ואז השתמשו בקריטריון המקבילים עם זוויות מתאימות על החותך AB.",
      visuals:{},
      defaultVisualKey:"",
      hintVisualKeys:[],
      angleVisualKeys:{},
      angleHelpByName:{},
      anglePairVisualKeys:{},
      angleHelpVisualKey:"",
      intentVisualKeys:{},
      visualFocus:null
    },
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
      angleHelpByName:q4AngleHelpByName,
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
      angleHelpByName:q4AngleHelpByName,
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
    return /איז(?:ו|ה)\s+זווית|(?:איפה|היכן)\s+(?:נמצאת\s+)?(?:ה)?(?:זווית|∠)|קשה\s+לי\s+לזהות|לא\s+(?:רואה|מזהה).*זווית|סמ(?:ן|ני)\s+לי.*(?:זווית|∠)/i.test(String(text||""));
  }

  function asksForNextStep(text){
    return /ואז\s+מה|מה\s+עכשיו|איך\s+ממשיכ|מה\s+השלב\s+הבא/i.test(String(text||""));
  }

  function asksToEnlarge(text){
    var value=String(text||"");
    return /(?:שרטוט|ציור|תמונה).*(?:קטן|הגדל)|(?:קטן|הגדל).*(?:שרטוט|ציור|תמונה)/i.test(value);
  }

  function namedAngles(guide,text){
    var value=String(text||"").toUpperCase();
    var keys=Object.keys(guide.angleVisualKeys||{});
    return keys.filter(function(name){
      var pattern=new RegExp("(?:∠\\s*|זווית(?:\\s+של)?\\s*)"+name+"(?![A-Z])","i");
      return pattern.test(value);
    });
  }

  function namedVisualKey(guide,text){
    var named=namedAngles(guide,text);
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

  var UNDERSTOOD_LEAD="יופי, מעולה שזה ברור.";
  var NOT_UNDERSTOOD_LEAD="זה בסדר גמור, בואו ננסה אחרת.";
  var CLOSING_TEXT="יופי, מעולה שזה ברור.\nאפשר לעבור לסעיף הבא.";
  var AI_SIMPLER="לא הבנתי. תסבירו מחדש, יותר בפשטות ובצעדים קטנים, בלי לחזור על אותן מילים. סיימו בשאלה קצרה אחת.";
  var AI_NEXT="הבנתי. תנו רק את הצעד הבא, בלי לחזור על מה שכבר נאמר. סיימו בשאלה קצרה אחת.";
  var AI_ANGLE="לא הבנתי את הצעד גם אחרי הפירוק. תנו זווית אחרת, בפשטות ובצעדים קטנים, בלי לחזור על אותו ניסוח. סיימו בשאלה קצרה.";
  var AI_DOWN="אי אפשר להביא עכשיו הסבר חדש. אפשר ללחוץ על «רמז», או לקרוא שוב את הצעד לאט.";
  var AI_DOWN_NEXT="אי אפשר להביא עכשיו את הצעד הבא. אפשר ללחוץ על «רמז», או לעבור לסעיף הבא.";
  var AI_DOWN_DONE="אי אפשר להביא עכשיו הסבר חדש. אפשר לקרוא שוב את הצעד לאט.";
  var AI_DOWN_NEXT_DONE="אי אפשר להביא עכשיו את הצעד הבא. אפשר לעבור לסעיף הבא.";
  var understandingState=Object.create(null);
  var pendingNote="";

  function understandingFor(exerciseId){
    var id=String(exerciseId||"");
    if(!understandingState[id]){
      understandingState[id]={cursor:-1,stepShown:false,factIndex:0,factsStarted:false};
    }
    return understandingState[id];
  }

  function cloneState(state){
    return {
      cursor:state.cursor,
      stepShown:state.stepShown,
      factIndex:state.factIndex,
      factsStarted:state.factsStarted
    };
  }

  function resetUnderstanding(exerciseId){
    delete understandingState[String(exerciseId||"")];
    pendingNote="";
  }

  function hintKey(guide,index){
    var keys=guide.hintVisualKeys||[];
    if(!keys.length){return "";}
    var at=Math.max(0,Math.min(keys.length-1,Number(index)||0));
    return keys[at]||"";
  }

  function checkReply(text,visualKey){
    return {
      text:text,
      visual:visualKey?"focus":null,
      focusKey:visualKey||"",
      source:"didactic-guide"
    };
  }

  function plainCheck(text){
    return String(text||"").replace(/\s+/g," ").trim().replace(/^[«"'“]+|[»"'”.!?؟]+$/g,"");
  }

  function understandingIntent(text){
    var value=plainCheck(text);
    if(value==="הבנתי"){return "understood";}
    if(value==="לא הבנתי"){return "not-understood";}
    return "";
  }

  function shortenStep(part){
    var text=String(part||"").replace(/\s+/g," ").trim();
    text=text.replace(/,\s*(ולכן|לכן|ומכאן|מכאן)(?=\s|$)/g,".\n$1");
    if(text.length>90&&text.indexOf("\n")===-1){
      text=text.replace(/,\s+/g,",\n");
    }
    return text;
  }

  function substeps(guide){
    var lines=[];
    function pushPart(part){
      String(part||"").split(/\s*;\s*/).forEach(function(piece){
        var chunk=piece.trim();
        if(!chunk){return;}
        chunk.replace(/[^.!?؟]+[.!?؟]?/g,function(sentence){
          var line=shortenStep(sentence);
          if(line){lines.push(line);}
          return sentence;
        });
      });
    }
    (guide.canonicalFacts||[]).forEach(pushPart);
    if(guide.canonicalChain){pushPart(guide.canonicalChain);}
    if(guide.angleHelp){pushPart(guide.angleHelp);}
    return lines;
  }

  function catchUpState(state,guide,settings){
    var hints=guide.hints||[];
    var progress=Number(settings&&settings.progress);
    if(!isFinite(progress)||progress<0){progress=0;}
    var fromHints=progress>0?Math.min(hints.length-1,progress-1):-1;
    if(String(settings&&settings.helpKind||"")==="hint"){
      fromHints=Math.max(0,Math.min(hints.length-1,Number(settings.hintIndex)||0));
    }
    if(fromHints>state.cursor){state.cursor=fromHints;}
    return state;
  }

  function catchUp(exerciseId,guide,settings){
    return catchUpState(understandingFor(exerciseId),guide,settings);
  }

  function retryText(body){
    var text=String(body||"").trim();
    if(!text){return NOT_UNDERSTOOD_LEAD;}
    if(text.indexOf(NOT_UNDERSTOOD_LEAD)===0){return text;}
    return NOT_UNDERSTOOD_LEAD+"\n"+text;
  }

  function hintsDone(settings){
    if(settings&&settings.hintsDone){return true;}
    var progress=Number(settings&&settings.progress);
    return isFinite(progress)&&progress>=3;
  }

  function applyReply(state,guide,intent){
    var hints=guide.hints||[];
    if(intent==="understood"){
      if(state.factsStarted||state.stepShown){
        return checkReply(CLOSING_TEXT,"");
      }
      var next=state.cursor+1;
      if(next>=0&&next<hints.length){
        state.cursor=next;
        return checkReply(UNDERSTOOD_LEAD+"\n"+hints[next],hintKey(guide,next));
      }
      if(guide.nextStep){
        state.stepShown=true;
        return checkReply(UNDERSTOOD_LEAD+"\n"+guide.nextStep,"");
      }
      return checkReply(CLOSING_TEXT,"");
    }
    if(state.cursor<hints.length-1){
      state.cursor=Math.max(0,state.cursor+1);
      return checkReply(retryText(hints[state.cursor]),hintKey(guide,state.cursor));
    }
    var steps=substeps(guide);
    if(state.factIndex<steps.length){
      state.factsStarted=true;
      var line=steps[state.factIndex];
      state.factIndex+=1;
      return checkReply(retryText(line),guide.defaultVisualKey||hintKey(guide,hints.length-1));
    }
    return null;
  }

  function replyToUnderstanding(guide,exerciseId,intent,settings){
    return applyReply(catchUp(exerciseId,guide,settings),guide,intent);
  }

  function needsCheck(text){
    var value=String(text||"").replace(/\s+/g," ").trim();
    if(!value){return false;}
    if(/חושב…|עדיין חושב/.test(value)){return false;}
    if(value.indexOf(UNDERSTOOD_LEAD)!==-1&&value.indexOf("אפשר לעבור לסעיף הבא")!==-1){return false;}
    return true;
  }

  function offlineUnderstanding(intent,settings){
    var done=hintsDone(settings);
    if(intent==="understood"){return done?AI_DOWN_NEXT_DONE:AI_DOWN_NEXT;}
    return retryText(done?AI_DOWN_DONE:AI_DOWN);
  }

  function fallbackUnderstanding(intent,settings){
    var opts=settings&&typeof settings==="object"&&!Array.isArray(settings)?settings:null;
    return offlineUnderstanding(intent,opts);
  }

  function noteCheck(intent){
    pendingNote=intent==="understood"?"understood":"not-understood";
  }

  function planUnderstanding(exerciseId,intent,settings){
    var display=intent==="understood"?"הבנתי":"לא הבנתי";
    var guide=get(exerciseId);
    if(!guide){
      return intent==="understood"
        ?{action:"ai",prompt:AI_NEXT,display:display,fallback:offlineUnderstanding(intent,settings)}
        :{action:"ai",prompt:AI_SIMPLER,display:display,fallback:offlineUnderstanding(intent,settings)};
    }
    var sim=catchUpState(cloneState(understandingFor(exerciseId)),guide,settings);
    var hints=guide.hints||[];
    if(!sim.factsStarted&&!sim.stepShown&&sim.cursor<hints.length-1){
      return {action:"hint",hintsOpened:Math.min(3,sim.cursor+2),lead:intent==="understood",display:display};
    }
    var reply=applyReply(sim,guide,intent);
    if(!reply){
      return {
        action:"ai",
        prompt:intent==="understood"?AI_NEXT:AI_ANGLE,
        display:display,
        fallback:offlineUnderstanding(intent,settings)
      };
    }
    return {action:"local",phrase:display,display:display,text:reply.text};
  }

  function respond(exerciseId,options){
    var guide=get(exerciseId);
    if(!guide){return null;}
    var settings=options||{};
    var helpKind=String(settings.helpKind||"");
    var message=String(settings.studentMessage||"");
    var visual=resolveVisual(exerciseId,settings);
    var intent=understandingIntent(message);
    if(intent){return replyToUnderstanding(guide,exerciseId,intent,settings);}
    if(helpKind==="hint"){
      var hintIndex=Math.max(0,Math.min(2,Number(settings.hintIndex)||0));
      catchUp(exerciseId,guide,{helpKind:"hint",hintIndex:hintIndex,progress:hintIndex+1});
      var note=pendingNote;
      pendingNote="";
      var body=guide.hints[hintIndex];
      if(note==="understood"){body=UNDERSTOOD_LEAD+"\n"+body;}
      if(note==="not-understood"){body=retryText(body);}
      return {text:body,visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    pendingNote="";
    if(asksToEnlarge(message)){
      return {text:"הנה השרטוט המלא כשהחלק הגאומטרי מוגדל והזוויות הדרושות מסומנות.",visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
    }
    if(asksWhichAngle(message)){
      var named=namedAngles(guide,message);
      var angleText=named.length===1&&(guide.angleHelpByName||{})[named[0]];
      return {text:angleText||guide.angleHelp,visual:"focus",focusKey:visual&&visual.key||"",source:"didactic-guide"};
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

  return {
    get:get,
    respond:respond,
    prompt:prompt,
    resolveVisual:resolveVisual,
    needsCheck:needsCheck,
    resetUnderstanding:resetUnderstanding,
    planUnderstanding:planUnderstanding,
    noteCheck:noteCheck,
    offlineUnderstanding:offlineUnderstanding,
    fallbackUnderstanding:fallbackUnderstanding,
    understoodLead:UNDERSTOOD_LEAD,
    notUnderstoodLead:NOT_UNDERSTOOD_LEAD,
    closingText:CLOSING_TEXT
  };
});
