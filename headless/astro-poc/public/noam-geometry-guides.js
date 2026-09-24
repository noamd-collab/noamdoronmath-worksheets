(function(root,factory){
  "use strict";
  var geometry=typeof module==="object"&&module.exports?require("./noam-geometry.js"):root.NoamGeometry;
  var api=factory(geometry);
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamGeometryGuides=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(geometry){
  "use strict";

  // These constructions are selected by verified problem facts, never by the
  // exercise ID alone. Replaced PDFs can reuse IDs for different questions.
  function clean(value){
    return String(value||"").replace(/\\(?:text|mathrm|operatorname)\s*\{([^{}]*)\}/g,"$1")
      .replace(/\\(?:left|right)/g,"").replace(/\\parallel/g,"∥").replace(/\\perp/g,"⊥").replace(/\\angle/g,"∠")
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"").replace(/[{}$]/g,"")
      .replace(/\\[()[\]]/g,"").replace(/\s+/g," ").trim();
  }
  function sourceOf(exercise){
    return clean(exercise.geometrySource||[exercise.context,exercise.prompt,exercise.text].filter(Boolean).join(" "));
  }
  function compact(value){return clean(value).replace(/\s/g,"");}
  function hasEquality(value,left,right){
    var a=left.split("").reverse().join(""),b=right.split("").reverse().join("");
    var lhs="(?:"+left+"|"+a+")",rhs="(?:"+right+"|"+b+")";
    // Bound both entire operands. CF = AE + 1 and 2CF = AE are not AE = CF.
    var boundary="[^A-Z0-9+*/=−-]";
    return new RegExp("(?:^|"+boundary+")(?:(?:"+lhs+"="+rhs+")|(?:"+rhs+"="+lhs+"))(?=$|"+boundary+")","i").test(compact(value));
  }
  function established(answer,left,right){
    // Only an affirmative current assistant answer can authorize result marks.
    // Questions, goals and conditional statements are never established facts.
    return (clean(answer).match(/[^.!?\n]+[.!?]?/g)||[]).some(function(sentence){
      if(!hasEquality(sentence,left,right)||/(?:\?|כדי|צריך|עליכם|עליך|הוכיחו|להוכיח|להראות|האם|למה|מדוע|אפשר\s+להסיק|מה\s+ניתן|מטר[הת]|רוצים|נרצה|ננסה|בדקו|בדוק|חפשו|מצאו|נשער|אם|נניח|אינ[הו]|טרם|עדיין|ייתכן|אולי|לא\s+(?:נכון|הוכח|נתון|ניתן|מתקיים))/.test(sentence)){return false;}
      return /לכן|מכאן|מתקבל|נובע|הוכחנו|הוכח|נכון|ידוע|שווים|מתקיים/.test(sentence)
        ||/^(?:[A-Z]{2})\s*=\s*(?:[A-Z]{2})[. ]*$/.test(sentence.trim());
    });
  }
  function explicitDrawingRequest(value){
    return /איפה|היכן|סמן|סמני|הראה|הראי|תראה|תראי|צייר|ציור|שרטט|שרטוט|הדגם|תדגים|הצג/.test(clean(value));
  }
  function segmentMentions(value,names){
    var text=clean(value).toUpperCase();
    return names.filter(function(name){
      var reverse=name.split("").reverse().join("");
      return new RegExp("(?:^|[^A-Z])(?:"+name+"|"+reverse+")(?=$|[^A-Z])").test(text);
    });
  }
  function scene(points,title,caption,key){
    return {type:"geometry-scene",key:key,title:title,caption:caption,points:points,
      segments:[],highlights:[],equalGroups:[],rightAngles:[],angles:[],equations:[]};
  }
  function highlight(output,names,color){
    names.forEach(function(name){output.highlights.push({from:name[0],to:name[1],color:color,label:name});});
  }
  function equal(output,names,count,color){
    output.equalGroups.push({segments:names.map(function(name){return name.split("");}),count:count,color:color});
  }
  function rhombusMatches(exercise){
    if(!/^G9-T19-[ABE]-Q06[אבג]$/.test(String(exercise.id||""))){return false;}
    var source=sourceOf(exercise);
    return /מעוין\s+ABCD/i.test(source)&&/אלכסונ/.test(source)&&/\bO\b/.test(source)
      &&/על\s+(?:ה)?אלכסון\s+AC/i.test(source)&&/\bE\b/.test(source)&&/\bF\b/.test(source)
      &&/O\s+(?:נמצאת|נמצא)\s+ביניה/.test(source)&&hasEquality(source,"AE","CF")
      &&/A\s*[,–−-]\s*E\s*[,–−-]\s*O\s*[,–−-]\s*F\s*[,–−-]\s*C/.test(source);
  }
  function rhombusPoints(){
    if(!geometry||typeof geometry.rhombus!=="function"){return null;}
    var shape=geometry.rhombus({diagonalAC:12,diagonalBD:8,rotation:-18});
    var base=shape.points||shape;
    if(!base.A||!base.B||!base.C||!base.D){return null;}
    var points={A:base.A.slice(),B:base.B.slice(),C:base.C.slice(),D:base.D.slice()};
    points.O=[(points.A[0]+points.C[0])/2,(points.A[1]+points.C[1])/2];
    points.E=[points.A[0]*.7+points.C[0]*.3,points.A[1]*.7+points.C[1]*.3];
    points.F=[points.A[0]*.3+points.C[0]*.7,points.A[1]*.3+points.C[1]*.7];
    return points;
  }
  function rhombusKey(options){
    var segments=["AO","OC","AE","CF","OE","OF","BD","EF","AC","BO","OD","BE","ED","DF","FB"];
    var allowed=["q6-givens","q6-halves","q6-subtraction","q6-remainders","q6-diagonals","q6-inner"].concat(segments.map(function(name){return "q6-segment-"+name;}));
    if(allowed.indexOf(options.focusKey)!==-1){return options.focusKey;}
    var student=clean(options.studentMessage),answer=clean(options.answer);
    var content=answer||student;
    // An explicit request to locate a segment takes precedence over a broad
    // previous answer. A bare drawing request inherits that answer's scope.
    if(explicitDrawingRequest(student)){
      var located=segmentMentions(student,segments);
      if(located.length===1){return "q6-segment-"+located[0];}
      if(located.length){content=student;}
    }
    if(/חיסור|הפרש|מחס[רי]|מורידים/.test(content)||/(?:AO|OA)\s*[−-]\s*(?:AE|EA)/i.test(content)){
      return "q6-subtraction";
    }
    if(/מאונ[כך]|⊥/.test(content)||segmentMentions(content,["BD","EF"]).length===2){return "q6-diagonals";}
    if(/BEDF|צלעות\s+(?:ה)?מרובע\s+(?:ה)?פנימי/i.test(content)){return "q6-inner";}
    if(segmentMentions(content,["AO","OC"]).length||/חוצ(?:ים|ות)\s+זה\s+את\s+זה|חצאי\s+(?:ה)?אלכסון/.test(content)){return "q6-halves";}
    if(segmentMentions(content,["OE","OF"]).length){return "q6-remainders";}
    if(options.helpKind==="hint"&&Number(options.hintIndex)===0){return "q6-halves";}
    // Progress alone never reveals a later proof step.
    return "q6-givens";
  }
  function rhombusScene(exercise,options){
    var points=rhombusPoints();
    if(!points){return null;}
    var key=rhombusKey(options),answer=clean(options.answer);
    var out=scene(points,"המעוין והנקודות שעל האלכסון","",key);
    out.segments=[["A","B"],["B","C"],["C","D"],["D","A"],["A","C"],["B","D"],["B","E"],["E","D"],["D","F"],["F","B"]];
    if(key.indexOf("q6-segment-")===0){
      var selectedSegment=key.slice("q6-segment-".length);
      out.title="הקטע "+selectedSegment;
      out.caption="הקטע המודגש מחבר את "+selectedSegment[0]+" עם "+selectedSegment[1]+".";
      highlight(out,[selectedSegment],"blue");
    }else if(key==="q6-halves"){
      out.title="שני חצאי האלכסון AC";
      out.caption="AO מחבר את A עם O, ו־OC מחבר את O עם C. אלו שני החלקים של האלכסון AC.";
      highlight(out,["AO","OC"],"blue");
      if(established(answer,"AO","OC")||/חוצ(?:ים|ות)\s+זה\s+את\s+זה/.test(answer)){
        equal(out,["AO","OC"],1,"blue");out.equations=["AO = OC"];
        out.caption="O היא נקודת מפגש האלכסונים. במעוין האלכסונים חוצים זה את זה, ולכן AO ו־OC מסומנים כשווים.";
      }
    }else if(key==="q6-subtraction"){
      out.title="חיסור קטעים על אותו אלכסון";
      out.caption="מכל חצי אלכסון מורידים את הקטע הכתום שבקצה. הקטעים שנותרים, EO ו־OF, מודגשים במרכז.";
      highlight(out,["AE","CF"],"orange");highlight(out,["EO","OF"],"teal");
      equal(out,["AE","CF"],1,"orange");
      out.equations=[];
      if(/(?:AO|OA)\s*[−-]\s*(?:AE|EA)/i.test(answer)){out.equations.push("EO = AO − AE");}
      if(/(?:CO|OC)\s*[−-]\s*(?:CF|FC)/i.test(answer)){out.equations.push("OF = CO − CF");}
      if(established(answer,"OE","OF")){
        equal(out,["EO","OF"],2,"teal");out.equations.push("EO = OF");
      }
    }else if(key==="q6-remainders"){
      out.title="הקטעים EO ו־OF";
      out.caption="EO הוא הקטע שבין E ל־O; OF הוא הקטע שבין O ל־F. אלו הקטעים שבמרכז האלכסון.";
      highlight(out,["EO","OF"],"teal");
      if(established(answer,"OE","OF")){
        equal(out,["EO","OF"],1,"teal");out.equations=["EO = OF"];
        out.caption="EO ו־OF מסומנים באותו סימון, בהתאם לשוויון שהוסבר בתשובה.";
      }
    }else if(key==="q6-diagonals"){
      out.title="האלכסונים BD ו־EF";
      out.caption="BD מחבר את B עם D, ו־EF מחבר את E עם F. שני הקטעים עוברים דרך O.";
      highlight(out,["BD"],"blue");highlight(out,["EF"],"orange");
      if(/מאונ[כך]|⊥/.test(answer)&&!/(?:האם|\?|נניח|אם|אינ[הו]|טרם|עדיין|ייתכן|אולי|הוכיחו|להוכיח|בדקו|בדוק)/.test(answer)){
        out.rightAngles=[["B","O","F"]];out.equations=["BD ⊥ EF"];
        out.caption="EF נמצא על AC. האלכסון BD מאונך ל־AC, ולכן גם ל־EF. הזווית הישרה מסומנת בנקודה O.";
      }
      if(established(answer,"OB","OD")){equal(out,["BO","OD"],1,"blue");}
      if(established(answer,"OE","OF")){equal(out,["EO","OF"],2,"orange");}
    }else if(key==="q6-inner"){
      out.title="המרובע הפנימי BEDF";
      out.caption="הצלעות המודגשות מחברות את B, E, D ו־F לפי הסדר. הצבע מדגיש את המרובע ואינו מסמן שוויון אורכים.";
      highlight(out,["BE","ED","DF","FB"],"teal");
    }else{
      out.caption="הנקודות מופיעות לפי הסדר A–E–O–F–C על האלכסון AC. הנתון AE = CF מסומן בקווים כתומים.";
      highlight(out,["AE","CF"],"orange");equal(out,["AE","CF"],1,"orange");out.equations=["AE = CF"];
    }
    return out;
  }

  function triangleMatches(exercise){
    if(!/^G9-T15-E-Q04[אב]$/.test(String(exercise.id||""))){return false;}
    var source=sourceOf(exercise),value=compact(source);
    var angleABC=value.match(/(?:∠|∡)?ABC=(\d+(?:\.\d+)?)/i),angleBAC=value.match(/(?:∠|∡)?BAC=(\d+(?:\.\d+)?)/i);
    if((angleABC&&Number(angleABC[1])!==70)||(angleBAC&&Number(angleBAC[1])!==60)){return false;}
    return /משולש\s*△?ABC/i.test(source)&&/D\s+נמצאת\s+על\s+הצלע\s+AC/i.test(source)
      &&/E\s+על\s+הצלע\s+AB/i.test(source)&&/BD\s+חוצה/i.test(source)
      &&/(?:BC∥DE|DE∥BC)/i.test(value);
  }
  function trianglePoints(){
    // Construct a genuine 60°/70°/50° triangle. D is the angle-bisector
    // intersection, and E is the intersection of AB with the parallel to BC.
    var rad=Math.PI/180,height=12/(1/Math.tan(70*rad)+1/Math.tan(50*rad));
    var A=[height/Math.tan(70*rad),height],B=[0,0],C=[12,0];
    var AB=Math.hypot(A[0],A[1]),t=AB/(AB+12);
    var D=[A[0]+(C[0]-A[0])*t,A[1]*(1-t)],E=[A[0]*D[1]/A[1],D[1]];
    return {A:A,B:B,C:C,D:D,E:E};
  }
  var q4Keys={
    "q4a-base-angles":{title:"זוויות הבסיס במשולש EDB",angles:["EBD","EDB"]},
    "q4a-bisector":{title:"הזוויות שיוצר חוצה הזווית",angles:["EBD","DBC"],segments:["BD"]},
    "q4a-alternate":{title:"הזוויות המתחלפות והישר החותך",angles:["DBC","EDB"],segments:["DE","BC","DB"]},
    "q4b-bisector":{title:"שתי הזוויות שיוצר חוצה הזווית",angles:["ABD","DBC"],segments:["BD"]},
    "q4b-isosceles":{title:"זוויות הבסיס במשולש EDB",angles:["EBD","EDB"]},
    "q4b-parallel":{title:"הזוויות המתאימות בין הישרים המקבילים",angles:["ADE","ACB"],segments:["DE","BC","AC"]}
  };
  ["a","b"].forEach(function(part){
    (part==="a"?["EBD","EDB","ABD","DBC"]:["EBD","EDB","ABD","DBC","ADE","ACB"]).forEach(function(name){
      q4Keys["q4"+part+"-angle-"+name.toLowerCase()]={title:"הזווית ∠"+name,angles:[name]};
    });
  });
  function triangleKey(exercise,options){
    var part=/א$/.test(exercise.id)?"a":"b";
    var key=String(options.focusKey||"");
    if(key.indexOf("q4"+part+"-")===0&&q4Keys[key]){return key;}
    function namesIn(value){
      var text=clean(value);
      return ["EBD","EDB","ABD","DBC","ADE","ACB"].filter(function(name){
        return new RegExp("(?:∠|∡|זווית)\\s*"+name+"(?![A-Z])","i").test(text);
      });
    }
    var names=namesIn(options.studentMessage);
    if(!names.length){names=namesIn(options.answer);}
    if(names.length===1&&q4Keys["q4"+part+"-angle-"+names[0].toLowerCase()]){return "q4"+part+"-angle-"+names[0].toLowerCase();}
    var pair=names.slice().sort().join("|");
    if(pair==="DBC|EDB"&&part==="a"){return "q4a-alternate";}
    if(pair==="ACB|ADE"&&part==="b"){return "q4b-parallel";}
    if(pair==="EBD|EDB"){return part==="a"?"q4a-base-angles":"q4b-isosceles";}
    if(pair==="ABD|DBC"||pair==="DBC|EBD"){return "q4"+part+"-bisector";}
    if(options.helpKind==="hint"){
      var index=Math.max(0,Math.min(2,Number(options.hintIndex)||0));
      return (part==="a"?["q4a-base-angles","q4a-bisector","q4a-alternate"]:["q4b-bisector","q4b-isosceles","q4b-parallel"])[index];
    }
    return "";
  }
  function triangleScene(exercise,options){
    var key=triangleKey(exercise,options),focus=q4Keys[key];
    var out=scene(trianglePoints(),focus?focus.title:"המשולש והקטעים הנתונים","הסימונים מדגישים את החלק שעליו מדברים כעת. אין להסיק שוויון זוויות מן הצבע בלבד.",key||"q4-givens");
    out.segments=[["A","B"],["B","C"],["C","A"],["B","D"],["D","E"]];
    if(focus){
      out.angles=focus.angles.map(function(name){return {from:name[0],vertex:name[1],to:name[2],label:"∠"+name};});
      (focus.segments||[]).forEach(function(name,index){highlight(out,[name],index===2?"orange":"blue");});
    }
    return out;
  }
  function requestedFocus(out,options){
    var student=clean(options.studentMessage),answer=clean(options.answer);
    var explicit=explicitDrawingRequest(student);
    var names=explicit?(student.match(/(?:^|[^A-Za-z])[A-Z]{1,4}(?=$|[^A-Za-z])/g)||[]):[];
    // A drawing attached to an answer must also decline unknown named objects.
    // Known named angles in that answer can be demonstrated directly.
    if(!names.length){
      var namedObjects=answer.match(/(?:∠|∡|זווית|קטע|צלע|אלכסון|נקודה)\s*[A-Z]{1,3}(?![A-Z])/g)||[];
      if(namedObjects.some(function(item){return item.replace(/[^A-Z]/g,"").split("").some(function(letter){return !Object.prototype.hasOwnProperty.call(out.points,letter);});})){return null;}
      names=answer.match(/(?:∠|∡|זווית)\s*[A-Z]{3}(?![A-Z])/g)||[];
    }
    names=names.map(function(name){return name.replace(/[^A-Z]/g,"");}).filter(function(name,index,array){return array.indexOf(name)===index;});
    if(!names.length){return out;}
    if(names.some(function(name){return name.split("").some(function(letter){return !Object.prototype.hasOwnProperty.call(out.points,letter);});})){return null;}
    // A location question about one named object cannot reuse annotations from
    // an earlier answer. Only rays/segments explicitly requested are marked.
    var angles=[],segments=[];
    for(var i=0;i<names.length;i++){
      var name=names[i];
      if(name.length===2){
        if(name[0]===name[1]){return null;}
        segments.push(name);
      }else if(name.length===3){
        var a=out.points[name[0]],v=out.points[name[1]],b=out.points[name[2]];
        var cross=(a[0]-v[0])*(b[1]-v[1])-(a[1]-v[1])*(b[0]-v[0]);
        if(Math.abs(cross)<1e-8){return null;}
        angles.push({from:name[0],vertex:name[1],to:name[2],label:"∠"+name});
      }else if(name.length===4&&name!=="ABCD"&&name!=="BEDF"){return null;}
    }
    if(!angles.length&&!segments.length){return out;}
    if(angles.length&&!segments.length&&angles.map(function(item){return item.label;}).sort().join("|")===out.angles.map(function(item){return item.label;}).sort().join("|")){return out;}
    // A requested subtraction expression needs its multiple collinear pieces,
    // and the dedicated subtraction drawing already contains precisely those.
    if(out.key==="q6-subtraction"&&/[−-]/.test(student)&&!angles.length){return out;}
    if(segments.length&&!angles.length){
      var requested=segments.map(function(name){return name.split("").sort().join("");}).sort().join("|");
      var current=out.highlights.map(function(item){return [item.from,item.to].sort().join("");}).sort().join("|");
      if(requested===current){
        out.equalGroups=[];out.rightAngles=[];out.equations=[];
        out.caption="הקטעים המודגשים הם "+segments.join(" ו־")+", לפי הבקשה.";
        return out;
      }
    }
    out.highlights=[];out.equalGroups=[];out.rightAngles=[];out.equations=[];out.angles=angles;
    highlight(out,segments,"blue");
    out.title=angles.length?"הזוויות שסומנו בבקשה":"הקטעים שסומנו בבקשה";
    out.caption=angles.length?"קשת מסמנת כל זווית בין שתי הקרניים שלה; האות האמצעית בשם הזווית היא הקודקוד.":"כל קטע מודגש מחבר את שתי הנקודות שבשמו.";
    if(angles.length===1&&!segments.length){out.title="הזווית "+angles[0].label;}
    return out;
  }
  function resolve(exercise,options){
    if(!exercise||typeof exercise!=="object"){return null;}
    var settings=options||{},output=null;
    if(rhombusMatches(exercise)){output=rhombusScene(exercise,settings);}
    else if(triangleMatches(exercise)){output=triangleScene(exercise,settings);}
    return output?requestedFocus(output,settings):null;
  }
  return {resolve:resolve};
});
