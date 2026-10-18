import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {it} from 'node:test';
const source=readFileSync(new URL('../src/components/SimilarityLoop.astro',import.meta.url),'utf8').split('<script>')[1].split('</script>')[0];
// Execute the shipped controller with a deterministic animation-frame clock.
function player(){
  let frame:(time:number)=>void=()=>{};
  const classes=new Set<string>(), attributes=new Set<string>(), values:Record<string,string>={};
  const button=(dataset:Record<string,string>)=>({dataset,disabled:true,attrs:{} as Record<string,string>,click:()=>{},setAttribute(k:string,v:string){this.attrs[k]=v;},addEventListener(_:string,fn:()=>void){this.click=fn;}});
  const chapters=[0,1,2,3].map(n=>button({chapter:String(n)})),details=[1,2,3].map(n=>button({construction:String(n)}));
  const media={matches:false,addEventListener(){}};
  const film={dataset:{phase:'0',beat:'0'} as Record<string,string>,isConnected:true,closest:()=>({classList:{contains:(c:string)=>classes.has(c)}}),querySelectorAll:(q:string)=>q==='[data-chapter]'?chapters:details,style:{setProperty:(k:string,v:string)=>{values[k]=v;}},toggleAttribute:(k:string,on:boolean)=>on?attributes.add(k):attributes.delete(k),hasAttribute:(k:string)=>attributes.has(k),removeAttribute:(k:string)=>attributes.delete(k)};
  const document={hidden:false,querySelectorAll:()=>[film],documentElement:{classList:{contains:()=>false}},addEventListener(){}};
  runInNewContext(ts.transpile(source,{target:ts.ScriptTarget.ES2022}),{document,window:{matchMedia:()=>media},requestAnimationFrame:(fn:(time:number)=>void)=>{frame=fn;}});
  let now=10;frame(now);
  const advance=(ms:number)=>{for(let n=0;n<ms;n+=10){now+=10;frame(now);}};
  return {film,chapters,details,media,document,classes,values,advance};
}
it('plays AA, SAS, SSS and area consecutively for ten seconds each, then loops',()=>{
  const p=player();
  for(let phase=0;phase<4;phase++){
    assert.equal(p.film.dataset.phase,String(phase));
    p.advance(9990);assert.equal(p.film.dataset.phase,String(phase));
    p.advance(10);assert.equal(p.film.dataset.phase,String((phase+1)%4));
  }
});
it('pausing freezes time; chapter selection and individual constructions remain inspectable',()=>{
  const p=player();p.advance(4200);p.classes.add('ll--paused');
  const progress=p.values['--progress'];p.advance(20000);assert.equal(p.values['--progress'],progress);
  p.chapters[2].click();assert.equal(p.film.dataset.phase,'2');
  for(let i=0;i<3;i++){p.details[i].click();assert.equal(p.film.dataset.beat,String(i+1));assert.equal(p.details[i].attrs['aria-pressed'],'true');}
  p.classes.delete('ll--paused');p.advance(2600);assert.equal(p.film.dataset.phase,'3');
});
it('offscreen, hidden and reduced-motion modes never advance the sequence',()=>{
  for(const condition of ['offscreen','hidden','reduced']){
    const p=player();
    if(condition==='offscreen')p.classes.add('ll--off');
    if(condition==='hidden')p.document.hidden=true;
    if(condition==='reduced')p.media.matches=true;
    p.advance(40000);assert.equal(p.film.dataset.phase,'0');
    p.chapters[2].click();p.details[1].click();assert.equal(p.film.dataset.beat,'2');
  }
});
