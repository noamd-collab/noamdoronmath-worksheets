(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamGeometry=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  var SVG_NS="http://www.w3.org/2000/svg";
  var COLORS={blue:"#2563eb",orange:"#c45b16",teal:"#008779",pink:"#be3c86"};
  var NAME=/^[A-Za-z][A-Za-z0-9]{0,3}$/;
  var EPS=1e-7;
  var CSS=".noam-geometry{box-sizing:border-box;max-width:100%;margin:10px 0;padding:12px;border:1px solid #d6e2ed;border-radius:14px;background:#fff;color:#172440;text-align:right;overflow:hidden}.noam-geometry .noam-geometry-title{margin:0 0 4px;font-size:15px;font-weight:700;line-height:1.45}.noam-geometry .noam-geometry-svg{display:block;width:100%;height:auto;max-height:240px;overflow:visible;background:#fff}.noam-geometry .noam-geometry-caption{margin:5px 0 0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.noam-geometry .noam-geometry-equations{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;margin-top:6px;font-size:14px;line-height:1.5}.noam-geometry .noam-geometry-equation{unicode-bidi:isolate;white-space:pre-wrap;overflow-wrap:anywhere}.noam-geometry .noam-geometry-label,.noam-geometry .noam-geometry-angle-label,.noam-geometry .noam-geometry-length-label{font-family:Arial,sans-serif;font-weight:600;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round;direction:ltr;unicode-bidi:isolate}.noam-geometry .noam-geometry-label{font-size:14px;fill:#172440}.noam-geometry .noam-geometry-angle-label,.noam-geometry .noam-geometry-length-label{font-size:12px}";

  CSS+=".noam-geometry .noam-geometry-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:5px 14px;margin:6px 0;padding:0;list-style:none;font:600 13px/1.5 Arial,sans-serif;direction:ltr;unicode-bidi:isolate}.noam-geometry .noam-geometry-legend-item{display:flex;align-items:center;gap:5px}.noam-geometry .noam-geometry-legend-swatch{display:inline-block;width:15px;height:3px;border-radius:2px}";

  function fail(message){throw new Error(message);}
  function finite(value){return typeof value==="number"&&Number.isFinite(value)&&Math.abs(value)<=1e6;}
  function coordinate(value){return Array.isArray(value)&&value.length===2&&value.every(finite);}
  function positive(value){if(!finite(value)||value<=0){fail("A dimension must be a positive finite number");}return value;}
  function point(points,name){if(!points||!NAME.test(name)||!Object.prototype.hasOwnProperty.call(points,name)||!coordinate(points[name])){fail("Unknown or invalid point");}return points[name];}
  function newPoint(points,name,value){if(!NAME.test(name)||Object.prototype.hasOwnProperty.call(points,name)||!coordinate(value)){fail("Invalid or duplicate point name");}points[name]=value;return value;}
  function distance(a,b){return Math.hypot(b[0]-a[0],b[1]-a[1]);}
  function rotate(points,degrees,center){
    if(!finite(degrees)){fail("Invalid rotation");}
    var a=(degrees%360)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    Object.keys(points).forEach(function(name){var p=points[name],x=p[0]-center[0],y=p[1]-center[1];points[name]=[center[0]+x*c-y*s,center[1]+x*s+y*c];});
    return points;
  }
  function rectangle(options){
    options=options||{};
    var w=positive(options.w),h=positive(options.h),center=[w/2,h/2];
    return rotate({A:[0,0],B:[w,0],C:[w,h],D:[0,h],O:center.slice()},options.rotation===undefined?0:options.rotation,center);
  }
  function rhombus(options){
    options=options||{};
    var a=positive(options.diagonalAC)/2,b=positive(options.diagonalBD)/2;
    return rotate({A:[-a,0],B:[0,b],C:[a,0],D:[0,-b],O:[0,0]},options.rotation===undefined?0:options.rotation,[0,0]);
  }
  function pointOn(points,from,to,t,name){
    var a=point(points,from),b=point(points,to);
    if(!finite(t)||t<0||t>1||distance(a,b)<EPS){fail("Invalid point-on-segment construction");}
    return newPoint(points,name,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  function footToLine(points,from,lineA,lineB,name){
    var p=point(points,from),a=point(points,lineA),b=point(points,lineB),x=b[0]-a[0],y=b[1]-a[1],norm=x*x+y*y;
    if(norm<EPS*EPS){fail("A line requires distinct points");}
    var t=((p[0]-a[0])*x+(p[1]-a[1])*y)/norm;
    return newPoint(points,name,[a[0]+t*x,a[1]+t*y]);
  }
  function text(value,limit){if(value===undefined){return "";}if(typeof value!=="string"||value.length>limit){fail("Invalid text");}return value;}
  function array(value,limit){if(value===undefined){return [];}if(!Array.isArray(value)||value.length>limit){fail("Too many drawing elements");}return value;}
  function color(value){if(value===undefined){return COLORS.blue;}if(!Object.prototype.hasOwnProperty.call(COLORS,value)){fail("Invalid color");}return COLORS[value];}
  function pair(points,value){if(!Array.isArray(value)||value.length!==2){fail("Invalid segment");}var a=point(points,value[0]),b=point(points,value[1]);if(distance(a,b)<EPS){fail("Degenerate segment");}return value.slice();}
  function angle(points,from,vertex,to){
    var a=point(points,from),v=point(points,vertex),b=point(points,to),u=[a[0]-v[0],a[1]-v[1]],w=[b[0]-v[0],b[1]-v[1]],nu=Math.hypot(u[0],u[1]),nw=Math.hypot(w[0],w[1]);
    if(nu<EPS||nw<EPS){fail("An angle requires two distinct rays");}
    var cosine=(u[0]*w[0]+u[1]*w[1])/(nu*nw),radians=Math.acos(Math.max(-1,Math.min(1,cosine)));
    if(radians<EPS||Math.PI-radians<EPS){fail("A marked angle must have a nonzero interior");}
    return {from:from,vertex:vertex,to:to,radians:radians,cosine:cosine};
  }
  function validate(scene){
    if(!scene||scene.type!=="geometry-scene"||!scene.points||typeof scene.points!=="object"||Array.isArray(scene.points)){fail("Invalid scene");}
    var names=Object.keys(scene.points),points={};
    if(names.length<3||names.length>32){fail("Invalid point count");}
    names.forEach(function(name){if(!NAME.test(name)){fail("Invalid point name");}points[name]=point(scene.points,name).slice();});
    var valid={points:points,names:names,title:text(scene.title,120),caption:text(scene.caption,320)};
    valid.segments=array(scene.segments,64).map(function(item){return pair(points,item);});
    if(!valid.segments.length){fail("A scene needs segments");}
    var raySeen={};
    valid.rays=array(scene.rays,16).map(function(item){
      var ends=pair(points,item),name=ends.join("");
      if(raySeen[name]||!valid.segments.some(function(segment){return segment[0]===ends[0]&&segment[1]===ends[1]||segment[0]===ends[1]&&segment[1]===ends[0];})){fail("Invalid or undrawn ray");}
      raySeen[name]=true;return ends;
    });
    valid.highlights=array(scene.highlights,24).map(function(item){if(!item||typeof item!=="object"){fail("Invalid highlight");}return {ends:pair(points,[item.from,item.to]),color:color(item.color),label:text(item.label,32)};});
    var pointHighlightsSeen={};
    valid.pointHighlights=array(scene.pointHighlights,8).map(function(item){
      if(!item||typeof item!=="object"||pointHighlightsSeen[item.point]){fail("Invalid point highlight");}
      point(points,item.point);pointHighlightsSeen[item.point]=true;
      return {point:item.point,color:color(item.color)};
    });
    var equalityLengths={};
    valid.equalGroups=array(scene.equalGroups,8).map(function(group){
      if(!group||[1,2,3].indexOf(group.count)<0){fail("Invalid equality marks");}
      var segments=array(group.segments,12).map(function(item){return pair(points,item);});
      if(segments.length<2){fail("Equality needs at least two segments");}
      var length=distance(points[segments[0][0]],points[segments[0][1]]);
      if(equalityLengths[group.count]!==undefined&&Math.abs(equalityLengths[group.count]-length)>Math.max(length,equalityLengths[group.count])*1e-6){fail("Same equality marks cannot claim different lengths");}
      equalityLengths[group.count]=length;
      segments.forEach(function(ends){if(Math.abs(distance(points[ends[0]],points[ends[1]])-length)>length*1e-6){fail("Equality claim contradicts coordinates");}});
      return {segments:segments,count:group.count,color:color(group.color)};
    });
    valid.rightAngles=array(scene.rightAngles,16).map(function(item){if(!Array.isArray(item)||item.length!==3){fail("Invalid right angle");}var a=angle(points,item[0],item[1],item[2]);if(Math.abs(a.cosine)>1e-6){fail("Right-angle claim contradicts coordinates");}return a;});
    valid.angles=array(scene.angles,16).map(function(item){
      if(!item||typeof item!=="object"){fail("Invalid angle");}
      var a=angle(points,item.from,item.vertex,item.to);a.label=text(item.label,24);
      var numeric=a.label.match(/^\s*(\d+(?:\.\d+)?)\s*°\s*$/);
      if(numeric&&Math.abs(Number(numeric[1])-a.radians*180/Math.PI)>.51){fail("Angle value contradicts coordinates");}
      var named=a.label.match(/^\s*∠?([A-Za-z])([A-Za-z])([A-Za-z])\s*$/);
      if(named&&(named[2]!==a.vertex||!((named[1]===a.from&&named[3]===a.to)||(named[1]===a.to&&named[3]===a.from)))){fail("Angle label names different rays or vertex");}
      return a;
    });
    valid.equations=array(scene.equations,8).map(function(value){return text(value,160);});
    return valid;
  }
  function svgElement(doc,name,attributes,content){var node=doc.createElementNS(SVG_NS,name);Object.keys(attributes||{}).forEach(function(key){node.setAttribute(key,String(attributes[key]));});if(content!==undefined){node.textContent=content;}return node;}
  function html(doc,name,className,content){var node=doc.createElement(name);node.className=className;if(content!==undefined){node.textContent=content;}return node;}
  function render(doc,scene){
    try{
      if(!doc||typeof doc.createElement!=="function"||typeof doc.createElementNS!=="function"){return null;}
      var data=validate(scene),points=data.points,xs=data.names.map(function(n){return points[n][0];}),ys=data.names.map(function(n){return points[n][1];});
      var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys),width=maxX-minX,height=maxY-minY;
      if(width<EPS||height<EPS){return null;}
      var scale=Math.min(248/width,162/height),centerX=(maxX+minX)/2,centerY=(maxY+minY)/2;
      function screen(name){var p=points[name];return [160+(p[0]-centerX)*scale,112-(p[1]-centerY)*scale];}
      function screenRay(ends){
        var a=screen(ends[0]),b=screen(ends[1]),dx=b[0]-a[0],dy=b[1]-a[1],size=Math.hypot(dx,dy),ux=dx/size,uy=dy/size;
        // Points already occupy x=36..284 and y=31..193. A 17px extension
        // leaves room for a visible arrowhead inside the 320x224 viewBox.
        var tip=[b[0]+ux*17,b[1]+uy*17];
        return {from:a,tip:tip,left:[tip[0]-ux*7-uy*4,tip[1]-uy*7+ux*4],right:[tip[0]-ux*7+uy*4,tip[1]-uy*7-ux*4]};
      }
      var card=html(doc,"figure","noam-geometry");card.setAttribute("dir","rtl");
      var style=html(doc,"style","noam-geometry-style",CSS);card.appendChild(style);
      if(data.title){card.appendChild(html(doc,"figcaption","noam-geometry-title",data.title));}
      var svg=svgElement(doc,"svg",{viewBox:"0 0 320 224",preserveAspectRatio:"xMidYMid meet",role:"img","aria-label":data.title||"שרטוט גאומטרי","class":"noam-geometry-svg"});
      svg.appendChild(svgElement(doc,"title",{},data.title||"שרטוט גאומטרי"));
      // Reserve conservative text bounds, including the white halo. All label
      // types share these reservations, so a later vertex cannot cover an
      // earlier segment or angle label (particularly O beside EO and OF).
      var angleLegend=[],labelBoxes=[],pointBoxes=data.names.map(function(name){var p=screen(name),r=data.pointHighlights.some(function(item){return item.point===name;})?10:4;return [p[0]-r,p[1]-r,p[0]+r,p[1]+r];});
      var markBoxes=data.rightAngles.map(function(item){
        var r=screenRays(item),s=Math.min(11,r.size*.22),a=[r.v[0]+r.u[0]*s,r.v[1]+r.u[1]*s],b=[a[0]+r.w[0]*s,a[1]+r.w[1]*s],c=[r.v[0]+r.w[0]*s,r.v[1]+r.w[1]*s];
        return [Math.min(a[0],b[0],c[0])-3,Math.min(a[1],b[1],c[1])-3,Math.max(a[0],b[0],c[0])+3,Math.max(a[1],b[1],c[1])+3];
      });
      data.rays.forEach(function(ends){var r=screenRay(ends);markBoxes.push([Math.min(r.tip[0],r.left[0],r.right[0])-3,Math.min(r.tip[1],r.left[1],r.right[1])-3,Math.max(r.tip[0],r.left[0],r.right[0])+3,Math.max(r.tip[1],r.left[1],r.right[1])+3]);});
      function overlaps(a,b){return a[0]<b[2]+2&&a[2]>b[0]-2&&a[1]<b[3]+2&&a[3]>b[1]-2;}
      function label(value,anchor,preferred,size,attributes,alternatives,interiorLimit,allowLegend){
        var units=Array.from(value).reduce(function(sum,c){return sum+(/[MW@]/.test(c)?1.08:/[ilI1.,:°]/.test(c)?.52:.85);},0);
        var halfWidth=(units*size+6)/2,halfHeight=(size*1.35+4)/2;
        var dx=preferred[0]-anchor[0],dy=preferred[1]-anchor[1],radius=Math.max(14,Math.hypot(dx,dy)),direction=Math.atan2(dy,dx);
        var candidates=[preferred].concat(alternatives||[]),turns=[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,3*Math.PI/4,-3*Math.PI/4,Math.PI];
        if(interiorLimit!==undefined){
          // An angle's label must remain in its own sector. Move outward only
          // along the interior bisector; a generic radial search could put it
          // on the opposite side of a ray and name a different angle.
          for(var r=radius+7;r<=Math.max(radius,interiorLimit);r+=7){candidates.push([anchor[0]+Math.cos(direction)*r,anchor[1]+Math.sin(direction)*r]);}
        }else{
          [radius,radius+7,radius+14,radius+21].forEach(function(r){turns.forEach(function(turn){candidates.push([anchor[0]+Math.cos(direction+turn)*r,anchor[1]+Math.sin(direction+turn)*r]);});});
        }
        var chosen=null,bounds=null;
        for(var i=0;i<candidates.length;i++){
          var p=candidates[i],box=[p[0]-halfWidth,p[1]-halfHeight,p[0]+halfWidth,p[1]+halfHeight];
          if(box[0]<3||box[1]<3||box[2]>317||box[3]>221){continue;}
          if(labelBoxes.some(function(other){return overlaps(box,other);})||pointBoxes.some(function(other){return overlaps(box,other);})||markBoxes.some(function(other){return overlaps(box,other);})){continue;}
          chosen=p;bounds=box;break;
        }
        if(!chosen){if(allowLegend){return false;}fail("No legible label placement");}
        labelBoxes.push(bounds);
        var attrs={x:chosen[0],y:chosen[1],"text-anchor":"middle","dominant-baseline":"central"};
        Object.keys(attributes||{}).forEach(function(key){attrs[key]=attributes[key];});
        svg.appendChild(svgElement(doc,"text",attrs,value));
        return true;
      }
      function line(a,b,attributes){var attrs={x1:a[0],y1:a[1],x2:b[0],y2:b[1],fill:"none","stroke-linecap":"round"};Object.keys(attributes||{}).forEach(function(k){attrs[k]=attributes[k];});var node=svgElement(doc,"line",attrs);svg.appendChild(node);return node;}
      data.segments.forEach(function(ends){line(screen(ends[0]),screen(ends[1]),{stroke:"#172440","stroke-width":1.8,"class":"noam-geometry-segment"});});
      var pendingSegmentLabels=[];
      data.highlights.forEach(function(item){
        var a=screen(item.ends[0]),b=screen(item.ends[1]);line(a,b,{stroke:item.color,"stroke-width":4,opacity:.85,"class":"noam-geometry-highlight"});
        if(item.label){
          var dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],alternatives=[];
          [.35,.65,.25,.75].forEach(function(t){[15,-15,22,-22].forEach(function(offset){alternatives.push([a[0]+dx*t-dy/n*offset,a[1]+dy*t+dx/n*offset]);});});
          pendingSegmentLabels.push(function(){label(item.label,mid,[mid[0]-dy/n*15,mid[1]+dx/n*15],12,{fill:item.color,"class":"noam-geometry-length-label"},alternatives);});
        }
      });
      data.rays.forEach(function(ends){
        var r=screenRay(ends),highlight=data.highlights.find(function(item){return item.ends[0]===ends[0]&&item.ends[1]===ends[1]||item.ends[0]===ends[1]&&item.ends[1]===ends[0];}),shade=highlight?highlight.color:"#172440";
        line(r.from,r.tip,{stroke:shade,"stroke-width":highlight?4:1.8,opacity:highlight ? .85 : 1,"class":"noam-geometry-ray","data-ray":ends.join("")});
        svg.appendChild(svgElement(doc,"path",{d:"M"+r.left.join(" ")+" L"+r.tip.join(" ")+" L"+r.right.join(" "),fill:"none",stroke:shade,"stroke-width":highlight?2.5:1.8,"stroke-linecap":"round","stroke-linejoin":"round","class":"noam-geometry-ray-arrow","data-ray":ends.join(""),"aria-label":"קרן "+ends.join("")}));
      });
      data.equalGroups.forEach(function(group){group.segments.forEach(function(ends){
        var a=screen(ends[0]),b=screen(ends[1]),dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),ux=dx/n,uy=dy/n;
        for(var i=0;i<group.count;i++){var shift=(i-(group.count-1)/2)*5,cx=(a[0]+b[0])/2+ux*shift,cy=(a[1]+b[1])/2+uy*shift;line([cx-uy*5,cy+ux*5],[cx+uy*5,cy-ux*5],{stroke:group.color,"stroke-width":2,"class":"noam-geometry-equality-mark"});}
      });});
      function screenRays(item){var a=screen(item.from),v=screen(item.vertex),b=screen(item.to),u=[a[0]-v[0],a[1]-v[1]],w=[b[0]-v[0],b[1]-v[1]],nu=Math.hypot(u[0],u[1]),nw=Math.hypot(w[0],w[1]);return {v:v,u:[u[0]/nu,u[1]/nu],w:[w[0]/nw,w[1]/nw],size:Math.min(nu,nw)};}
      data.rightAngles.forEach(function(item){var r=screenRays(item),s=Math.min(11,r.size*.22),a=[r.v[0]+r.u[0]*s,r.v[1]+r.u[1]*s],b=[a[0]+r.w[0]*s,a[1]+r.w[1]*s],c=[r.v[0]+r.w[0]*s,r.v[1]+r.w[1]*s];svg.appendChild(svgElement(doc,"path",{d:"M"+a.join(" ")+" L"+b.join(" ")+" L"+c.join(" "),fill:"none",stroke:COLORS.teal,"stroke-width":1.6,"class":"noam-geometry-right-angle"}));});
      data.angles.forEach(function(item,index){
        var r=screenRays(item),radius=Math.min(23,r.size*.29),a=[r.v[0]+r.u[0]*radius,r.v[1]+r.u[1]*radius],b=[r.v[0]+r.w[0]*radius,r.v[1]+r.w[1]*radius],cross=r.u[0]*r.w[1]-r.u[1]*r.w[0],shade=[COLORS.orange,COLORS.blue,COLORS.teal,COLORS.pink][index%4];
        var angleName=item.from+item.vertex+item.to;
        svg.appendChild(svgElement(doc,"path",{d:"M"+a.join(" ")+" A"+radius+" "+radius+" 0 0 "+(cross>0?1:0)+" "+b.join(" "),fill:"none",stroke:shade,"stroke-width":2.2,"class":"noam-geometry-angle","data-angle-vertex":item.vertex,"data-angle-name":angleName,"aria-label":"זווית "+angleName+(item.label?": "+item.label:"")}));
        if(item.label){
          var bx=r.u[0]+r.w[0],by=r.u[1]+r.w[1],bn=Math.hypot(bx,by),offset=radius+12;
          if(!label(item.label,r.v,[r.v[0]+bx/bn*offset,r.v[1]+by/bn*offset],12,{fill:shade,"class":"noam-geometry-angle-label"},[],r.size*.88,true)){
            // A crowded angle must not discard the whole valid drawing or
            // move a label across its rays. Preserve its name/value in a
            // color-matched legend and leave the arc at the correct vertex.
            var isNamed=/^\s*∠?[A-Za-z]{3}\s*$/.test(item.label);
            angleLegend.push({label:isNamed?item.label:"∠"+angleName+" = "+item.label,color:shade});
          }
        }
      });
      // Angle labels have the strictest placement (inside their own sector).
      // Give them priority before placing the more flexible segment labels.
      pendingSegmentLabels.forEach(function(draw){draw();});
      data.pointHighlights.forEach(function(item){
        var p=screen(item.point);
        svg.appendChild(svgElement(doc,"circle",{cx:p[0],cy:p[1],r:7,fill:"#fff",stroke:item.color,"stroke-width":2.5,"class":"noam-geometry-point-highlight","data-point":item.point}));
      });
      data.names.forEach(function(name){
        var p=screen(name),dx=p[0]-160,dy=p[1]-112,n=Math.hypot(dx,dy),offset=n<5?[10,14]:[dx/n*13,dy/n*13];
        var highlight=data.pointHighlights.find(function(item){return item.point===name;});
        svg.appendChild(svgElement(doc,"circle",{cx:p[0],cy:p[1],r:highlight?3:2.4,fill:highlight?highlight.color:"#172440","class":"noam-geometry-point"}));
        label(name,p,[p[0]+offset[0],p[1]+offset[1]],14,{"class":"noam-geometry-label"});
      });
      card.appendChild(svg);
      if(angleLegend.length){
        var legend=html(doc,"ul","noam-geometry-legend");legend.setAttribute("aria-label","סימוני הזוויות בשרטוט");
        angleLegend.forEach(function(item){var entry=html(doc,"li","noam-geometry-legend-item"),swatch=html(doc,"span","noam-geometry-legend-swatch");swatch.setAttribute("style","background-color:"+item.color);swatch.setAttribute("aria-hidden","true");entry.appendChild(swatch);entry.appendChild(html(doc,"span","noam-geometry-legend-label",item.label));legend.appendChild(entry);});
        card.appendChild(legend);
      }
      if(data.caption){card.appendChild(html(doc,"p","noam-geometry-caption",data.caption));}
      if(data.equations.length){var equations=html(doc,"div","noam-geometry-equations");data.equations.forEach(function(value){var equation=html(doc,"span","noam-geometry-equation",value);equation.setAttribute("dir","auto");equations.appendChild(equation);});card.appendChild(equations);}
      return card;
    }catch(error){return null;}
  }

  return {rectangle:rectangle,rhombus:rhombus,pointOn:pointOn,footToLine:footToLine,render:render};
});
