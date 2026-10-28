(function(root,factory){'use strict';var api=factory(root||{});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NoamSourceDataVisual=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function givenRowTable(context){
    if(context.partTable||context.questionText!=='בטבלה מפרקים כל תרגיל לשני חלקים: סימן המנה וגודל המנה. השורה הראשונה מולאה כדוגמה.')return false;
    var selected=context.partText.match(/^מלאו את השורה (השנייה|השלישית|הרביעית)\.$/),table=context.questionTable;
    if(!selected||!table||JSON.stringify(table.head)!==JSON.stringify(['התרגיל','סימן המנה','גודל המנה','המנה'])||
       !Array.isArray(table.rows)||table.rows.length!==5||!table.rows.every(function(row){return Array.isArray(row)&&row.length===4&&row.every(function(cell){return typeof cell==='string';});}))return false;
    // The complete first row is explicitly a printed example. The requested
    // row supplies its exercise only; never fill its sign/magnitude/quotient.
    return table.rows[0].every(function(cell){return !!cell.trim();})&&
      table.rows.slice(1,4).every(function(row){return !!row[0].trim()&&row.slice(1).every(function(cell){return cell==='';});})&&
      table.rows[4].every(function(cell){return cell==='';});
  }
  function workedTable(context){
    var table=context.questionTable,q=context.questionText,p=context.partText;
    var worked=q.match(/^([א-ת]+) פתר(?:ה)? את המשוואה \$[^$\n]+\$ וכתב(?:ה)? שלוש שורות\. אחת מהן שגויה\.$/);
    var checking=p.match(/^אם מסתכלים רק על המעבר משורה לשורה, האם השורה השנייה והשלישית של ([א-ת]+) נכונות\?$/);
    return !context.partTable&&table&&Array.isArray(table.head)&&table.head.length===2&&table.head[0]==='השורה'&&/^מה כתב(?:ה)?\s+[א-ת]+$/.test(table.head[1])&&
      worked&&checking&&worked[1]===checking[1]&&table.head[1].split(/\s+/).pop()===worked[1];
  }
  // This fallback selects existing typed compilers. It neither interprets a
  // model answer nor evaluates an expression or completes a source table.
  function plan(context,options){
    options=options||{};
    if(options.drawCurrentStep!==true||!context||context.hasFigure!==false||'sourcePanels' in context)return null;
    var request=String(options.studentMessage||'').trim();
    if(!/^(?:(?:אפשר\s+)?רמז(?:\s+[123])?|שרטוט\s+להמחשה)[?!.]*$/.test(request))return null;
    var q=context.questionText,p=context.partText;
    if(typeof q!=='string'||typeof p!=='string'||q.length>2000||p.length>1000)return null;
    q=q.trim();p=p.trim();
    var expression,source,match;
    // An entire selected math span already owns its source scope. The existing
    // compiler must consume it whole; no formula is extracted from prose or a
    // sibling, and its evidence is never normalized or replaced with hint math.
    if(!context.questionTable&&!context.partTable&&((match=p.match(/^\$([^$\n]+)\$$/))||(match=p.match(/^\\\(([^\n]+)\\\)$/)))){
      // Relational spans may be intentionally false printed claims. The
      // general fallback only draws non-relational expressions; existing
      // narrowly scoped equation routes below keep their own contract.
      if(/[=<>≤≥≠]/.test(match[1]))return null;
      expression=match[1];source='part';
    }
    // A direct simplification task with a complete, unambiguous local span.
    // Formula-bearing stems, examples and separately chosen systems cannot
    // silently donate another expression to this selected part.
    var simpleStem=/^(?:פשטו(?:\s+(?:כל\s+ביטוי|את\s+הביטויים))?(?:,\s*ואז\s+בדקו\s+את\s+הקשר\s+בין\s+התוצאות)?|חשבו)\s*[.:]?$/;
    if(!expression&&!context.questionTable&&!context.partTable&&simpleStem.test(q)&&(match=p.match(/^פשטו\s+\$([^$\n]+)\$\s*[.]?$/))){
      expression=match[1];source='part';
    }else if(!expression&&!context.questionTable&&!context.partTable&&(match=q.match(/^נתון\s+\$([A-Za-z])=([^$\n]+)\$\s*[.]?$/))){
      // The selected target must be the exact assigned symbol. Do not use a
      // sibling result, a requested substitution or a different expression.
      var target=p.match(/^מצאו\s+את\s+\$([A-Za-z])\$\s*[.]?$/);
      if(target&&target[1]===match[1]){expression=match[1]+'='+match[2];source='question';}
    }
    if(expression)return {version:2,status:'ok',family:'operations',expression:expression,evidence:[{source:source,quote:source==='part'?p:q}]};
    if(givenRowTable(context))return {version:2,status:'ok',family:'table',tableSource:'question',evidence:[{source:'question',quote:q}]};
    // An error-checking exercise can show the original worked rows without
    // asserting that those rows are correct. It cannot generate a solution.
    if(workedTable(context)){
      return {version:2,status:'ok',family:'table',tableSource:'question',evidence:[{source:'question',quote:q}]};
    }
    // Showing the supplied table is source context, not a newly constructed
    // table. A selected table owns its scope; an invalid one never falls back
    // to the parent. The existing inspector retains new-table/scope limits.
    if(/משלכם|משלכן|משלך|בעצמכם|בעצמך|שבחרתם|שיצרתם|שבניתם|המתוק(?:ן|נת|נים|נות)|(?:לאחר|אחרי)\s+התיקון|שתיקנתם|שהשלמתם|הטבלה\s+המלאה/.test(p))return null;
    source=context.partTable!==undefined&&context.partTable!==null?'part':context.questionTable?'question':null;
    if(!source||(source==='part'?!p:!q))return null;
    return {version:2,status:'ok',family:'table',tableSource:source,evidence:[{source:source,quote:source==='part'?p:q}]};
  }
  function resolve(context,options){
    var candidate=plan(context,options),compiler=root.NoamVisualPlan;
    if(!candidate||!compiler||typeof compiler.inspect!=='function')return null;
    // A full source span is the only possible candidate. Hint text is omitted
    // so this fallback cannot authorize a hinted subtree or derived answer.
    var checked=compiler.inspect(candidate,Object.assign({},context,{hintText:'',studentMessage:''}));
    return checked&&checked.ok?checked.scene:null;
  }
  function render(document,context,options){
    var scene=resolve(context,options),compiler=root.NoamVisualPlan;
    if(!scene||!compiler||typeof compiler.render!=='function')return null;
    var figure=compiler.render(document,scene);
    if(figure&&scene.kind==='typed-operations'){
      var formula=figure.querySelector('math');
      if(formula&&formula.parentElement){
        formula.parentElement.style.overflowX='auto';
        formula.parentElement.style.maxWidth='100%';
        formula.parentElement.style.textAlign='left';
      }
    }
    if(figure&&scene.kind==='typed-table'){
      var caption=figure.querySelector('figcaption');
      if(caption)caption.textContent='הטבלה המקורית כפי שהודפסה. לא מולאו תאים ריקים ולא תוקנו ערכים; לא נקבע אילו שורות נכונות.'+(givenRowTable(context)?' השורה הראשונה נשמרה כדוגמה המקורית; תאים ריקים לא הושלמו.':workedTable(context)?' זו טבלת השלבים המקורית לבדיקה.':'');
    }
    return figure;
  }
  return {resolve:resolve,render:render};
});
