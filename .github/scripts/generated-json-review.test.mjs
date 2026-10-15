import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATED_GUIDE_PATH, jsonChanges, prepareGeneratedJsonReview } from './generated-json-review.mjs';
test('generated semantic review retains all non-generated code exactly',()=>{
 const before=JSON.stringify({records:[{id:'page-viewer',title:'old'}]});
 const after=JSON.stringify({records:[{id:'page-viewer',title:'new'}]});
 const codeBefore='diff --git a/src/viewer.ts b/src/viewer.ts\n@@ code @@\n-oldCode\n+newCode\n';
 const guide=`diff --git a/${GENERATED_GUIDE_PATH} b/${GENERATED_GUIDE_PATH}\n-${before}\n+${after}\n`;
 const codeAfter='diff --git a/tests/viewer.ts b/tests/viewer.ts\n@@ test @@\n-oldTest\n+newTest\n';
 const result=prepareGeneratedJsonReview(codeBefore+guide+codeAfter,before,after);
 assert.ok(result.text.startsWith(codeBefore));assert.ok(result.text.endsWith(codeAfter));
 assert.deepEqual(result.changes,[{path:'$.records[0].title',before:'old',after:'new'}]);
 assert.match(result.text,/Before full-file SHA-256: [a-f0-9]{64}/);
 assert.match(result.text,/After full-file SHA-256: [a-f0-9]{64}/);
 assert.match(result.text,/-"old"\n\+"new"/);
});
test('arrays, null and deleted/added fields remain distinguishable',()=>{
 assert.deepEqual(jsonChanges({a:[1,null],b:false},{a:[2],c:false}),[
  {path:'$.a[0]',before:1,after:2},{path:'$.a[1]',before:null,after:{missing:true}},
  {path:'$.b',before:false,after:{missing:true}},{path:'$.c',before:{missing:true},after:false},
 ]);
});
test('only the allowlisted generated JSON section is normalized and malformed input fails closed',()=>{
 const code='diff --git a/src/app.ts b/src/app.ts\n+code\n';
 assert.deepEqual(prepareGeneratedJsonReview(code,'bad','bad'),{text:code,normalized:false,changes:[]});
 const guide=`diff --git a/${GENERATED_GUIDE_PATH} b/${GENERATED_GUIDE_PATH}\n-old\n+new\n`;
 assert.throws(()=>prepareGeneratedJsonReview(guide,'bad','{}'),SyntaxError);
});
