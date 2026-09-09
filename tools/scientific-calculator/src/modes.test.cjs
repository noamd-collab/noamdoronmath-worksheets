'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('mathjs');
const { createEngine } = require('./core.js');
const { createAlgorithms } = require('./algorithms.js');
const { createDeviceModes } = require('./modes.js');

function fixture() {
  const engine = createEngine(math), alg = createAlgorithms(math);
  const state = { mode: 'COMP', angle: 'deg', format: 'norm', digits: 10, freq: false, base: 10, scope: { Ans: 0, X: 0, Y: 0 } };
  const ui = { menu: null, input: null, values: [], expression: '', announcements: [] };
  const api = {
    engine, alg, math, getState: () => state,
    ev: (expression, scope) => engine.evaluate(expression, { ...state, scope }),
    showMenu(title, entries, options) { ui.input = null; ui.menu = { title, entries, ...options }; },
    showInput(prompt, initial, done) { ui.menu = null; ui.input = { prompt, initial, done }; },
    closeMenu() { ui.menu = null; ui.input = null; },
    showValue(value, label) { ui.menu = null; ui.input = null; ui.values.push({ value, label }); },
    format: value => engine.format(value, state),
    insert: value => { ui.expression += value; },
    getExpression: () => ui.expression,
    setExpression: value => { ui.expression = value; },
    announce: message => ui.announcements.push(message)
  };
  const modes = createDeviceModes(api);
  const choose = label => {
    assert.ok(ui.menu, 'Expected menu before choosing ' + label);
    const entry = typeof label === 'number' ? ui.menu.entries[label - 1] : ui.menu.entries.find(e => e.label === label);
    assert.ok(entry, 'No menu entry ' + label + ' in ' + ui.menu.title + ': ' + ui.menu.entries.map(e => e.label));
    entry.action();
  };
  const submit = text => {
    assert.ok(ui.input, 'Expected input for ' + text);
    const old = ui.input; ui.input = null;
    try { old.done(String(text)); } catch (e) { if (!ui.input && !ui.menu) ui.input = old; throw e; }
  };
  const fill = values => values.forEach(submit);
  const stat = () => { api.closeMenu(); modes.handleKey('1', { shift: true }); };
  return { state, ui, api, modes, choose, submit, fill, stat, last: () => ui.values.at(-1) };
}
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1,Math.abs(expected)), `${actual} ≈ ${expected}`);

test('all eight modes enter without external UI and unknown modes fail', () => {
  const f = fixture();
  for (const name of ['COMP','CMPLX','STAT','BASE-N','EQN','MATRIX','TABLE','VECTOR']) {
    f.modes.enter(name); assert.equal(f.state.mode,name);
    if (!['COMP','CMPLX','BASE-N'].includes(name)) assert.ok(f.ui.menu || f.ui.input);
  }
  assert.throws(() => f.modes.enter('FAKE'), /Unknown mode/);
});

test('EQN 2 unknowns follows coefficient order, cycles answers and reopens editor', () => {
  const f = fixture(); f.modes.enter('EQN'); f.choose(1); f.fill([1,2,3,2,3,4]);
  close(f.last().value,-1); assert.match(f.last().label,/X=/);
  f.modes.handleKey('equals'); close(f.last().value,2); assert.match(f.last().label,/Y=/);
  f.modes.handleKey('up'); close(f.last().value,-1);
  f.modes.handleKey('down'); f.modes.handleKey('equals'); assert.equal(f.ui.input.prompt,'EQN 1: a =');
});

test('EQN 3 unknowns and cubic roots use actual numerical algorithms', () => {
  const f = fixture(); f.modes.enter('EQN'); f.choose(2); f.fill([1,-1,1,2,1,1,-1,0,-1,1,1,4]);
  close(f.last().value,1); f.modes.handleKey('down'); close(f.last().value,2); f.modes.handleKey('down'); close(f.last().value,3);
  f.modes.enter('EQN'); f.choose(4); f.fill([1,-6,11,-6]);
  close(f.last().value,1); f.modes.handleKey('equals'); close(f.last().value,2); f.modes.handleKey('equals'); close(f.last().value,3);
});

