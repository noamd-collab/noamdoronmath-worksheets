"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Geometry=require("../noam-geometry.js");

function documentStub(){
  function create(name){return {name,attributes:{},children:[],className:"",textContent:"",appendChild(node){this.children.push(node);return node;},setAttribute(key,value){this.attributes[key]=String(value);if(key==="class"){this.className=String(value);}}};}
  return {createElement:create,createElementNS(_ns,name){return create(name);}};
}
function nodes(node){return node?[node].concat((node.children||[]).flatMap(nodes)):[];}
function near(a,b,tolerance=1e-8){assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);}
function length(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function rectangleScene(){return {type:"geometry-scene",title:"מלבן",points:Geometry.rectangle({w:15,h:6}),segments:[["A","B"],["B","C"],["C","D"],["D","A"]]};}
function render(scene){return Geometry.render(documentStub(),scene);}

test("rectangles preserve given proportions and centre through rotation",()=>{
  for(const rotation of [0,37,90,215]){
    const points=Geometry.rectangle({w:15,h:6,rotation});
    near(length(points.A,points.B),15);near(length(points.B,points.C),6);
    near((points.A[0]+points.C[0])/2,points.O[0]);near((points.A[1]+points.C[1])/2,points.O[1]);
    near((points.B[0]-points.A[0])*(points.D[0]-points.A[0])+(points.B[1]-points.A[1])*(points.D[1]-points.A[1]),0);
  }
  assert.throws(()=>Geometry.rectangle({w:0,h:6}));
  assert.throws(()=>Geometry.rectangle({w:15,h:Infinity}));
  assert.throws(()=>Geometry.rectangle({w:15,h:6,rotation:"37"}));
});

test("rhombus diagonals give four equal sides with correct A/B/C/D placement",()=>{
  const p=Geometry.rhombus({diagonalAC:12,diagonalBD:8});
  assert.deepEqual(p,{A:[-6,0],B:[0,4],C:[6,0],D:[0,-4],O:[0,0]});
  const rotated=Geometry.rhombus({diagonalAC:12,diagonalBD:8,rotation:-27});
  near(length(rotated.A,rotated.C),12);near(length(rotated.B,rotated.D),8);
  for(const [a,b] of [["A","B"],["B","C"],["C","D"],["D","A"]]){near(length(rotated[a],rotated[b]),Math.sqrt(52));}
  assert.throws(()=>Geometry.rhombus({diagonalAC:-12,diagonalBD:8}));
});

test("pointOn and perpendicular foot compute in the same rotated frame",()=>{
  const p=Geometry.rectangle({w:16,h:12,rotation:37});
  const e=Geometry.pointOn(p,"D","C",.25,"E");
  near(length(p.D,e),4);near(length(e,p.C),12);assert.equal(p.E,e);
  const h=Geometry.footToLine(p,"B","A","C","H");
  near((p.B[0]-h[0])*(p.C[0]-p.A[0])+(p.B[1]-h[1])*(p.C[1]-p.A[1]),0);
  near(length(p.A,h),12.8);
  assert.throws(()=>Geometry.pointOn(p,"A","B",1.01,"F"));
  assert.throws(()=>Geometry.pointOn(p,"A","B",-.1,"F"));
  assert.throws(()=>Geometry.pointOn(p,"A","B",.5,"E"));
  assert.throws(()=>Geometry.footToLine(p,"A","B","B","J"));
  assert.throws(()=>Geometry.pointOn(p,"Z","B",.5,"F"));
});

test("the renderer produces a responsive true SVG preserving rectangle proportions",()=>{
  const card=render(rectangleScene()),all=nodes(card),svg=all.find(n=>n.name==="svg");
  assert.ok(card);assert.equal(card.attributes.dir,"rtl");
  assert.equal(svg.attributes.preserveAspectRatio,"xMidYMid meet");assert.equal(svg.attributes.viewBox,"0 0 320 224");
  const lines=all.filter(n=>n.className==="noam-geometry-segment");
  const renderedLength=n=>Math.hypot(Number(n.attributes.x2)-Number(n.attributes.x1),Number(n.attributes.y2)-Number(n.attributes.y1));
  near(renderedLength(lines[0])/renderedLength(lines[1]),2.5);
  for(const n of all.filter(n=>n.className==="noam-geometry-label")){assert.ok(Number(n.attributes.x)>0&&Number(n.attributes.x)<320);assert.ok(Number(n.attributes.y)>0&&Number(n.attributes.y)<224);}
  assert.match(all.find(n=>n.name==="style").textContent,/max-height:240px/);
});

test("equal ticks render only when all claimed segments have the same measured length",()=>{
  const valid=rectangleScene();valid.equalGroups=[{segments:[["A","B"],["C","D"]],count:1,color:"blue"},{segments:[["B","C"],["D","A"]],count:2,color:"orange"}];
  assert.equal(nodes(render(valid)).filter(n=>n.className==="noam-geometry-equality-mark").length,6);
  const falseEquality=rectangleScene();falseEquality.equalGroups=[{segments:[["A","B"],["B","C"]],count:1}];assert.equal(render(falseEquality),null);
  valid.equalGroups[1].count=1;assert.equal(render(valid),null,"Identical tick counts must not denote two different lengths");
  valid.equalGroups[1].count=4;assert.equal(render(valid),null);
});

test("right angle checks the middle point as vertex and verifies the perpendicular rays",()=>{
  const valid=rectangleScene();valid.points=Geometry.rectangle({w:15,h:6,rotation:37});valid.rightAngles=[["B","A","D"]];
  assert.equal(nodes(render(valid)).filter(n=>n.className==="noam-geometry-right-angle").length,1);
  valid.rightAngles=[["A","B","D"]];assert.equal(render(valid),null);
  valid.rightAngles=[["A","A","D"]];assert.equal(render(valid),null);
});

test("angle names and degree claims are checked against their actual vertex and rays",()=>{
  const s=rectangleScene();s.angles=[{from:"B",vertex:"A",to:"D",label:"∠BAD"}];
  let arcs=nodes(render(s)).filter(n=>n.className==="noam-geometry-angle");assert.equal(arcs.length,1);assert.equal(arcs[0].attributes["data-angle-vertex"],"A");
  s.angles[0].label="∠DAB";assert.ok(render(s),"Ray order can be reversed");
  s.angles[0].label="∠ABD";assert.equal(render(s),null);
  s.angles[0].label="35°";assert.equal(render(s),null);
  s.angles[0].label="90°";assert.ok(render(s));
  s.angles[0].to="B";assert.equal(render(s),null);
});

test("two separated triangles keep both angle markings when their labels do not fit inside",()=>{
  const s={type:"geometry-scene",points:{A:[0,0],B:[3,0],C:[2,3],D:[20,2],E:[22,0],F:[23,4]},
    segments:[["A","B"],["B","C"],["C","A"],["D","E"],["E","F"],["F","D"]],
    highlights:[{from:"C",to:"A",color:"blue",label:"CA"},{from:"A",to:"B",color:"blue",label:"AB"},{from:"F",to:"D",color:"orange",label:"FD"},{from:"D",to:"E",color:"orange",label:"DE"}],
    angles:[{from:"C",vertex:"A",to:"B",label:"∠CAB"},{from:"F",vertex:"D",to:"E",label:"∠FDE"}]};
  const before=JSON.stringify(s),card=render(s),all=nodes(card);assert.ok(card,"valid two-triangle drawing must not disappear because a label is crowded");
  assert.equal(JSON.stringify(s),before,"layout does not rewrite coordinates or annotations");
  assert.equal(all.filter(n=>n.className==="noam-geometry-segment").length,6);
  assert.equal(all.filter(n=>n.className==="noam-geometry-highlight").length,4);
  assert.deepEqual(all.filter(n=>n.className==="noam-geometry-label").map(n=>n.textContent),["A","B","C","D","E","F"]);
  const arcs=all.filter(n=>n.className==="noam-geometry-angle");
  assert.deepEqual(arcs.map(n=>n.attributes["data-angle-vertex"]),["A","D"]);
  assert.deepEqual(arcs.map(n=>n.attributes["data-angle-name"]),["CAB","FDE"]);
  const legend=all.filter(n=>n.className==="noam-geometry-legend-item");assert.equal(legend.length,2);
  legend.forEach((item,i)=>{
    const label=item.children.find(n=>n.className==="noam-geometry-legend-label"),swatch=item.children.find(n=>n.className==="noam-geometry-legend-swatch");
    assert.equal(label.textContent,s.angles[i].label);assert.equal(swatch.attributes.style,"background-color:"+arcs[i].attributes.stroke);
  });
});

test("a crowded numeric angle retains its exact name and value in the legend",()=>{
  const s={type:"geometry-scene",points:{A:[0,0],B:[3,0],C:[3,3],D:[30,0],E:[33,0],F:[33,3]},
    segments:[["A","B"],["B","C"],["C","A"],["D","E"],["E","F"],["F","D"]],
    angles:[{from:"C",vertex:"A",to:"B",label:"45°"}]};
  const all=nodes(render(s));assert.ok(all.length);
  assert.equal(all.find(n=>n.className==="noam-geometry-legend-label").textContent,"∠CAB = 45°");
  assert.equal(all.find(n=>n.className==="noam-geometry-angle").attributes["data-angle-vertex"],"A");
  s.angles[0].label="48°";assert.equal(render(s),null,"a legend never bypasses mathematical validation");
});

test("highlights identify segments without implicitly marking equality",()=>{
  const s=rectangleScene();s.highlights=[{from:"A",to:"B",color:"blue"},{from:"B",to:"C",color:"blue"}];
  const all=nodes(render(s));assert.equal(all.filter(n=>n.className==="noam-geometry-highlight").length,2);assert.equal(all.filter(n=>n.className==="noam-geometry-equality-mark").length,0);
});

test("unknown references and unbounded or nonnumeric inputs fail closed",()=>{
  const cases=[
    s=>s.segments.push(["A","Z"]),s=>s.points.A=[NaN,0],s=>s.points.A=[1e7,0],s=>s.points.A=["1",0],
    s=>s.highlights=[{from:"A",to:"Z"}],s=>s.highlights=[{from:"A",to:"B",color:"url(evil)"}],
    s=>s.segments=Array.from({length:65},()=>["A","B"]),s=>s.angles=[{from:"B",vertex:"A",to:"Z"}],
    s=>s.title="a".repeat(121),s=>s.points["<x>"]=[2,4],s=>s.type="svg",s=>s.segments=[]
  ];
  for(const change of cases){const s=rectangleScene();change(s);assert.equal(render(s),null);}
  assert.equal(Geometry.render(null,rectangleScene()),null);
  assert.equal(render(null),null);
});

test("all user-visible strings remain text nodes and cannot inject HTML or SVG",()=>{
  const s=rectangleScene();s.title='<img src=x onerror="bad()">';s.caption="<script>bad()</script>";s.equations=['<svg onload="bad()">'];
  const all=nodes(render(s));assert.equal(all.filter(n=>n.name==="img"||n.name==="script").length,0);
  assert.equal(all.find(n=>n.className==="noam-geometry-title").textContent,s.title);
  assert.equal(all.find(n=>n.className==="noam-geometry-equation").textContent,s.equations[0]);
  assert.ok(all.every(n=>!Object.keys(n.attributes).some(key=>key.startsWith("on"))));
});

test("Q6 subtraction labels stay separate from O, other point names and segment labels at mobile size",()=>{
  for(const rotation of [-18,0,37,90]){
    const points=Geometry.rhombus({diagonalAC:12,diagonalBD:8,rotation});
    Geometry.pointOn(points,"A","C",.3,"E");Geometry.pointOn(points,"A","C",.7,"F");
    const scene={type:"geometry-scene",points,
      segments:[["A","B"],["B","C"],["C","D"],["D","A"],["A","C"],["B","D"],["B","E"],["E","D"],["D","F"],["F","B"]],
      highlights:["AE","CF","EO","OF"].map(name=>({from:name[0],to:name[1],color:name.includes("O")?"teal":"orange",label:name}))};
    const card=render(scene);assert.ok(card,`rotated scene ${rotation} renders`);
    const labels=nodes(card).filter(n=>n.name==="text");assert.equal(labels.length,11);
    // Conservative text rectangles include the visible white halo; checking
    // coordinates after scaling reproduces the narrow phone presentation.
    for(const viewportWidth of [280,320]){
      const scale=viewportWidth/320;
      const boxes=labels.map(n=>{
        const font=n.className==="noam-geometry-label"?14:12;
        const width=(n.textContent.length*font*.78+4)*scale,height=(font+4)*scale;
        const x=Number(n.attributes.x)*scale,y=Number(n.attributes.y)*scale;
        assert.equal(n.attributes["text-anchor"],"middle");assert.equal(n.attributes["dominant-baseline"],"central");
        return {name:n.textContent,l:x-width/2,r:x+width/2,t:y-height/2,b:y+height/2};
      });
      for(let i=0;i<boxes.length;i++){
        const a=boxes[i];assert.ok(a.l>=0&&a.r<=viewportWidth);
        for(let j=i+1;j<boxes.length;j++){
          const b=boxes[j],overlap=a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
          assert.equal(overlap,false,`${a.name}/${b.name} overlap at ${rotation}°, viewport ${viewportWidth}`);
        }
      }
    }
    assert.deepEqual(nodes(render(scene)).filter(n=>n.name==="text").map(n=>n.attributes),labels.map(n=>n.attributes),"placement is deterministic");
  }
});

test("crossing-diagonal labels avoid each other, O and the right-angle glyph",()=>{
  const points=Geometry.rhombus({diagonalAC:12,diagonalBD:8,rotation:-18});
  Geometry.pointOn(points,"A","C",.3,"E");Geometry.pointOn(points,"A","C",.7,"F");
  const card=render({type:"geometry-scene",points,
    segments:[["A","B"],["B","C"],["C","D"],["D","A"],["A","C"],["B","D"],["B","E"],["E","D"],["D","F"],["F","B"]],
    highlights:[{from:"B",to:"D",color:"blue",label:"BD"},{from:"E",to:"F",color:"orange",label:"EF"}],rightAngles:[["B","O","F"]]});
  assert.ok(card);
  const all=nodes(card),labels=all.filter(n=>n.name==="text");
  const boxes=labels.map(n=>{const f=n.className==="noam-geometry-label"?14:12,w=n.textContent.length*f*.78+4,h=f+4,x=+n.attributes.x,y=+n.attributes.y;return {name:n.textContent,l:x-w/2,r:x+w/2,t:y-h/2,b:y+h/2};});
  const glyph=all.find(n=>n.className==="noam-geometry-right-angle");
  const values=glyph.attributes.d.match(/-?\d+(?:\.\d+)?/g).map(Number),xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);
  boxes.push({name:"right angle",l:Math.min(...xs)-1,r:Math.max(...xs)+1,t:Math.min(...ys)-1,b:Math.max(...ys)+1});
  for(let i=0;i<boxes.length;i++){for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.equal(a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t,false,`${a.name} overlaps ${b.name}`);}}
});

