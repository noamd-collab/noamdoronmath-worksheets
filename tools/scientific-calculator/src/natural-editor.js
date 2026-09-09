/* Structural, bounded Natural Display editor. Parentheses in the serialized
 * arithmetic are never reused as presentation or cursor locations.
 */
(function(global){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createNaturalEditor({math}){
  let next=1,root,caret,armed=false;const slots=new Map();
  const seq=(items=[])=>({id:next++,items});
  const atom=text=>({kind:'atom',text:String(text)});
  const chars=text=>Array.from(String(text),c=>atom(c));
  const node=(kind,fields,extra={})=>({kind,fields:fields.map(a=>a&&a.items?a:seq(a||[])),...extra});
  function index(){slots.clear();let count=0;const visit=(s,parent=null,field=-1,level=0)=>{if(level>40)throw new Error('Natural expression is too deeply nested.');slots.set(s.id,{s,parent,field});for(const n of s.items){if(++count>600)throw new Error('Natural expression is too long.');if(n.fields)n.fields.forEach((f,i)=>visit(f,{s,node:n},i,level+1));}};visit(root);}
  function current(){return slots.get(caret.slot).s;}
  const point=(s,pos)=>{caret={slot:s.id,index:Math.max(0,Math.min(s.items.length,pos))};};
  function commit(){index();if(!slots.has(caret.slot))point(root,root.items.length);if(source().length>1000)throw new Error('Natural expression is too long.');}
  function transaction(fn){const backup=snapshot();try{const value=fn();commit();return value;}catch(e){restore(backup);throw e;}}
  function reset(){root=seq();point(root,0);armed=false;index();}
  function snapshot(){return JSON.parse(JSON.stringify({root,caret,armed,next}));}
  function restore(data){root=JSON.parse(JSON.stringify(data.root));caret={...data.caret};next=data.next;armed=!!data.armed;index();}
  function serialize(){
   let text='';const points=[];
   const out=s=>{text+=s;};
   function writeSeq(s,empty=true){points.push({slot:s.id,index:0,offset:text.length});if(!s.items.length&&empty)out('□');s.items.forEach((n,i)=>{writeNode(n);points.push({slot:s.id,index:i+1,offset:text.length});});}
   function wrapped(s){out('(');writeSeq(s);out(')');}
   function writeNode(n){
    if(n.kind==='atom'){out(n.text);return;}
    if(n.kind==='fraction'){out('(');wrapped(n.fields[0]);out('/');wrapped(n.fields[1]);out(')');return;}
    if(n.kind==='mixed'){out('(');writeSeq(n.fields[0]);out('+(');wrapped(n.fields[1]);out('/');wrapped(n.fields[2]);out('))');return;}
    if(n.kind==='power'){out('(');wrapped(n.fields[0]);out('^');wrapped(n.fields[1]);out(')');return;}
    if(n.kind==='group'){out('(');writeSeq(n.fields[0]);out(')');return;}
    const name=n.kind==='sqrt'?'sqrt':n.kind==='cbrt'?'cbrt':n.kind==='root'?'nthRoot':n.name;
    out(name+'(');
    const order=n.kind==='root'?[1,0]:n.fields.map((_,i)=>i);
    order.forEach((field,i)=>{if(i)out(',');writeSeq(n.fields[field]);});out(')');
   }
   writeSeq(root,false);return {text,points};
  }
  const source=()=>serialize().text;
  function selection(){const p=serialize().points.find(p=>p.slot===caret.slot&&p.index===caret.index);return p?p.offset:source().length;}
  function seek(offset){const points=serialize().points;let best=points[0];for(const p of points)if(Math.abs(p.offset-offset)<=Math.abs(best.offset-offset))best=p;point(slots.get(best.slot).s,best.index);}
  const unwrap=n=>n.type==='ParenthesisNode'?n.content:n;
  function fromAst(n){
   if(n.type==='ConstantNode')return chars(n.value);
   if(n.type==='SymbolNode')return /^Nslot\d+$/.test(n.name)?[]:[atom(n.name)];
   if(n.type==='ParenthesisNode'){
    const x=n.content;
    if(x.type==='OperatorNode'&&x.fn==='divide'&&x.args.every(a=>a.type==='ParenthesisNode'))return [node('fraction',x.args.map(a=>fromAst(a.content)))];
    if(x.type==='OperatorNode'&&x.fn==='pow'&&x.args.every(a=>a.type==='ParenthesisNode'))return [node('power',x.args.map(a=>fromAst(a.content)))];
    return [node('group',[fromAst(x)],{closed:true})];
   }
   if(n.type==='OperatorNode'){
    if(n.fn==='divide'&&n.args.every(a=>a.type==='ParenthesisNode'))return [node('fraction',n.args.map(a=>fromAst(a.content)))];
    if(n.fn==='pow')return [node('power',n.args.map(a=>fromAst(unwrap(a))))];
    if(n.fn==='factorial')return [...fromAst(n.args[0]),atom('!')];
    if(n.args.length===1)return [atom(n.op),...fromAst(n.args[0])];
    return n.args.flatMap((a,i)=>[...(i&&!(n.fn==='multiply'&&n.implicit)?[atom(n.op)]:[]),...fromAst(a)]);
   }
   if(n.type==='FunctionNode'){
    const name=n.fn.name,fields=n.args.map(fromAst);if(!fields.length&&!['random'].includes(name))fields.push([]);
    if(['sqrt','cbrt'].includes(name))return [node(name,fields)];
    if(name==='nthRoot')return [node('root',[fields[1]||[],fields[0]||[]])];
    return [node('function',fields,{name})];
   }
   if(n.type==='ArrayNode')return [atom(n.toString())];
   throw new Error('Unsupported natural input');
  }
  function parse(text){
   if(!text)return [];
   let i=0;
   let source=String(text).replace(/□/g,()=> 'Nslot'+i++).replace(/π/g,'pi').replace(/√/g,'sqrt').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/');
   let depth=0;for(const c of source){if(c==='(')depth++;if(c===')')depth--;}
   if(depth>0&&depth<=40)source+=')'.repeat(depth);
   try{return fromAst(math.parse(source));}catch(_){
    // Incomplete operators and statement separators remain editable tokens.
    const tokens=String(text).match(/Ans|MatAns|Mat[ABC]|VctAns|Vct[ABC]|pi|[A-Za-z]+|\S/g)||[];
    return tokens.filter(t=>t!=='□').flatMap(t=>/^\d+$/.test(t)?chars(t):[atom(t)]);
   }
  }
  function setSource(text,offset){return transaction(()=>{if(String(text).length>1000)throw new Error('Natural expression is too long.');root=seq(parse(text));index();point(root,root.items.length);armed=false;if(offset!==undefined)seek(offset);});}
  function firstEmpty(n){if(!n.fields)return null;for(const f of n.fields){if(!f.items.length)return f;for(const child of f.items){const empty=firstEmpty(child);if(empty)return empty;}}return null;}
  function spliceNodes(nodes){const s=current(),at=caret.index;s.items.splice(at,0,...nodes);index();const empty=nodes.map(firstEmpty).find(Boolean);if(empty)point(empty,0);else point(s,at+nodes.length);}
  function operand(s,at){
   if(!at)return {start:at,items:[]};const last=s.items[at-1];
   if(last.kind!=='atom')return {start:at-1,items:[last]};
   let start=at-1;
   if(/[0-9.]/.test(last.text)&&last.text.length===1){while(start>0&&s.items[start-1].kind==='atom'&&/^[0-9.]$/.test(s.items[start-1].text))start--;}
   else if(!/^(?:Ans|pi|e|i|[A-FXYM]|Mat[A-C]|Vct[A-C]|MatAns|VctAns)$/.test(last.text))return {start:at,items:[]};
   return {start,items:s.items.slice(start,at)};
  }
  function captureNode(kind,fieldsAfter=[],extra={},reverse=false){
   const s=current(),range=operand(s,caret.index),filled=range.items.length>0;
   const fields=reverse?[seq(),seq(range.items)]:[seq(range.items),...fieldsAfter.map(()=>seq())];
   const n=node(kind,fields,extra);s.items.splice(range.start,caret.index-range.start,n);index();
   const destination=reverse?n.fields[0]:filled?(n.fields[1]||n.fields[0]):n.fields[0];point(destination,0);return n;
  }
  function fraction(){return transaction(()=>{armed=false;captureNode('fraction',[null]);});}
  function mixed(){return transaction(()=>{armed=false;const n=node('mixed',[[],[],[]]);spliceNodes([n]);});}
  function wrapBinary(name,reverse=false){return transaction(()=>{armed=false;if(name==='nthRoot')captureNode('root',[null],{},false);else captureNode('function',[null],{name},reverse);});}
  function inFunction(name){let ref=slots.get(caret.slot);while(ref.parent){if(ref.parent.node.name===name)return true;ref=slots.get(ref.parent.s.id);}return false;}
  function dms(){return transaction(()=>{if(inFunction('dms'))move('right');else captureNode('function',[null,null],{name:'dms'});});}
  function insert(text){return transaction(()=>{
   text=String(text);
   if(text==='('){const n=node('group',[[]],{closed:false});spliceNodes([n]);armed=false;return;}
   if(text===')'){
    let ref=slots.get(caret.slot);
    while(ref.parent){const owner=ref.parent.node;if(owner.kind==='group'||owner.kind==='function'){owner.closed=true;point(ref.parent.s,ref.parent.s.items.indexOf(owner)+1);armed=false;return;}ref=slots.get(ref.parent.s.id);}
    spliceNodes([atom(')')]);armed=false;return;
   }
   if(text===','||text===':'){
    const ref=slots.get(caret.slot);if(text===','&&ref.parent&&ref.parent.node.kind==='function'&&ref.field<ref.parent.node.fields.length-1){point(ref.parent.node.fields[ref.field+1],0);armed=false;return;}
   }
   if(/^\^/.test(text)){
    const exponent=text.slice(1).replace(/^\((.*)\)$/,'$1'),s=current(),range=operand(s,caret.index);
    if(!range.items.length)range.items=[atom('Ans')];
    const n=node('power',[seq(range.items),seq(parse(exponent))]);s.items.splice(range.start,caret.index-range.start,n);index();
    if(exponent.includes('□'))point(n.fields[1],0);else point(s,range.start+1);armed=false;return;
   }
   if(text==='*10^(□)'){armed=false;spliceNodes([atom('*'),node('power',[chars('10'),[]])]);return;}
   let nodes;
   if(text.includes('□')||/^[A-Za-z]+\(/.test(text)||/^\(.*\)$/.test(text))nodes=parse(text);
   else if(['Ans','pi','e','i','MatA','MatB','MatC','MatAns','VctA','VctB','VctC','VctAns','Ran#'].includes(text))nodes=[atom(text)];
   else nodes=chars(text);
   if(armed&&nodes.length===1&&nodes[0].fields){
    const s=current(),nextNode=s.items[caret.index],target=nodes[0].fields[0];
    if(nextNode){let count=1;if(nextNode.kind==='atom'&&/^[0-9.]$/.test(nextNode.text)){while(s.items[caret.index+count]&&s.items[caret.index+count].kind==='atom'&&/^[0-9.]$/.test(s.items[caret.index+count].text))count++;}target.items=s.items.slice(caret.index,caret.index+count);s.items.splice(caret.index,count,nodes[0]);index();point(s,caret.index+1);armed=false;return;}
   }
   armed=false;spliceNodes(nodes);
  });}
  function move(direction){
   const s=current(),at=caret.index,ref=slots.get(s.id);
   if(direction==='right'){
    if(at<s.items.length){const n=s.items[at];if(n.fields)point(n.fields[0],0);else point(s,at+1);return true;}
    if(ref.parent){const n=ref.parent.node;if(ref.field+1<n.fields.length)point(n.fields[ref.field+1],0);else point(ref.parent.s,ref.parent.s.items.indexOf(n)+1);return true;}point(root,0);return true;
   }
   if(direction==='left'){
    if(at>0){const n=s.items[at-1];if(n.fields){const f=n.fields[n.fields.length-1];point(f,f.items.length);}else point(s,at-1);return true;}
    if(ref.parent){const n=ref.parent.node;if(ref.field>0){const f=n.fields[ref.field-1];point(f,f.items.length);}else point(ref.parent.s,ref.parent.s.items.indexOf(n));return true;}point(root,root.items.length);return true;
   }
   const down=direction==='down';let candidate=ref;
   while(candidate.parent){
    const n=candidate.parent.node;let target=-1;
    if(n.kind==='fraction')target=down?1:0;
    if(n.kind==='mixed')target=down?2:1;
    if(n.kind==='power')target=down?0:1;
    if(n.kind==='root')target=down?1:0;
    if(n.kind==='function'&&['integral','sum'].includes(n.name))target=down?1:2;
    if(n.kind==='function'&&n.name==='derivative')target=down?1:0;
    if(target>=0&&target!==candidate.field){const f=n.fields[target];point(f,Math.min(caret.index,f.items.length));return true;}
    candidate=slots.get(candidate.parent.s.id);
   }
   const adjacent=s.items[at-1]||s.items[at];
   if(adjacent&&['fraction','mixed','power','root'].includes(adjacent.kind)){
    const field=adjacent.kind==='fraction'?(down?1:0):adjacent.kind==='mixed'?(down?2:1):adjacent.kind==='power'?(down?0:1):(down?1:0),f=adjacent.fields[field];point(f,f.items.length);return true;
   }
   return false;
  }
  function del(){return transaction(()=>{
   const s=current(),at=caret.index;
   if(at>0){s.items.splice(at-1,1);point(s,at-1);return;}
   const ref=slots.get(s.id);if(!ref.parent)return;
   const n=ref.parent.node,parent=ref.parent.s,pos=parent.items.indexOf(n);
   if(n.fields.every(f=>!f.items.length)){parent.items.splice(pos,1);point(parent,pos);return;}
   move('left');
  });}
  function home(){point(root,0);}function end(){point(root,root.items.length);}
  function click(slot,index){const ref=slots.get(Number(slot));if(ref)point(ref.s,Number(index));}
  function render({cursor=true}={}){
   const op=s=>'<mo>'+esc(s)+'</mo>';
   const caretTag='<mo class="lcd-math-cursor" data-caret="true" stretchy="true" fence="true" symmetric="true">|</mo>';
   function field(s){
    const items=[];for(let i=0;i<=s.items.length;i++){if(cursor&&caret.slot===s.id&&caret.index===i)items.push(caretTag);if(i<s.items.length)items.push('<mrow data-edit-slot="'+s.id+'" data-edit-index="'+i+'">'+draw(s.items[i])+'</mrow>');}
    if(!s.items.length&&s!==root)items.push('<mi class="lcd-slot" data-edit-slot="'+s.id+'" data-edit-index="0">□</mi>');
    return '<mrow data-slot="'+s.id+'">'+items.join('')+'</mrow>';
   }
   function draw(n){
    if(n.kind==='atom'){const text=n.text==='pi'?'π':n.text==='*'?'×':n.text==='/'?'÷':n.text==='-'?'−':n.text;return /^\d|\.$/.test(text)?'<mn>'+esc(text)+'</mn>':/^[A-Za-zπ]/.test(text)?'<mi>'+esc(text)+'</mi>':op(text);}
    const a=n.fields.map(field);
    if(n.kind==='fraction')return '<mfrac>'+a[0]+a[1]+'</mfrac>';
    if(n.kind==='mixed')return '<mrow>'+a[0]+'<mfrac>'+a[1]+a[2]+'</mfrac></mrow>';
    if(n.kind==='power')return '<msup>'+a[0]+a[1]+'</msup>';
    if(n.kind==='sqrt')return '<msqrt>'+a[0]+'</msqrt>';
    if(n.kind==='cbrt')return '<mroot>'+a[0]+'<mn>3</mn></mroot>';
    if(n.kind==='root')return '<mroot>'+a[1]+a[0]+'</mroot>';
    if(n.kind==='group')return '<mrow>'+op('(')+a[0]+(n.closed?op(')'):'')+'</mrow>';
    if(n.name==='log'&&a.length===2)return '<mrow><msub><mi>log</mi>'+a[0]+'</msub>'+a[1]+'</mrow>';
    if(n.name==='integral')return '<mrow><msubsup><mo>∫</mo>'+a[1]+a[2]+'</msubsup>'+a[0]+'<mi>dX</mi></mrow>';
    if(n.name==='sum')return '<mrow><munderover><mo>∑</mo><mrow><mi>X</mi>'+op('=')+a[1]+'</mrow>'+a[2]+'</munderover>'+a[0]+'</mrow>';
    if(n.name==='derivative')return '<mrow><mfrac><mi>d</mi><mi>dX</mi></mfrac>'+op('(')+a[0]+op(')')+'<msub><mo>|</mo><mrow><mi>X</mi>'+op('=')+a[1]+'</mrow></msub></mrow>';
    if(n.name==='dms')return '<mrow>'+a[0]+op('°')+a[1]+op('′')+a[2]+op('″')+'</mrow>';
    const inverse={asin:'sin',acos:'cos',atan:'tan',asinh:'sinh',acosh:'cosh',atanh:'tanh'};
    const label=inverse[n.name]?'<msup><mi>'+inverse[n.name]+'</mi><mn>−1</mn></msup>':'<mi>'+esc(n.name)+'</mi>';
    return '<mrow>'+label+op('(')+a.join(op(','))+op(')')+'</mrow>';
   }
   return '<math xmlns="http://www.w3.org/1998/Math/MathML" dir="ltr" class="lcd-natural-math">'+field(root)+'</math>';
  }
  reset();
  return {getSource:source,getSelection:selection,setSource,insert,fraction,mixed,wrapBinary,dms,move,delete:del,home,end,click,render,snapshot,restore,reset,armCaptureNext(){armed=true;},isCaptureArmed:()=>armed,getCaret:()=>({...caret}),getRoot:()=>root};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={createNaturalEditor};else global.createNaturalEditor=createNaturalEditor;
})(typeof window!=='undefined'?window:globalThis);