test('quadratic complex solutions are available while degenerate equations retain Ans', () => {
  const f = fixture(); f.modes.enter('EQN'); f.choose(3); f.fill([1,0,1]);
  close(f.last().value.re,0); assert.equal(f.last().value.im,1);
  f.modes.handleKey('equals'); assert.equal(f.last().value.im,-1);
  const ans = f.state.scope.Ans;
  f.modes.enter('EQN'); f.choose(3); f.fill([0,1]); assert.throws(() => f.submit(1),/מקדם/);
  assert.equal(f.state.scope.Ans,ans);
});

test('STAT one variable data yields mean, sums, standard deviation and limits', () => {
  const f = fixture(); f.modes.enter('STAT'); f.choose('1-VAR'); f.fill([1,2,3]);
  assert.equal(f.state.stats.rows.length,3);
  f.stat(); f.choose('Var'); f.choose('x̄'); close(f.last().value,2);
  f.stat(); f.choose('Var'); f.choose('σx'); close(f.last().value,Math.sqrt(2/3));
  f.stat(); f.choose('Sum'); f.choose('Σx²'); close(f.last().value,14);
  f.stat(); f.choose('MinMax'); f.choose('maxX'); close(f.last().value,3);
  f.state.stats.rows = Array.from({length:80},(_,i) => ({x:i,freq:1}));
  f.stat(); f.choose('Data'); assert.throws(() => f.choose('Add row'),/80/);
});

test('STAT frequency rows commit atomically and setup changes clear data', () => {
  const f = fixture(); f.state.freq = true; f.modes.enter('STAT'); f.choose('1-VAR');
  f.submit(3); assert.equal(f.state.stats.rows.length,0);
  assert.throws(() => f.submit(-1),/FREQ/); assert.equal(f.state.stats.rows.length,0);
  f.submit(2); f.fill([6,1]); f.stat(); f.choose('Var'); f.choose('x̄'); close(f.last().value,4);
  f.state.freq = false; f.stat(); assert.equal(f.state.stats.rows.length,0);
  assert.equal(f.state.freq,false);
});

test('STAT regression, predictor, sums and row edits always use current data', () => {
  const f = fixture(); f.modes.enter('STAT'); f.choose('A+BX'); f.fill([1,3,2,5,3,7]);
  f.stat(); f.choose('Reg'); f.choose('B'); close(f.last().value,2);
  f.stat(); f.choose('Reg'); f.choose('ŷ'); f.submit(4); close(f.last().value,9);
  f.stat(); f.choose('Data'); f.choose(2); f.choose('Edit'); f.fill([1,6]);
  f.stat(); f.choose('Reg'); f.choose('ŷ'); f.submit(4); close(f.last().value,7);
  f.stat(); f.choose('Data'); f.choose(2); f.choose('Delete'); assert.equal(f.state.stats.rows.length,2);
  f.stat(); f.choose('Sum'); f.choose('Σxy'); close(f.last().value,31);
});

test('paired descriptive statistics work without enough variance for regression', () => {
  const f = fixture(); f.modes.enter('STAT'); f.choose('A+BX'); f.fill([2,5,2,7]);
  f.stat(); f.choose('Var'); f.choose('ȳ'); close(f.last().value,6);
  f.stat(); f.choose('Reg'); assert.throws(() => f.choose('B'),/ערכי x שונים/);
});

test('all eight regression types and quadratic inverse branches are usable', () => {
  const cases = [['A+BX',x=>2+3*x],['_+CX²',x=>1+2*x+x*x],['ln X',x=>2+3*Math.log(x)],['e^X',x=>2*Math.exp(.3*x)],['A·B^X',x=>2*1.2**x],['A·X^B',x=>2*x**1.5],['1/X',x=>2+3/x]];
  for (const [label,fn] of cases) {
    const f=fixture();f.modes.enter('STAT');f.choose(label);f.fill([1,fn(1),2,fn(2),3,fn(3)]);
    f.stat();f.choose('Reg');f.choose('ŷ');f.submit(4);close(f.last().value,fn(4));
  }
  const f=fixture();f.modes.enter('STAT');f.choose('_+CX²');f.fill([-1,1,0,0,1,1]);
  f.stat();f.choose('Reg');f.choose('x̂1');f.submit(4);close(f.last().value,-2);
  f.stat();f.choose('Reg');f.choose('x̂2');f.submit(4);close(f.last().value,2);
});

