(function(root,factory){'use strict';var api=factory(root||{});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NoamSourceDataVisual=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
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
    // A direct simplification task with a complete, unambiguous local span.
    // Formula-bearing stems, examples and separately chosen systems cannot
    // silently donate another expression to this selected part.
    var simpleStem=/^(?:פשטו(?:\s+(?:כל\s+ביטוי|את\s+הביטויים))?(?:,\s*ואז\s+בדקו\s+את\s+הקשר\s+בין\s+התוצאות)?|חשבו)\s*[.:]?$/;
    if(!context.questionTable&&!context.partTable&&simpleStem.test(q)&&(match=p.match(/^פשטו\s+\$([^$\n]+)\$\s*[.]?$/))){
      expression=match[1];source='part';
    }else if(!context.questionTable&&!context.partTable&&(match=q.match(/^נתון\s+\$([A-Za-z])=([^$\n]+)\$\s*[.]?$/))){
      // The selected target must be the exact assigned symbol. Do not use a
      // sibling result, a requested substitution or a different expression.
      var target=p.match(/^מצאו\s+את\s+\$([A-Za-z])\$\s*[.]?$/);
      if(target&&target[1]===match[1]){expression=match[1]+'='+match[2];source='question';}
    }
    if(expression)return {version:2,status:'ok',family:'operations',expression:expression,evidence:[{source:source,quote:source==='part'?p:q}]};
    // An error-checking exercise can show the original worked rows without
    // asserting that those rows are correct. It cannot generate a solution.
    var table=context.questionTable,worked=q.match(/^([א-ת]+) פתר(?:ה)? את המשוואה \$[^$\n]+\$ וכתב(?:ה)? שלוש שורות\. אחת מהן שגויה\.$/);
    var checking=p.match(/^אם מסתכלים רק על המעבר משורה לשורה, האם השורה השנייה והשלישית של ([א-ת]+) נכונות\?$/);
    if(!context.partTable&&table&&Array.isArray(table.head)&&table.head.length===2&&table.head[0]==='השורה'&&/^מה כתב(?:ה)?\s+[א-ת]+$/.test(table.head[1])&&
       worked&&checking&&worked[1]===checking[1]&&table.head[1].split(/\s+/).pop()===worked[1]){
      return {version:2,status:'ok',family:'table',tableSource:'question',evidence:[{source:'question',quote:q}]};
    }
    return null;
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
      if(caption)caption.textContent+=' זו טבלת השלבים המקורית לבדיקה; לא נקבע אילו שורות נכונות.';
    }
    return figure;
  }
  return {resolve:resolve,render:render};
});
