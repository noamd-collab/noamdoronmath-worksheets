import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
const viewer = readFileSync(fileURLToPath(new URL('../public/worksheet-viewer-noam.html', import.meta.url)), 'utf8');
const helper = 'var lastReadingTranscript=null;' + viewer.split('  var lastReadingTranscript=null;')[1].split('  function sync(){')[0];
function fixture({top=400,bottom=600,height=200,diagram=false,typing=false,preview=false,compact=true}={}) {
  const frames: Function[]=[];
  const reply={getBoundingClientRect:()=>({top,bottom,height}),querySelector:()=>diagram?{}:null};
  const transcript={isConnected:true,querySelectorAll:()=>[reply]};
  const body={clientHeight:480,scrollTop:0,getBoundingClientRect:()=>({top:100,bottom:580}),classList:{contains:()=>preview}};
  const context={document:{getElementById:()=>transcript,activeElement:{id:typing?'noamQuestion':''}},panel:{classList:{contains:()=>compact}},panelBody:body,requestAnimationFrame:(f:Function)=>frames.push(f)};
  runInNewContext(helper,context);
  return {body,transcript,reveal:()=>runInNewContext('revealCompactReply()',context),flush:()=>frames.splice(0).forEach(f=>f())};
}
it('reveals the complete short answer and its controls only after layout',()=>{
 const f=fixture(); f.reveal(); assert.equal(f.body.scrollTop,0); f.flush(); assert.equal(f.body.scrollTop,28);
 f.body.scrollTop=7;f.reveal();f.flush();assert.equal(f.body.scrollTop,7,'decorations must not undo user scrolling');
});
it('starts an oversized answer at its beginning',()=>{
 const f=fixture({top:300,bottom:1100,height:800});f.reveal();f.flush();assert.equal(f.body.scrollTop,192);
});
it('preserves typing, source preview, diagram reveal and tall layouts',()=>{
 for(const opts of [{typing:true},{preview:true},{diagram:true},{compact:false}]){const f=fixture(opts);f.reveal();f.flush();assert.equal(f.body.scrollTop,0);}
 const f=fixture();f.reveal();f.transcript.isConnected=false;f.flush();assert.equal(f.body.scrollTop,0);
});
