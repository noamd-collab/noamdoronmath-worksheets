import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import { readPublicText } from './read-native-public';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';
const root=new URL('../public/',import.meta.url),context:any={};
for(const file of ['noam-native-visual.js','noam-source-panels.js'])runInNewContext(readFileSync(new URL(file,root),'utf8'),context);
const api=context.NoamSourcePanels,json=(path:string)=>JSON.parse(readFileSync(new URL(path,root),'utf8')),clone=(v:any)=>JSON.parse(JSON.stringify(v));
const manifests=readdirSync(new URL('noam-ai/manifests/',root)).filter(f=>f.endsWith('.json')).map(f=>json('noam-ai/manifests/'+f));
function fixture(pkg='G7-T22',level='a',q='q21',part='א'){
 const path=`noam-ai/native/${pkg}/${level}/noam-ai.json`,data=json(path),manifest=manifests.find(m=>m.nativeExportUrl==='/'+path);
 const exercise=manifest.exercises.find((e:any)=>e.nativeQuestionId===q&&e.part===part),primary=readPublicText(new URL(exercise.nativeFigureUrl.slice(1),root));
 const refs=api.references(data,exercise,primary),svgs=Object.fromEntries((refs?.panels||[]).map((p:any)=>[p.id,readPublicText(new URL(p.url.slice(1),root))]));return{data,exercise,primary,refs,svgs,manifest};
}
it('52 reviewed questions expose 111 printed panels across 181 group subsections',()=>{
 const groups=new Map(),failed=[];let parts=0;
 for(const m of manifests){if(!m.nativeExportUrl)continue;let data:any;
  for(const e of m.exercises){if(!api.isReviewed(e))continue;data ||=json(m.nativeExportUrl.slice(1));
   const primary=readPublicText(new URL(e.nativeFigureUrl.slice(1),root)),refs=api.references(data,e,primary),svgs=Object.fromEntries((refs?.panels||[]).map((p:any)=>[p.id,readPublicText(new URL(p.url.slice(1),root))])),result=api.resolve(data,e,svgs);
   if(!result){failed.push(e.id);continue;}groups.set(result.sourceKey,result.panelIds);parts++;
  }
 }assert.deepEqual(failed,[]);assert.equal(groups.size,52);assert.equal([...groups.values()].reduce((n,a)=>n+a.length,0),111);assert.equal(parts,181);
});
it('six explicit singular mappings retain their source and comparison siblings receive groups',()=>{
 for(const[p,l,q,s]of [['G9-T13','a','q17','ב'],['G7-T24','a','q20','ג'],['G7-T24','a','q20','ד'],['G8-T29','c','q20','א'],['G8-T29','c','q20','ג'],['G8-T35','a','q7','ד']]){const f=fixture(p,l,q,s);assert.equal(api.isReviewed(f.exercise),false);assert.equal(f.refs,null);assert.equal(context.NoamNativeVisual.resolve(f.data,f.exercise,{studentMessage:'הראה את השרטוט המקורי'},f.primary)?.kind,'source-context');}
 assert.equal(fixture('G9-T13','a','q17','ג').refs.panels.length,2);
});
it('TWOSRC canonical URL passes existing package alias without inventing captions or answer selection',()=>{
 const f=fixture('G8-TWOSRC','a','q3'),r=api.resolve(f.data,f.exercise,f.svgs);assert.equal(f.data.package,'G8-T66');assert.equal(r.sourceKey,'G8-TWOSRC/a/q3');assert.equal(r.panels.length,2);assert.ok(!JSON.stringify(r).includes('דנה'));assert.equal(api.resolve(f.data,{...f.exercise,id:'G8-T12-A-Q03א'},f.svgs),null);
});
it('missing and extra panel sets reject as a group rather than falling through to first panel',()=>{
 const f=fixture();for(const id of f.refs.panelIds){const map={...f.svgs};delete map[id];assert.equal(api.resolve(f.data,f.exercise,map),null);}
 assert.equal(api.resolve(f.data,f.exercise,{...f.svgs,q22_head:f.primary}),null);
 const d=clone(f.data);d.figures.push({...clone(d.figures.find((v:any)=>v.id==='q21_head_3')),id:'q21_head_4'});assert.equal(api.references(d,f.exercise,f.primary),null);assert.equal(api.isReviewed(f.exercise),true);
});
it('cross-question, sibling-item, hidden, answer and duplicate models are excluded',()=>{
 const f=fixture();for(const mutate of[(v:any)=>v.role='answer',(v:any)=>v.visual_model.role='answer',(v:any)=>v.visual_model.aux=[{id:'solution'}],(v:any)=>v.question='q22',(v:any)=>v.item='q21b',(v:any)=>v.visual_model.item='q21b',(v:any)=>v.visual_model.question='q22',(v:any)=>v.visual_model.objects[0].role='answer',(v:any)=>v.visual_model.objects[0].display='hidden',(v:any)=>v.svg='figures/q22_head.svg',(v:any)=>v.visual_model.objects.push(clone(v.visual_model.objects[0]))]){const d=clone(f.data);mutate(d.figures.find((v:any)=>v.id==='q21_head_2'));assert.equal(api.resolve(d,f.exercise,f.svgs),null);}
 const d=clone(f.data);d.figures.push(clone(d.figures.find((v:any)=>v.id==='q21_head_2')));assert.equal(api.resolve(d,f.exercise,f.svgs),null);
});
it('unreviewed prefixes and stale question/item/exercise identity cannot validate',()=>{
 const f=fixture();for(const e of[{...f.exercise,nativeFigureUrl:f.exercise.nativeFigureUrl.replace('/G7-T22/','/G7-T23/')},{...f.exercise,nativeQuestionId:'q22'},{...f.exercise,nativeItemId:'q21b'},{...f.exercise,part:'ב'},{...f.exercise,id:'G7-T22-A-Q22א'}])assert.equal(api.resolve(f.data,e,f.svgs),null);
});
it('secondary SVG dimension mismatch, external content and active content reject the whole set',()=>{
 const f=fixture(),id=f.refs.panelIds[1],original=f.svgs[id];for(const svg of[original.replace(/viewBox="[^"]*"/,'viewBox="0 0 999 999"'),original.replace('</svg>','<script>alert(1)</script></svg>'),original.replace('</svg>','<svg:script>alert(1)</svg:script></svg>'),original.replace('</svg>','<style>@import "https://example.test/x";</style></svg>'),original.replace('</svg>','<image href="https://example.test/x"/></svg>'),original.replace('</svg>','<g onclick="alert(1)"/></svg>'),original.replace('</svg>','<g id="duplicate"/><g id="duplicate"/></svg>')])assert.equal(api.resolve(f.data,f.exercise,{...f.svgs,[id]:svg}),null);
});
it('rendered SVGs are isolated images with no generated geometry or invented panel semantics',()=>{
 const f=fixture(),{document}=parseHTML('<html><body></body></html>'),node=api.render(document,f.data,f.exercise,f.svgs);assert.equal(node.getAttribute('data-visual-kind'),'source-context');assert.equal(node.querySelectorAll('svg').length,3);assert.equal(node.querySelectorAll('svg image').length,3);assert.equal(node.querySelectorAll('svg path,svg circle,svg text').length,0);assert.ok(!/שלב|ימני|שמאלי|נבחר|נכון/.test(node.textContent));assert.deepEqual([...node.querySelectorAll('image')].map(n=>decodeURIComponent(n.getAttribute('href')!.split(',').slice(1).join(','))),Array.from(f.refs.panels,(p:any)=>f.svgs[p.id]));
 const metadata=JSON.parse(JSON.stringify(api.metadata(f.refs)));assert.ok(metadata.every((p:any)=>Object.keys(p).sort().join(',')==='id,kind,visibleNames'));assert.ok(!JSON.stringify(metadata).includes('svg_xy'));
});
it('root/public helper bytes match',()=>assert.equal(readFileSync(new URL('../../../noam-source-panels.js',import.meta.url),'utf8'),readFileSync(new URL('noam-source-panels.js',root),'utf8')));

it('blank, definitions-only and empty-primitive secondary SVGs are not successful source panels',()=>{
 const f=fixture(),p=f.refs.panels[1];for(const content of ['', '<defs><path d="M0 0 L10 10"/></defs>', '<path d=""/><line/>'])assert.equal(api.resolve(f.data,f.exercise,{...f.svgs,[p.id]:`<svg viewBox="0 0 ${p.width} ${p.height}">${content}</svg>`}),null);
});

it('isolated data images retain exact validated non-ASCII SVG bytes without another URL fetch',()=>{
 const f=fixture(),id=f.refs.panelIds[1];f.svgs[id]=f.svgs[id].replace('</svg>','<text x="2" y="12">דנה · −4</text></svg>');
 const {document}=parseHTML('<html><body></body></html>'),node=api.render(document,f.data,f.exercise,f.svgs),href=node.querySelectorAll('image')[1].getAttribute('href');
 assert.ok(href.startsWith('data:image/svg+xml;charset=utf-8,'));assert.equal(decodeURIComponent(href.slice(href.indexOf(',')+1)),f.svgs[id]);assert.ok(!href.includes('דנה'));
});

it('reviewed example/practice groups retain panels without promoting example object names to selected givens',()=>{
 for(const [level,q]of [['a','q7'],['b','q2']]){const f=fixture('G8-TWOSRC',level,q),group=api.resolve(f.data,f.exercise,f.svgs);assert.equal(group.requiresPrintedRoleContext,true);assert.equal(group.panels.length,2);assert.ok(group.panels.every((p:any)=>p.visibleNames.length===0));assert.ok(api.metadata(group).every((p:any)=>p.visibleNames.length===0));}
 assert.equal(fixture().refs.requiresPrintedRoleContext,false);
});

it('approved whole-question crop is bound to exact PDF/native bytes, geometry, actual pages and selected identity',()=>{
 const f=fixture(),a=api.approvedCrop(f.manifest,f.exercise);assert.equal(a.pageCount,12);assert.equal(a.pdfId,f.manifest.pdfHash);assert.equal(f.manifest.reviewRequired,true);
 for(const mutate of[(m:any)=>m.pdfHash='0'.repeat(32),(m:any)=>m.sourceSha256='0'.repeat(64),(m:any)=>m.nativeExportSha256='0'.repeat(64),(m:any)=>m.pageCount=999,(m:any)=>m.nativeExportUrl=m.nativeExportUrl.replace('G7-T22','G7-T23')]){const m=clone(f.manifest);mutate(m);assert.equal(api.approvedCrop(m,f.exercise),null);}
 for(const mutate of[(e:any)=>e.crops[0].y+=.000001,(e:any)=>e.crops.shift(),(e:any)=>e.crops.reverse(),(e:any)=>e.nativeItemId='q21b',(e:any)=>e.id='G7-T22-A-Q22א',(e:any)=>e.crops[0].page=0]){const e=clone(f.exercise);mutate(e);assert.equal(api.approvedCrop(f.manifest,e),null);}
});
it('all 181 reviewed group parts use all exact approved crops, including pages beyond last exercise page',()=>{
 let accepted=0,beyond=0;for(const m of manifests)for(const e of m.exercises||[]){if(!api.isReviewed(e))continue;const a=api.approvedCrop(m,e);assert.ok(a,e.id);accepted++;if(e.crops.some((c:any)=>c.page>m.exercisePageCount))beyond++;assert.equal(a.pageCount,m.pageCount);}
 assert.equal(accepted,181);assert.ok(beyond>0);const singular=fixture('G9-T13','a','q17','ב');assert.equal(api.approvedCrop(singular.manifest,singular.exercise),null);
});
