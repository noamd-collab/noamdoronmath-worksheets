const {test}=require('node:test');const assert=require('node:assert/strict');const math=require('mathjs');
const {createEngine}=require('./core');const {createAlgorithms}=require('./algorithms');const {createMS82}=require('./ms82');
const fresh=()=>createMS82(createEngine(math),createAlgorithms(math));
function run(c,seq){for(const word of seq.split(/\s+/)){if(/^\d+$/.test(word))for(const d of word)c.press(d);else c.press(word);}return c;}
function close(c,v,tol=1e-9){assert.equal(c.state.error,null,JSON.stringify(c.state.error));assert.ok(Math.abs(c.state.result-v)<=tol*Math.max(1,Math.abs(v)),`${c.state.result} != ${v}`);}
const cases=[
['mixed arithmetic','3 mul 4 div 30 equals',.4],['photo expression','sin 60 + cos 90 equals',.8660254038],
['prefix scopes','sin 30 + cos 60 equals',1],['unary priority','negative 2 power 4 equals',-16],['parenthesis priority','open negative 2 close power 4 equals',16],
['powers left associative','2 power 3 power 2 equals',64],['implicit variable priority','sin 30 shift exp equals',Math.sin(30*Math.PI*Math.PI/180)],
['omitted parentheses','2 mul open 3 + 4 equals',14],['implied multiplication','2 sqrt 3 equals',2*Math.sqrt(3)],
['inverse','open 3 inverse - 4 inverse close inverse equals',12],['square','123 + 30 square equals',1023],['cube','12 cube equals',1728],
['power root','7 shift power 123 equals',1.988647795],['negative cube root','shift cube open negative 27 close equals',-3],
['roots','sqrt 2 + sqrt 3 mul sqrt 5 equals',5.287196909],['factorial','8 shift inverse equals',40320],['combinations','10 ncr 4 equals',210],['permutations','10 shift ncr 4 equals',5040],
['natural log','ln shift ln 1 equals',1],['common log','log 1000 equals',3],['power ten','shift log 3 equals',1000],['exponential','shift ln 2 equals',Math.exp(2)],
['inverse trig','shift sin 0 dot 5 equals',30],['hyperbolic','hyp sin 1 equals',1.175201194],['inverse hyperbolic','shift hyp sin 1 equals',.881373587],
['scientific entry','1 dot 23 exp negative 3 equals',.00123],['scientific one implied','exp 5 equals',1e5],
['simple fractions','2 fraction 3 + 1 fraction 5 equals',13/15],['mixed fractions','3 fraction 1 fraction 4 + 1 fraction 2 fraction 3 equals',4+11/12],['negative fraction','negative 1 fraction 2 equals',-.5],
['decimal fraction arithmetic','1 fraction 2 + 1 dot 6 equals',2.1],['percent of','1500 mul 12 shift equals',180],['ratio percent','660 div 880 shift equals',75],['markup','2500 mul 15 shift equals +',2875],['discount','3500 mul 25 shift equals -',2625],['increase percent','300 + 500 shift equals',160],['change percent','46 - 40 shift equals',15],
['sexagesimal','2 dms 20 dms 30 dms + 0 dms 39 dms 30 dms equals',3],['angle radians','mode mode 2 sin shift exp div 2 equals',0],
['radians parentheses','mode mode 2 sin open shift exp div 2 close equals',1],['grad','mode mode 3 sin 100 equals',1],['angle conversion','mode mode 2 180 shift ans 1 equals',Math.PI],
['coordinate rect','shift pol 2 comma 60 close equals',1],['coordinate polar','pol 1 comma sqrt 3 close equals',2],
['replay deletion','4 mul 3 + 2 equals left del del - 7 equals',5],['overwrite','cos 60 left left left sin equals',Math.sin(Math.PI/3)],
['insertion','2 dot 36 square left left left left left shift del sin equals',Math.sin(2.36**2*Math.PI/180)],
['duplicate operator deletion','369 mul mul 2 left left del equals',738],
['memory recall','3 + 5 shift rcl negative rcl negative',8],['variable expression','3 + 5 shift rcl negative alpha negative mul 10 equals',80],['memory total','23 + 9 shift rcl memory 53 - 6 memory 45 mul 2 shift memory 99 div 3 memory rcl memory',22],
['consecutive calculation','3 mul 4 equals div 30 equals',.4],
];
for(const [name,seq,expected]of cases)test(name,()=>close(run(fresh(),seq),expected));
test('E/F coordinate memories',()=>{const c=run(fresh(),'shift pol 2 comma 60 close equals rcl tan');close(c,Math.sqrt(3));});
test('linear fraction display and toggles',()=>{const c=run(fresh(),'2 dot 75 equals fraction');assert.equal(c.display().result,'2┘3┘4');run(c,'shift fraction');assert.equal(c.display().result,'11┘4');run(c,'fraction');assert.equal(c.display().result,'2.75');});
test('fractions do not have numerator/denominator navigation fields',()=>{const c=run(fresh(),'2 fraction 3 right + 1 fraction 5 equals');assert.equal(c.display().result,'13┘15');});
test('d/c rejects mixed fraction input',()=>{const c=run(fresh(),'mode mode mode mode 1 2 1 fraction 2 fraction 3 equals');assert.equal(c.state.error.code,'Math ERROR');});
test('decimal results stay decimal after fractional input mixed with decimal',()=>{const c=run(fresh(),'1 fraction 2 + 1 dot 6 equals');assert.equal(c.display().result,'2.1');});
test('Fix / Sci / Norm settings',()=>{
 const c=run(fresh(),'mode mode mode 1 3 100 div 7 equals');assert.equal(c.display().result,'14.286');
 run(c,'mode mode mode 2 5 ac 1 div 7 equals');assert.equal(c.display().result,'1.4286e-1');
 run(c,'mode mode mode 3 2 ac 1 div 200 equals');assert.equal(c.display().result,'0.005');
});
test('Rnd uses Fix setting in the actual calculation',()=>{close(run(fresh(),'mode mode mode 1 3 10 div 3 equals shift 0 mul 3 equals'),9.999);});
test('engineering exponent shifts in both directions',()=>{const c=run(fresh(),'1234 equals eng');assert.equal(c.display().result,'1.234e3');run(c,'eng');assert.equal(c.display().result,'1234.e0');run(c,'shift eng');assert.equal(c.display().result,'1.234e3');});
test('replay history AC retention, ON clearing',()=>{const c=run(fresh(),'1 + 1 equals 2 + 2 equals 3 + 3 equals up');close(c,4);run(c,'ac up');close(c,2);run(c,'on');assert.equal(c.state.history.length,0);});
test('percent replay',()=>{const c=run(fresh(),'46 - 40 shift equals right right 8 equals');close(c,20);});
test('multi statement uses Ans at each equals',()=>{const c=run(fresh(),'3 + 3 alpha pol ans mul 3 equals');close(c,6);run(c,'equals');close(c,18);});
test('SD manual data and statistics menus',()=>{
 const c=run(fresh(),'mode 2 shift mode 1 equals 55 memory 54 memory 51 memory 55 memory 53 memory memory 54 memory 52 memory');
 close(c,8);for(const [seq,v]of [['shift 2 3 equals',1.407885953],['shift 2 2 equals',1.316956719],['shift 2 1 equals',53.375],['shift 1 1 equals',22805],['shift 1 2 equals',427],['shift 1 3 equals',8]]){run(c,'ac '+seq);close(c,v);}
});
test('SD frequencies, editing and CL deletion',()=>{
 const c=run(fresh(),'mode 2 110 shift comma 10 memory');close(c,10);run(c,'up 120 equals ac shift 2 1 equals');close(c,120);
 run(c,'up shift memory ac shift 1 3 equals');assert.equal(c.state.rows.length,0);
});
const linear='mode 3 1 10 comma 1003 memory 15 comma 1005 memory 20 comma 1010 memory 25 comma 1011 memory 30 comma 1014 memory';
test('REG linear manual coefficients and prediction',()=>{
 const c=run(fresh(),linear);for(const [seq,v]of [['shift 2 right right 1 equals',997.4],['shift 2 right right 2 equals',.56],['shift 2 right right 3 equals',.982607368],['open negative 5 close shift 2 right right right 2 equals',994.6],['1000 shift 2 right right right 1 equals',4.642857143]]){run(c,'ac '+seq);close(c,v);}
});
test('REG quadratic manual coefficients and both inverse roots',()=>{
 const c=run(fresh(),'mode 3 right 3 29 comma 1 dot 6 memory 50 comma 23 dot 5 memory 74 comma 38 memory 103 comma 46 dot 4 memory 118 comma 48 memory');
 for(const [seq,v]of [['shift 2 right right 1 equals',-35.59856934],['shift 2 right right 2 equals',1.495939413],['shift 2 right right 3 equals',-.00671629667],['16 shift 2 right right right 3 equals',-13.38291067],['20 shift 2 right right right 1 equals',47.14556728],['20 shift 2 right right right 2 equals',175.5872105]]){run(c,'ac '+seq);close(c,v,1e-8);}
});
for(const [reg,v]of [['2',2*Math.log(4)+3],['3',3*Math.exp(.2*4)],['right 1',3*4**2],['right 2',3+2/4]])test('REG type '+reg,()=>{
 const c=run(fresh(),'mode 3 '+reg);for(const x of[1,2,3]){const y=reg==='2'?2*Math.log(x)+3:reg==='3'?3*Math.exp(.2*x):reg==='right 1'?3*x*x:3+2/x;run(c,String(x));c.press('comma');for(const ch of String(y))c.press(ch==='.'?'dot':ch);c.press('memory');}
 run(c,'ac 4 shift 2 right right right 2 equals');close(c,v);
});
test('Data Full retains data and supports escaping or EditOFF',()=>{const c=run(fresh(),'mode 2');for(let i=0;i<80;i++)run(c,'1 memory');run(c,'2 memory');assert.equal(c.state.error.code,'Data Full');run(c,'equals 2');assert.equal(c.state.rows.length,80);run(c,'2 memory equals 1');assert.equal(c.state.rows.length,81);assert.equal(c.state.editOff,true);});
test('Clear memory does not reset settings; clear mode preserves memories',()=>{const c=run(fresh(),'8 shift rcl negative mode mode 2 shift mode 2 equals rcl negative');close(c,8);assert.equal(c.state.settings.angle,'deg');run(c,'shift mode 1 equals rcl negative');close(c,0);});
test('OFF and ON retain independent memories',()=>{const c=run(fresh(),'8 shift rcl negative shift ac 2');assert.equal(c.display().result,'');run(c,'on rcl negative');close(c,8);});
test('error does not overwrite Ans, AC recovers',()=>{const c=run(fresh(),'7 equals 1 div 0 equals');assert.equal(c.state.error.code,'Math ERROR');assert.equal(c.state.memory.Ans,7);run(c,'ac ans equals');close(c,7);});
test('input rejects invalid syntax and remains correctable',()=>{const c=run(fresh(),'1 mul mul 2 equals');assert.equal(c.state.error.code,'Syntax ERROR');run(c,'left del equals');close(c,2);});
test('memory serialization is model specific and validates finite values',()=>{const c=run(fresh(),'3 shift rcl negative');const saved=c.save();const d=createMS82(createEngine(math),createAlgorithms(math),saved);run(d,'rcl negative');close(d,3);});

test('contrast is option 2 after MODE four times, matching 2nd edition',()=>{const c=run(fresh(),'mode mode mode mode');assert.equal(c.display().expression,'Disp◀CONT▶');run(c,'2 right right');assert.equal(c.state.settings.contrast,8);run(c,'left ac');assert.equal(c.state.settings.contrast,7);assert.equal(c.state.menu,null);});
