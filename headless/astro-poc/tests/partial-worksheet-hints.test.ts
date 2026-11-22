import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { appendHintText } from '../src/scripts/partialWorksheetReader.ts';
import { matchVerifiedRows, parsePartialHintIndex, reviewedPageNumbers, type PartialHintIndex } from '../src/lib/partialWorksheetHints.ts';

const hash = (s: string) => createHash('sha256').update(s,'utf8').digest('hex');
const hints = ['איזו פעולה מתאימה כאן?', 'השוו את הנתונים בשאלה.', 'בדקו את התוצאה בדרך נוספת.'];
const item = {
  exerciseId:'G7-T101-B-Q06ב', canonicalQuestionSha256:hash('q6'),
  canonicalItemId:'ms-g7-test-01-b-r1.question.06.item.02', sourceExerciseSha256:hash('body'), q:6,part:'ב',
  pin:{page:3,x:0.91,y:0.27},hintSha256:hints.map(hash) as [string,string,string],
};
const index: PartialHintIndex = {
  version:1,editionId:'ms-test-01-r1',nativePrefix:'G7-T101',level:'b',levelCode:'B',title:'דף בדיקה',
  pdfId:'2'.repeat(32),pdfSha256:hash('pdf'),canonicalSourceSha256:hash('source'),items:[item],
};
const verified = {
  edition_id:index.editionId,exercise_id:item.exerciseId,source_pdf_hash:index.pdfId,source_pdf_sha256:index.pdfSha256,
  canonical_source_sha256:index.canonicalSourceSha256,canonical_question_sha256:item.canonicalQuestionSha256,
  canonical_item_id:item.canonicalItemId,source_exercise_sha256:item.sourceExerciseSha256,
  hint_1:hints[0],hint_2:hints[1],hint_3:hints[2],status:'verified',
};

describe('partial worksheet pin bindings',() => {
  it('accepts an exact PDF, a three-digit topic and the source-positioned item',() => {
    assert.deepEqual(parsePartialHintIndex(index,index.pdfId),index);
  });
  it('rejects incorrect PDF identity, level, exercise, or position before reading the bank',() => {
    for (const value of [
      {...index,pdfId:'a'.repeat(32)}, {...index,level:'c'}, {...index,version:2},
      {...index,items:[item,item]}, {...index,items:[{...item,q:7}]},
      {...index,items:[{...item,pin:{page:0,x:.5,y:.5}}]}, {...index,items:[{...item,pin:{page:1,x:1.5,y:.5}}]},
      {...index,items:[{...item,hintSha256:[hash('same'),hash('same'),hash('same')]}]},
    ]) assert.equal(parsePartialHintIndex(value,index.pdfId),null);
    assert.equal(parsePartialHintIndex(index,'../sample.json'),null);
  });
  it('accepts exact verified authored text and ignores unrelated worksheet exercises',async () => {
    const bank=await matchVerifiedRows(index,[verified,{...verified,exercise_id:'G7-T101-B-Q05א'}]);
    assert.deepEqual([...bank.entries()],[[item.exerciseId,hints]]);
  });
  it('starts at the first page with a matched row and offers only unique reviewed pages in numerical order',async () => {
    const items = [10,1,9,9].map((page,i) => ({
      ...item, exerciseId:'G7-T101-B-Q0'+(i+1)+'א', q:i+1, part:'א',
      canonicalItemId:'ms-g7-test-01-b-r1.question.0'+(i+1)+'.item.01', pin:{...item.pin,page},
    }));
    const current = {...index,items};
    const responses = items.map((pin,i) => ({
      ...verified, exercise_id:pin.exerciseId, canonical_item_id:pin.canonicalItemId, status:i===1?'review':'verified',
    }));
    assert.deepEqual(reviewedPageNumbers(current,await matchVerifiedRows(current,responses)),[9,10]);
    assert.deepEqual(reviewedPageNumbers(current,new Map()),[]);
  });
  it('displays verified one-letter math atoms LTR while preserving all other literal text',() => {
    const {document} = parseHTML('<html><body></body></html>');
    const line = document.createElement('li');
    const input = 'בחנו $x$ מול $y$, טקסט <img src=x> וגם $x+1$, $$A$$ ו־\\$z$.';
    appendHintText(line,input);
    assert.equal(line.textContent,'בחנו x מול y, טקסט <img src=x> וגם $x+1$, $$A$$ ו־\\$z$.');
    assert.deepEqual([...line.querySelectorAll('bdi')].map(node=>[node.getAttribute('dir'),node.textContent]),[['ltr','x'],['ltr','y']]);
    assert.equal(line.querySelector('img'),null);
  });
  it('suppresses missing, duplicated or changed hints and every mismatched identity',async () => {
    for (const key of ['status','exercise_id','edition_id','source_pdf_hash','source_pdf_sha256','canonical_source_sha256','canonical_question_sha256','canonical_item_id','source_exercise_sha256','hint_1','hint_2','hint_3']) {
      assert.equal((await matchVerifiedRows(index,[{...verified,[key]:key==='status'?'review':'changed'}])).size,0,key);
    }
    for(const response of [[],null,{hint_1:hints[0]},[verified,verified],[{...verified,hint_2:hints[1]+' '}]]) {
      assert.equal((await matchVerifiedRows(index,response)).size,0);
    }
  });
});
