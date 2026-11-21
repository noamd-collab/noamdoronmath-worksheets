import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as next from '../scripts/lib/measured-worksheet.mjs';
const dir=new URL('./fixtures/measured-v1/',import.meta.url).pathname;
let fixtures=0, legacy=0, added=0, negative=0;
for(const name of ['a05-B','b28-E','synthetic-dependency','synthetic-split']) {
 const draft=JSON.parse(readFileSync(dir+name+'/draft.json'));const layout=readFileSync(dir+name+'/layout.json');
 const media={pdfId:'a'.repeat(32),url:'https://static.wixstatic.com/ugd/d8e7ad_'+ 'a'.repeat(32)+'.pdf',downloadedSha256:draft.binding.pdfSha256,syntheticTestFixture:true};
 const m=next.prepareMeasuredManifestDraft(draft,layout,media);fixtures++;
 const remap=p=>{const c=structuredClone(m);c.prefix=p;for(const e of c.exercises)e.id=`${p}-${c.levelCode}-Q${String(e.q).padStart(2,'0')}${e.part}`;return c;};
 for(let g=1;g<=9;g++)for(let t=0;t<100;t++){const c=remap(`G${g}-T${String(t).padStart(2,'0')}`);next.validateMeasuredManifest(c,{allowDraft:true});legacy++;}
 for(let g=7;g<=9;g++)for(let t=100;t<1000;t++){const c=remap(`G${g}-T${t}`);next.validateMeasuredManifest(c,{allowDraft:true});added++;}
 for(const p of ['G1-T100','G6-T999','G10-T100','G9-T001','G9-T1000','G9-T1','G9-T-1','G9-T1.0','G9-T100\n','G9-T01\n','G9-T100/../','G9-T١٠٠',' G9-T100']){assert.throws(()=>next.validateMeasuredManifest(remap(p),{allowDraft:true}),/MEASURED_WORKSHEET_ID/);negative++;}
 const c=remap('G9-T100');assert.throws(()=>next.validateMeasuredManifest(c),/DRAFT/);c.exercises[0].id=m.exercises[0].id;assert.throws(()=>next.validateMeasuredManifest(c,{allowDraft:true}),/MEASURED_EXERCISE_ID/);negative+=2;
}
console.log({fixtures,legacy,added,negative,result:'PASS'});
