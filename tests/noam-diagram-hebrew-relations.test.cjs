'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Plan=require('../noam-diagram-plan.js');
function fixture(relation){return {plan:{version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[4,3],H:[2,1.5]},segments:[['A','B'],['A','C'],['B','H']],highlights:[{from:'A',to:'B',color:'blue',label:''}],angles:[],rightAngles:[],equalGroups:[],evidence:[]},context:{questionText:'נתון משולש ABC ונקודה H. '+relation+'.',hintText:'סמנו את הקטע AB.',studentMessage:'שרטט לי'}};}
test('affirmative Hebrew perpendicular and parallel givens constrain plain coordinates',()=>{
 for(const sentence of ['הקטע BH מאונך לאלכסון AC','BH ניצב לישר AC','BH הוא מאונך ל־AC','BH ⟂ AC','BH מקביל לקטע AC']){
  const {plan,context}=fixture(sentence),r=Plan.inspect(plan,context);
  assert.equal(r.reason,'source_coordinate_contradiction',sentence);assert.equal(r.constraint.type,'relation');
 }
});
test('Hebrew relation parser accepts a correct altitude and does not assume a goal/negation/question',()=>{
 const {plan,context}=fixture('BH מאונך לאלכסון AC');plan.points.H=[2.56,1.92];assert.equal(Plan.inspect(plan,context).ok,true);
 for(const sentence of ['האם BH מאונך לאלכסון AC?','הוכיחו כי BH מאונך לאלכסון AC','לא נכון ש-BH מאונך לאלכסון AC']){
  const f=fixture(sentence);assert.equal(Plan.inspect(f.plan,f.context).ok,true,sentence);
 }
});

function rectangleListFixture(sentence){
 const plan={version:1,status:'ok',points:{A:[0,0],B:[10,0],C:[10,9],D:[0,9],P:[4.579618,3.38703],K:[6.579618,5]},
  segments:[['A','B'],['B','C'],['C','D'],['D','A'],['B','P'],['C','P'],['P','K']],
  highlights:[{from:'P',to:'K',color:'blue',label:''}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};
 return {plan,context:{questionText:'נתון מלבן ABCD ובתוכו הנקודה P. נקודה K נתונה. '+sentence,
  hintText:'התבוננו בקטע PK.',studentMessage:''}};
}

test('live plural parallel statement rejects the tilted PK and reports both required relations',()=>{
 const {plan,context}=rectangleListFixture('הקטע PK מקביל לצלעות AB ו-CD.');
 const before=JSON.stringify(plan),result=Plan.inspect(plan,context);
 assert.equal(result.reason,'source_coordinate_contradiction');
 assert.deepEqual(result.constraint,{type:'relation',first:['P','K'],second:['A','B'],relation:'∥',requiredRelations:['PK∥AB','PK∥CD']});
 assert.equal(JSON.stringify(plan),before,'validation never moves points');
 plan.points.K=[6.579618,3.38703];
 assert.equal(Plan.inspect(plan,context).ok,true,'the approved source geometry satisfies both relations');
});

test('the plural parser handles all explicit references, order and renamed points',()=>{
 for(const sentence of ['PK מקביל לצלעות CD ו־AB.','PK הוא מקביל לקטעים AB, CD.','PK מקביל לישרים AB ו CD.']){
  const {plan,context}=rectangleListFixture(sentence);
  assert.equal(Plan.inspect(plan,context).reason,'source_coordinate_contradiction',sentence);
  plan.points.K=[6.579618,3.38703];assert.equal(Plan.inspect(plan,context).ok,true,sentence);
 }
 const {plan,context}=rectangleListFixture('PK מקביל לצלעות AB ו-CD.');
 const rename={A:'E',B:'F',C:'G',D:'H',P:'M',K:'N'};
 const relabel=value=>typeof value==='string'?value.replace(/[ABCDPK]/g,n=>rename[n]):Array.isArray(value)?value.map(relabel):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[rename[key]||key,relabel(v)])):value;
 const renamed=Plan.inspect(relabel(plan),relabel(context));
 assert.deepEqual(renamed.constraint.requiredRelations,['MN∥EF','MN∥GH']);
 // The first pair already agrees; a second nonparallel reference must still fail.
 const second=fixture('BH מקביל לקטעים BH ו-AC');
 const failed=Plan.inspect(second.plan,second.context);
 assert.equal(failed.reason,'source_coordinate_contradiction');
 assert.deepEqual(failed.constraint.second,['A','C']);
});

test('plural perpendicular and parallel lists cannot turn a goal, question or negation into a given',()=>{
 for(const sentence of ['האם PK מקביל לצלעות AB ו-CD?','הוכיחו כי PK מקביל לצלעות AB ו-CD.',
  'לא נכון ש-PK מקביל לצלעות AB ו-CD.','אם PK מקביל לצלעות AB ו-CD, מצאו זווית.',
  'נניח כי PK מקביל לצלעות AB ו-CD.']){
  const {plan,context}=rectangleListFixture(sentence);
  assert.equal(Plan.inspect(plan,context).ok,true,sentence);
 }
 const {plan,context}=rectangleListFixture('');
 context.studentMessage='PK מקביל לצלעות AB ו-CD.';
 assert.equal(Plan.inspect(plan,context).ok,true,'a student assertion is not source evidence');
 const f=fixture('BH מאונך לישרים AC ו-AB');
 const r=Plan.inspect(f.plan,f.context);
 assert.deepEqual(r.constraint.requiredRelations,['BH⊥AC','BH⊥AB']);
});

