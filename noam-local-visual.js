(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamLocalVisual=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  var SVG_NS="http://www.w3.org/2000/svg";

  function wantsDrawing(text){
    return /(?:צייר|לצייר|שרטט|שרטוט|תמחיש|המחשה|גרף|פרבולה)/i.test(String(text||""));
  }

  function wantsVisualSupport(text){
    return wantsDrawing(text)||/(?:איזו?|איפה|היכן)\s+(?:היא\s+)?(?:ה)?זווית|קשה\s+לי\s+לזהות|לא\s+(?:רואה|מזהה)|סמ(?:ן|ני)\s+לי|תראה\s+לי/i.test(String(text||""));
  }

  function compactLatinLetters(value){
    return String(value||"").replace(/[^A-Za-z]/g,"").toUpperCase();
  }

  function parseLabeledTriangle(source){
    var text=String(source||"");
    var trianglePattern=/(?:△|\\triangle|משולש(?:\s+שווה[־-]?שוקיים)?(?:\s+))\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])/gi;
    var triangleMatch,vertices=null;
    while((triangleMatch=trianglePattern.exec(text))){
      var candidate=compactLatinLetters(triangleMatch.slice(1).join(""));
      if(candidate.length===3&&new Set(candidate).size===3){vertices=candidate.split("");}
    }
    if(!vertices){return null;}

    var anglePattern=/(?:∠|\\angle)\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])/gi;
    var angleMatch,angles=[];
    while((angleMatch=anglePattern.exec(text))){
      var angle=compactLatinLetters(angleMatch.slice(1).join(""));
      if(angle.length===3&&angle.split("").every(function(letter){return vertices.indexOf(letter)!==-1;})&&angles.indexOf(angle)===-1){
        angles.push(angle);
      }
    }
    return {type:"labeled-triangle",vertices:vertices,angles:angles.slice(-3)};
  }

  function normalizedRelation(value){
    return ({">=":"≥","<=":"≤","≥":"≥","≤":"≤",">":">","<":"<"})[value]||"";
  }

  function parseFactoredQuadraticInequality(source){
    var text=String(source||"").replace(/–|—/g,"−").replace(/,/g,".");
    var factorPattern=/\(\s*x\s*([+\-−])\s*(\d+(?:\.\d+)?)\s*\)/gi;
    var factors=[];
    var match;
    while((match=factorPattern.exec(text))){
      factors.push({
        root:(match[1]==="+"?-1:1)*Number(match[2]),
        start:match.index,
        end:factorPattern.lastIndex
      });
    }
    if(factors.length!==2||!Number.isFinite(factors[0].root)||!Number.isFinite(factors[1].root)){return null;}
    if(factors[0].root===factors[1].root){return null;}
    var between=text.slice(factors[0].end,factors[1].start);
    if(between.trim()&&!/^\s*[·×*]?\s*$/.test(between)){return null;}
    var relationMatch=text.slice(factors[1].end).match(/^\s*(>=|<=|≥|≤|>|<)\s*0(?:\D|$)/);
    if(!relationMatch){return null;}
    var roots=[factors[0].root,factors[1].root].sort(function(a,b){return a-b;});
    return {
      type:"factored-quadratic-inequality",
      roots:roots,
      relation:normalizedRelation(relationMatch[1])
    };
  }

  function describe(spec){
    if(!spec){return "";}
    if(spec.type==="labeled-triangle"){
      var triangle=(spec.vertices||[]).join("");
      var angles=(spec.angles||[]).map(function(angle){return "∠"+angle;}).join(" ו־");
      return "משולש "+triangle+(angles?", ובו מסומנות הזוויות "+angles:".");
    }
    if(spec.type==="question-image"){
      return String(spec.label||"השרטוט מתוך השאלה");
    }
    if(spec.type!=="factored-quadratic-inequality"){return "";}
    var inclusive=spec.relation==="≥"||spec.relation==="≤";
    var position=spec.relation==="≥"||spec.relation===">"?"מעל ציר x":"מתחת לציר x";
    return "פרבולה הפתוחה כלפי מעלה, חותכת את ציר x ב־"+formatNumber(spec.roots[0])+" וב־"+formatNumber(spec.roots[1])+". החלקים "+position+(inclusive?" או עליו":"")+" מודגשים.";
  }

  function assistantText(spec){
    var inclusive=spec.relation==="≥"||spec.relation==="≤";
    var position=spec.relation==="≥"||spec.relation===">"?"מעל ציר x":"מתחת לציר x";
    return "הנה המחשה. סמנו תחילה את שני השורשים, ואז עקבו אחרי החלקים המודגשים שבהם הפרבולה נמצאת "+position+(inclusive?" או עליו.":".")+" נסו לתרגם את ההדגשה לתחומים על ציר x.";
  }

  function formatNumber(value){
    return Number.isInteger(value)?String(value):String(Number(value.toFixed(2)));
  }

  function svgElement(documentRef,name,attributes,text){
    var element=documentRef.createElementNS(SVG_NS,name);
    Object.keys(attributes||{}).forEach(function(key){element.setAttribute(key,String(attributes[key]));});
    if(text!==undefined){element.textContent=String(text);}
    return element;
  }

  function conditionHolds(relation,value){
    if(relation==="≥"){return value>=-1e-9;}
    if(relation===">"){return value>1e-9;}
    if(relation==="≤"){return value<=1e-9;}
    return value<-1e-9;
  }

  function triangleAnglePath(points,angle){
    var center=points[angle.charAt(1)];
    var first=points[angle.charAt(0)];
    var last=points[angle.charAt(2)];
    if(!center||!first||!last){return "";}
    function unit(target){
      var dx=target.x-center.x,dy=target.y-center.y;
      var length=Math.sqrt(dx*dx+dy*dy)||1;
      return {x:dx/length,y:dy/length};
    }
    var a=unit(first),b=unit(last),radius=25;
    var start={x:center.x+a.x*radius,y:center.y+a.y*radius};
    var end={x:center.x+b.x*radius,y:center.y+b.y*radius};
    var middle={x:center.x+(a.x+b.x)*radius*.72,y:center.y+(a.y+b.y)*radius*.72};
    return "M"+start.x.toFixed(1)+" "+start.y.toFixed(1)+" Q"+middle.x.toFixed(1)+" "+middle.y.toFixed(1)+" "+end.x.toFixed(1)+" "+end.y.toFixed(1);
  }

  function normalizedPoint(value){
    if(!Array.isArray(value)||value.length!==2){return null;}
    if(typeof value[0]!=="number"||typeof value[1]!=="number"){return null;}
    var x=value[0],y=value[1];
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1){return null;}
    return [x,y];
  }

  function normalizedFocusCrop(value){
    if(!value){return null;}
    if(typeof value.x!=="number"||typeof value.y!=="number"||typeof value.w!=="number"||typeof value.h!=="number"){
      return null;
    }
    var crop={x:value.x,y:value.y,w:value.w,h:value.h};
    if(!Number.isFinite(crop.x)||!Number.isFinite(crop.y)||!Number.isFinite(crop.w)||!Number.isFinite(crop.h)){
      return null;
    }
    if(crop.x<0||crop.y<0||crop.w<.04||crop.h<.04||crop.x+crop.w>1.000001||crop.y+crop.h>1.000001){
      return null;
    }
    return crop;
  }

  function pointInsideFocus(point,crop){
    var epsilon=.000001;
    return point&&point[0]>=crop.x-epsilon&&point[0]<=crop.x+crop.w+epsilon&&
      point[1]>=crop.y-epsilon&&point[1]<=crop.y+crop.h+epsilon;
  }

  function normalizeQuestionFocus(value){
    if(!value){return null;}
    var crop=normalizedFocusCrop(value.crop);
    if(!crop){return null;}
    var segments=(Array.isArray(value.segments)?value.segments:[]).slice(0,12).map(function(segment){
      var from=normalizedPoint(segment&&segment.from);
      var to=normalizedPoint(segment&&segment.to);
      if(!pointInsideFocus(from,crop)||!pointInsideFocus(to,crop)||(from[0]===to[0]&&from[1]===to[1])){return null;}
      var role=segment.role==="parallel"||segment.role==="transversal"?segment.role:"emphasis";
      return {from:from,to:to,role:role};
    }).filter(Boolean);
    var angles=(Array.isArray(value.angles)?value.angles:[]).slice(0,8).map(function(angle){
      var vertex=normalizedPoint(angle&&angle.vertex);
      var from=normalizedPoint(angle&&angle.from);
      var to=normalizedPoint(angle&&angle.to);
      if(!pointInsideFocus(vertex,crop)||!pointInsideFocus(from,crop)||!pointInsideFocus(to,crop)){
        return null;
      }
      if((vertex[0]===from[0]&&vertex[1]===from[1])||(vertex[0]===to[0]&&vertex[1]===to[1])){
        return null;
      }
      return {vertex:vertex,from:from,to:to,label:String(angle.label||"").trim().slice(0,24)};
    }).filter(Boolean);
    return {
      label:String(value.label||"").trim().slice(0,120),
      crop:crop,
      segments:segments,
      angles:angles
    };
  }

  function focusPoint(point,crop){
    return {x:(point[0]-crop.x)/crop.w*1000,y:(point[1]-crop.y)/crop.h*1000};
  }

  function focusAngleGeometry(angle,crop){
    var center=focusPoint(angle.vertex,crop);
    var first=focusPoint(angle.from,crop);
    var last=focusPoint(angle.to,crop);
    function unit(target){
      var dx=target.x-center.x,dy=target.y-center.y;
      var length=Math.sqrt(dx*dx+dy*dy)||1;
      return {x:dx/length,y:dy/length};
    }
    var a=unit(first),b=unit(last),radius=68;
    var start={x:center.x+a.x*radius,y:center.y+a.y*radius};
    var end={x:center.x+b.x*radius,y:center.y+b.y*radius};
    var middleVector={x:a.x+b.x,y:a.y+b.y};
    var middleLength=Math.sqrt(middleVector.x*middleVector.x+middleVector.y*middleVector.y)||1;
    var middle={
      x:center.x+middleVector.x/middleLength*radius*.83,
      y:center.y+middleVector.y/middleLength*radius*.83
    };
    var label={
      x:center.x+middleVector.x/middleLength*radius*1.68,
      y:center.y+middleVector.y/middleLength*radius*1.68
    };
    return {
      path:"M"+start.x.toFixed(1)+" "+start.y.toFixed(1)+" Q"+middle.x.toFixed(1)+" "+middle.y.toFixed(1)+" "+end.x.toFixed(1)+" "+end.y.toFixed(1),
      label:label
    };
  }

  function describeQuestionFocus(spec,focus){
    var details=[];
    if(focus.segments.some(function(segment){return segment.role==="parallel";})){details.push("הישרים המקבילים");}
    if(focus.segments.some(function(segment){return segment.role==="transversal";})){details.push("הישר החותך");}
    var angles=focus.angles.map(function(angle){return angle.label;}).filter(Boolean);
    if(angles.length){details.push("הזוויות "+angles.join(" ו־"));}
    return String(focus.label||spec.label||"השרטוט מתוך השאלה")+(details.length?". מודגשים "+details.join(", "):"");
  }

  function renderQuestionFocus(documentRef,card,image,spec,focus){
    var stage=documentRef.createElement("div");
    stage.className="noam-question-visual-stage";
    stage.style.aspectRatio="4 / 3";
    image.className+=" noam-question-visual-focus-image";
    image.alt=describeQuestionFocus(spec,focus);
    image.style.width=(100/focus.crop.w)+"%";
    image.style.left=(-focus.crop.x/focus.crop.w*100)+"%";
    image.style.top=(-focus.crop.y/focus.crop.h*100)+"%";
    image.addEventListener("load",function(){
      if(image.naturalWidth&&image.naturalHeight){
        stage.style.aspectRatio=(image.naturalWidth*focus.crop.w)+" / "+(image.naturalHeight*focus.crop.h);
      }
    });
    stage.appendChild(image);

    var overlay=svgElement(documentRef,"svg",{
      class:"noam-question-visual-overlay",viewBox:"0 0 1000 1000",
      preserveAspectRatio:"none","aria-hidden":"true"
    });
    focus.segments.forEach(function(segment){
      var from=focusPoint(segment.from,focus.crop),to=focusPoint(segment.to,focus.crop);
      overlay.appendChild(svgElement(documentRef,"line",{
        class:"noam-question-focus-segment is-"+segment.role,
        x1:from.x.toFixed(1),y1:from.y.toFixed(1),x2:to.x.toFixed(1),y2:to.y.toFixed(1),
        "vector-effect":"non-scaling-stroke"
      }));
    });
    focus.angles.forEach(function(angle){
      var geometry=focusAngleGeometry(angle,focus.crop);
      overlay.appendChild(svgElement(documentRef,"path",{
        class:"noam-question-focus-angle",d:geometry.path,"vector-effect":"non-scaling-stroke"
      }));
      if(angle.label){
        overlay.appendChild(svgElement(documentRef,"text",{
          class:"noam-question-focus-label",x:geometry.label.x.toFixed(1),y:geometry.label.y.toFixed(1)
        },angle.label));
      }
    });
    stage.appendChild(overlay);
    card.appendChild(stage);
    var note=documentRef.createElement("p");
    note.className="noam-visual-note noam-question-visual-note";
    var legend=[];
    if(focus.segments.some(function(segment){return segment.role==="parallel";})){legend.push("ירוק: ישרים מקבילים");}
    if(focus.segments.some(function(segment){return segment.role==="transversal";})){legend.push("כתום: ישר חותך");}
    if(focus.angles.length){legend.push("ורוד: הזוויות המסומנות");}
    note.textContent="זהו השרטוט המקורי מתוך השאלה, בהגדלה."+(legend.length?" "+legend.join(" · ")+".":"");
    card.appendChild(note);
    image.addEventListener("error",function(){
      stage.hidden=true;
      note.hidden=true;
    });
  }

  function renderQuestionImage(documentRef,spec){
    // A guide may describe what to highlight, but the overlay is meaningful only
    // on top of the cached worksheet image it was measured against.
    var focus=spec.src?normalizeQuestionFocus(spec.focus):null;
    var card=documentRef.createElement("figure");
    card.className="noam-visual-card noam-question-visual";
    card.setAttribute("dir","rtl");
    var title=documentRef.createElement("figcaption");
    title.className="noam-visual-title";
    title.textContent=(focus&&focus.label)||spec.label||"השרטוט מתוך השאלה";
    card.appendChild(title);
    var image=documentRef.createElement("img");
    image.className="noam-question-visual-image";
    image.alt=spec.label||"השרטוט מתוך השאלה";
    image.setAttribute("data-exercise-id",String(spec.exerciseId||""));
    if(focus){
      renderQuestionFocus(documentRef,card,image,spec,focus);
    }else{
      card.appendChild(image);
    }
    if(spec.src){image.src=spec.src;}else{image.hidden=true;}
    return card;
  }

  function renderLabeledTriangle(documentRef,spec){
    var vertices=Array.isArray(spec.vertices)?spec.vertices.slice(0,3):[];
    if(vertices.length!==3||new Set(vertices).size!==3){return null;}
    var card=documentRef.createElement("figure");
    card.className="noam-visual-card noam-triangle-visual";
    card.setAttribute("dir","rtl");
    var title=documentRef.createElement("figcaption");
    title.className="noam-visual-title";
    title.textContent="המשולש לבדו";
    card.appendChild(title);
    var svg=svgElement(documentRef,"svg",{
      class:"noam-visual-svg",viewBox:"0 0 360 220",role:"img",
      "aria-label":describe(spec),preserveAspectRatio:"xMidYMid meet"
    });
    svg.appendChild(svgElement(documentRef,"title",{},describe(spec)));
    var coordinates=[{x:180,y:26},{x:48,y:182},{x:312,y:182}];
    var points={};
    vertices.forEach(function(letter,index){points[letter]=coordinates[index];});
    svg.appendChild(svgElement(documentRef,"path",{
      class:"noam-visual-triangle",d:"M180 26 L48 182 L312 182 Z"
    }));
    (spec.angles||[]).forEach(function(angle){
      var path=triangleAnglePath(points,angle);
      if(path){svg.appendChild(svgElement(documentRef,"path",{class:"noam-visual-angle",d:path}));}
    });
    vertices.forEach(function(letter,index){
      var point=coordinates[index];
      var dx=index===0?0:(index===1?-16:16);
      var dy=index===0?-9:20;
      svg.appendChild(svgElement(documentRef,"circle",{class:"noam-visual-vertex",cx:point.x,cy:point.y,r:3.5}));
      svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-vertex-label",x:point.x+dx,y:point.y+dy},letter));
    });
    card.appendChild(svg);
    if((spec.angles||[]).length){
      var note=documentRef.createElement("p");
      note.className="noam-visual-note";
      note.textContent=(spec.angles||[]).map(function(angle){return "ב־∠"+angle+" הקודקוד הוא "+angle.charAt(1);}).join(" · ");
      card.appendChild(note);
    }
    return card;
  }

  function render(documentRef,spec){
    if(!documentRef||!spec){return null;}
    if(spec.type==="question-image"){return renderQuestionImage(documentRef,spec);}
    if(spec.type==="labeled-triangle"){return renderLabeledTriangle(documentRef,spec);}
    if(spec.type!=="factored-quadratic-inequality"){return null;}
    var left=Number(spec.roots[0]),right=Number(spec.roots[1]);
    if(!Number.isFinite(left)||!Number.isFinite(right)||left>=right){return null;}

    var card=documentRef.createElement("figure");
    card.className="noam-visual-card";
    card.setAttribute("dir","rtl");
    var title=documentRef.createElement("figcaption");
    title.className="noam-visual-title";
    title.textContent="שרטוט להמחשה";
    card.appendChild(title);

    var svg=svgElement(documentRef,"svg",{
      class:"noam-visual-svg",viewBox:"0 0 360 220",role:"img",
      "aria-label":describe(spec),preserveAspectRatio:"xMidYMid meet"
    });
    svg.appendChild(svgElement(documentRef,"title",{},describe(spec)));

    var gap=right-left;
    var margin=Math.max(1.5,gap*.48);
    var xmin=left-margin,xmax=right+margin;
    var plot={x:24,y:18,w:312,h:128};
    function px(x){return plot.x+(x-xmin)/(xmax-xmin)*plot.w;}
    function value(x){return (x-left)*(x-right);}
    var samples=[];
    var minY=0,maxY=0;
    for(var i=0;i<=96;i++){
      var x=xmin+(xmax-xmin)*i/96;
      var y=value(x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      samples.push({x:x,y:y});
    }
    var yPad=Math.max(1,(maxY-minY)*.08);
    minY-=yPad;maxY+=yPad;
    function py(y){return plot.y+(maxY-y)/(maxY-minY)*plot.h;}
    var axisY=py(0);

    svg.appendChild(svgElement(documentRef,"line",{class:"noam-visual-axis",x1:plot.x,y1:axisY,x2:plot.x+plot.w,y2:axisY}));
    svg.appendChild(svgElement(documentRef,"line",{class:"noam-visual-axis noam-visual-y-axis",x1:px(0),y1:plot.y,x2:px(0),y2:plot.y+plot.h}));
    svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-axis-label",x:plot.x+plot.w-2,y:axisY-7},"x"));

    function pathFor(points){
      return points.map(function(point,index){return (index?"L":"M")+px(point.x).toFixed(2)+" "+py(point.y).toFixed(2);}).join(" ");
    }
    svg.appendChild(svgElement(documentRef,"path",{class:"noam-visual-curve-muted",d:pathFor(samples)}));
    var active=[];
    function flushActive(){
      if(active.length>1){svg.appendChild(svgElement(documentRef,"path",{class:"noam-visual-curve-active",d:pathFor(active)}));}
      active=[];
    }
    samples.forEach(function(point){
      if(conditionHolds(spec.relation,point.y)){active.push(point);}else{flushActive();}
    });
    flushActive();

    var inclusive=spec.relation==="≥"||spec.relation==="≤";
    [left,right].forEach(function(root){
      svg.appendChild(svgElement(documentRef,"line",{class:"noam-visual-root-guide",x1:px(root),y1:axisY-6,x2:px(root),y2:170}));
      svg.appendChild(svgElement(documentRef,"circle",{class:"noam-visual-root",cx:px(root),cy:axisY,r:4.5}));
      svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-number",x:px(root),y:axisY+19},formatNumber(root)));
    });

    var lineY=184;
    svg.appendChild(svgElement(documentRef,"line",{class:"noam-visual-number-line",x1:plot.x,y1:lineY,x2:plot.x+plot.w,y2:lineY}));
    svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-arrow",x:plot.x-1,y:lineY+5},"←"));
    svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-arrow",x:plot.x+plot.w+1,y:lineY+5},"→"));
    var outside=spec.relation==="≥"||spec.relation===">";
    var segments=outside?[[plot.x,px(left)],[px(right),plot.x+plot.w]]:[[px(left),px(right)]];
    segments.forEach(function(segment){
      svg.appendChild(svgElement(documentRef,"line",{class:"noam-visual-solution",x1:segment[0],y1:lineY,x2:segment[1],y2:lineY}));
    });
    [left,right].forEach(function(root){
      svg.appendChild(svgElement(documentRef,"circle",{
        class:"noam-visual-endpoint"+(inclusive?" is-closed":" is-open"),cx:px(root),cy:lineY,r:5
      }));
      svg.appendChild(svgElement(documentRef,"text",{class:"noam-visual-number",x:px(root),y:207},formatNumber(root)));
    });

    card.appendChild(svg);
    var note=documentRef.createElement("p");
    note.className="noam-visual-note";
    note.textContent="החלקים המודגשים מקיימים את סימן האי־שוויון. כתבו אותם כתחומים.";
    card.appendChild(note);
    var steps=documentRef.createElement("details");
    steps.className="noam-visual-steps";
    var stepsSummary=documentRef.createElement("summary");
    stepsSummary.textContent="מה עושים קודם?";
    steps.appendChild(stepsSummary);
    var stepsList=documentRef.createElement("ol");
    [
      "מוצאים את נקודות האפס: משווים כל גורם לאפס.",
      "מסמנים את נקודות האפס על ציר x.",
      "בודקים באילו תחומים הגרף מתאים לסימן שבשאלה.",
      "בודקים אם הסימן כולל שוויון, ורק אז כותבים את התחומים."
    ].forEach(function(step){
      var item=documentRef.createElement("li");
      item.textContent=step;
      stepsList.appendChild(item);
    });
    steps.appendChild(stepsList);
    card.appendChild(steps);
    var followUp=documentRef.createElement("button");
    followUp.type="button";
    followUp.className="noam-visual-question";
    followUp.setAttribute("data-noam-suggested-question","לא הבנתי: למה מציירים כאן פרבולה כדי לפתור את האי־שוויון?");
    followUp.textContent="לא הבנתי: למה מציירים כאן פרבולה?";
    card.appendChild(followUp);
    return card;
  }

  return {
    wantsDrawing:wantsDrawing,
    wantsVisualSupport:wantsVisualSupport,
    parseLabeledTriangle:parseLabeledTriangle,
    parseFactoredQuadraticInequality:parseFactoredQuadraticInequality,
    normalizeQuestionFocus:normalizeQuestionFocus,
    focusAngleGeometry:focusAngleGeometry,
    assistantText:assistantText,
    describe:describe,
    render:render
  };
});
