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