test('the captured live coordinates are rejected for PK parallelism, without changing the diagram',()=>{
 const {plan,context}=rectangleListFixture('הקטע PK מקביל לצלעות AB ו-CD.');
 plan.points={A:[-.0016176696,-.0124536023],B:[5.8495762309,-.0168514008],C:[5.8527623726,4.2222542927],D:[.0015684721,4.2266520912],P:[3.2977118462,1.5803986010],K:[5.5,2]};
 plan.highlights=[{from:'B',to:'P',color:'blue',label:''},{from:'P',to:'K',color:'blue',label:''},{from:'C',to:'P',color:'orange',label:''}];
 plan.angles=[{from:'B',vertex:'P',to:'K',label:'∠BPK'},{from:'C',vertex:'P',to:'K',label:'∠CPK'}];
 context.hintText='סמנו את הזוויות BPK ו-CPK.';
 context.questionText+=' ∠ABP=32°. ∠PCD=46°.';
 const before=JSON.stringify(plan),result=Plan.inspect(plan,context);
 assert.equal(result.reason,'source_coordinate_contradiction');
 assert.equal(result.constraint.type,'relation');
 assert.deepEqual(result.constraint.requiredRelations,['PK∥AB','PK∥CD']);
 assert.equal(JSON.stringify(plan),before);
 assert.match(Plan.PROMPT_SCHEMA,/PK∥AB and PK∥CD/,'the existing planner repair receives unambiguous list guidance');
});

test('a comma or conjunction before a new relation starts a clause, not another list operand',()=>{
 for(const prefix of ['PK מקביל ל-AB','PK מקביל לצלעות AB']){
  for(const suffix of [', CD מאונך ל-AB.',' ו-CD הוא מאונך ל-AB.',', ו־CD הינו ניצב ל־AB.',', CD⊥AB.',' ו-CD ⊥ AB.']){
   const plan={version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[5,0],D:[5,3],P:[0,2],K:[4,2]},
    segments:[['A','B'],['C','D'],['P','K']],highlights:[{from:'P',to:'K',color:'blue',label:''}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};
   const context={questionText:'הקטעים AB, CD, PK נתונים. '+prefix+suffix,hintText:'התבוננו בקטע PK.',studentMessage:''};
   assert.equal(Plan.inspect(plan,context).ok,true,'independent perpendicular clause: '+prefix+suffix);
   plan.points.D=[8,0];
   const invalid=Plan.inspect(plan,context);
   assert.equal(invalid.reason,'source_coordinate_contradiction','the second clause must still be checked: '+prefix+suffix);
   assert.deepEqual(invalid.constraint.first,['C','D']);
   assert.equal(invalid.constraint.relation,'⊥');
   assert.ok(!invalid.constraint.requiredRelations.includes('PK∥CD'),'do not invent a parallel relation');
  }
 }
});

test('existing altitude and median clauses remain independent of a preceding parallel list',()=>{
 for(const kind of ['גובה','תיכון']){
  for(const construction of [kind,'ה'+kind]){
   for(const copula of ['', 'הוא ', 'הינו ']){
    for(const destination of ['', ' לצלע AB']){
     for(const separator of [', ', ' ו-', ', ו־']){
      const clause='CD '+copula+construction+destination;
      const plan={version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[2,3],D:[2,0],P:[0,2],K:[4,2]},
       segments:[['A','B'],['C','D'],['P','K']],highlights:[{from:'P',to:'K',color:'blue',label:''}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};
      const context={questionText:'הקטעים AB, CD, PK נתונים. D על הקטע AB. PK מקביל ל-AB'+separator+clause+'.',hintText:'התבוננו בקטע PK.',studentMessage:''};
      assert.equal(Plan.inspect(plan,context).ok,true,'valid construction: '+separator+clause);
      if(kind==='גובה'){plan.points.C=[3,3];}else{plan.points.D=[1,0];}
      const invalid=Plan.inspect(plan,context);
      assert.equal(invalid.reason,'source_coordinate_contradiction','construction constraints remain active: '+clause);
      assert.ok(!(invalid.constraint.first?.join('')==='PK'&&invalid.constraint.second?.join('')==='CD'),'no invented PK∥CD');
     }
    }
   }
  }
 }
});

test('copulas and the existing English altitude wording cannot be swallowed as list operands',()=>{
 for(const separator of [', ', ' ו-', ', ו־']){
  for(const clause of ['CD הוא גובה לצלע AB','CD הינו גובה לצלע AB','CD היא גובה לצלע AB','CD הינה גובה לצלע AB',
   'CD is an altitude to AB','CD is a height onto AB','CD IS an altitude to AB','CD Is A Height onto AB']){
   const plan={version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[2,3],D:[2,0],P:[0,2],K:[4,2]},
    segments:[['A','B'],['C','D'],['P','K']],highlights:[{from:'P',to:'K',color:'blue',label:''}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};
   const context={questionText:'הקטעים AB, CD, PK נתונים. D על הקטע AB. PK מקביל לצלעות AB'+separator+clause+'.',hintText:'התבוננו בקטע PK.',studentMessage:''};
   assert.equal(Plan.inspect(plan,context).ok,true,separator+clause);
  }
 }
});
