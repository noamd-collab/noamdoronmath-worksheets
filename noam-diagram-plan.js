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

  function fail(reason){throw Object.assign(new Error(reason),{reason:reason});}
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
  var UNPROVEN=/(?:\?|הוכיחו|הוכח(?:ה|ת|ו)?\s+(?:כי|ש)|להוכיח|להראות|הראו|הראה\s+(?:כי|ש)|האם|מדוע|למה|כדי|צריך|עליכם|עליך|מטר[הת]|רוצים|נרצה|ננסה|בדקו|בדוק|חפשו|מצאו|נשער|(?:^|[^א-ת])אם(?:[^א-ת]|$)|נניח|אינ[הו]|טרם|עדיין|ייתכן|אולי|לא(?:[^א-ת]|$)|אינו|אינה|אין(?:[^א-ת]|$)|≠|prove|suppose|assum|not\b|false\b|unknown\b|whether\b|show\s+that)/i;
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
  function inspect(plan,context){
    try{
      context=context||{};safeTree(plan,0);
      if(JSON.stringify(plan).length>24000){fail("plan_too_large");}
      keys(plan,["version","status","points","segments","highlights","pointHighlights","angles","equalGroups","rightAngles","evidence"]);
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
      var segments=list(plan.segments,40).map(pair),seen={};if(!segments.length){fail("missing_segments");}
      segments.forEach(function(p){var key=pairKey(p);if(seen[key]){fail("duplicate_segment");}seen[key]=true;});
      function isDrawn(ends){return segments.some(function(s){var a=points[s[0]],b=points[s[1]],length=distance(a,b);return ends.every(function(name){var p=points[name];return sameLength(distance(a,p)+distance(p,b),length);});});}
      function focused(ends,isAngle){if(!focusAllows(focus,ends,isAngle)){fail("outside_current_focus");}if(isAngle){if(!isDrawn([ends[0],ends[1]])||!isDrawn([ends[1],ends[2]])){fail("undrawn_mark");}}else if(!isDrawn(ends)){fail("undrawn_mark");}}
      var evidence={};list(plan.evidence,32).forEach(function(item){keys(item,["mark","source","quote"]);if(typeof item.mark!=="string"||!/^(equalGroups|rightAngles|angles|highlights)\.\d{1,2}$/.test(item.mark)||evidence[item.mark]||(item.source!=="question"&&item.source!=="hint")){fail("invalid_evidence");}text(item.quote,400);if(!grounded(item.quote,item.source==="question"?question:hint)){fail("unproven_evidence");}evidence[item.mark]=item;});
      var usedEvidence={};function proof(mark,check){var item=evidence[mark];if(!item||!check(item.quote)){fail("ungrounded_mark");}usedEvidence[mark]=true;}
      var scene={type:"geometry-scene",title:"המחשה לשלב הנוכחי",caption:"שרטוט סכמטי: הצבעים מדגישים את הנקודות, הקטעים והזוויות שבשלב הנוכחי.",points:points,segments:segments,equations:[]};
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
        }
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
        keys(item,["from","vertex","to","label"]);var a=angle([item.from,item.vertex,item.to]),label=text(item.label,16);focused(a.ends,true);
        var name=label.replace(/^∠/,""),numeric=label.match(/^(\d+(?:\.\d+)?)°$/);
        if(numeric){proof("angles."+index,function(quote){return numericIn(quote,a.ends,Number(numeric[1]),true);});if(Math.abs(a.degrees-Number(numeric[1]))>.5){fail("coordinate_contradiction");}}
        else if(label&&name!==a.ends.join("")&&name!==a.ends.slice().reverse().join("")){fail("invalid_angle_label");}
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
      sentences(question+". "+hint).filter(function(s){return !UNPROVEN.test(s);}).forEach(function(sentence){
        var s=compact(sentence),match,re=/(?:^|[^A-Z0-9+*/=−-])([A-Z]{2})(=|∥|⊥)([A-Z]{2})(?=$|[^A-Z0-9+*/=−-])/g;
        while((match=re.exec(s))){if(allPresent(match[1]+match[3])){var a=match[1].split(""),b=match[3].split("");if(match[2]==="="?!sameLength(distance(points[a[0]],points[a[1]]),distance(points[b[0]],points[b[1]])):!linesAgree(a,b,match[2])){fail("source_coordinate_contradiction");}}}
        re=/(?:^|[^A-Z0-9+*/=−-])∠?([A-Z]{3})=(\d+(?:\.\d+)?)°(?=$|[^A-Z0-9+*/=−-])/g;
        while((match=re.exec(s))){if(allPresent(match[1])&&Math.abs(angle(match[1].split("")).degrees-Number(match[2]))>.5){fail("source_coordinate_contradiction");}}
        re=/([A-Z])\s+(?:(?:נמצא|נמצאת)\s+)?על\s+(?:(הצלע|הקטע|האלכסון|הישר)\s+)?([A-Z]{2})(?![A-Z])/g;
        while((match=re.exec(sentence))){if(allPresent(match[1]+match[3])){var middle=points[match[1]],start=points[match[3][0]],end=points[match[3][1]],onSegment=sameLength(distance(start,middle)+distance(middle,end),distance(start,end)),cross=(end[0]-start[0])*(middle[1]-start[1])-(end[1]-start[1])*(middle[0]-start[0]);if(match[2]==="הישר"?Math.abs(cross)>EPS*Math.max(1,distance(start,end)*distance(start,middle)):!onSegment){fail("source_coordinate_contradiction");}}}
        re=/(משולש|מעוין|ריבוע|מלבן|מקבילית)\s*[△Δ]?\s*([A-Z]{3,4})(?![A-Z])/g;
        while((match=re.exec(sentence))){if(!allPresent(match[2])){continue;}var shape=match[1],names=match[2].split("");
          if(shape==="משולש"&&names.length===3){angle(names);continue;}
          if(names.length!==4){continue;}
          var edges=names.map(function(n,i){return [n,names[(i+1)%4]];});
          if(!linesAgree(edges[0],edges[2],"∥")||!linesAgree(edges[1],edges[3],"∥")){fail("source_coordinate_contradiction");}
          if((shape==="מלבן"||shape==="ריבוע")&&!linesAgree(edges[0],edges[1],"⊥")){fail("source_coordinate_contradiction");}
          if((shape==="מעוין"||shape==="ריבוע")&&!sameLength(distance(points[names[0]],points[names[1]]),distance(points[names[1]],points[names[2]]))){fail("source_coordinate_contradiction");}
        }
      });
      return {ok:true,scene:scene,reason:null};
    }catch(error){return {ok:false,scene:null,reason:error.reason||"invalid_plan"};}
  }
  function compile(plan,context){return inspect(plan,context).scene;}
  function render(doc,plan,context){var scene=compile(plan,context);return scene&&geometry&&typeof geometry.render==="function"?geometry.render(doc,scene):null;}
  return {inspect:inspect,compile:compile,render:render,PROMPT_SCHEMA:PROMPT_SCHEMA};
});