test('normal P/Q/R and normalized variate agree with manual definitions', () => {
  const f=fixture();f.modes.enter('STAT');f.choose('1-VAR');f.fill([1,2,3]);
  for(const [name,expected] of [['P(',0.5],['Q(',0],['R(',0.5]]){f.stat();f.choose('Distr');f.choose(name);f.submit(0);close(f.last().value,expected);}
  f.stat();f.choose('Distr');f.choose('→t');f.submit(3);close(f.last().value,Math.sqrt(1.5));
  f.modes.enter('COMP');assert.equal(f.state.stats.rows.length,0,'leaving STAT clears data as documented');
});

test('MATRIX 2×2 entry commits only after final cell; edit retains values and references insert', () => {
  const f=fixture();f.state.scope.MatA=[[9]];f.modes.enter('MATRIX');f.choose('MatA');f.choose('2×2');
  f.fill([2,1,1]);assert.deepEqual(f.state.scope.MatA,[[9]]);f.submit(1);assert.deepEqual(f.state.scope.MatA,[[2,1],[1,1]]);
  close(f.api.ev('det(MatA)',f.state.scope),1);
  f.modes.handleKey('4',{shift:true});f.choose('Data');f.choose('MatA');assert.equal(f.ui.input.initial,'2');
  f.fill([3,1,1,1]);close(f.api.ev('det(MatA)',f.state.scope),2);
  f.api.setExpression('');f.modes.handleKey('4',{shift:true});f.choose('MatA');assert.equal(f.ui.expression,'MatA');
  assert.deepEqual(f.api.ev('inverse(MatA)',f.state.scope),[[.5,-.5],[-.5,1.5]]);
});

test('VECTOR 2D/3D editors, norm, dot and cross operate on shared memory', () => {
  const f=fixture();f.modes.enter('VECTOR');f.choose('VctA');f.choose('3 dimensions');f.fill([1,0,0]);
  f.modes.handleKey('5',{shift:true});f.choose('Dim');f.choose('VctB');f.choose('3 dimensions');f.fill([0,1,0]);
  assert.deepEqual(f.api.ev('cross(VctA,VctB)',f.state.scope),[0,0,1]);
  close(f.api.ev('dot(VctA,VctB)',f.state.scope),0);
  f.modes.handleKey('5',{shift:true});f.choose('Dim');f.choose('VctC');f.choose('2 dimensions');f.fill([3,4]);close(f.api.ev('norm(VctC)',f.state.scope),5);
  f.api.setExpression('');f.modes.handleKey('5',{shift:true});f.choose('Dot');assert.equal(f.ui.expression,'dot(');
});

test('TABLE sequential prompts generate the manual example and update X only on success', () => {
  const f=fixture();f.modes.enter('TABLE');f.submit('X^2+1/2');f.fill([-1,1,.5]);
  assert.equal(f.ui.menu.entries.length,5);assert.equal(f.state.scope.X,1);
  f.choose(3);close(f.last().value,.5);assert.match(f.last().label,/X=0/);
  f.modes.handleKey('ac');assert.equal(f.ui.input.initial,'X^2+1/2');
  f.submit('1/X');f.fill([-1,1]);assert.throws(()=>f.submit(1),/אפס|מוגדרת/);assert.equal(f.state.scope.X,1);
});

test('TABLE enforces 30 rows and ascending positive-step constraints', () => {
  const f=fixture();f.modes.enter('TABLE');f.submit('X');f.fill([1,30]);f.submit(1);assert.equal(f.ui.menu.entries.length,30);
  f.modes.enter('TABLE');f.submit('X');f.fill([1,31]);assert.throws(()=>f.submit(1),/30 rows/);
  f.modes.enter('TABLE');f.submit('X');f.fill([5,1]);assert.throws(()=>f.submit(-1),/positive/);
  f.modes.enter('TABLE');assert.throws(()=>f.submit('Pol(1,X)'),/Pol\/Rec/);
});

