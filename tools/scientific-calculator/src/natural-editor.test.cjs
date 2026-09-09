const test=require('node:test'),assert=require('node:assert/strict'),math=require('mathjs');
const {JSDOM}=require('jsdom');
const {createNaturalEditor}=require('./natural-editor.js');
const {createEngine}=require('./core.js');
const engine=createEngine(math);
const value=e=>engine.evaluate(e.getSource());
const markup=e=>new JSDOM('<div>'+e.render()+'</div>').window.document;
const cursor=e=>markup(e).querySelector('[data-caret]');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} vs ${b}`);
function setup(){return createNaturalEditor({math});}

test('photo sequence changes actual caret parent from denominator to baseline in one RIGHT',()=>{
 const e=setup();e.fraction();e.insert('3');e.move('right');e.insert('2');
 assert.ok(cursor(e).closest('mfrac'));
 const before=markup(e),c=before.querySelector('[data-caret]');assert.equal(c.closest('mfrac').lastElementChild.contains(c),true);
 assert.equal(Array.from(before.querySelectorAll('mo')).filter(n=>/[()]/.test(n.textContent)).length,0);
 e.move('right');assert.equal(cursor(e).closest('mfrac'),null);e.insert('+1');near(value(e),2.5);
});
test('without exiting a fraction, new arithmetic stays in its denominator',()=>{const e=setup();e.fraction();e.insert('3');e.move('down');e.insert('2');e.insert('+1');near(value(e),1);});
test('LEFT is inverse structural traversal, including all four positions around7/6',()=>{
 const e=setup();e.insert('1+7');e.fraction();e.insert('6');
 const den=e.getCaret().slot;e.move('left');assert.equal(e.getCaret().slot,den);assert.equal(e.getCaret().index,0);
 e.move('left');const num=e.getCaret().slot;assert.notEqual(num,den);assert.equal(e.getCaret().index,1);
 e.move('left');assert.equal(e.getCaret().slot,num);assert.equal(e.getCaret().index,0);
 e.move('left');assert.equal(e.getCaret().slot,e.getRoot().id);assert.equal(e.getCaret().index,2);
 e.armCaptureNext();e.insert('sqrt(□)');near(value(e),1+Math.sqrt(7/6));
 assert.ok(markup(e).querySelector('msqrt mfrac'));
});
test('official nested-root fraction sequence exits one structural layer per RIGHT',()=>{
 const e=setup();e.fraction();e.insert('2+');e.insert('sqrt(□)');e.insert('2');
 assert.ok(cursor(e).closest('msqrt'));e.move('right');assert.equal(cursor(e).closest('msqrt'),null);assert.ok(cursor(e).closest('mfrac'));
 e.move('right');e.insert('1+');e.insert('sqrt(□)');e.insert('2');near(value(e),Math.sqrt(2));
});
test('filled numerator and denominator remain spatially navigable',()=>{
 const e=setup();e.fraction();e.insert('3');e.move('down');e.insert('2');const den=e.getCaret().slot;
 e.move('up');assert.notEqual(e.getCaret().slot,den);e.insert('4');e.move('down');assert.equal(e.getCaret().slot,den);e.insert('5');near(value(e),34/25);
});
test('nested fractions leave only their own denominator and retain outside multiplication grouping',()=>{
 const e=setup();e.fraction();e.insert('1');e.move('right');e.fraction();e.insert('2');e.move('right');e.insert('3');
 const nested=markup(e).querySelector('[data-caret]');assert.equal(nested.closest('mfrac').parentElement.closest('mfrac')!==null,true);
 e.move('right');const inOuter=markup(e).querySelector('[data-caret]');assert.equal(inOuter.closest('mfrac').parentElement.closest('mfrac'),null);
 e.move('right');assert.equal(cursor(e).closest('mfrac'),null);e.insert('2');near(value(e),3);
});
test('power and root fields have real cursor ancestry and reversible exit boundaries',()=>{
 const e=setup();e.insert('2');e.insert('^(□)');e.fraction();e.insert('1');e.move('down');e.insert('3');e.move('right');
 const c=cursor(e);assert.equal(c.closest('mfrac'),null);assert.ok(c.closest('msup'));
 e.move('right');assert.equal(cursor(e).closest('msup'),null);near(value(e),Math.cbrt(2));
 e.move('left');assert.ok(cursor(e).closest('msup'));
});
test('integral and sum use body then lower then upper fields; UP moves lower to upper',()=>{
 for(const name of ['integral','sum']){
  const e=setup();e.insert(name+'(□,□,□)');e.insert('X');e.move('right');e.insert('1');e.move('up');e.insert('3');
  assert.equal(e.getSource(),name+'(X,1,3)');
  const c=cursor(e);assert.ok(c.closest(name==='integral'?'msubsup':'munderover'));
  e.move('right');assert.equal(cursor(e).closest(name==='integral'?'msubsup':'munderover'),null);
 }
});
test('explicitly typed groups remain visible inside fractions; generated wrappers do not',()=>{
 const e=setup();e.fraction();e.insert('(');e.insert('1+2');e.insert(')');e.move('right');e.insert('3');
 const d=markup(e),parentheses=Array.from(d.querySelectorAll('mo')).filter(n=>['(',')'].includes(n.textContent));assert.equal(parentheses.length,2);near(value(e),1);
 const snap=e.snapshot();const loaded=setup();loaded.restore(snap);assert.equal(loaded.render(),e.render());
 const imported=setup();imported.setSource(e.getSource());assert.equal(Array.from(markup(imported).querySelectorAll('mo')).filter(n=>['(',')'].includes(n.textContent)).length,2);
});
test('actual outer boundaries wrap while composite boundaries remain distinct',()=>{
 const e=setup();e.fraction();e.insert('3');e.move('right');e.insert('2');e.move('right');assert.equal(e.getCaret().index,1);
 e.move('right');assert.equal(e.getCaret().slot,e.getRoot().id);assert.equal(e.getCaret().index,0);
 e.move('left');assert.equal(e.getCaret().index,1);e.move('left');assert.notEqual(e.getCaret().slot,e.getRoot().id);
});
test('deletion edits slot contents, snapshots are independent, and bounds reject transactionally',()=>{
 const e=setup();e.fraction();e.insert('12');e.move('right');e.insert('34');e.delete();e.insert('5');near(value(e),12/35);
 const saved=e.snapshot(),before=e.getSource();assert.throws(()=>e.insert('9'.repeat(1200)));assert.equal(e.getSource(),before);
 const copy=setup();copy.restore(saved);copy.insert('6');assert.equal(e.getSource(),before);assert.notEqual(copy.getSource(),before);
});
test('scientific-notation insertion exposes its exponent as an editable structural field',()=>{const e=setup();e.insert('2');e.insert('*10^(□)');e.insert('-3');assert.ok(cursor(e).closest('msup'));e.move('right');assert.equal(cursor(e).closest('msup'),null);near(value(e),.002);});
test('INS captures an entire numeric literal and stops before the following term',()=>{for(const literal of ['123','12.25']){const e=setup();e.insert(literal+'+7');e.home();e.armCaptureNext();e.insert('sqrt(□)');near(value(e),Math.sqrt(Number(literal))+7);const d=markup(e);assert.equal(d.querySelector('msqrt').textContent,literal);assert.equal(d.querySelectorAll('msqrt').length,1);}});
