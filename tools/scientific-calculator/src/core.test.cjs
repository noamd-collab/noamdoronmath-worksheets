const test=require('node:test');
const assert=require('node:assert/strict');
const math=require('mathjs');
const {createEngine}=require('./core.js');
const engine=createEngine(math);
const close=(actual,expected,tolerance=1e-11)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} ≠ ${expected}`);
const evaluate=(expression,options)=>engine.evaluate(expression,options);

test('PLUS multiplication precedence, unary minus, percentages and parentheses',()=>{
  close(evaluate('2(5+4)-2*(-3)'),24);
  close(evaluate('2sin(30)+3pi'),1+3*Math.PI);
  close(evaluate('-2^2'),-4);close(evaluate('(-2)^2'),4);
  close(evaluate('1/2i',{mode:'CMPLX'}).im,-.5);
  close(evaluate('1/(2i)',{mode:'CMPLX'}).im,-.5);
  close(evaluate('1/-2i',{mode:'CMPLX'}).im,.5);
  close(evaluate('1/2*3i',{mode:'CMPLX'}).im,1.5);
  close(evaluate('1/2^3i',{mode:'CMPLX'}).im,-.125);
  close(evaluate('6/2(1+2)'),1);
  close(evaluate('1/2sin(30)'),1);
  close(evaluate('1/2X',{scope:{X:4}}),.125);
  close(evaluate('1/2/3X',{scope:{X:4}}),1/24);
  close(evaluate('2EF+XY',{scope:{E:2,F:3,X:4,Y:5}}),32);
  close(evaluate('2AX+3BX',{scope:{A:2,B:3,X:4}}),52);
  const memoryComplex=evaluate('A+Bi',{mode:'CMPLX',scope:{A:2,B:3}});
  close(memoryComplex.re,2);close(memoryComplex.im,3);
  close(evaluate('200+10%'),200.1);close(evaluate('1/50%'),2);
  close(evaluate('2500+2500*15%'),2875);
  close(evaluate('2^3%'),.08);close(evaluate('200+(1+3)%'),200.04);
  close(evaluate('1e-3%'),.00001);
  close(evaluate('2*(3+4'),14);close(evaluate('sin(30'),.5);
  close(evaluate('2√2'),2*Math.sqrt(2));close(evaluate('√2/2'),Math.sqrt(2)/2);
});

test('scientific functions and all three angle units',()=>{
  for(const [angle,quarter,half] of [['deg',90,30],['rad',Math.PI/2,Math.PI/6],['gra',100,100/3]]){
    close(evaluate(`sin(${quarter})`,{angle}),1);
    close(evaluate('asin(0.5)',{angle}),half);
    close(evaluate(`cos(${quarter})`,{angle}),0);
  }
  const cases={'log(100)':2,'log(2,8)':3,'ln(e)':1,'pow10(3)':1000,'exp(0)':1,'sqrt(9)':3,'cbrt(-8)':-2,'nthRoot(-32,5)':-2,'nthRoot(16,4)':2,'Abs(-7)':7,'5!':120,'0!':1,'nPr(10,4)':5040,'nCr(10,4)':210,'nCr(1000,999)':1000,'sinh(1)':Math.sinh(1),'cosh(1)':Math.cosh(1),'tanh(1)':Math.tanh(1),'asinh(1)':Math.asinh(1),'acosh(2)':Math.acosh(2),'atanh(0.5)':Math.atanh(.5)};
  for(const [input,result]of Object.entries(cases))close(evaluate(input),result);
  close(evaluate('deg(180)',{angle:'rad'}),Math.PI);
  close(evaluate('rad(pi)',{angle:'deg'}),180);
  close(evaluate('gra(100)',{angle:'deg'}),90);
  close(evaluate('Rnd(200/7)',{format:'fix',digits:3}),28.571);
  close(evaluate('Rnd(200/7)',{format:'sci',digits:3}),28.6);
});

test('PLUS negative-base powers use proven odd-denominator fractions in COMP',()=>{
  const cases={
    '(-8)^(1/3)':-2,'(-8)^(2/3)':4,'(-8)^(-1/3)':-.5,
    '(-8)^(2/6)':-2,'(-32)^(1/5)':-2,'(-32)^(2/5)':4,
    '(-8)^(1/(2+1))':-2,'(-8)^((1+1)/(3*2))':-2,
    'pow(-8,1/3)':-2,'(-8)^(-3)':-1/512
  };
  for(const [source,expected]of Object.entries(cases))close(evaluate(source),expected,1e-12);
  close(evaluate('(-8)^(A/B)',{scope:{A:1,B:3}}),-2);
  // Property check: roots of signed perfect odd powers, including reciprocal
  // and even/odd numerator signs. This is algebraic provenance, not guessing.
  for(const denominator of [3,5,7])for(const numerator of [-3,-2,-1,1,2,3]){
    const base=-(2**denominator),expected=(Math.abs(numerator)%2?-1:1)*2**numerator;
    close(evaluate(`(${base})^(${numerator}/${denominator})`),expected,1e-11);
  }
  for(const source of ['(-8)^(1/2)','(-8)^(1/6)','(-8)^(0.3333333333333333)','(-8)^(1.0000000000000002/3)'])assert.throws(()=>evaluate(source),undefined,source);
  assert.throws(()=>evaluate('(-8)^Ans',{scope:{Ans:1/3}}),'memory has no rational provenance');
  const principal=evaluate('(-8)^(1/3)',{mode:'CMPLX'});
  close(principal.re,1);close(principal.im,Math.sqrt(3));
  const principalPow=evaluate('pow(-8,1/3)',{mode:'CMPLX'});
  close(principalPow.re,1);close(principalPow.im,Math.sqrt(3));
});

test('complex arithmetic and coordinates',()=>{
  const options={mode:'CMPLX'};
  const z=evaluate('(2+3i)*(4-5i)',options);close(z.re,23);close(z.im,2);
  const root=evaluate('sqrt(-4)',options);close(root.re,0);close(root.im,2);
  close(evaluate('arg(1+i)',options),45);
  close(evaluate('re(2+3i)',options),2);close(evaluate('im(2+3i)',options),3);
  assert.equal(evaluate('Conjg(2+3i)',options).im,-3);
  close(evaluate('Abs(3+4i)',options),5);
  const pol=evaluate('Pol(1,1)');close(pol[0],Math.sqrt(2));close(pol[1],45);
  const rec=evaluate('Rec(2,60)');close(rec[0],1);close(rec[1],Math.sqrt(3));
  close(evaluate('Pol(sqrt(2),sqrt(2))+5'),7);
  close(evaluate('2*(Rec(2,60))'),2);
  close(evaluate('polar(2,90)',options).im,2);
  close(evaluate('2+3',{scope:{Ans:math.complex(1,2),A:math.complex(2,3)}}),5);
  assert.throws(()=>evaluate('Ans',{scope:{Ans:math.complex(1,2)}}),/CMPLX/);
});

test('matrix and vector arithmetic, dimensions and singular errors',()=>{
  const scope={MatA:[[1,2],[3,4]],MatB:[[2,0],[0,2]],VctA:[1,2,3],VctB:[3,2,1]};
  close(evaluate('det(MatA)',{mode:'MATRIX',scope}),-2);
  assert.deepEqual(evaluate('MatA+MatB',{mode:'MATRIX',scope}),[[3,2],[3,6]]);
  assert.deepEqual(evaluate('MatA*MatB',{mode:'MATRIX',scope}),[[2,4],[6,8]]);
  assert.deepEqual(evaluate('MatA^2',{mode:'MATRIX',scope}),[[7,10],[15,22]]);
  const identity=evaluate('MatA*inverse(MatA)',{mode:'MATRIX',scope});
  close(identity[0][0],1);close(identity[1][1],1);close(identity[0][1],0);
  assert.deepEqual(evaluate('Trn(MatA)',{mode:'MATRIX',scope}),[[1,3],[2,4]]);
  assert.deepEqual(evaluate('Abs([-1,2;3,-4])',{mode:'MATRIX'}),[[1,2],[3,4]]);
  close(evaluate('dot(VctA,VctB)',{mode:'VECTOR',scope}),10);
  assert.deepEqual(evaluate('cross(VctA,VctB)',{mode:'VECTOR',scope}),[-4,8,-4]);
  assert.deepEqual(evaluate('VctA*VctB',{mode:'VECTOR',scope}),[-4,8,-4]);
  assert.deepEqual(evaluate('2*VctA',{mode:'VECTOR',scope}),[2,4,6]);
  close(evaluate('Abs(VctA)',{mode:'VECTOR',scope}),Math.sqrt(14));
  assert.throws(()=>evaluate('inverse([1,2;2,4])'));
  assert.throws(()=>evaluate('dot([1,2],[1,2,3])'));
  assert.deepEqual(evaluate('cross([1,2],[3,4])'),[0,0,-2]);
  assert.throws(()=>evaluate('cross([1,2],[3,4,5])'));
  assert.throws(()=>evaluate('[1,2,3,4]'));
  assert.throws(()=>evaluate('MatA'));
});

test('coordinate memories update inside the expression and commit only on success',()=>{
  const scope={X:17,Y:19},pairs=[];
  const options={scope,onCoordinates:pair=>pairs.push(pair)};
  close(evaluate('Pol(3,4)+X+Y',options),10+Math.atan2(4,3)*180/Math.PI);
  assert.equal(pairs.length,1);close(pairs[0][0],5);close(pairs[0][1],Math.atan2(4,3)*180/Math.PI);
  assert.deepEqual(scope,{X:17,Y:19});
  pairs.length=0;
  close(evaluate('Pol(3,4)+Rec(2,60)+X',options),7);
  assert.equal(pairs.length,1);close(pairs[0][0],1);close(pairs[0][1],Math.sqrt(3));
  pairs.length=0;
  assert.throws(()=>evaluate('Pol(3,4)+1/0',options));
  assert.equal(pairs.length,0);assert.deepEqual(scope,{X:17,Y:19});
  close(evaluate('X+Y',options),36);assert.equal(pairs.length,0);
  close(evaluate('Pol(3,4)+X',{scope}),10);
  assert.deepEqual(scope,{X:17,Y:19});
});

test('memory, dms, random number and output formats',()=>{
  close(evaluate('A+X+Ans',{scope:{A:3,X:4,Ans:5}}),12);
  close(evaluate('dms(-12,30,0)'),-12.5);
  assert.equal(engine.dms(-12.5),'−12° 30′ 0″');
  assert.equal(engine.dms(12+59/60+59.9999999/3600),'13° 0′ 0″');
  for(let i=0;i<20;i++){const n=evaluate('Ran#');assert.ok(n>=0&&n<1);close(n*1000,Math.round(n*1000));}
  const randomPair=evaluate('randomInt(5,6)');assert.ok(randomPair===5||randomPair===6);
  close(evaluate('dms(0,90,120)'),1+32/60);
  assert.equal(engine.dms(evaluate('dms(2,20,30)+dms(0,39,30)')),'3° 0′ 0″');
  assert.throws(()=>engine.dms(1e7));
  assert.equal(engine.format(100/7,{format:'fix',digits:3}),'14.286');
  assert.equal(engine.format(1/7,{format:'sci',digits:5}),'1.4286e-1');
  assert.equal(engine.format(.005,{format:'norm'}),'5e-3');
  assert.equal(engine.format(.005,{format:'norm2'}),'0.005');
  assert.equal(engine.format(12345,{format:'eng'}),'12.345 × 10^3');
  assert.equal(engine.fraction(1/3),'1/3');
  assert.equal(engine.fraction(-7/3,{mixed:true}),'−2 1/3');
  assert.equal(engine.fraction(Math.PI),null);
  assert.equal(engine.format(math.complex(2,-1)),'2 − i');
});

test('exact rational, surd and pi algebra never guesses from decimal answers',()=>{
  const cases={'1/3+1/6':'1/2','0.1+0.2':'3/10','sqrt(8)':'2√2','sqrt(2)/2':'√2/2','1/sqrt(2)':'√2/2','sqrt(2)*sqrt(3)':'√6','sqrt(2)^2':'2','sqrt(2)+sqrt(2)':'2√2','pi/6':'π/6','(pi/3)*3':'π','sin(30)':'1/2','sin(45)':'√2/2','cos(30)':'√3/2','-2^2':'−4','2^(-3)':'1/8','200+10%':'2001/10'};
  for(const [input,result] of Object.entries(cases))assert.equal(engine.exact(input),result,input);
  assert.equal(engine.exact('sin(pi/6)',{angle:'rad'}),'1/2');
  assert.equal(engine.exact('asin(1/2)',{angle:'rad'}),'π/6');
  assert.equal(engine.exact('acos(-sqrt(2)/2)',{angle:'rad'}),'3π/4');
  assert.equal(engine.exact('atan(sqrt(3)/3)',{angle:'rad'}),'π/6');
  assert.equal(engine.exact('atan(2-sqrt(3))',{angle:'rad'}),'π/12');
  assert.equal(engine.exact('asin((sqrt(6)+sqrt(2))/4)',{angle:'rad'}),'5π/12');
  assert.equal(engine.exact('asin(-1)',{angle:'rad'}),'−π/2');
  assert.equal(engine.exact('acos(1)',{angle:'rad'}),'0');
  assert.equal(engine.exact('asin(1/2)',{angle:'gra'}),'100/3');
  assert.equal(engine.exact('asin(1/2)',{angle:'gra',mixed:true}),'33 1/3');
  assert.equal(engine.exact('atan(0.5)',{angle:'rad'}),null);
  assert.equal(engine.exact('asin(0.500000001)',{angle:'rad'}),null);
  assert.equal(engine.exact('7/3',{mixed:true}),'2 1/3');
  assert.equal(engine.exact('-7/3',{mixed:true}),'−2 1/3');
  assert.equal(engine.exact('ln(2)'),null);
  assert.equal(engine.exact('Ans',{scope:{Ans:Math.sqrt(2)}}),null);
  assert.equal(engine.exact('1/(1+sqrt(2))'),'−1 + √2');
  assert.equal(engine.exact('1/(sqrt(3)+sqrt(2))'),'−√2 + √3');
  assert.equal(engine.exact('6/2(1+2)'),'1');
  assert.equal(engine.exact('1/2X',{scope:{X:4}}),'1/8');
});

test('PLUS RanInt includes both signed endpoints and rejects invalid ranges',()=>{
  const original=Math.random;
  try{
    Math.random=()=>0;
    assert.equal(evaluate('RanInt#(-3,8)'),-3);
    assert.equal(evaluate('Ran#'),0);
    Math.random=()=>1-Number.EPSILON;
    assert.equal(evaluate('RanInt#(-3,8)'),8);
    assert.equal(evaluate('RanInt#(0,9999999999)'),9999999999);
    assert.equal(evaluate('RanInt#(-9999999999,0)'),0);
    assert.equal(evaluate('Ran#'),.999);
  }finally{Math.random=original;}
  for(const input of ['RanInt#(5,5)','RanInt#(2,1)','RanInt#(0.5,2)','RanInt#(-10000000000,0)','RanInt#(0,10000000000)','RanInt#(-9999999999,1)'])assert.throws(()=>evaluate(input));
});

test('exact CMPLX display covers the PLUS manual rectangular/polar examples',()=>{
  const options={mode:'CMPLX'};
  assert.equal(engine.exact('(2+6i)/(2i)',options),'3 − i');
  assert.equal(engine.exact('sqrt(2)+sqrt(2)i',options),'√2 + √2i');
  assert.equal(engine.exact('polar(2,45)',options),'√2 + √2i');
  assert.equal(engine.exact('1/2i',options),'−i/2');
  assert.equal(engine.exact('sqrt(-8)',options),'2√2i');
  assert.equal(engine.exact('1/(1+i)',options),'1/2 − i/2');
  assert.equal(engine.exact('(sqrt(3)+i)^2',options),'2 + 2√3i');
  assert.equal(engine.exact('(2+3i)*(2-3i)',options),'13');
  assert.equal(engine.exact('i^3',options),'−i');
  assert.equal(engine.exact('Abs(1+i)',options),'√2');
  assert.equal(engine.exact('Conjg(sqrt(2)+sqrt(3)i)',options),'√2 − √3i');
  assert.equal(engine.exact('Re(sqrt(2)+sqrt(3)i)',options),'√2');
  assert.equal(engine.exact('Im(sqrt(2)+sqrt(3)i)',options),'√3');
  assert.equal(engine.exact('sqrt(2)+sqrt(2)i',{...options,complex:'polar'}),null);
  assert.equal(engine.exact('i'),null);
});

test('manual rounding examples, Sci zero and Norm transition boundaries',()=>{
  close(evaluate('200/7*14',{format:'fix',digits:3}),400);
  close(evaluate('Rnd(200/7)*14',{format:'fix',digits:3}),399.994);
  assert.equal(engine.format(100/7,{format:'fix',digits:3}),'14.286');
  assert.equal(engine.format(1/7,{format:'sci',digits:0}),'1.428571429e-1');
  assert.equal(engine.format(.01,{format:'norm'}),'0.01');
  assert.equal(engine.format(.001,{format:'norm'}),'1e-3');
  assert.equal(engine.format(1e-9,{format:'norm2'}),'0.000000001');
  assert.equal(engine.format(-1.234e-8,{format:'norm2'}),'-0.00000001234');
  assert.equal(engine.format(1/7,{format:'norm',digits:3}),'0.1428571429');
  assert.equal(engine.format(1e-10,{format:'norm2'}),'1e-10');
  assert.equal(engine.format(1e10,{format:'norm2'}),'1e10');
});

test('domain failures, bounded work, and expression sandbox',()=>{
  const failures=['1/0','sqrt(-1)','ln(0)','tan(90)','log(1,4)','(-1)!','1.2!','70!','nCr(2,3)','nPr(1000000000,1000000000)','10^100','nthRoot(2,0)','dms(1,-1,0)','sin()','sin(1,2)','X=4','f(x)=x','import(2)','evaluate(2)','parse(2)','ones(1000000)','range(1,1000000)','[1,2][1]','2;3','foo(2)','constructor(2)','__proto__','1==1','true'];
  for(const input of failures)assert.throws(()=>evaluate(input),undefined,input);
  assert.throws(()=>evaluate('1+'.repeat(600)+'1'));
  assert.throws(()=>evaluate('('.repeat(45)+'1'+')'.repeat(45)));
  assert.throws(()=>evaluate('1+'.repeat(150)+'1'));
});
