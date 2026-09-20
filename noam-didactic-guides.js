(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamDidacticGuides=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  var proofVisual={
    label:"השרטוט המוגדל",
    crop:{x:.055,y:.015,w:.285,h:.68},
    segments:[
      {from:[.128,.36],to:[.228,.36],role:"parallel"},
      {from:[.095,.628],to:[.305,.628],role:"parallel"},
      {from:[.095,.628],to:[.228,.36],role:"transversal"}
    ],
    angles:[
      {vertex:[.228,.36],from:[.128,.36],to:[.095,.628],label:"∠EDB"},
      {vertex:[.095,.628],from:[.228,.36],to:[.305,.628],label:"∠DBC"}
    ]
  };

  var calculationVisual={
    label:"הזוויות המתאימות בהגדלה",
    crop:{x:.055,y:.015,w:.285,h:.68},
    segments:[
      {from:[.128,.36],to:[.228,.36],role:"parallel"},
      {from:[.095,.628],to:[.305,.628],role:"parallel"},
      {from:[.158,.126],to:[.305,.628],role:"transversal"}
    ],
    angles:[
      {vertex:[.228,.36],from:[.158,.126],to:[.128,.36],label:"∠ADE"},
      {vertex:[.305,.628],from:[.158,.126],to:[.095,.628],label:"∠ACB"}
    ]
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
      visualFocus:proofVisual
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
      visualFocus:calculationVisual
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

  function respond(exerciseId,options){
    var guide=get(exerciseId);
    if(!guide){return null;}
    var settings=options||{};
    var helpKind=String(settings.helpKind||"");
    var message=String(settings.studentMessage||"");
    if(helpKind==="hint"){
      var hintIndex=Math.max(0,Math.min(2,Number(settings.hintIndex)||0));
      return {text:guide.hints[hintIndex],visual:null,source:"didactic-guide"};
    }
    if(asksToEnlarge(message)){
      return {text:"הנה השרטוט המלא כשהחלק הגאומטרי מוגדל והזוויות הדרושות מסומנות.",visual:"focus",source:"didactic-guide"};
    }
    if(asksWhichAngle(message)){
      return {text:guide.angleHelp,visual:"focus",source:"didactic-guide"};
    }
    if(asksForNextStep(message)){
      return {text:guide.nextStep,visual:null,source:"didactic-guide"};
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

  return {get:get,respond:respond,prompt:prompt};
});
