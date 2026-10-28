(function(root,factory){'use strict';var api=factory(root||{});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NoamVisualPlan=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  var FAMILIES=['function','coordinates','numberline','given-geometry','operations','table','bar-chart'];
  var PROMPT_SCHEMA='For an opt-in typed illustration, return JSON {"version":2,"status":"ok","family":"function|coordinates|numberline|given-geometry|operations|table|bar-chart","evidence":[{"source":"question|part","quote":"EXACT contiguous text copied from the matching trusted authored text"}]}. '+
    'The two trusted authored texts and their tables are authoritative; image reading, hints and the user request are focus only, never evidence for newly given values. Choose a small meaningful illustration of CURRENT hint only. Keep evidence concise: quote the shortest complete authored declaration sufficient for the family, not whole paragraphs. '+
    'Do not calculate an answer, select unknown parameters, complete table cells, infer coordinates/lengths, repair a partition, or invent a new example/counterexample. No SVG, HTML, code, output captions, invented point names or model coordinates. '+
    'For function, quote complete explicitly given y= or f(x)= declarations; include every supplied function needed for the current comparison. Unknown parameters, implicit equations, unspecified natural/integer domains or requested transformed/previously-chosen functions are unsupported. '+
    'For coordinates, quote only explicitly written (x,y) tuples from the common stem or current part; do not construct missing vertices or label answers. '+
    'For numberline use only given points or a complete already-written atomic inequality, not a solution to an inequality. For given-geometry quote the complete stem defining the given shape/dimensions, preserving unknown dimensions. '+
    'For operations add "expression":"the complete authored equation or expression by default". Copy the complete authored mathematical span into the evidence quote, including both sides of an equation. A focused subtree is allowed only when that same ordered subtree occurs in the current hint; still quote the entire containing authored expression or equation as evidence. Preserve operation order and grouping; never simplify, rearrange, solve or evaluate. '+
    'For table or bar-chart add "tableSource":"question|part". All cells come from that trusted source table, never from model output. Use table for blank cells. Bar-chart requires a complete given 2-column table and must not invent frequencies. '+
    'If none is appropriate, return the existing version1 source-geometry focus contract if possible, or {"version":1,"status":"unsupported"}. Never return a decorative empty diagram.';
  function fail(reason){return {ok:false,scene:null,reason:reason};}
  function clean(t){return String(t||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/[−–—]/g,'-');}
  function exactKeys(o,allowed){return o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(function(k){return allowed.indexOf(k)>=0;});}
  function safe(value,depth){
    if(depth>7)return false;if(value===null||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string')return value.length<=12000;
    if(!value||typeof value!=='object'||Object.keys(value).length>50)return false;
    return Object.keys(value).every(function(k){var d=Object.getOwnPropertyDescriptor(value,k);return !/^(?:__proto__|constructor|prototype)$/.test(k)&&d&&!d.get&&!d.set&&safe(d.value,depth+1);});
  }
  function evidence(plan,context){
    if(!Array.isArray(plan.evidence)||plan.evidence.length<1||plan.evidence.length>8)return null;
    var quotes=[];
    for(var e of plan.evidence){
      if(!exactKeys(e,['source','quote'])||!['question','part'].includes(e.source)||typeof e.quote!=='string'||!e.quote.trim()||e.quote.length>5000)return null;
      var text=e.source==='question'?context.questionText:context.partText;
      if(typeof text!=='string'||text.indexOf(e.quote)<0)return null;
      quotes.push(e.quote);
    }
    return quotes;
  }
  function inspect(plan,context){
    try{
      if(!safe(plan,0)||!exactKeys(plan,['version','status','family','evidence','expression','tableSource'])||plan.version!==2||plan.status!=='ok'||FAMILIES.indexOf(plan.family)<0)return fail('invalid_typed_plan');
      if(!context||typeof context.questionText!=='string'||typeof context.partText!=='string')return fail('missing_authored_source');
      // Shared original panels require their complete source context and printed
      // roles. No current typed family carries a panel-aware source contract.
      // Presence also rejects malformed/empty metadata instead of silently
      // erasing group ownership and compiling a standalone primary-only scene.
      if('sourcePanels' in context)return fail('source_panel_context_only');
      var quotes=evidence(plan,context);if(!quotes)return fail('evidence_not_in_selected_source');
      if(plan.expression!==undefined&&plan.family!=='operations'||plan.tableSource!==undefined&&!['table','bar-chart'].includes(plan.family))return fail('unexpected_family_field');
      var all=clean(context.questionText+' '+context.partText),hint=String(context.hintText||''),student=String(context.studentMessage||''),a=root.NoamAuthoredVisual;
      if(/דוגמה\s+נגדית|הטענה\s+(?:אינה|לא)\s+נכונה\s+תמיד/.test(all))return fail('counterexample_requires_new_construction');
      if(['operations','table','bar-chart'].includes(plan.family))return root.NoamVisualData?root.NoamVisualData.inspect(plan,context):fail('typed_family_unavailable');
      if(!a)return fail('typed_compiler_missing');
      if(plan.family==='function'){
        if(a.restrictedFunctionDomain(context.questionText+' '+context.partText))return fail('explicit_function_domain_unsupported');
        if(/טבעי|מספרים שלמים|קלטים שלמים|כללים שבחרתם|פונקציות שבחרתם|(?:הזיזו|הזזה|מוזז|מוזזת|פרבולה חדשה)/.test(all))return fail('function_domain_or_construction_unspecified');
        var quoted=a.formulas(quotes.join('\n')),authored=a.formulas(context.questionText+'\n'+context.partText);
        if(quoted.invalid||authored.invalid||!quoted.length||quoted.length>4)return fail('incomplete_explicit_function');
        if(!a.functionSources||!a.functionSources(context))return fail('ambiguous_function_scope');
        var signature=function(f){return JSON.stringify(f.ast);},sig=quoted.map(signature);
        if(authored.length!==quoted.length||authored.some(function(f){return sig.indexOf(signature(f))<0;}))return fail('partial_function_set');
        return {ok:true,reason:null,scene:{kind:'authored-function',expressions:quoted.map(function(f){return {expression:f.expression,label:f.label};}),expression:quoted[0].expression,caption:'גרף של הנוסחאות שנכתבו במפורש. לא סומנו פתרונות או נקודות שהתבקשת למצוא.'}};
      }
      if(plan.family==='coordinates'){
        if(/קודקודים האחרים|נקודות נוספות|הנקודות שמצאתם|נקודה שבחרתם|הזזה|שיקוף|סיבוב/.test(clean(context.partText)))return fail('coordinates_require_construction');
        // Inspect every tuple in the cited set before deriving any point. The
        // legacy focus parser deliberately truncates; a new plot must not do so.
        var points=[],rawTuples=0,badTuple=false;
        quotes.forEach(function(q){
          var normalized=clean(q).replace(/\\(?:left|right)/g,'').replace(/\$/g,''),tuple,re=/\(([^()]*[,;][^()]*)\)/g;
          while((tuple=re.exec(normalized))){
            rawTuples++;
            var pair=tuple[1].match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
            if(!pair){badTuple=true;continue;}
            var p=[Number(pair[1]),Number(pair[2])];
            if(p.some(function(n){return !Number.isFinite(n)||Math.abs(n)>100;})){badTuple=true;continue;}
            if(!points.some(function(v){return v[0]===p[0]&&v[1]===p[1];}))points.push(p);
          }
        });
        if(badTuple||rawTuples>8)return fail('incomplete_coordinate_set');
        if(!points.length)return fail('no_explicit_coordinates');
        var labels=points.map(function(){return '';});
        var named=/(?:^|[^A-Za-z])([A-Z])\s*(?:=|:)?\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)\s*\)/g,m;
        while((m=named.exec(clean(quotes.join(' ')).replace(/\$/g,'')))){var ix=points.findIndex(function(p){return p[0]===Number(m[2])&&p[1]===Number(m[3]);});if(ix>=0){if(labels[ix]&&labels[ix]!==m[1])return fail('ambiguous_coordinate_label');labels[ix]=m[1];}}
        return {ok:true,reason:null,scene:{kind:'typed-coordinate-points',points:points,labels:labels,caption:'הנקודות שנכתבו במפורש בשאלה. לא נוספו קודקודים, חיבורים או משוואה.'}};
      }
      var opts={studentMessage:'אפשר רמז 1?',helpKind:'hint',answer:hint,drawCurrentStep:true};
      var scene=a.fromContext(context,opts);
      var quotedContext=Object.assign({},context,{questionText:plan.evidence.filter(function(e){return e.source==='question';}).map(function(e){return e.quote;}).join('\n'),partText:plan.evidence.filter(function(e){return e.source==='part';}).map(function(e){return e.quote;}).join('\n')});
      var quotedScene=a.fromContext(quotedContext,opts);
      if(!scene||!quotedScene||JSON.stringify(scene)!==JSON.stringify(quotedScene))return fail('incomplete_family_evidence');
      if(plan.family==='numberline'&&scene&&['authored-number-line','authored-intervals'].includes(scene.kind))return {ok:true,scene:scene,reason:null};
      if(plan.family==='given-geometry'&&scene&&/^authored-(?:triangular-prism|triangle-sides|rectangle|equal-perimeter|correspondence)$/.test(scene.kind))return {ok:true,scene:scene,reason:null};
      return fail('unsupported_authored_family');
    }catch(_error){return fail('invalid_typed_plan');}
  }
  function pointsFigure(document,scene){
    if(!Array.isArray(scene.points)||!scene.points.length||scene.points.length>8||scene.points.some(function(p){return !Array.isArray(p)||p.length!==2||p.some(function(n){return !Number.isFinite(n)||Math.abs(n)>100;});}))return null;
    if(scene.labels&&(!Array.isArray(scene.labels)||scene.labels.length!==scene.points.length||scene.labels.some(function(s){return !/^[A-Z]?$/.test(s);})))return null;
    var NS='http://www.w3.org/2000/svg',el=function(tag,attrs,text){var e=document.createElementNS(NS,tag);Object.keys(attrs).forEach(function(k){e.setAttribute(k,String(attrs[k]));});if(text!==undefined)e.textContent=String(text);return e;};
    var fig=document.createElement('figure');fig.className='noam-visual-card noam-geometry';fig.dataset.visualKind='typed-coordinate-points';
    var svg=el('svg',{viewBox:'0 0 440 340',role:'img','aria-label':scene.caption});svg.style.cssText='display:block;width:100%;height:auto;background:white';fig.appendChild(svg);
    var xs=scene.points.map(function(p){return p[0];}),ys=scene.points.map(function(p){return p[1];}),xmin=Math.min.apply(Math,[-2].concat(xs))-1,xmax=Math.max.apply(Math,[2].concat(xs))+1,ymin=Math.min.apply(Math,[-2].concat(ys))-1,ymax=Math.max.apply(Math,[2].concat(ys))+1;
    var unit=Math.min(360/(xmax-xmin),255/(ymax-ymin)),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
    var px=function(x){return 218+(x-cx)*unit;},py=function(y){return 162.5-(y-cy)*unit;};
    function line(x1,y1,x2,y2){svg.appendChild(el('line',{x1:x1,y1:y1,x2:x2,y2:y2,stroke:'#64748b','stroke-width':1.5}));}
    function label(x,y,text){svg.appendChild(el('text',{x:x,y:y,'font-family':'Arial','font-size':14,'text-anchor':'middle',direction:'ltr','unicode-bidi':'isolate'},text));}
    var tick=Math.max(1,Math.ceil(Math.max(xmax-xmin,ymax-ymin)/12));
    for(var gx=Math.ceil(xmin/tick)*tick;gx<=xmax;gx+=tick){line(px(gx),py(0)-3,px(gx),py(0)+3);if(gx!==0)label(px(gx),py(0)+18,gx);}
    for(var gy=Math.ceil(ymin/tick)*tick;gy<=ymax;gy+=tick){line(px(0)-3,py(gy),px(0)+3,py(gy));if(gy!==0)label(px(0)-16,py(gy)+4,gy);}
    line(px(xmin),py(0),px(xmax),py(0));line(px(0),py(ymin),px(0),py(ymax));label(px(xmax)+14,py(0)+5,'x');label(px(0)+14,py(ymax),'y');label(px(0)-10,py(0)+18,'0');
    scene.points.forEach(function(p,i){svg.appendChild(el('circle',{cx:px(p[0]),cy:py(p[1]),r:5,fill:'#1769aa','data-role':'given-coordinate'}));label(px(p[0]),py(p[1])-12-(i%2)*4,(scene.labels&&scene.labels[i]||'')+'('+p[0]+','+p[1]+')');});
    var caption=document.createElement('figcaption');caption.textContent=scene.caption;fig.appendChild(caption);return fig;
  }
  function render(document,scene){
    if(!scene||typeof scene.caption!=='string')return null;
    if(scene.kind==='typed-coordinate-points')return pointsFigure(document,scene);
    var figure=root.NoamVisualData&&root.NoamVisualData.render(document,scene);
    return figure||root.NoamAuthoredVisual&&root.NoamAuthoredVisual.render(document,scene)||null;
  }
  return {PROMPT_SCHEMA:PROMPT_SCHEMA,inspect:inspect,render:render};
});
