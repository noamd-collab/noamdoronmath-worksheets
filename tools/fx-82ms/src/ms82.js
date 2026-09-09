/* Independent fx-82MS 2nd edition practice model. No Casio firmware or assets.
 * Input precedence and key sequences: official S-V.P.A.M. User's Guide (2018/2024).
 */
function createMS82(engine, algorithms, saved) {
  'use strict';
  const defaults=()=>({angle:'deg',format:'norm',digits:10,mixed:true,decimal:'.',contrast:6});
  const vars=()=>Object.fromEntries('ABCDEFMXY'.split('').concat('Ans').map(x=>[x,0]));
  const s={tokens:[],cursor:0,insert:false,result:0,done:false,view:'decimal',shift:false,alpha:false,hyp:false,on:true,mode:'COMP',reg:'linear',settings:defaults(),memory:vars(),menu:null,history:[],historyIndex:0,rows:[],dataIndex:null,editOff:false,percent:null,eng:null,statement:0,error:null};
  if(saved){Object.assign(s.settings,saved.settings||{});for(const k of Object.keys(s.memory))if(Number.isFinite(saved.memory?.[k]))s.memory[k]=saved.memory[k];}
  const prefix=new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','asinh','acosh','atanh','sqrt','cbrt','log','ln','exp','pow10','neg']);
  const post=new Set(['sq','cube','inv','fact','deg','rad','gra','predictX','predictX2','predictY']);
  const alpha={negative:'A',dms:'B',hyp:'C',sin:'D',cos:'E',tan:'F',close:'X',comma:'Y',memory:'M',pol:':',ln:'e'};
  const names={frac:'┘',neg:'−',mul:'×',div:'÷',sq:'²',cube:'³',inv:'⁻¹',fact:'!',power:'^',root:'x√',sqrt:'√',cbrt:'³√',pow10:'10^',exp:'e^',asin:'sin⁻¹ ',acos:'cos⁻¹ ',atan:'tan⁻¹ ',asinh:'sinh⁻¹ ',acosh:'cosh⁻¹ ',atanh:'tanh⁻¹ ',pol:'Pol(',rec:'Rec(',EXP:'E',pi:'π',random:'Ran#',degree:'°',deg:'°',rad:'ʳ',gra:'ᵍ',predictX:'x̂',predictX2:'x̂₂',predictY:'ŷ'};
  const fail=(code='Syntax ERROR',position=s.cursor)=>{const e=new Error(code);e.code=code;e.position=position;throw e;};
  const label=t=>typeof t==='object'?t.label:(names[t]??(prefix.has(t)?t+' ':t));
  const text=(ts=s.tokens)=>ts.map(label).join('');
  const numeric=v=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>=1e100)fail('Math ERROR');return Math.abs(v)<1e-99?0:v;};
  const call=(name,args)=>{const value=engine.evaluate(name+'('+args.map(v=>'('+v+')').join(',')+')',{angle:s.settings.angle,format:s.settings.format,digits:s.settings.digits,mode:'COMP',scope:s.memory,coordinateScalar:true,onCoordinates:pair=>{s.memory.E=pair[0];s.memory.F=pair[1];}});return numeric(Array.isArray(value)?value[0]:value);};
  function calculate(ts) {
    let i=0,depth=0;
    const numberToken=t=>typeof t==='string'&&/^[0-9.]$/.test(t);
    const isMemory=t=>typeof t==='string'&&/^(A|B|C|D|E|F|M|X|Y|Ans|pi|e)$/.test(t);
    const starts=t=>numberToken(t)||isMemory(t)||prefix.has(t)||['(','pol','rec','random'].includes(t)||typeof t==='object';
    const atom=()=>{
      if(++depth>24)fail('Stack ERROR',i);let t=ts[i++],v;
      if(numberToken(t)||t==='EXP'){
        let str=t==='EXP'?'1':t;
        if(t!=='EXP')while(numberToken(ts[i]))str+=ts[i++];
        if(t==='EXP'||ts[i]==='EXP'){
          if(t!=='EXP')i++;str+='e';if(ts[i]==='neg'||ts[i]==='-'){str+='-';i++;}else if(ts[i]==='+'){str+='+';i++;}
          let exp='';while(typeof ts[i]==='string'&&/^[0-9]$/.test(ts[i]))exp+=ts[i++];if(!exp||exp.length>2)fail('Syntax ERROR',i);str+=exp;
        }
        if(!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/.test(str))fail('Syntax ERROR',i-1);v=Number(str);
      }else if(isMemory(t))v=t==='pi'?Math.PI:t==='e'?Math.E:s.memory[t];
      else if(t==='random')v=Math.floor(Math.random()*1000)/1000;
      else if(t==='('){v=expr(0);if(ts[i]===')')i++;else if(i<ts.length)fail('Syntax ERROR',i);}
      else if(t==='pol'||t==='rec'){
        const a=expr(0);if(ts[i++]!==',')fail('Syntax ERROR',i-1);const b=expr(0);if(ts[i]===')')i++;else if(i<ts.length)fail('Syntax ERROR',i);
        v=call(t,[a,b]);
      }else if(prefix.has(t)){const a=expr(50);v=t==='neg'?-a:call(t,[a]);}
      else if(t&&typeof t==='object')v=statValue(t.key);
      else fail('Syntax ERROR',i-1);
      depth--;return numeric(v);
    };
    const expr=min=>{
      let a=atom();
      while(i<ts.length){const op=ts[i];
        if(post.has(op)||op==='degree'){
          if(90<min)break;i++;
          if(op==='degree'){
            const parts=[a];
            while(parts.length<3&&numberToken(ts[i])){let str='';while(numberToken(ts[i]))str+=ts[i++];if(ts[i++]!=='degree')fail('Syntax ERROR',i-1);parts.push(Number(str));}
            a=parts[0]+(parts[1]||0)/60+(parts[2]||0)/3600;
          }else if(op.startsWith('predict')){const stats=algorithms.stats(s.rows,s.reg);a=op==='predictY'?stats.predictY(a):stats.predictX(a);if(Array.isArray(a)){a.sort((x,y)=>x-y);a=a[op==='predictX2'?1:0];}}
          else if(['deg','rad','gra'].includes(op))a=a*({deg:Math.PI/180,rad:1,gra:Math.PI/200}[op])/({deg:Math.PI/180,rad:1,gra:Math.PI/200}[s.settings.angle]);
          else a=op==='sq'?a*a:op==='cube'?a*a*a:op==='inv'?1/a:call('fact',[a]);
          a=numeric(a);continue;
        }
        const implied=starts(op);
        let p=op==='power'||op==='root'?80:op==='frac'?70:implied?(isMemory(op)?60:40):op==='npr'||op==='ncr'?30:op==='mul'||op==='div'?20:op==='+'||op==='-'?10:-1;
        if(p<min)break;if(!implied)i++;
        const b=expr(p+1);
        if(op==='frac'){
          if(ts[i]==='frac'){
            if(!s.settings.mixed)fail('Math ERROR',i);i++;const c=expr(71);if(!Number.isInteger(a)||!Number.isInteger(b)||!Number.isInteger(c)||c===0)fail('Math ERROR',i);a=a+b/c;
          }else{if(!Number.isInteger(a)||!Number.isInteger(b)||b===0)fail('Math ERROR',i);a/=b;}
        }else if(implied||op==='mul')a*=b;
        else if(op==='div')a/=b;
        else if(op==='+')a+=b;
        else if(op==='-')a-=b;
        else if(op==='power')a=call('pow',[a,b]);
        else if(op==='root')a=call('nthRoot',[b,a]);
        else a=call(op,[a,b]);
        a=numeric(a);
      }
      return a;
    };
    if(!ts.length)fail('Syntax ERROR',0);const v=expr(0);if(i<ts.length)fail('Syntax ERROR',i);return numeric(v);
  }
  function statValue(key){
    const st=algorithms.stats(s.rows,s.mode==='SD'?'one':s.reg);let v=key.startsWith('sum.')?st.sums[key.slice(4)]:key.startsWith('coef.')?st.coefficients[key.slice(5)]:st[key];if(v==null)fail('Math ERROR');return numeric(v);
  }
  function clear(){s.tokens=[];s.cursor=0;s.insert=false;s.done=false;s.view='decimal';s.result=0;s.menu=null;s.shift=s.alpha=s.hyp=false;s.dataIndex=null;s.percent=null;s.eng=null;s.error=null;s.statement=0;}
  function resetMode(){s.mode='COMP';s.reg='linear';s.settings=defaults();s.rows=[];s.editOff=false;s.history=[];clear();}
  function insert(t,continueResult=false){
    if(s.done||s.dataIndex!==null){const wasData=s.dataIndex!==null;if(s.done){s.tokens=continueResult?['Ans']:[];s.cursor=s.tokens.length;}s.done=false;if(wasData)s.dataEditing=true;s.view='decimal';s.eng=null;s.percent=null;s.statement=0;}
    s.error=null;
    if(s.tokens.length>=79&&(s.insert||s.cursor>=s.tokens.length))return;
    if(s.insert||s.cursor>=s.tokens.length)s.tokens.splice(s.cursor,0,t);else s.tokens[s.cursor]=t;
    s.cursor++;s.menu=null;
  }
  function remember(){if(s.mode!=='COMP')return;s.history.push({tokens:s.tokens.slice(),result:s.result,view:s.view,percent:s.percent?{...s.percent}:null});while(s.history.reduce((n,h)=>n+h.tokens.length+1,0)>150)s.history.shift();s.historyIndex=s.history.length-1;}
  function finish(value,view='decimal',record=true){s.result=numeric(value);s.memory.Ans=s.result;s.done=true;s.insert=false;s.view=view;s.eng=null;s.menu=null;s.error=null;s.cursor=s.tokens.length;if(record)remember();}
  function equals(){
    if(s.dataIndex!==null&&s.dataEditing){const {row,field}=dataField();const v=calculate(s.tokens);if(field==='freq'&&(!Number.isInteger(v)||v<0))fail('Math ERROR');s.rows[row][field]=v;s.dataEditing=false;s.tokens=[];s.result=v;s.done=true;return;}
    if(s.percent){percent();return;}
    const parts=[[]];s.tokens.forEach(t=>t===':'?parts.push([]):parts.at(-1).push(t));
    if(s.done&&s.statement<parts.length-1)s.statement++;else if(s.done)s.statement=0;
    const part=parts[s.statement];const v=part.length?calculate(part):s.memory.Ans;
    const vtype=part.includes('frac')&&!part.includes('.')?'fraction':part.includes('degree')?'dms':'decimal';finish(v,vtype);
  }
  function percent(){
    const ts=s.tokens;let index=-1,depth=0;for(let i=0;i<ts.length;i++){if(ts[i]==='('||ts[i]==='pol'||ts[i]==='rec')depth++;if(ts[i]===')')depth--;if(depth===0&&['+','-','mul','div'].includes(ts[i]))index=i;}
    let v,base=null,op=null;
    if(index<0)v=calculate(ts)/100;
    else{base=calculate(ts.slice(0,index));const b=calculate(ts.slice(index+1));op=ts[index];v=op==='mul'?base*b/100:op==='div'?base/b*100:op==='+'?(base+b)/b*100:(base-b)/b*100;}
    s.percent={base,op};finish(v,'decimal',false);remember();
  }
  function formatResult(){
    if(!s.on)return '';
    if(s.eng!==null){const exponent=s.eng,mantissa=s.result/10**exponent;return Number(mantissa.toPrecision(10)).toString()+(Number.isInteger(mantissa)?'.':'')+'e'+exponent;}
    if(s.view==='fraction'){
      let f=engine.fraction(s.result,{mixed:s.settings.mixed});if(f){f=f.replace(/ /g,'┘').replace(/\//g,'┘');if(f.length<=10)return f;}
    }
    if(s.view==='dms')return engine.dms(s.result).replace(/ /g,'').replace('′',"'").replace('″','"');
    let v=engine.format(s.result,s.settings).replace(/−/g,'-');
    v=v.replace(/ × 10\^([+-]?\d+)/,'e$1').replace(/×10\^([+-]?\d+)/,'e$1');
    if(!/[.e]/.test(v))v+='.';else if(v.includes('e')&&!v.split('e')[0].includes('.'))v=v.replace('e','.e');
    if(s.settings.decimal===',')v=v.replace('.',',');return v;
  }
  const sumPages=[[['Σx²','sum.x2'],['Σx','sum.x'],['n','n']],[['Σy²','sum.y2'],['Σy','sum.y'],['Σxy','sum.xy']],[['Σx³','sum.x3'],['Σx²y','sum.x2y'],['Σx⁴','sum.x4']]];
  function varPages(){return [[['x̄','meanX'],['xσn','popStdX'],['xσn-1','sampleStdX']],[['ȳ','meanY'],['yσn','popStdY'],['yσn-1','sampleStdY']],[['A','coef.A'],['B','coef.B'],[s.reg==='quadratic'?'C':'r',s.reg==='quadratic'?'coef.C':'coef.r']],s.reg==='quadratic'?[['x̂₁','predictX'],['x̂₂','predictX2'],['ŷ','predictY']]:[['x̂','predictX'],['ŷ','predictY']]];}
  function menuLines(){
    const m=s.menu;if(!m)return null;
    if(m.kind==='mode')return [['COMP SD REG','1    2   3'],['Deg Rad Gra','1   2   3'],['Fix Sci Norm','1   2   3'],['Disp◀CONT▶','1    2']][m.page];
    if(m.kind==='reg')return m.page===0?['Lin Log Exp','1   2   3']:['Pwr Inv Quad','1   2   3'];
    if(m.kind==='format')return [m.format==='norm'?'Norm 1~2?':m.format==='fix'?'Fix 0~9?':'Sci 0~9?',''];
    if(m.kind==='disp')return m.page===0?['ab/c   d/c','1      2']:['Dot  Comma','1    2'];
    if(m.kind==='clear')return [s.mode==='COMP'?'Mcl Mode All':'Scl Mode All','1    2    3'];
    if(m.kind==='confirm')return [m.option===1?(s.mode==='COMP'?'Mcl?':'Scl?'):m.option===2?'Mode?':'All?','[=]  [AC]'];
    if(m.kind==='angle')return ['D   R   G','1   2   3'];
    if(m.kind==='contrast')return ['Light  Dark','◀         ▶'];
    if(m.kind==='full')return ['EditOFF  ESC','1        2'];
    if(m.kind==='sum'||m.kind==='var'){const entries=(m.kind==='sum'?sumPages:varPages())[m.page];return [entries.map(x=>x[0]).join(' '),entries.map((_,i)=>i+1).join('    ')];}
    return null;
  }
  function choose(n){const m=s.menu;
    if(m.kind==='mode'){
      if(m.page===0&&[1,2,3].includes(n)){if(n===3){s.menu={kind:'reg',page:0};return;}s.mode=n===1?'COMP':'SD';s.history=[];s.rows=[];s.editOff=false;clear();}
      else if(m.page===1&&[1,2,3].includes(n)){s.settings.angle=['deg','rad','gra'][n-1];s.menu=null;}
      else if(m.page===2&&[1,2,3].includes(n))s.menu={kind:'format',format:['fix','sci','norm'][n-1]};
      else if(m.page===3&&n===1)s.menu={kind:'disp',page:0};
      else if(m.page===3&&n===2)s.menu={kind:'contrast'};
    }else if(m.kind==='reg'&&[1,2,3].includes(n)){s.mode='REG';s.reg=['linear','log','exp','power','inverse','quadratic'][m.page*3+n-1];s.rows=[];s.editOff=false;s.history=[];for(const k of 'ABCDEFXY')s.memory[k]=0;clear();}
    else if(m.kind==='format'){
      if(m.format==='norm'){if(n!==1&&n!==2)return;s.settings.format=n===1?'norm':'norm2';s.settings.digits=10;}
      else{s.settings.format=m.format;s.settings.digits=m.format==='sci'?(n||10):n;}
      s.menu=null;
    }else if(m.kind==='disp'&&[1,2].includes(n)){if(m.page===0)s.settings.mixed=n===1;else s.settings.decimal=n===1?'.':',';s.menu=null;}
    else if(m.kind==='clear'&&[1,2,3].includes(n))s.menu={kind:'confirm',option:n};
    else if(m.kind==='angle'&&[1,2,3].includes(n))insert(['deg','rad','gra'][n-1],true);
    else if(m.kind==='sum'||m.kind==='var'){
      const entry=(m.kind==='sum'?sumPages:varPages())[m.page][n-1];if(!entry)return;
      insert(entry[1].startsWith('predict')?entry[1]:{label:entry[0],key:entry[1]},entry[1].startsWith('predict'));
    }else if(m.kind==='full'&&[1,2].includes(n)){s.menu=null;if(n===1){s.editOff=true;s.rows.push(s.pendingRow);s.pendingRow=null;showDataCount();}else{s.pendingRow=null;clear();}}
  }
  function dataField(){const fields=s.mode==='SD'?['x','freq']:['x','y','freq'];return {row:Math.floor(s.dataIndex/fields.length),field:fields[s.dataIndex%fields.length]};}
  function showDataCount(){s.tokens=[];s.cursor=0;s.result=s.rows.reduce((n,r)=>n+r.freq,0);s.done=true;s.dataIndex=null;s.dataEditing=false;s.view='decimal';s.dataCount=true;}
  function data(add=true){
    if(!add){if(s.rows.length){const row=s.dataIndex===null?s.rows.length-1:dataField().row;s.rows.splice(row,1);}showDataCount();return;}
    let row;
    if((!s.tokens.length||s.done)&&s.rows.length)row={...s.rows.at(-1)};
    else{
      const sep=s.tokens.indexOf(';'),ts=sep<0?s.tokens:s.tokens.slice(0,sep);const freq=sep<0?1:calculate(s.tokens.slice(sep+1));
      if(!Number.isInteger(freq)||freq<0||freq>1e9)fail('Math ERROR');
      if(s.mode==='SD')row={x:calculate(ts),freq};
      else{let depth=0,index=-1;ts.forEach((t,i)=>{if(t==='('||t==='pol'||t==='rec')depth++;if(t===')')depth--;if(t===','&&depth===0)index=i;});if(index<0)fail('Syntax ERROR');row={x:calculate(ts.slice(0,index)),y:calculate(ts.slice(index+1)),freq};}
    }
    if(!s.editOff&&s.rows.length>=(s.mode==='SD'?80:40)){s.pendingRow=row;s.error={code:'Data Full'};return;}
    if(s.rows.length>=10000)fail('Stack ERROR');s.rows.push(row);showDataCount();
  }
  function arrow(key){
    if(s.error){s.cursor=Math.max(0,Math.min(s.tokens.length,s.error.position??s.tokens.length));s.error=null;s.done=false;return;}
    if(s.menu){const m=s.menu;if(m.kind==='contrast'){s.settings.contrast=Math.max(1,Math.min(9,s.settings.contrast+(key==='right'?1:key==='left'?-1:0)));return;}
      if(['left','right'].includes(key)&&['reg','disp','sum','var'].includes(m.kind)){
        const count=m.kind==='reg'||m.kind==='disp'?2:s.mode==='SD'?1:m.kind==='var'?4:s.reg==='quadratic'?3:2;
        m.page=(m.page+(key==='right'?1:-1)+count)%count;
      }return;}
    if(key==='up'||key==='down'){
      if(s.mode!=='COMP'&&s.rows.length&&!s.editOff){const fields=s.mode==='SD'?2:3,count=s.rows.length*fields;s.dataIndex=s.dataIndex===null?(key==='up'?count-fields:0):(s.dataIndex+(key==='up'?-1:1)+count)%count;const {row,field}=dataField();s.tokens=[];s.result=s.rows[row][field];s.done=true;s.dataEditing=false;s.view='decimal';return;}
      if(!s.history.length)return;const change=key==='up'?-1:1;s.historyIndex=Math.max(0,Math.min(s.history.length-1,s.historyIndex+change));const h=s.history[s.historyIndex];s.tokens=h.tokens.slice();s.result=h.result;s.view=h.view;s.percent=h.percent?{...h.percent}:null;s.done=true;s.cursor=s.tokens.length;return;
    }
    if(s.done){s.done=false;s.cursor=key==='left'?s.tokens.length:0;s.dataIndex=null;return;}
    s.cursor=Math.max(0,Math.min(s.tokens.length,s.cursor+(key==='left'?-1:1)));
  }
  function press(key){
    try{
      if(key==='on'){s.on=true;s.history=[];clear();return;}
      if(!s.on)return;
      if(key==='shift'){s.shift=!s.shift;s.alpha=false;return;}
      if(key==='alpha'){s.alpha=!s.alpha;s.shift=false;return;}
      if(['left','right','up','down'].includes(key)){arrow(key);s.shift=s.alpha=false;return;}
      const shift=s.shift,al=s.alpha;s.shift=s.alpha=false;
      if(key==='ac'){if(shift)s.on=false;clear();return;}
      if(s.error){if(s.error.code==='Data Full'&&key==='equals'){s.error=null;s.menu={kind:'full'};}return;}
      if(s.menu?.kind==='store'||s.menu?.kind==='recall'){
        const variable=alpha[key];if(!variable||!Object.hasOwn(s.memory,variable))return;
        if(s.menu.kind==='store'){const v=s.done?s.result:s.tokens.length?calculate(s.tokens):s.result;s.memory[variable]=v;finish(v,'decimal',false);}
        else{s.tokens=[variable];finish(s.memory[variable],'decimal',false);}s.menu=null;return;
      }
      if(key==='mode'){s.menu=shift?{kind:'clear'}:{kind:'mode',page:s.menu?.kind==='mode'?(s.menu.page+1)%4:0};s.hyp=false;return;}
      if(s.menu){
        if(s.menu.kind==='confirm'&&key==='equals'){const n=s.menu.option;if(n===1){if(s.mode==='COMP')s.memory=vars();else{s.rows=[];s.editOff=false;}}if(n===2)resetMode();if(n===3){s.memory=vars();resetMode();}clear();return;}
        if(/^\d$/.test(key)){choose(Number(key));return;}return;
      }
      if(al){if(alpha[key])insert(alpha[key]);return;}
      if(key==='hyp'){s.hyp=true;if(shift)s.shift=true;return;}
      if(key==='rcl'){s.menu={kind:shift?'store':'recall'};return;}
      if(key==='del'){
        if(shift){if(s.done){s.done=false;s.cursor=s.tokens.length;}s.insert=!s.insert;return;}
        if(s.done){s.done=false;s.cursor=s.tokens.length;}if(s.cursor===s.tokens.length)s.cursor=Math.max(0,s.cursor-1);s.tokens.splice(s.cursor,1);s.error=null;s.percent=null;return;
      }
      if(shift){
        const shifted={inverse:'fact',ncr:'npr',pol:'rec',cube:'cbrt',power:'root',log:'pow10',ln:'exp',comma:';',exp:'pi',dot:'random'};
        if(key==='fraction'){if(s.done){s.settings.mixed=!s.settings.mixed;s.view='fraction';}return;}
        if(key==='dms'){if(s.done)s.view='decimal';return;}
        if(key==='ans'){s.menu={kind:'angle'};return;}
        if(key==='0'){const v=s.done?s.result:s.tokens.length?calculate(s.tokens):s.result;finish(call('rnd',[v]),'decimal',false);return;}
        if(key==='1'||key==='2'){if(s.mode!=='COMP')s.menu={kind:key==='1'?'sum':'var',page:0};return;}
        if(key==='equals'){percent();return;}
        if(key in shifted){insert(shifted[key],post.has(shifted[key])||['npr','root'].includes(shifted[key]));return;}
      }
      if(['sin','cos','tan'].includes(key)){const name=(shift?'a':'')+key+(s.hyp?'h':'');s.hyp=false;insert(name);return;}
      if(key==='memory'){if(s.mode!=='COMP'){data(!shift);return;}const v=s.done?s.result:s.tokens.length?calculate(s.tokens):s.result;s.memory.M=numeric(s.memory.M+(shift?-v:v));finish(v,'decimal',false);return;}
      if(key==='eng'){
        if(!s.done)equals();let e=s.eng;if(e===null){const log=s.result===0?0:Math.floor(Math.log10(Math.abs(s.result)));e=Math.floor(log/3)*3;if(shift)e+=3;}else e+=shift?3:-3;
        if(Math.abs(e)<=99)s.eng=e;s.view='decimal';return;
      }
      if(key==='fraction'){if(s.done){s.view=s.view==='fraction'?'decimal':'fraction';s.eng=null;}else insert('frac');return;}
      if(key==='dms'){if(s.done){s.view=s.view==='dms'?'decimal':'dms';s.eng=null;}else insert('degree');return;}
      if(key==='equals'){equals();return;}
      if((key==='+'||key==='-')&&s.done&&s.percent?.op==='mul'){const base=s.percent.base;finish(base+(key==='+'?s.result:-s.result));s.percent=null;return;}
      const map={inverse:'inv',negative:'neg',square:'sq',power:'power',ncr:'ncr',pol:'pol',sqrt:'sqrt',cube:'cube',log:'log',ln:'ln',open:'(',close:')',comma:',',exp:'EXP',ans:'Ans',dot:'.',mul:'mul',div:'div'};
      const t=map[key]??key;if(/^\d$/.test(t)||prefix.has(t)||post.has(t)||['+','-','mul','div','power','ncr','(',')',',','EXP','Ans','.','pol'].includes(t)){
        const continuing=post.has(t)||['+','-','mul','div','power','ncr'].includes(t);s.dataCount=false;insert(t,continuing);
      }
    }catch(e){s.error={code:e.code||'Math ERROR',position:e.position??s.cursor};s.menu=null;s.insert=false;}
  }
  function display(){
    let expression=text();if(s.dataCount&&s.done)expression='n=';
    if(s.dataIndex!==null&&!s.dataEditing){const {row,field}=dataField();expression=(field==='freq'?'Freq':field)+(row+1)+'=';}
    const menu=menuLines();if(menu)expression=menu[0];
    if(s.menu?.kind==='store')expression+='→';if(s.menu?.kind==='recall')expression='RCL';
    return {expression:s.on?(s.error?s.error.code:expression):'',result:s.on?(s.error?'':menu?menu[1]:formatResult()):'',cursor:s.on&&!s.done&&!s.menu&&!s.error?text(s.tokens.slice(0,s.cursor)).length:null,insert:s.insert,status:[s.shift?'S':'',s.alpha?'A':'',s.memory.M?'M':'',s.mode==='COMP'?'':s.mode,{deg:'D',rad:'R',gra:'G'}[s.settings.angle],s.settings.format==='fix'?'FIX':s.settings.format==='sci'?'SCI':'',s.hyp?'hyp':'',s.statement<s.tokens.filter(t=>t===':').length?'Disp':''].filter(Boolean).join(' '),menu:!!menu,historyUp:s.history.length>0,historyDown:s.historyIndex<s.history.length-1};
  }
  return {state:s,press,display,calculate,text,save:()=>({memory:s.memory,settings:s.settings})};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createMS82};