test("Q4 angle labels remain inside their own sectors even beside a competing segment label",()=>{
  const guides=require("../noam-geometry-guides.js");
  const exercise={id:"G9-T15-E-Q04א",context:"במשולש △ABC, הנקודה D נמצאת על הצלע AC והנקודה E על הצלע AB. נתון: הקטע BD חוצה את ∡ABC, וכן BC ∥ DE."};
  for(const focusKey of ["q4a-bisector","q4a-alternate"]){
    const scene=guides.resolve(exercise,{focusKey}),card=render(scene);assert.ok(card,focusKey);
    const all=nodes(card),circles=all.filter(n=>n.className==="noam-geometry-point"),screenPoints={};
    Object.keys(scene.points).forEach((name,i)=>{screenPoints[name]=[+circles[i].attributes.cx,+circles[i].attributes.cy];});
    const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
    const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];
    for(const angle of scene.angles){
      const label=all.find(n=>n.className==="noam-geometry-angle-label"&&n.textContent===angle.label);assert.ok(label);
      const vertex=screenPoints[angle.vertex],u=subtract(screenPoints[angle.from],vertex),w=subtract(screenPoints[angle.to],vertex),v=subtract([+label.attributes.x,+label.attributes.y],vertex),sign=Math.sign(cross(u,w));
      assert.ok(sign*cross(u,v)>0,`${angle.label} must be past its first ray`);
      assert.ok(sign*cross(v,w)>0,`${angle.label} must be before its second ray`);
      const bisector=[u[0]/Math.hypot(...u)+w[0]/Math.hypot(...w),u[1]/Math.hypot(...u)+w[1]/Math.hypot(...w)];
      near(cross(v,bisector),0);
      assert.ok(v[0]*bisector[0]+v[1]*bisector[1]>0,"Label stays on the interior, not the opposite, bisector");
    }
  }
});
