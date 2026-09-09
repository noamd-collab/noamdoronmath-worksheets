/* Scientific arithmetic for the Noam Doron calculator.
 * This is an independent implementation, not a hardware/firmware emulator.
 * Casio fx-991ES PLUS 2nd edition User's Guide, functions and priority:
 * https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/
 * math.js is used only through a restricted AST interpreter below.
 */
function createEngine(math) {
  'use strict';
  const MAX_VALUE = 9.999999999999999e99;
  const symbols = new Set(['A','B','C','D','E','F','X','Y','M','Ans','pi','e','i','MatA','MatB','MatC','MatAns','VctA','VctB','VctC','VctAns']);
  const aliases = {Abs:'abs', Rnd:'rnd', Pol:'pol', Rec:'rec', Conjg:'conj', Trn:'transpose', Re:'re', Im:'im', Ran:'random', RanInt:'randomInt', nPr:'npr', nCr:'ncr', ln:'ln', arcsin:'asin', arccos:'acos', arctan:'atan', asinh:'asinh', acosh:'acosh', atanh:'atanh', inv:'inverse', root:'nthRoot', logab:'log', factorial:'fact'};
  const functions = new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','asinh','acosh','atanh','sqrt','cbrt','nthRoot','pow','square','cube','exp','pow10','ln','log','log10','abs','rnd','npr','ncr','fact','random','randomInt','pol','rec','polar','arg','conj','re','im','det','transpose','inverse','dot','cross','norm','dms','deg','rad','gra','percent']);
  const fail = (message, code='Math ERROR') => {const error = new Error(message); error.code=code; throw error;};
  const real = value => {if(typeof value !== 'number' || !Number.isFinite(value)) fail('הפעולה דורשת מספר ממשי סופי.'); return value;};
  const isComplex = value => !!(value && value.isComplex === true);
  const data = value => value && value.isMatrix ? value.toArray() : value;
  const angleFactor = angle => ({deg:Math.PI/180, rad:1, gra:Math.PI/200})[String(angle).toLowerCase()] || fail('יחידת זווית לא מוכרת.');

  function bounded(value, allowComplex, depth=0) {
    value = data(value);
    if(typeof value === 'number') {
      if(!Number.isFinite(value) || Math.abs(value)>MAX_VALUE) fail('התוצאה אינה מוגדרת או חורגת מטווח החישוב.');
      return Object.is(value,-0) ? 0 : value;
    }
    if(isComplex(value)) {
      bounded(value.re,true); bounded(value.im,true);
      if(value.im === 0) return value.re;
      if(!allowComplex) fail('נדרש מצב מספרים מרוכבים (CMPLX) לחישוב הזה.');
      return math.complex(value.re,value.im);
    }
    if(Array.isArray(value)) {
      if(depth>1 || value.length<1 || value.length>3) fail('ניתן לחשב וקטורים ומטריצות עד גודל 3.','Dimension ERROR');
      const result=value.map(item=>bounded(item,allowComplex,depth+1));
      const rows=result.filter(Array.isArray);
      if(rows.length && (rows.length!==result.length || rows.some(row=>row.length!==rows[0].length))) fail('למטריצה דרושות שורות באורך זהה.','Dimension ERROR');
      return result;
    }
    fail('סוג הערך אינו נתמך.');
  }

  // PLUS omitted multiplication has priority 7, above explicit ×/÷ (10).
  // Keep implicit products in math.js, but suppress its exceptional numeric
  // quotient rule: Casio interprets 1/2i as 1/(2i), not (1/2)i.
  function normalize(expression) {
    if(typeof expression!=='string' || expression.length>1000) fail('הביטוי ארוך מדי: עד 1,000 תווים.','Stack ERROR');
    let source=expression.trim().replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/π/g,'pi').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)').replace(/√/g,'sqrt').replace(/²/g,'^2').replace(/³/g,'^3').replace(/⁻¹/g,'^(-1)').replace(/RanInt#/g,'randomInt').replace(/Ran#/g,'random()');
    if(!source) fail('יש להזין ביטוי לחישוב.','Syntax ERROR');
    const tokens=[]; let position=0;
    while(position<source.length) {
      if(/\s/.test(source[position])) {position++;continue;}
      const rest=source.slice(position);
      const number=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if(number) {tokens.push({type:'number',text:number[0]});position+=number[0].length;continue;}
      const identifier=rest.match(/^[A-Za-z][A-Za-z0-9_]*/);
      if(identifier) {
        const text=Object.prototype.hasOwnProperty.call(aliases,identifier[0])?aliases[identifier[0]]:identifier[0];
        // Consecutive memory keys are omitted multiplication, e.g. XY or EF.
        if(text.length>1&&/^[ABCDEFMXY]+i?$/.test(text))for(const name of text)tokens.push({type:'name',text:name});
        else tokens.push({type:'name',text});
        position+=identifier[0].length;continue;
      }
      if('+-*/^!%(),[];'.includes(source[position])) {tokens.push({type:source[position],text:source[position]});position++;continue;}
      fail('תו לא נתמך בביטוי. השתמשו במקשי המחשבון או בתחביר המתמטי המוצג.','Syntax ERROR');
    }
    let openParentheses=0;
    for(const token of tokens){if(token.type==='(')openParentheses++;if(token.type===')')openParentheses--;if(openParentheses<0)fail('סוגר סוגר ללא סוגר פותח.','Syntax ERROR');}
    if(openParentheses>40)fail('יותר מדי סוגריים מקוננים.','Stack ERROR');
    // Like the ES line-input mode, final closing parentheses may be omitted.
    for(let i=0;i<openParentheses;i++)tokens.push({type:')',text:')'});
    let result='';
    for(let index=0;index<tokens.length;index++) {
      const token=tokens[index], previous=tokens[index-1];
      if(previous) {
        const end=['number','name',')',']','!','%'].includes(previous.type);
        const start=['number','name','(','['].includes(token.type);
        const call=previous.type==='name' && token.type==='(' && functions.has(previous.text);
        if(end && start && !call) result+=' ';
      }
      let before=index-1;
      while(before>=0&&['+','-'].includes(tokens[before].type))before--;
      const numericDenominator=token.type==='number'&&before>=0&&tokens[before].type==='/';
      result+=numericDenominator?'('+token.text+')':token.text;
    }
    // math.js gives a bare `a+b%` a business-calculator markup interpretation.
    // Scientific ES percentages always divide the operand by 100 instead.
    while(result.includes('%')) {
      const end=result.indexOf('%');let start=end-1,depth=0;
      for(;start>=0;start--) {
        const ch=result[start];
        if(ch===')'||ch===']')depth++;
        else if(ch==='('||ch==='['){if(depth===0)break;depth--;}
        else if(depth===0&&'+-*/,;'.includes(ch)) {
          if((ch==='+'||ch==='-')&&start>0&&/[eE^]/.test(result[start-1]))continue;
          break;
        }
      }
      start++;
      if(start===end)fail('יש להזין ערך לפני סימן האחוז.','Syntax ERROR');
      result=result.slice(0,start)+'percent('+result.slice(start,end)+')'+result.slice(end+1);
    }
    return result;
  }

  function evaluate(expression, {angle='deg',mode='COMP',scope={},format='norm',digits=10,onCoordinates}={}) {
    const factor=angleFactor(angle), allowComplex=String(mode).toUpperCase()==='CMPLX';
    const source=normalize(expression);
    const variables=Object.create(null);
    for(const name of symbols) {
      if(name==='pi') variables[name]=Math.PI;
      else if(name==='e') variables[name]=Math.E;
      else if(name==='i') {if(allowComplex) variables[name]=math.complex(0,1);}
      else if(Object.prototype.hasOwnProperty.call(scope,name)) variables[name]=scope[name];
      else if(!name.startsWith('Mat') && !name.startsWith('Vct')) variables[name]=0;
    }
    let lastCoordinates=null;
    const coordinateResult=pair=>{
      pair=bounded(pair,false);
      variables.X=pair[0];variables.Y=pair[1];lastCoordinates=pair;
      return pair;
    };
    let tree;
    try {tree=math.parse(source);} catch(error) {fail('בדקו את הביטוי, הפסיקים והסוגריים.','Syntax ERROR');}
    const integer=(value,min,max)=>{real(value);if(!Number.isInteger(value)||value<min||value>max) fail('נדרש מספר שלם בטווח '+min+' עד '+max+'.');return value;};
    const single=(fn,args)=>{if(args.length!==1) fail('לפעולה הזו דרוש ערך אחד.','Syntax ERROR');return fn(args[0]);};
    const argumentsCount=(args,count)=>{if(args.length!==count) fail('לפעולה הזו דרושים '+count+' ערכים.','Syntax ERROR');};
    const mapScalar=(value,fn)=>isComplex(value)?math.complex(fn(value.re),fn(value.im)):fn(real(value));
    const roundNumber=value=> {
      const count=Math.max(0,Math.min(10,Number(digits)||0));
      return mapScalar(value,x=>format==='fix'?Number(x.toFixed(Math.min(count,9))):Number(x.toPrecision(format==='sci'?(count||10):10)));
    };
    const factorial=value=>{integer(value,0,69);let answer=1;for(let i=2;i<=value;i++) answer*=i;return answer;};
    const permutation=(n,r,combination)=>{
      integer(n,0,9999999999);integer(r,0,n);
      if(combination) r=Math.min(r,n-r);
      if(r>1000) fail('התוצאה חורגת מטווח החישוב.');
      let answer=1;for(let i=1;i<=r;i++) {answer*=combination?(n-r+i)/i:n-i+1;if(answer>MAX_VALUE) fail('התוצאה חורגת מטווח החישוב.');}
      return answer<Number.MAX_SAFE_INTEGER?Math.round(answer):answer;
    };
    const vector=value=>{value=data(value);if(!Array.isArray(value)||![2,3].includes(value.length)||value.some(v=>typeof v!=='number')) fail('נדרש וקטור בן 2 או 3 רכיבים.','Dimension ERROR');return value;};
    const matrix=value=>{value=data(value);if(!Array.isArray(value)||!value.every(Array.isArray)) fail('נדרשת מטריצה.','Dimension ERROR');return value;};
    const table={
      sin:args=>single(x=>math.sin(math.multiply(x,factor)),args),
      cos:args=>single(x=>math.cos(math.multiply(x,factor)),args),
      tan:args=>single(x=>{if(typeof x==='number'&&Math.abs(Math.cos(x*factor))<1e-14) fail('טנגנס אינו מוגדר בזווית הזו.');return math.tan(math.multiply(x,factor));},args),
      asin:args=>single(x=>math.divide(math.asin(x),factor),args),
      acos:args=>single(x=>math.divide(math.acos(x),factor),args),
      atan:args=>single(x=>math.divide(math.atan(x),factor),args),
      sinh:args=>single(math.sinh,args),cosh:args=>single(math.cosh,args),tanh:args=>single(math.tanh,args),
      asinh:args=>single(math.asinh,args),acosh:args=>single(math.acosh,args),atanh:args=>single(math.atanh,args),
      sqrt:args=>single(math.sqrt,args),cbrt:args=>single(x=>typeof x==='number'?Math.cbrt(x):math.pow(x,1/3),args),
      nthRoot:args=>{argumentsCount(args,2);const [x,n]=args;real(n);if(n===0) fail('סדר השורש חייב להיות שונה מאפס.');if(typeof x==='number'&&x<0&&Number.isInteger(n)&&Math.abs(n%2)===1)return -Math.pow(-x,1/n);return math.pow(x,1/n);},
      pow:(args,nodes)=>{argumentsCount(args,2);return power(args[0],args[1],nodes&&nodes[1]);},
      square:args=>single(x=>power(x,2),args),cube:args=>single(x=>power(x,3),args),
      exp:args=>single(math.exp,args),pow10:args=>single(x=>math.pow(10,x),args),ln:args=>single(math.log,args),
      log:args=>{if(args.length===1)return math.log10(args[0]);argumentsCount(args,2);real(args[0]);if(args[0]<=0||args[0]===1)fail('בסיס הלוגריתם חייב להיות חיובי ושונה מ־1.');return math.log(args[1],args[0]);},
      log10:args=>single(math.log10,args),abs:args=>single(x=>Array.isArray(x)?(Array.isArray(x[0])?x.map(row=>row.map(value=>math.abs(value))):math.norm(vector(x))):math.abs(x),args),
      rnd:args=>single(roundNumber,args),fact:args=>single(factorial,args),
      npr:args=>{argumentsCount(args,2);return permutation(args[0],args[1],false);},
      ncr:args=>{argumentsCount(args,2);return permutation(args[0],args[1],true);},
      random:args=>{argumentsCount(args,0);return Math.floor(Math.random()*1000)/1000;},
      randomInt:args=>{argumentsCount(args,2);const min=integer(args[0],-9999999999,9999999999),max=integer(args[1],-9999999999,9999999999);if(min>=max||max-min>=1e10)fail('נדרש a < b והפרש קטן מ־10¹⁰.');return min+Math.floor(Math.random()*(max-min+1));},
      pol:args=>{argumentsCount(args,2);const [x,y]=args.map(real);if(x===0&&y===0)fail('כיוון אינו מוגדר לנקודת הראשית.');return coordinateResult([Math.hypot(x,y),Math.atan2(y,x)/factor]);},
      rec:args=>{argumentsCount(args,2);const [r,theta]=args.map(real);return coordinateResult([r*Math.cos(theta*factor),r*Math.sin(theta*factor)]);},
      polar:args=>{argumentsCount(args,2);const [r,theta]=args.map(real);return math.complex(r*Math.cos(theta*factor),r*Math.sin(theta*factor));},
      arg:args=>single(x=>math.arg(x)/factor,args),conj:args=>single(math.conj,args),re:args=>single(math.re,args),im:args=>single(math.im,args),
      det:args=>single(x=>math.det(matrix(x)),args),transpose:args=>single(x=>math.transpose(matrix(x)),args),inverse:args=>single(x=>Array.isArray(x)?math.inv(matrix(x)):math.divide(1,x),args),
      dot:args=>{argumentsCount(args,2);return math.dot(vector(args[0]),vector(args[1]));},
      cross:args=>{argumentsCount(args,2);let a=vector(args[0]),b=vector(args[1]);if(a.length!==b.length)fail('למכפלה וקטורית דרושים וקטורים באותה מידה.','Dimension ERROR');if(a.length===2){a=[...a,0];b=[...b,0];}return math.cross(a,b);},
      norm:args=>single(x=>math.norm(vector(x)),args),
      dms:args=>{argumentsCount(args,3);const [d,m,s]=args.map(real);if(m<0||s<0)fail('דקות ושניות חייבות להיות לא שליליות.');return (d<0?-1:1)*(Math.abs(d)+m/60+s/3600);},
      deg:args=>single(x=>real(x)*(Math.PI/180)/factor,args),rad:args=>single(x=>real(x)/factor,args),gra:args=>single(x=>real(x)*(Math.PI/200)/factor,args),
      percent:args=>single(x=>math.divide(x,100),args)
    };
    function rationalExponent(node) {
      // Recover provenance from integer-fraction syntax, never from a nearby
      // floating-point decimal or a rounded noninteger memory value. PLUS's
      // real-domain rule permits negative x when y=m/(2n+1).
      let visited=0;
      const abs=x=>x<0n?-x:x;
      const fraction=(n,d=1n)=>{
        if(!d)throw Error();if(d<0n){n=-n;d=-d;}
        let a=abs(n),b=d;while(b)[a,b]=[b,a%b];n/=a;d/=a;
        if(abs(n)>10n**100n||d>10n**100n)throw Error();return {n,d};
      };
      function read(item,depth=0){
        if(!item||++visited>256||depth>40)throw Error();
        if(item.type==='ParenthesisNode')return read(item.content,depth+1);
        if(item.type==='ConstantNode'&&Number.isSafeInteger(item.value))return fraction(BigInt(item.value));
        if(item.type==='SymbolNode'&&symbols.has(item.name)&&Number.isSafeInteger(variables[item.name]))return fraction(BigInt(variables[item.name]));
        if(item.type!=='OperatorNode')throw Error();
        const a=read(item.args[0],depth+1),b=item.args[1]?read(item.args[1],depth+1):null;
        if(item.fn==='unaryPlus')return a;if(item.fn==='unaryMinus')return fraction(-a.n,a.d);
        if(item.fn==='add')return fraction(a.n*b.d+b.n*a.d,a.d*b.d);
        if(item.fn==='subtract')return fraction(a.n*b.d-b.n*a.d,a.d*b.d);
        if(item.fn==='multiply')return fraction(a.n*b.n,a.d*b.d);
        if(item.fn==='divide')return fraction(a.n*b.d,a.d*b.n);
        if(item.fn==='pow'&&b.d===1n&&abs(b.n)<=100n){const n=a.n**abs(b.n),d=a.d**abs(b.n);return b.n<0n?fraction(d,n):fraction(n,d);}
        throw Error();
      }
      try{return read(node);}catch(_){return null;}
    }
    function power(base,exponent,exponentNode) {
      if(Array.isArray(base)) {
        matrix(base);integer(exponent,-1,3);
        if(exponent===-1) return math.inv(base);
        if(base.length!==base[0].length)fail('חזקת מטריצה דורשת מטריצה ריבועית.','Dimension ERROR');
      }
      if(!allowComplex&&typeof base==='number'&&base<0&&typeof exponent==='number'&&!Number.isInteger(exponent)){
        const ratio=rationalExponent(exponentNode);
        if(ratio&&ratio.d%2n===1n)return (ratio.n%2n===0n?1:-1)*Math.pow(-base,Number(ratio.n)/Number(ratio.d));
      }
      return math.pow(base,exponent);
    }
    let visited=0;
    function visit(node,depth=0,coordinateScalar=false) {
      if(++visited>256||depth>40)fail('הביטוי מורכב מדי. פצלו אותו למספר חישובים.','Stack ERROR');
      let answer;
      switch(node.type) {
        case 'ConstantNode':if(typeof node.value!=='number')fail('מותר להזין ערכים מספריים בלבד.','Syntax ERROR');answer=node.value;break;
        case 'ParenthesisNode':answer=visit(node.content,depth+1,coordinateScalar);break;
        case 'SymbolNode':
          if(!symbols.has(node.name))fail('השם '+node.name+' אינו מוכר.','Syntax ERROR');
          if(!Object.prototype.hasOwnProperty.call(variables,node.name))fail(node.name==='i'?'יש לבחור במצב CMPLX לשימוש ב־i.':'יש להגדיר תחילה את '+node.name+'.');
          answer=variables[node.name];break;
        case 'ArrayNode':
          if(node.items.length>3)fail('ניתן להזין עד 3 שורות או רכיבים.','Dimension ERROR');
          answer=node.items.map(item=>visit(item,depth+1,true));break;
        case 'FunctionNode': {
          if(node.fn.type!=='SymbolNode'||!functions.has(node.fn.name)||!Object.prototype.hasOwnProperty.call(table,node.fn.name))fail('הפונקציה אינה נתמכת.','Syntax ERROR');
          if(node.args.length>3)fail('יותר מדי ערכים בפונקציה.','Syntax ERROR');
          answer=table[node.fn.name](node.args.map(arg=>visit(arg,depth+1,true)),node.args);
          if(coordinateScalar&&(node.fn.name==='pol'||node.fn.name==='rec'))answer=answer[0];
          break;
        }
        case 'OperatorNode': {
          if(!['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus','factorial'].includes(node.fn))fail('הפעולה אינה נתמכת.','Syntax ERROR');
          const args=node.args.map(arg=>visit(arg,depth+1,true));
          if(node.fn==='factorial')answer=factorial(args[0]);
          else if(node.fn==='pow')answer=power(args[0],args[1],node.args[1]);
          else if(node.fn==='multiply'&&String(mode).toUpperCase()==='VECTOR'&&args.every(value=>Array.isArray(value)&&!Array.isArray(value[0])))answer=table.cross(args);
          else if(node.fn==='divide'&&typeof args[1]==='number'&&args[1]===0)fail('לא ניתן לחלק באפס.');
          else answer=math[node.fn](...args);
          break;
        }
        default:fail('התחביר אינו נתמך. אפשר להזין ביטויים מתמטיים בלבד.','Syntax ERROR');
      }
      return bounded(answer,allowComplex);
    }
    let result;
    try {result=visit(tree);} catch(error) {
      if(error.code) throw error;
      if(/dimension|square|shape|matrix|vector|size/i.test(error.message))fail('מידות המטריצה או הווקטור אינן מתאימות לפעולה.','Dimension ERROR');
      fail('לא ניתן לחשב את הביטוי הזה. בדקו תחום הגדרה וערכי קלט.');
    }
    // Commit side effects only once the complete expression succeeds. The
    // caller's scope is never mutated, even if a later node raises an error.
    if(lastCoordinates&&typeof onCoordinates==='function')onCoordinates([...lastCoordinates]);
    return result;
  }

  function format(value,{format='norm',digits=10,angle='deg',complex='rect'}={}) {
    const count=Math.max(0,Math.min(10,Number(digits)||0));
    const trim=x=>x.replace(/(\.\d*?[1-9])0+(?=e|$)/,'$1').replace(/\.0+(?=e|$)/,'').replace(/e\+/,'e');
    const scalar=x=>{
      real(x);if(Object.is(x,-0))x=0;
      if(format==='fix')return x.toFixed(Math.min(count,9));
      if(format==='sci')return x.toExponential((count||10)-1).replace('e+','e');
      if(format==='eng') {
        if(x===0)return '0';let exponent=Math.floor(Math.log10(Math.abs(x))/3)*3;
        let mantissa=Number((x/10**exponent).toPrecision(count||10));
        if(Math.abs(mantissa)>=1000){mantissa/=1000;exponent+=3;}
        return String(mantissa)+(exponent?' × 10^'+exponent:'');
      }
      const lower=format==='norm2'?1e-9:1e-2;
      const rounded=Number(x.toPrecision(10));
      if(rounded!==0&&(Math.abs(rounded)<lower||Math.abs(rounded)>=1e10))return trim(rounded.toExponential(9));
      const text=String(rounded);
      // JavaScript switches to exponent notation below 1e-6. Norm 2 does not
      // switch until below 1e-9, so expand those small decimal strings.
      if(!text.includes('e'))return text;
      const [mantissa,exponent]=text.split('e'),negative=mantissa[0]==='-',unsigned=negative?mantissa.slice(1):mantissa;
      const digitsText=unsigned.replace('.',''),point=(unsigned.indexOf('.')<0?unsigned.length:unsigned.indexOf('.'))+Number(exponent);
      return (negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digitsText:digitsText.slice(0,point)+'.'+digitsText.slice(point));
    };
    const render=v=>{
      v=data(v);
      if(typeof v==='number')return scalar(v);
      if(isComplex(v)) {
        if(complex==='polar')return scalar(math.abs(v))+' ∠ '+scalar(math.arg(v)/angleFactor(angle));
        if(v.im===0)return scalar(v.re);
        const magnitude=Math.abs(v.im), imag=(magnitude===1?'':scalar(magnitude))+'i';
        return v.re===0?(v.im<0?'−':'')+imag:scalar(v.re)+(v.im<0?' − ':' + ')+imag;
      }
      if(Array.isArray(v))return '['+v.map(render).join(Array.isArray(v[0])?'; ':', ')+']';
      fail('התוצאה אינה ניתנת להצגה.');
    };
    return render(value);
  }

  // Recover a small rational from a floating-point result; null means keep its
  // decimal display. This is not symbolic algebra and does not recover radicals.
  function fraction(value,{mixed=false}={}) {
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e10)return null;
    if(Number.isInteger(value))return String(value);
    const sign=value<0?'−':'',target=Math.abs(value);let x=target,h0=0,h1=1,k0=1,k1=0;
    for(let i=0;i<32;i++) {
      const integer=Math.floor(x),h=integer*h1+h0,k=integer*k1+k0;
      if(k>1000000||!Number.isSafeInteger(h))break;
      if(Math.abs(h/k-target)<=1e-13*Math.max(1,target)) {
        if(mixed&&h>=k) {const whole=Math.floor(h/k),remainder=h%k;return sign+whole+(remainder?' '+remainder+'/'+k:'');}
        return sign+h+'/'+k;
      }
      [h0,h1,k0,k1]=[h1,h,k1,k];
      const rest=x-integer;if(rest===0)break;x=1/rest;
    }
    return null;
  }

  // Exact display deliberately uses its own small rational/surd algebra. It
  // never infers a fraction or radical from an approximate computed result.
  // Unsupported expressions return null so the UI retains the decimal result.
  function exact(expression,{angle='deg',scope={},mixed=false,mode='COMP',complex='rect'}={}) {
    try {
      const abs=x=>x<0n?-x:x;
      const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a;};
      const rational=(n,d=1n)=>{
        if(d===0n)throw Error();if(d<0n){n=-n;d=-d;}const g=gcd(n,d);n/=g;d/=g;
        if(abs(n)>10n**30n||d>10n**30n)throw Error();return {n,d};
      };
      const addR=(a,b)=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
      const mulR=(a,b)=>rational(a.n*b.n,a.d*b.d);
      const decimal=value=>{
        if(typeof value!=='number'||!Number.isFinite(value))throw Error();
        const [mantissa,expText='0']=String(value).split('e'),exponent=Number(expText);
        const places=(mantissa.split('.')[1]||'').length-exponent;
        if(Math.abs(places)>30)throw Error();
        const n=BigInt(mantissa.replace('.',''));return places>=0?rational(n,10n**BigInt(places)):rational(n*10n**BigInt(-places));
      };
      const term=(coefficient,radical=1,piPower=0,imaginary=false)=>new Map([[radical+':'+piPower+(imaginary?':i':''),coefficient]]);
      const constant=value=>term(decimal(value));
      const clean=poly=>{for(const [key,value] of poly)if(value.n===0n)poly.delete(key);if(poly.size>8)throw Error();return poly;};
      const plus=(a,b)=>{const result=new Map(a);for(const [key,value]of b)result.set(key,addR(result.get(key)||rational(0n),value));return clean(result);};
      const negate=poly=>new Map([...poly].map(([key,c])=>[key,rational(-c.n,c.d)]));
      const multiply=(a,b)=>{
        let result=new Map();
        for(const [ka,ca]of a)for(const [kb,cb]of b){
          const [ra,pa]=ka.split(':').map(Number),[rb,pb]=kb.split(':').map(Number),ia=ka.endsWith(':i'),ib=kb.endsWith(':i'),common=Number(gcd(BigInt(ra),BigInt(rb))),radical=ra/common*(rb/common),power=pa+pb;
          if(radical>1000000||Math.abs(power)>6)throw Error();
          result=plus(result,term(mulR(mulR(ca,cb),rational(BigInt(common)*(ia&&ib?-1n:1n))),radical,power,ia!==ib));
        }
        return result;
      };
      const divide=(a,b)=>{
        b=clean(b);
        if(b.size===2){
          // Rationalize a two-term surd denominator algebraically, e.g.
          // 1/(1+√2)=√2−1. Never infer radicals from a decimal result.
          const [[ka,ca],[kb,cb]]=[...b];
          const conjugate=new Map([[ka,ca],[kb,rational(-cb.n,cb.d)]]);
          const norm=clean(multiply(b,conjugate));
          if(norm.size!==1)throw Error();
          return divide(multiply(a,conjugate),norm);
        }
        if(b.size!==1)throw Error();
        const [key,c]=[...b][0],[radical,power]=key.split(':').map(Number),imaginary=key.endsWith(':i');
        return multiply(a,term(rational(c.d*(imaginary?-1n:1n),c.n*BigInt(radical)),radical,-power,imaginary));
      };
      const scalar=poly=>{poly=clean(poly);if(!poly.size)return rational(0n);if(poly.size!==1||!poly.has('1:0'))throw Error();return poly.get('1:0');};
      const squareRoot=poly=>{
        const q=scalar(poly);
        if(q.n<0n){if(String(mode).toUpperCase()!=='CMPLX')throw Error();return multiply(squareRoot(negate(poly)),term(rational(1n),1,0,true));}
        if(q.n*q.d>1000000n)throw Error();
        let remaining=Number(q.n*q.d),outside=1,inside=1;
        for(let prime=2;prime*prime<=remaining;prime++){
          let count=0;while(remaining%prime===0){remaining/=prime;count++;}
          outside*=prime**Math.floor(count/2);if(count%2)inside*=prime;
        }
        if(remaining>1)inside*=remaining;
        if(q.n===0n)return constant(0);
        return term(rational(BigInt(outside),q.d),inside);
      };
      let count=0;
      const trig=(name,poly)=>{
        let degrees;
        if(String(angle).toLowerCase()==='rad'){
          const p=clean(poly);if(!p.size)degrees=0;else{if(p.size!==1||!p.has('1:1'))throw Error();const q=p.get('1:1');degrees=Number(q.n)*180/Number(q.d);}
        }else{const q=scalar(poly);degrees=Number(q.n)/Number(q.d)*(String(angle).toLowerCase()==='gra'?.9:1);}
        if(!Number.isInteger(degrees)||degrees%15!==0)throw Error();
        degrees=((degrees%360)+360)%360;
        const sine=d=>{
          d=((d%360)+360)%360;let sign=1;if(d>180){d-=180;sign=-1;}if(d>90)d=180-d;
          const values={0:'0',15:'(sqrt(6)-sqrt(2))/4',30:'1/2',45:'sqrt(2)/2',60:'sqrt(3)/2',75:'(sqrt(6)+sqrt(2))/4',90:'1'};
          let value=visit(math.parse(values[d]));return sign<0?negate(value):value;
        };
        if(name==='sin')return sine(degrees);
        if(name==='cos')return sine(90-degrees);
        return divide(sine(degrees),sine(90-degrees));
      };
      const inverseTrig=(name,poly)=>{
        // Match exact algebraic expressions, not nearby floating-point values.
        // This includes familiar 15°, 30°, 45°, 60° and 75° triangle ratios.
        const signature=value=>[...clean(value)].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,c])=>key+'='+c.n+'/'+c.d).join(';');
        const sineValues=[[0,'0'],[15,'(sqrt(6)-sqrt(2))/4'],[30,'1/2'],[45,'sqrt(2)/2'],[60,'sqrt(3)/2'],[75,'(sqrt(6)+sqrt(2))/4'],[90,'1']];
        const tangentValues=[[0,'0'],[15,'2-sqrt(3)'],[30,'sqrt(3)/3'],[45,'1'],[60,'sqrt(3)'],[75,'2+sqrt(3)']];
        const target=signature(poly);let degrees=null;
        for(const [candidate,source]of name==='atan'?tangentValues:sineValues){
          const value=visit(math.parse(source));
          if(signature(value)===target){degrees=candidate;break;}
          if(signature(negate(value))===target){degrees=-candidate;break;}
        }
        if(degrees===null)throw Error();
        if(name==='acos')degrees=90-degrees;
        const unit=String(angle).toLowerCase();
        if(unit==='rad')return term(rational(BigInt(degrees),180n),1,1);
        if(unit==='gra')return term(rational(BigInt(degrees)*10n,9n));
        return constant(degrees);
      };
      function visit(node,depth=0) {
        if(++count>256||depth>40)throw Error();
        if(node.type==='ParenthesisNode')return visit(node.content,depth+1);
        if(node.type==='ConstantNode')return constant(node.value);
        if(node.type==='SymbolNode'){
          if(node.name==='pi')return term(rational(1n),1,1);
          if(node.name==='i'&&String(mode).toUpperCase()==='CMPLX')return term(rational(1n),1,0,true);
          // Memory has no symbolic provenance. Only exact integer values are
          // safe to reconstruct; e.g. a decimal Ans from sqrt(2) stays decimal.
          if(!symbols.has(node.name)||node.name==='e'||node.name==='i')throw Error();
          const value=Object.prototype.hasOwnProperty.call(scope,node.name)?scope[node.name]:0;
          if(!Number.isSafeInteger(value))throw Error();return constant(value);
        }
        if(node.type==='OperatorNode'){
          const a=visit(node.args[0],depth+1),b=node.args[1]?visit(node.args[1],depth+1):null;
          if(node.fn==='add')return plus(a,b);if(node.fn==='subtract')return plus(a,negate(b));
          if(node.fn==='multiply')return multiply(a,b);if(node.fn==='divide')return divide(a,b);
          if(node.fn==='unaryMinus')return negate(a);if(node.fn==='unaryPlus')return a;
          if(node.fn==='pow'){
            const q=scalar(b);if(q.n===1n&&q.d===2n)return squareRoot(a);
            if(q.d!==1n||abs(q.n)>8n)throw Error();let result=constant(1);
            for(let i=0n;i<abs(q.n);i++)result=multiply(result,a);
            return q.n<0n?divide(constant(1),result):result;
          }
          if(node.fn==='factorial'){
            const q=scalar(a);if(q.d!==1n||q.n<0n||q.n>20n)throw Error();let result=1n;for(let i=2n;i<=q.n;i++)result*=i;return term(rational(result));
          }
          throw Error();
        }
        if(node.type==='FunctionNode'&&node.fn.type==='SymbolNode'&&node.fn.name==='polar'&&node.args.length===2&&String(mode).toUpperCase()==='CMPLX'){
          const radius=visit(node.args[0],depth+1),theta=visit(node.args[1],depth+1);
          return multiply(radius,plus(trig('cos',theta),multiply(trig('sin',theta),term(rational(1n),1,0,true))));
        }
        if(node.type==='FunctionNode'&&node.fn.type==='SymbolNode'&&node.args.length===1){
          const name=node.fn.name,arg=visit(node.args[0],depth+1);
          if(name==='sqrt')return squareRoot(arg);
          if(name==='percent')return divide(arg,constant(100));
          if(name==='sin'||name==='cos'||name==='tan')return trig(name,arg);
          if(name==='asin'||name==='acos'||name==='atan')return inverseTrig(name,arg);
          if(name==='square')return multiply(arg,arg);
          if(name==='cube')return multiply(multiply(arg,arg),arg);
          if(name==='inverse')return divide(constant(1),arg);
          if(name==='conj')return new Map([...arg].map(([key,c])=>[key,key.endsWith(':i')?rational(-c.n,c.d):c]));
          if(name==='re')return new Map([...arg].filter(([key])=>!key.endsWith(':i')));
          if(name==='im')return new Map([...arg].filter(([key])=>key.endsWith(':i')).map(([key,c])=>[key.slice(0,-2),c]));
          if(name==='abs'){
            const conjugate=new Map([...arg].map(([key,c])=>[key,key.endsWith(':i')?rational(-c.n,c.d):c]));
            return squareRoot(multiply(arg,conjugate));
          }
        }
        throw Error();
      }
      const result=clean(visit(math.parse(normalize(expression))));
      if(result.size===0)return '0';
      if(complex==='polar'&&[...result.keys()].some(key=>key.endsWith(':i')))return null;
      if(result.size===1&&result.has('1:0')){
        const {n,d}=result.get('1:0'),sign=n<0n?'−':'',numerator=abs(n);
        if(d===1n)return sign+numerator;
        if(mixed&&numerator>d)return sign+(numerator/d)+' '+(numerator%d)+'/'+d;
        return sign+numerator+'/'+d;
      }
      const parts=[];
      for(const [key,c]of [...result].sort((a,b)=>Number(a[0].endsWith(':i'))-Number(b[0].endsWith(':i'))||a[0].localeCompare(b[0]))){
        const [radical,power]=key.split(':').map(Number),numerator=abs(c.n);
        const symbol=(radical===1?'':'√'+radical)+(power===0?'':power===1?'π':'π^'+power)+(key.endsWith(':i')?'i':'');
        const body=(numerator===1n&&symbol?'':String(numerator))+symbol+(c.d===1n?'':'/'+c.d);
        parts.push((parts.length?(c.n<0n?' − ':' + '):(c.n<0n?'−':''))+body);
      }
      return parts.join('');
    }catch(_){return null;}
  }

  function dms(value) {
    real(value);if(Math.abs(value)>9999999+59/60+59/3600)fail('הערך גדול מדי להצגת מעלות, דקות ושניות.');
    const sign=value<0?'−':'';
    // Round the total before splitting so seconds and minutes carry correctly.
    const ticks=Math.round(Math.abs(value)*3600*1e6);
    const degrees=Math.floor(ticks/3600000000),remainder=ticks-degrees*3600000000;
    const minutes=Math.floor(remainder/60000000),seconds=(remainder-minutes*60000000)/1e6;
    return sign+degrees+'° '+minutes+'′ '+seconds+'″';
  }
  return {evaluate,format,fraction,exact,dms,normalize};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createEngine};