test('BASE-N converts results, exposes logic and retains Ans across overflow', () => {
  const f=fixture();f.modes.enter('BASE-N');f.api.setExpression('15*37');f.modes.handleKey('equals');assert.equal(f.last().value,'555');
  f.modes.handleKey('HEX');assert.equal(f.last().value,'0000022B');f.modes.handleKey('BIN');assert.equal(f.last().value,'0000001000101011');
  f.modes.handleKey('DEC');f.api.setExpression('-1');f.modes.handleKey('equals');f.modes.handleKey('HEX');assert.equal(f.last().value,'FFFFFFFF');
  f.api.setExpression('Ans+1');f.modes.handleKey('equals');assert.equal(f.state.scope.Ans,0);
  f.modes.handleKey('DEC');f.api.setExpression('32768');f.modes.handleKey('equals');assert.throws(()=>f.modes.handleKey('BIN'),/16-bit/);assert.equal(f.state.base,10);assert.equal(f.state.scope.Ans,32768);
  f.api.setExpression('2147483647+1');assert.throws(()=>f.modes.handleKey('equals'),/32/);assert.equal(f.state.scope.Ans,32768);
  f.api.setExpression('');f.modes.handleKey('3',{shift:true});f.choose('Not(');assert.equal(f.ui.expression,'not(');
});

test('CALC substitutes variables, handles memory assignment and runs statements transactionally', () => {
  const f=fixture();f.api.setExpression('2X+3Y');f.modes.handleKey('CALC');f.fill([2,4]);close(f.last().value,16);
  f.api.setExpression('2→A:A+1');f.modes.handleKey('CALC');close(f.last().value,2);assert.equal(f.state.scope.A,2);assert.equal(f.state.scope.Ans,2);
  f.modes.handleKey('equals');close(f.last().value,3);
  const before={...f.state.scope};f.api.setExpression('5→A:1/0');assert.throws(()=>f.modes.handleKey('CALC'),/אפס|מוגדרת/);assert.deepEqual(f.state.scope,before);
});

test('SOLVE prompts other variables then initial X and reports residual without partial writes', () => {
  const f=fixture();f.api.setExpression('X^2=A');f.modes.handleKey('CALC',{shift:true});f.fill([2,1]);close(f.last().value,Math.sqrt(2));close(f.state.scope.X,Math.sqrt(2));
  f.modes.handleKey('equals');close(f.last().value,0,1e-8);
  const before={...f.state.scope};f.api.setExpression('1/X=0');f.modes.handleKey('SOLVE');assert.throws(()=>f.submit(1),/לא נמצא פתרון/);assert.deepEqual(f.state.scope,before);
});

test('CMPLX menu inserts operations and overrides this result without changing SETUP', () => {
  const f=fixture();f.modes.enter('CMPLX');f.modes.handleKey('2',{shift:true});f.choose('Conjg(');assert.equal(f.ui.expression,'conj(');
  f.state.complex='rect';f.state.scope.Ans=math.complex(1,1);f.modes.handleKey('2',{shift:true});f.choose('r∠θ');assert.equal(f.state.resultComplex,'polar');assert.equal(f.state.complex,'rect');
  f.state.complex='polar';f.modes.handleKey('2',{shift:true});f.choose('a+bi');assert.equal(f.state.resultComplex,'rect');assert.equal(f.state.complex,'polar');
});

test('CALC single-variable equality stores result and equals repeats parameter prompts', () => {
  const f=fixture();f.api.setExpression('Y=X^2+X+3');f.modes.handleKey('CALC');assert.equal(f.ui.input.prompt,'X?');f.submit(2);close(f.last().value,9);close(f.state.scope.Y,9);
  f.modes.handleKey('equals');assert.equal(f.ui.input.prompt,'X?');f.submit(3);close(f.last().value,15);
});

test('SOLVE explicit trailing variable solves Y while retaining the entered X', () => {
  const f=fixture();f.api.setExpression('Y=X+5,Y');f.modes.handleKey('SOLVE');assert.equal(f.ui.input.prompt,'X?');f.fill([2,0]);close(f.last().value,7);close(f.state.scope.X,2);close(f.state.scope.Y,7);
});

