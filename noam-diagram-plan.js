(function(root,factory){
  "use strict";
  var geometry=typeof module==="object"&&module.exports?require("./noam-geometry.js"):root.NoamGeometry;
  var api=factory(geometry);
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamDiagramPlan=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(geometry){
  "use strict";

  // This is a data compiler, not a theorem prover. It never runs model code,
  // invents a point, or accepts a student assertion as an established fact.
  var COLORS=["blue","orange","teal","pink"],EPS=1e-6;
  var PROMPT_SCHEMA="Return JSON only. Supported geometry is straight segments between 3–16 named uppercase single-letter points. Format: {version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[0,3]},segments:[['A','B'],['B','C'],['C','A']],highlights:[{from:'A',to:'B',color:'blue',label:'AB'}],angles:[],equalGroups:[],rightAngles:[],evidence:[]}. Use double quotes in JSON. Allowed colors: blue,orange,teal,pink. Angles: {from,vertex,to,label}; label is empty, the exact angle name such as ∠ABC, or a given numeric degree value. Equality groups: {segments:[[A,B],[C,D]],count:1|2|3,color}. Right angles: [[A,B,C]] with B the vertex. Each equality group, right-angle mark, numeric angle/segment label needs evidence {mark:'equalGroups.0'|'rightAngles.0'|'angles.0'|'highlights.0',source:'question'|'hint',quote:'exact affirmative text from supplied question or current hint'}. Never cite a goal, question, conditional statement, negation, or a student assertion as evidence. Coordinates must agree with every explicit given relation and with marked values. Use simple exact coordinates where possible. Only emphasize the named objects in the current hint or the student's explicit drawing request. Points must already occur in question/hint. No title, caption, prose, equations, SVG, HTML, code, extra keys, computed solution, or later proof step. If unsupported, return {version:1,status:'unsupported'}.";

  PROMPT_SCHEMA += " The additional optional field pointHighlights is supported: [{point:'B',color:'blue'}]. Use it to locate a single point or vertex explicitly named on its own in the current hint or drawing request. If the hint asks which side is opposite vertex B, emphasize only B; do not select the opposite side or add rays/angle marks that were not named. Point highlighting requires no factual evidence and must not introduce a new point.";
  PROMPT_SCHEMA += " Optional rays:[[M,A],[M,C]] are directed from the first point through the second. A ray must be explicitly called a ray in affirmative source text (Hebrew קרן/קרניים or English ray/rays). Its base segment is included automatically; repeating that point pair in segments is optional. Never convert a segment or line to a ray based on a student request. The renderer adds arrowheads beyond the named through-point. Preserve explicitly stated acute/obtuse angle classes; an approximate diagram description is not an exact degree measurement.";
  PROMPT_SCHEMA += " Angle-label examples: for {from:'E',vertex:'A',to:'D'} use label:'∠EAD' or label:''; for {from:'D',vertex:'A',to:'C'} use label:'∠DAC'. Write plain Unicode angle names, with the vertex in the middle. Never use alpha/beta, an equality such as EAD=DAC, explanatory words, or a computed angle value as a label. Identifying two angles does not mark or prove their equality.";
  PROMPT_SCHEMA += " Name-only or empty angle/segment labels identify objects; they need no evidence entry. Reserve evidence for factual markings and numeric values.";

  function fail(reason,constraint){throw Object.assign(new Error(reason),{reason:reason},constraint?{constraint:constraint}:{});}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
  function keys(value,allowed){if(!object(value)){fail("invalid_object");}Object.keys(value).forEach(function(key){if(allowed.indexOf(key)<0){fail("unknown_field");}});}
  function safeTree(value,depth){
    if(depth>8){fail("too_deep");}
    if(value===null||typeof value==="string"||typeof value==="boolean"){return;}
    if(typeof value==="number"){if(!Number.isFinite(value)){fail("invalid_number");}return;}
    if(!Array.isArray(value)&&!object(value)){fail("invalid_data");}
    if(Array.isArray(value)){for(var i=0;i<value.length;i++){if(!Object.prototype.hasOwnProperty.call(value,i)){fail("invalid_data");}}}
    Object.keys(value).forEach(function(key){
      var descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(key==="__proto__"||key==="constructor"||key==="prototype"||!descriptor||descriptor.get||descriptor.set){fail("unsafe_data");}
      safeTree(descriptor.value,depth+1);
    });
  }
  function list(value,max){if(value===undefined){return [];}if(!Array.isArray(value)||value.length>max){fail("invalid_list");}return value;}
  function text(value,max){if(value===undefined){return "";}if(typeof value!=="string"||value.length>max){fail("invalid_text");}return value;}
  function angleLabel(value){
    // Accept only presentation wrappers around a complete angle name. Do not
    // use clean(): removing arbitrary braces or commands could change a claim.
    var label=text(value,80).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"").trim();
    [["$$","$$"],["$","$"],["\\(","\\)"],["\\[","\\]"]].some(function(pair){
      if(label.length>=pair[0].length+pair[1].length&&label.slice(0,pair[0].length)===pair[0]&&label.slice(-pair[1].length)===pair[1]){
        label=label.slice(pair[0].length,-pair[1].length).trim();return true;
      }
      return false;
    });
    if(!label||/^\d+(?:\.\d+)?°$/.test(label)){return label;}
    var named=label.match(/^(?:(?:∠|∡|\\angle)\s*)?(?:([A-Z])\s*([A-Z])\s*([A-Z])|\\(?:mathrm|text)\s*\{\s*([A-Z])\s*([A-Z])\s*([A-Z])\s*\})$/);
    if(!named){fail("invalid_angle_label");}
    return "∠"+named.slice(1).filter(Boolean).join("");
  }
  function clean(value){return text(value,20000).replace(/\\(?:text|mathrm|operatorname)\s*\{([^{}]*)\}/g,"$1").replace(/\\(?:left|right)/g,"").replace(/\\parallel/g,"∥").replace(/\\perp/g,"⊥").replace(/\\angle/g,"∠").replace(/\\circ/g,"°").replace(/[∡]/g,"∠").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069{}$^]/g,"").replace(/\\[()[\]]/g,"").replace(/[ \t\r]+/g," ").trim();}
  function compact(value){return clean(value).replace(/\s/g,"");}
  function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
  function sameLength(a,b){return Math.abs(a-b)<=EPS*Math.max(1,a,b);}
  function namesIn(value){var names={};(clean(value).match(/(?:^|[^A-Za-z])[A-Z]{1,6}(?=$|[^A-Za-z])/g)||[]).forEach(function(token){token=token.replace(/[^A-Z]/g,"");if(["PDF","SVG","JSON","HTTP","HTTPS","AI"].indexOf(token)<0){token.split("").forEach(function(n){names[n]=true;});}});return names;}
  function tokens(value){return (clean(value).match(/(?:^|[^A-Za-z])[A-Z]{2,6}(?=$|[^A-Za-z])/g)||[]).map(function(v){return v.replace(/[^A-Z]/g,"");}).filter(function(v){return ["PDF","SVG","JSON","HTTP","HTTPS","AI"].indexOf(v)<0;});}
  function singlePointNames(value){return (clean(value).match(/(?:^|[^A-Za-z])[A-Z](?=$|[^A-Za-z])/g)||[]).map(function(v){return v.replace(/[^A-Z]/g,"");});}
  function focusText(context){var student=clean(context.studentMessage||"");return /איפה|היכן|סמן|סמני|הראה|הראי|תראה|תראי|צייר|ציור|שרטט|שרטוט|הדגם|תדגים|הצג/.test(student)&&(tokens(student).length||singlePointNames(student).length)?student:clean(context.hintText||"");}
  function pairKey(pair){return pair.slice().sort().join("");}
  function focusAllows(value,ends,isAngle){
    var wanted=ends.join(""),reverse=ends.slice().reverse().join("");
    if(isAngle&&focusAllows(value,[ends[0],ends[1]],false)&&focusAllows(value,[ends[1],ends[2]],false)){return true;}
    return tokens(value).some(function(token){
      if(isAngle){return token===wanted||token===reverse;}
      if(token.length===2){return pairKey(token.split(""))===pairKey(ends);}
      // A named angle highlights its rays, while a named polygon highlights
      // consecutive edges. Neither permits an unmentioned diagonal.
      for(var i=0;i<token.length-1;i++){if(pairKey([token[i],token[i+1]])===pairKey(ends)){return true;}}
      return /משולש|מרובע|מלבן|מעוין|מקבילית|טרפז|ריבוע|מחומש|משושה/.test(value)&&pairKey([token[0],token[token.length-1]])===pairKey(ends);
    });
  }
  var UNPROVEN=/(?:\?|הוכיחו|הוכח(?:ה|ת|ו)?(?=[^א-ת]|$)|להוכיח|להראות|הראו|הראה\s+(?:כי|ש)|האם|מדוע|למה|כדי|צריך|עליכם|עליך|מטר[הת]|רוצים|נרצה|ננסה|בדקו|בדוק|חפשו|מצאו|נשער|(?:^|[^א-ת])אם(?:[^א-ת]|$)|נניח|בהנחה|משערים|השערה|(?:^|[^א-ת])או(?:[^א-ת]|$)|אינ[הו]|טרם|עדיין|ייתכן|אולי|לא(?:[^א-ת]|$)|אינו|אינה|אין(?:[^א-ת]|$)|≠|prove|suppose|assum|hypothet|conjectur|\b(?:either|or)\b|not\b|false\b|unknown\b|whether\b|show\s+that)/i;
  function sentences(value){return clean(value).split(/(?<=[.!?])(?=\s|$)|;/).map(function(v){return v.trim();}).filter(Boolean);}
  function grounded(quote,source){
    quote=clean(quote).replace(/\s+/g," ");
    if(!quote||quote.length>400||UNPROVEN.test(quote)){return false;}
    return sentences(source).some(function(sentence){return !UNPROVEN.test(sentence)&&sentence.replace(/\s+/g," ").indexOf(quote)!==-1;});
  }
  function segmentAlternates(ends){return "(?:"+ends.join("")+"|"+ends.slice().reverse().join("")+")";}
  function equalityIn(quote,first,second){var a=segmentAlternates(first),b=segmentAlternates(second),s=compact(quote);return new RegExp("(?:^|[^A-Z0-9+*/=−-])(?:"+a+"="+b+"|"+b+"="+a+")(?=$|[^A-Z0-9+*/=−-])").test(s);}
  function numericIn(quote,entity,value,angle){
    var word=entity.join(""),reverse=entity.slice().reverse().join(""),pattern="(?:"+word+"|"+reverse+")",s=compact(quote);
    var re=new RegExp("(?:^|[^A-Z0-9+*/=−-])"+(angle?"∠?":"")+pattern+"=(\\d+(?:\\.\\d+)?)(°?)(?=$|[^A-Z0-9+*/=−.\\-]|\\.(?!\\d))","g"),match;
    while((match=re.exec(s))){if(sameLength(Number(match[1]),value)&&(!angle||match[2]==="°")){return true;}}
    return false;
  }
  function perpendicularIn(quote,ends){var a=segmentAlternates([ends[0],ends[1]]),b=segmentAlternates([ends[1],ends[2]]);return new RegExp("(?:^|[^A-Z])(?:"+a+"⊥"+b+"|"+b+"⊥"+a+")(?=$|[^A-Z])").test(compact(quote))||numericIn(quote,ends,90,true);}
  function sourceRays(source){
    var rays={};
    sentences(source).filter(function(s){return !UNPROVEN.test(s);}).forEach(function(sentence){
      // Only explicit lists immediately after the object type are accepted.
      // Point order matters: ray MA starts at M, unlike ray AM.
      var re=/(?:^|[^א-תA-Za-z])(?:ו[־-]?)?(?:ה?קרן|ה?קרניים|rays?)\s*:?\s*([A-Z]{2}(?:\s*(?:,\s*(?:and\s+|ו[־-]?)?|and\s+|ו[־-]?)\s*[A-Z]{2})*)(?![A-Za-z])/gi,match;
      while((match=re.exec(sentence))){(match[1].match(/[A-Z]{2}/g)||[]).forEach(function(name){rays[name]=name.split("");});}
    });
    return rays;
  }
  function sourceRayNames(context){
    try{context=context||{};return Object.keys(sourceRays(clean(context.questionText||"")+". "+clean(context.hintText||"")));}
    catch(_error){return [];}
  }
  function inspect(plan,context){
    try{
      context=context||{};safeTree(plan,0);
      if(JSON.stringify(plan).length>24000){fail("plan_too_large");}
      keys(plan,["version","status","points","segments","rays","highlights","pointHighlights","angles","equalGroups","rightAngles","evidence"]);
      if(plan.version!==1){fail("unsupported_version");}
      if(plan.status==="unsupported"){return {ok:false,scene:null,reason:"unsupported"};}
      if(plan.status!=="ok"){fail("invalid_status");}
      var question=clean(context.questionText||""),hint=clean(context.hintText||""),trusted=namesIn(question+" "+hint),focus=focusText(context);
      if(!question||!focus){fail("missing_context");}
      if(!object(plan.points)){fail("invalid_points");}
      var pointNames=Object.keys(plan.points),points={};
      if(pointNames.length<3||pointNames.length>16){fail("invalid_point_count");}
      pointNames.forEach(function(name){
        var p=plan.points[name];
        if(!/^[A-Z]$/.test(name)||!trusted[name]){fail("unknown_point");}
        if(!Array.isArray(p)||p.length!==2||p.some(function(n){return typeof n!=="number"||!Number.isFinite(n)||Math.abs(n)>10000;})){fail("invalid_coordinate");}
        if(Object.keys(points).some(function(other){return distance(points[other],p)<EPS;})){fail("coincident_points");}
        points[name]=p.slice();
      });
      function pair(value){if(!Array.isArray(value)||value.length!==2||value.some(function(n){return typeof n!=="string"||!Object.prototype.hasOwnProperty.call(points,n);})||value[0]===value[1]){fail("invalid_segment");}return value.slice();}
      function angle(value){if(!Array.isArray(value)||value.length!==3){fail("invalid_angle");}pair([value[0],value[1]]);pair([value[1],value[2]]);var a=points[value[0]],v=points[value[1]],b=points[value[2]],u=[a[0]-v[0],a[1]-v[1]],w=[b[0]-v[0],b[1]-v[1]],cos=(u[0]*w[0]+u[1]*w[1])/(distance(a,v)*distance(b,v)),deg=Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI;if(deg<EPS||180-deg<EPS){fail("degenerate_angle");}return {ends:value.slice(),degrees:deg,cosine:cos};}
      function color(value){if(value===undefined){return "blue";}if(COLORS.indexOf(value)<0){fail("invalid_color");}return value;}
      var segments=list(plan.segments,40).map(pair),seen={};
      segments.forEach(function(p){var key=pairKey(p);if(seen[key]){fail("duplicate_segment");}seen[key]=true;});
      function isDrawn(ends){return segments.some(function(s){var a=points[s[0]],b=points[s[1]],length=distance(a,b);return ends.every(function(name){var p=points[name];return sameLength(distance(a,p)+distance(p,b),length);});});}
      function focused(ends,isAngle){if(!focusAllows(focus,ends,isAngle)){fail("outside_current_focus");}if(isAngle){if(!isDrawn([ends[0],ends[1]])||!isDrawn([ends[1],ends[2]])){fail("undrawn_mark");}}else if(!isDrawn(ends)){fail("undrawn_mark");}}
      var evidence={};list(plan.evidence,32).forEach(function(item){keys(item,["mark","source","quote"]);if(typeof item.mark!=="string"||!/^(equalGroups|rightAngles|angles|highlights)\.\d{1,2}$/.test(item.mark)||evidence[item.mark]||(item.source!=="question"&&item.source!=="hint")){fail("invalid_evidence");}text(item.quote,400);if(!grounded(item.quote,item.source==="question"?question:hint)){fail("unproven_evidence");}evidence[item.mark]=item;});
      var usedEvidence={};function proof(mark,check){var item=evidence[mark];if(!item||!check(item.quote)){fail("ungrounded_mark");}usedEvidence[mark]=true;}
      // Every entry was grounded above. An optional citation on a validated
      // name-only mark adds no fact; do not reject an otherwise useful diagram.
      // Call only for existing marks after their exact label/focus validation.
      function optionalNameEvidence(mark){if(evidence[mark]){usedEvidence[mark]=true;}}
      var scene={type:"geometry-scene",title:"המחשה לשלב הנוכחי",caption:"שרטוט סכמטי: הצבעים מדגישים את הנקודות, הקטעים והזוויות שבשלב הנוכחי.",points:points,segments:segments,equations:[]};
      var declaredRays=sourceRays(question+". "+hint),raySeen={};
      list(plan.rays,16).forEach(function(item){
        var ends=pair(item),name=ends.join(""),key=pairKey(ends);
        if(raySeen[name]){fail("duplicate_ray");}
        if(!declaredRays[name]){fail("ungrounded_ray");}
        // A grounded ray already declares its base segment. Normalize only
        // that redundant omission, preserving the source direction and every
        // later focus/relation check. segments is a copy, never model input.
        if(!seen[key]){if(segments.length>=40){fail("invalid_list");}segments.push(ends);seen[key]=true;}
        raySeen[name]=true;
      });
      if(!segments.length){fail("missing_segments");}
      // A source-labelled ray stays a ray even in a cached plan that omitted
      // the optional field. This adds no point, segment, fact or emphasis.
      scene.rays=Object.keys(declaredRays).filter(function(name){return seen[pairKey(declaredRays[name])];}).map(function(name){return declaredRays[name].slice();});
      if(scene.rays.length>16){fail("invalid_list");}
      var emphasizedPoints={};scene.pointHighlights=list(plan.pointHighlights,8).map(function(item){
        keys(item,["point","color"]);
        if(typeof item.point!=="string"||!Object.prototype.hasOwnProperty.call(points,item.point)||emphasizedPoints[item.point]){fail("invalid_point_highlight");}
        // A hint that asks for the side opposite B may locate B, but must not
        // color AC (the answer) or pick incident rays on the student's behalf.
        if(singlePointNames(focus).indexOf(item.point)<0){fail("outside_current_focus");}
        if(!isDrawn([item.point,item.point])){fail("undrawn_mark");}
        emphasizedPoints[item.point]=true;
        return {point:item.point,color:color(item.color)};
      });
      scene.highlights=list(plan.highlights,12).map(function(item,index){
        keys(item,["from","to","color","label"]);var ends=pair([item.from,item.to]),label=text(item.label,16);focused(ends,false);
        if(label&&label!==ends.join("")&&label!==ends.slice().reverse().join("")){
          if(!/^\d+(?:\.\d+)?$/.test(label)){fail("invalid_segment_label");}
          proof("highlights."+index,function(quote){return numericIn(quote,ends,Number(label),false);});
          if(!sameLength(distance(points[ends[0]],points[ends[1]]),Number(label))){fail("coordinate_contradiction");}
        }else{optionalNameEvidence("highlights."+index);}
        return {from:ends[0],to:ends[1],color:color(item.color),label:label};
      });
      var groupLengths={};scene.equalGroups=list(plan.equalGroups,6).map(function(item,index){
        keys(item,["segments","count","color"]);var pairs=list(item.segments,8).map(pair);if(pairs.length<2||[1,2,3].indexOf(item.count)<0||pairs.some(function(p,i){return pairs.slice(0,i).some(function(other){return pairKey(p)===pairKey(other);});})){fail("invalid_equality");}
        pairs.forEach(function(p){focused(p,false);});
        proof("equalGroups."+index,function(quote){return pairs.slice(1).every(function(p){return equalityIn(quote,pairs[0],p);});});
        var length=distance(points[pairs[0][0]],points[pairs[0][1]]);if(pairs.some(function(p){return !sameLength(length,distance(points[p[0]],points[p[1]]));})||(groupLengths[item.count]!==undefined&&!sameLength(length,groupLengths[item.count]))){fail("coordinate_contradiction");}groupLengths[item.count]=length;
        return {segments:pairs,count:item.count,color:color(item.color)};
      });
      scene.rightAngles=list(plan.rightAngles,8).map(function(item,index){var a=angle(item);focused(item,true);proof("rightAngles."+index,function(quote){return perpendicularIn(quote,item);});if(Math.abs(a.cosine)>EPS){fail("coordinate_contradiction");}return item.slice();});
      scene.angles=list(plan.angles,8).map(function(item,index){
        keys(item,["from","vertex","to","label"]);var a=angle([item.from,item.vertex,item.to]),label=angleLabel(item.label);focused(a.ends,true);
        var name=label.replace(/^∠/,""),numeric=label.match(/^(\d+(?:\.\d+)?)°$/);
        if(numeric){proof("angles."+index,function(quote){return numericIn(quote,a.ends,Number(numeric[1]),true);});if(Math.abs(a.degrees-Number(numeric[1]))>.5){fail("coordinate_contradiction");}}
        else if(label&&name!==a.ends.join("")&&name!==a.ends.slice().reverse().join("")){fail("invalid_angle_label");}
        else{optionalNameEvidence("angles."+index);}
        return {from:item.from,vertex:item.vertex,to:item.to,label:label};
      });
      if(Object.keys(evidence).some(function(mark){return !usedEvidence[mark];})){fail("unused_evidence");}
      if(!scene.highlights.length&&!scene.pointHighlights.length&&!scene.angles.length&&!scene.equalGroups.length&&!scene.rightAngles.length){fail("missing_focus");}
      var xs=pointNames.map(function(n){return points[n][0];}),ys=pointNames.map(function(n){return points[n][1];});
      if(Math.max.apply(null,xs)-Math.min.apply(null,xs)<EPS||Math.max.apply(null,ys)-Math.min.apply(null,ys)<EPS){fail("flat_scene");}
      // A plain outline can contradict a given even without a false tick mark.
      // Check recognizable affirmative source facts too; unsupported natural
      // language is left to the model, never promoted into a proved statement.
      function allPresent(names){return names.split("").every(function(n){return Object.prototype.hasOwnProperty.call(points,n);});}
      function vector(ends){return [points[ends[1]][0]-points[ends[0]][0],points[ends[1]][1]-points[ends[0]][1]];}
      function linesAgree(first,second,relation){var u=vector(first),v=vector(second),size=Math.hypot(u[0],u[1])*Math.hypot(v[0],v[1]);return relation==="∥"?Math.abs(u[0]*v[1]-u[1]*v[0])<=EPS*size:Math.abs(u[0]*v[0]+u[1]*v[1])<=EPS*size;}
      function checkAngleClass(names,description){
        if(!allPresent(names)){return;}
        var expected=description==="חדה"||description.toLowerCase()==="acute"?"acute":"obtuse",degrees=angle(names.split("")).degrees;
        if(expected==="acute"?degrees>=90-EPS:degrees<=90+EPS){fail("source_coordinate_contradiction",{type:"angleClass",points:names.split(""),expectedClass:expected,actualDegrees:Math.round(degrees*1e6)/1e6});}
      }
      sentences(question+". "+hint).filter(function(s){return !UNPROVEN.test(s);}).forEach(function(sentence){
        var s=compact(sentence),match,re=/(?:^|[^A-Z0-9+*/=−-])([A-Z]{2})(=|∥|⊥)([A-Z]{2})(?=$|[^A-Z0-9+*/=−-])/g;
        while((match=re.exec(s))){if(allPresent(match[1]+match[3])){var a=match[1].split(""),b=match[3].split("");if(match[2]==="="?!sameLength(distance(points[a[0]],points[a[1]]),distance(points[b[0]],points[b[1]])):!linesAgree(a,b,match[2])){fail("source_coordinate_contradiction",{type:"relation",first:a,second:b,relation:match[2]});}}}
        re=/(?:^|[^A-Z0-9+*/=−-])∠?([A-Z]{3})=(\d+(?:\.\d+)?)°(?=$|[^A-Z0-9+*/=−-])/g;
        while((match=re.exec(s))){if(allPresent(match[1])){var anglePoints=match[1].split(""),expectedDegrees=Number(match[2]),actualDegrees=angle(anglePoints).degrees;if(Math.abs(actualDegrees-expectedDegrees)>.5){
          // Only parsed geometry values enter diagnostics; never source prose.
          var constraint={type:"angle",points:anglePoints,actualDegrees:Math.round(actualDegrees*1e6)/1e6};
          if(Number.isFinite(expectedDegrees)&&expectedDegrees>=0&&expectedDegrees<=180){Object.assign(constraint,{expectedDegrees:expectedDegrees});}
          fail("source_coordinate_contradiction",constraint);
        }}}
        re=/(?:(?:ה?זווית\s*∠?|∠)([A-Z]{3})\s*(?:(?:היא|הינה)\s*)?(?:זווית\s*)?(חדה|קהה)(?=$|[^א-ת])|\b(?:angle\s+)?∠?([A-Z]{3})\s+(?:is\s+)?(acute|obtuse)\b)/gi;
        while((match=re.exec(sentence))){checkAngleClass(match[1]||match[3],match[2]||match[4]);}
        re=/(?:ה?זווית\s+ה?(חדה|קהה)\s*∠?([A-Z]{3})(?![A-Za-z])|\b(acute|obtuse)\s+angle\s*∠?([A-Z]{3})(?![A-Za-z]))/gi;
        while((match=re.exec(sentence))){checkAngleClass(match[2]||match[4],match[1]||match[3]);}
        re=/([A-Z])\s+(?:(?:נמצא|נמצאת)\s+)?על\s+(?:(הצלע|הקטע|האלכסון|הישר)\s+)?([A-Z]{2})(?![A-Z])/g;
        while((match=re.exec(sentence))){if(allPresent(match[1]+match[3])){var middle=points[match[1]],start=points[match[3][0]],end=points[match[3][1]],onSegment=sameLength(distance(start,middle)+distance(middle,end),distance(start,end)),cross=(end[0]-start[0])*(middle[1]-start[1])-(end[1]-start[1])*(middle[0]-start[0]);if(match[2]==="הישר"?Math.abs(cross)>EPS*Math.max(1,distance(start,end)*distance(start,middle)):!onSegment){fail("source_coordinate_contradiction",{type:"pointOn",point:match[1],ends:match[3].split(""),extent:match[2]==="הישר"?"line":"segment"});}}}
        re=/([A-Z])\s+(?:(?:נמצא|נמצאת)\s+)?על\s+המשך\s+(?:(?:הצלע|הקטע)\s+)?([A-Z]{2})\s+מעבר\s+ל\s*[־-]?\s*([A-Z])(?![A-Za-z])/g;
        while((match=re.exec(sentence))){
          var extensionPoint=match[1],extensionEnds=match[2].split(""),beyond=match[3];
          if(extensionEnds[0]===extensionEnds[1]||extensionEnds.indexOf(beyond)===-1||!allPresent(extensionPoint+match[2])){continue;}
          var extensionStart=points[extensionEnds[0]],extensionEnd=points[extensionEnds[1]],extension=points[extensionPoint];
          var along=[extensionEnd[0]-extensionStart[0],extensionEnd[1]-extensionStart[1]],offset=[extension[0]-extensionStart[0],extension[1]-extensionStart[1]];
          var extensionCross=along[0]*offset[1]-along[1]*offset[0],projection=(along[0]*offset[0]+along[1]*offset[1])/(along[0]*along[0]+along[1]*along[1]);
          var isBeyond=beyond===extensionEnds[0]?projection < -EPS:projection > 1+EPS;
          if(Math.abs(extensionCross)>EPS*Math.max(1,Math.hypot(along[0],along[1])*Math.hypot(offset[0],offset[1]))||!isBeyond){
            fail("source_coordinate_contradiction",{type:"pointOnExtension",point:extensionPoint,ends:extensionEnds,beyond:beyond});
          }
        }
        re=/(משולש|מעוין|ריבוע|מלבן|מקבילית)\s*[△Δ]?\s*([A-Z]{3,4})(?![A-Z])/g;
        while((match=re.exec(sentence))){if(!allPresent(match[2])){continue;}var shape=match[1],names=match[2].split("");
          if(shape==="משולש"&&names.length===3){angle(names);continue;}
          if(names.length!==4){continue;}
          var edges=names.map(function(n,i){return [n,names[(i+1)%4]];});
          if(!linesAgree(edges[0],edges[2],"∥")||!linesAgree(edges[1],edges[3],"∥")){fail("source_coordinate_contradiction",{type:"shape",shape:shape,points:names,required:"oppositeSidesParallel"});}
          if((shape==="מלבן"||shape==="ריבוע")&&!linesAgree(edges[0],edges[1],"⊥")){fail("source_coordinate_contradiction",{type:"shape",shape:shape,points:names,required:"adjacentSidesPerpendicular"});}
          if((shape==="מעוין"||shape==="ריבוע")&&!sameLength(distance(points[names[0]],points[names[1]]),distance(points[names[1]],points[names[2]]))){fail("source_coordinate_contradiction",{type:"shape",shape:shape,points:names,required:"adjacentSidesEqual"});}
        }
      });
      return {ok:true,scene:scene,reason:null};
    }catch(error){var result={ok:false,scene:null,reason:error.reason||"invalid_plan"};if(error.reason==="source_coordinate_contradiction"&&error.constraint){return Object.assign(result,{constraint:error.constraint});}return result;}
  }
  function normalizeRayPresentation(plan,context){
    // Optional repair of presentation, never source geometry: remove only an
    // unsupported arrow from a segment the model already drew explicitly.
    // Keep inspect strict; callers must opt in and receive a fully rechecked
    // plan. A missing base segment, malformed ray, or other failure is not
    // repaired, and all non-ray data is copied without alteration.
    if(inspect(plan,context).reason!=="ungrounded_ray"){return null;}
    try{
      var allowed=sourceRayNames(context),seen={},removed=false,invalid=false;
      var kept=plan.rays.filter(function(ends){
        if(!Array.isArray(ends)||ends.length!==2||ends[0]===ends[1]||ends.some(function(n){return typeof n!=="string"||!Object.prototype.hasOwnProperty.call(plan.points,n);})){invalid=true;return true;}
        var name=ends.join("");if(seen[name]){invalid=true;return true;}seen[name]=true;
        if(allowed.indexOf(name)!==-1){return true;}
        if(!plan.segments.some(function(segment){return pairKey(segment)===pairKey(ends);})){invalid=true;return true;}
        removed=true;return false;
      });
      if(invalid||!removed){return null;}
      var normalized=JSON.parse(JSON.stringify(plan));normalized.rays=kept.map(function(ends){return ends.slice();});
      return inspect(normalized,context).ok?normalized:null;
    }catch(_error){return null;}
  }
  function normalizeParallelAngleFocus(plan,context){
    // Locate a requested pair; do not prove equality or complete a later step.
    // Only three explicitly named segments with direct endpoint intersections
    // are supported. Missing topology, ambiguous language, factual angle marks,
    // or a narrower student focus remain the model's responsibility.
    var initial=inspect(plan,context);
    if(!initial.ok&&initial.reason!=="missing_focus"){return null;}
    try{
      context=context||{};
      var hint=clean(context.hintText||""),student=clean(context.studentMessage||""),question=clean(context.questionText||"");
      var drawing=/סמן|סמני|שרטט|שרטוט|צייר|ציור|הדגם|תדגים|הראה|הראי|תראה|תראי|\b(?:draw|mark|show|illustrate)\b/i;
      var declined=/(?:אל|לא|בלי|ללא)\s+(?:תסמן|תסמני|לסמן|סימון|תשרטט|לשרטט|שרטוט|תצייר|לצייר|ציור|תראה|להראות)|\b(?:do not|don't|without)\s+(?:draw|mark|show|illustrate)\b/i;
      if(!drawing.test(student)||declined.test(student)||tokens(student).length||singlePointNames(student).length){return null;}
      if(!/זוויות\s+ה?מתחלפות|\balternate(?:\s+interior)?\s+angles\b/i.test(hint)||/חיצוניות|\bexterior\b/i.test(hint)||declined.test(hint)||/(?:^|[^א-ת])(?:לא|אין|אינן|בלי|ללא)(?=[^א-ת]|$)|\b(?:not|no|without)\b/i.test(hint)){return null;}
      var hintTokens=tokens(hint),hintPairs={};
      if(hintTokens.some(function(n){return n.length!==2;})||singlePointNames(hint).length){return null;}
      hintTokens.forEach(function(n){hintPairs[pairKey(n.split(""))]=true;});
      if(Object.keys(hintPairs).length!==3){return null;}
      var transversalNames={},match,re=/(?:ה?חותך|\btransversal)\s*:?\s*([A-Z]{2})(?![A-Za-z])/gi;
      while((match=re.exec(hint))){transversalNames[pairKey(match[1].split(""))]=match[1].split("");}
      if(Object.keys(transversalNames).length!==1){return null;}
      var transversal=transversalNames[Object.keys(transversalNames)[0]],transversalKey=pairKey(transversal),relations={};
      if(!hintPairs[transversalKey]){return null;}
      sentences(question+". "+hint).filter(function(s){return !UNPROVEN.test(s);}).forEach(function(sentence){
        var relationRe=/(?:^|[^A-Z0-9+*/=−-])([A-Z]{2})∥([A-Z]{2})(?=$|[^A-Z0-9+*/=−-])/g,relation;
        while((relation=relationRe.exec(compact(sentence)))){
          var first=relation[1].split(""),second=relation[2].split(""),firstKey=pairKey(first),secondKey=pairKey(second);
          if(firstKey!==secondKey&&firstKey!==transversalKey&&secondKey!==transversalKey&&hintPairs[firstKey]&&hintPairs[secondKey]){
            relations[[firstKey,secondKey].sort().join(":")]=[first,second];
          }
        }
      });
      if(Object.keys(relations).length!==1){return null;}
      var parallel=relations[Object.keys(relations)[0]],allNames=parallel[0].concat(parallel[1]);
      if(new Set(allNames).size!==4||allNames.some(function(n){return !Object.prototype.hasOwnProperty.call(plan.points,n);})){return null;}
      var drawn=initial.scene?initial.scene.segments:list(plan.segments,40);
      if(parallel.concat([transversal]).some(function(ends){return !drawn.some(function(s){return pairKey(s)===pairKey(ends);});})){return null;}
      var intersections=parallel.map(function(ends){return ends.filter(function(n){return transversal.indexOf(n)!==-1;});});
      if(intersections.some(function(ends){return ends.length!==1;})||intersections[0][0]===intersections[1][0]){return null;}
      var u=intersections[0][0],v=intersections[1][0],a=parallel[0].filter(function(n){return n!==u;})[0],b=parallel[1].filter(function(n){return n!==v;})[0];
      var pu=plan.points[u],pv=plan.points[v],pa=plan.points[a],pb=plan.points[b],t=[pv[0]-pu[0],pv[1]-pu[1]];
      var firstSide=t[0]*(pa[1]-pu[1])-t[1]*(pa[0]-pu[0]),secondSide=t[0]*(pb[1]-pv[1])-t[1]*(pb[0]-pv[0]);
      var tolerance=EPS*Math.hypot(t[0],t[1])*Math.max(distance(pu,pa),distance(pv,pb));
      if(Math.abs(firstSide)<=tolerance||Math.abs(secondSide)<=tolerance||Math.sign(firstSide)===Math.sign(secondSide)){return null;}
      function angleKey(ends){return ends[1]+":"+[ends[0],ends[2]].sort().join("");}
      var desired=[[a,u,v],[u,v,b]],wanted=desired.map(angleKey),existing=list(plan.angles,8),seenAngles={};
      if(list(plan.evidence,32).some(function(item){return /^angles\./.test(item.mark);})){return null;}
      if(existing.some(function(item){var label=angleLabel(item.label),key=angleKey([item.from,item.vertex,item.to]);seenAngles[key]=true;return /^\d/.test(label)||wanted.indexOf(key)===-1;})){return null;}
      if(existing.length===2&&Object.keys(seenAngles).length===2){return null;}
      var normalized=JSON.parse(JSON.stringify(plan));
      normalized.angles=desired.map(function(ends){return {from:ends[0],vertex:ends[1],to:ends[2],label:"∠"+ends.join("")};});
      return inspect(normalized,context).ok?normalized:null;
    }catch(_error){return null;}
  }
  function compile(plan,context){return inspect(plan,context).scene;}
  function render(doc,plan,context){var scene=compile(plan,context);return scene&&geometry&&typeof geometry.render==="function"?geometry.render(doc,scene):null;}
  return {inspect:inspect,compile:compile,render:render,sourceRayNames:sourceRayNames,normalizeRayPresentation:normalizeRayPresentation,normalizeParallelAngleFocus:normalizeParallelAngleFocus,PROMPT_SCHEMA:PROMPT_SCHEMA};
});
