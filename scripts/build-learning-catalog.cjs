'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
for(const name of ['DATA','NOAM_PREFIX_FALLBACK']){
 const start=html.indexOf('var '+name+' = '),end=html.indexOf('\n};',start)+3;
 if(start<0||end<start)throw Error('Catalog declaration missing');
 vm.runInContext(html.slice(start,end),ctx);
}
const items=[];
for(const [g,data] of Object.entries(ctx.DATA))for(const t of data.topics){
 const row=data.links[t.id]||{};
 for(const l of ['a','b','c','one'])if(row[l])items.push({id:`g${g}-t${t.id}-${l}`,g:Number(g),t:t.id,parent:t.parent||t.id,title:t.t,l,label:l==='one'?(row.oneLabel||'כל הרמות'):(t[l+'Label']||({a:'רמה א׳',b:'רמה ב׳',c:'מצוינות'})[l]),pdf:row[l],x:t.x||(ctx.NOAM_PREFIX_FALLBACK[g]||{})[t.id]||''});
}
if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('Duplicate learning IDs');
fs.writeFileSync(path.join(root,'noam-learning-catalog.js'),'/* Generated from index.html; do not edit by hand. */\nwindow.NOAM_LEARNING_CATALOG='+JSON.stringify(items)+';\n');
fs.writeFileSync(path.join(root,'learning/catalog-seed.sql'),'insert into public.noam_learning_worksheets (worksheet_id) values\n'+items.map(x=>"('"+x.id+"')").join(',\n')+'\non conflict do nothing;\n');
console.log(items.length+' worksheet levels indexed; existing catalog unchanged');