test('mode status follows a controller setup reset without retaining stale STAT text', () => {
  const f=fixture();f.modes.enter('STAT');f.choose('1-VAR');f.submit(4);assert.equal(f.modes.getStatus(),'1-VAR n=1');
  f.state.mode='COMP';f.modes.exit();assert.equal(f.modes.getStatus(),'COMP');
});

test('TABLE rejects calculus functions before prompting a numeric range', () => {
  const f=fixture();
  for(const expression of ['integral(X,0,1)','derivative(X^2,1)','sum(X,1,3)','summation(X,1,3)']){
    f.modes.enter('TABLE');assert.throws(()=>f.submit(expression),/calculus unavailable/);assert.equal(f.ui.input.prompt,'f(X) =');
  }
  f.modes.enter('TABLE');f.submit('X');f.fill([1,1]);assert.throws(()=>f.submit(1),/greater than Start/);
  f.modes.resetTable();f.modes.enter('TABLE');assert.equal(f.ui.input.initial,'');
});

test('CALC prompts adjacent variable products separately and supports complex substitutions', () => {
  const f=fixture();f.api.setExpression('2AX+3BX+C');f.modes.handleKey('CALC');
  assert.equal(f.ui.input.prompt,'A?');f.submit(1);assert.equal(f.ui.input.prompt,'X?');f.submit(2);assert.equal(f.ui.input.prompt,'B?');f.fill([3,4]);close(f.last().value,26);
  f.modes.enter('CMPLX');f.api.setExpression('A+Bi');f.modes.handleKey('CALC');f.fill([2,3]);assert.equal(f.last().value.re,2);assert.equal(f.last().value.im,3);
  f.api.setExpression('A*2');f.modes.handleKey('CALC');f.submit('1+i');assert.equal(f.last().value.re,2);assert.equal(f.last().value.im,2);
});

test('STAT calculation and editor menu numbers match their separate physical contexts', () => {
  const f=fixture();f.modes.enter('STAT');f.choose(1);f.fill([1,2,3]);
  assert.equal(f.modes.handleContextKey('1',{shift:true},{type:'input',title:f.ui.input.prompt}),true);
  assert.deepEqual(f.ui.menu.entries.map(e=>e.label),['Type','Data','Edit']);
  f.choose(3);assert.deepEqual(f.ui.menu.entries.map(e=>e.label),['Ins','Del-A']);f.choose(2);assert.equal(f.state.stats.rows.length,0);
  f.stat();assert.deepEqual(f.ui.menu.entries.map(e=>e.label),['Type','Data','Sum','Var','Distr','MinMax']);
  f.choose(1);f.choose(2);f.fill([1,3,2,5]);f.stat();assert.equal(f.ui.menu.entries[4].label,'Reg');
});

test('BASE menu uses six logical operators then a separately numbered four-prefix page', () => {
  const f=fixture();f.modes.enter('BASE-N');f.modes.handleKey('3',{shift:true});assert.equal(f.ui.menu.pageSize,6);
  assert.deepEqual(f.ui.menu.entries.map(e=>e.label),['and','or','xor','xnor','Not(','Neg(','d','h','b','o']);
  f.choose('h');assert.equal(f.ui.expression,'h');
});

test('MATRIX and VECTOR official menu numbers and dimensions match manual key sequences', () => {
  const f=fixture();f.modes.enter('MATRIX');f.choose(1);assert.equal(f.ui.menu.pageSize,9);assert.equal(f.ui.menu.entries[3].label,'2×3');assert.equal(f.ui.menu.entries[4].label,'2×2');
  f.choose(5);f.fill([2,1,1,1]);assert.deepEqual(f.state.scope.MatA,[[2,1],[1,1]]);
  f.modes.handleKey('4',{shift:true});assert.deepEqual(f.ui.menu.entries.slice(0,8).map(e=>e.label),['Dim','Data','MatA','MatB','MatC','MatAns','det(','Trn(']);
  f.modes.enter('VECTOR');f.choose(1);f.choose(2);f.fill([3,4]);assert.deepEqual(f.state.scope.VctA,[3,4]);
  f.modes.handleKey('5',{shift:true});assert.deepEqual(f.ui.menu.entries.slice(0,7).map(e=>e.label),['Dim','Data','VctA','VctB','VctC','VctAns','Dot']);
});
