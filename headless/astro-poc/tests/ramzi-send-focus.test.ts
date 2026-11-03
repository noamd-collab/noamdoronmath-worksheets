import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';

function setup(source:string, mobile=true){
 const {document,window}=parseHTML('<html><body><textarea id="noamQuestion"></textarea><button id="noamSend"><svg><path></path></svg></button></body></html>');
 const field=document.getElementById('noamQuestion')! as any,send=document.getElementById('noamSend')! as any;
 let active:any=document.body,moved=false;
 Object.defineProperty(document,'activeElement',{configurable:true,get:()=>active});
 field.focus=()=>{active=field;};
 send.focus=()=>{if(active===field)moved=true;active=send;};
 const requests:any[]=[];
 const c:any={document,window,mobileLayout:{matches:mobile},tryNoamLocalVisual:()=>false,askNoam:(kind:string,message:string)=>requests.push({kind,message})};
 const start=source.indexOf('function noamKeepComposerFocusForSend('),end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0);
 const listenersStart=source.indexOf('  var noamSendButton=document.getElementById("noamSend");');
 const listenersEnd=source.indexOf('  document.getElementById("noamQuestion").addEventListener("input"',listenersStart);
 assert.ok(listenersStart>=0&&listenersEnd>listenersStart);
 runInNewContext(source.slice(start,end)+'\n'+source.slice(listenersStart,listenersEnd),c);
 function event(type:string,target:any,props:any={}){
  const e=new window.Event(type,{bubbles:true,cancelable:true}) as any;
  Object.keys(props).forEach(k=>Object.defineProperty(e,k,{value:props[k]}));
  target.dispatchEvent(e);return e;
 }
 function pointerDown(props:any={}){
  const e=event('pointerdown',send.querySelector('path'),{button:0,isPrimary:true,pointerType:'mouse',...props});
  // Model the native focus default and resulting phone layout movement. A
  // cancelled default leaves the original button under the pointer until up.
  if(!e.defaultPrevented)send.focus();
  return e;
 }
 return {c,field,send,document,requests,event,pointerDown,
  focusField(){active=field;moved=false;},moved:()=>moved,
  releasePointer(){event('pointerup',send.querySelector('path'));if(!moved)send.click();}};
}

for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const source=readFileSync(new URL(relative,import.meta.url),'utf8'),label=relative.includes('public')?'public':'root';
 it(label+': focused phone Send stays in place and the first native click submits exactly once',()=>{
  for(const pointerType of ['mouse','touch','pen']){
   const f=setup(source);f.field.value='האם 16 נכון?';f.focusField();
   assert.equal(f.pointerDown({pointerType}).defaultPrevented,true,pointerType);
   assert.equal(f.moved(),false);assert.equal(f.document.activeElement,f.field);
   assert.equal(f.requests.length,0,'pointerdown must not submit');
   f.releasePointer();assert.deepEqual(f.requests,[{kind:'free_question',message:'האם 16 נכון?'}]);
   f.event('mouseup',f.send);assert.equal(f.requests.length,1,'no compatibility-event duplicate');
  }
 });
 it(label+': cancelled gestures never submit on pointerdown or pointerup',()=>{
  const f=setup(source);f.field.value='שאלה';f.focusField();f.pointerDown();
  f.event('pointercancel',f.send);f.event('pointerup',f.send);f.event('mouseup',f.send);
  assert.equal(f.requests.length,0);
 });
 it(label+': desktop, unfocused, disabled and non-primary interactions keep native focus behavior',()=>{
  for(const mode of ['desktop','unfocused','disabled','secondary-button','non-primary']){
   const f=setup(source,mode!=='desktop');f.field.value='שאלה';if(mode!=='unfocused')f.focusField();
   if(mode==='disabled')f.send.disabled=true;
   const props=mode==='secondary-button'?{button:2}:mode==='non-primary'?{isPrimary:false}:{};
   assert.equal(f.pointerDown(props).defaultPrevented,false,mode);assert.equal(f.requests.length,0,mode);
  }
 });
 it(label+': Enter and keyboard clicks work, while composition and Shift+Enter do not send',()=>{
  for(const props of [{shiftKey:true},{isComposing:true},{keyCode:229}]){
   const f=setup(source);f.field.value='שאלה';f.focusField();
   assert.equal(f.event('keydown',f.field,{key:'Enter',...props}).defaultPrevented,false);
   assert.equal(f.requests.length,0);
  }
  const f=setup(source);f.field.value='  שאלה  ';f.focusField();
  assert.equal(f.event('keydown',f.field,{key:'Enter'}).defaultPrevented,true);
  assert.deepEqual(f.requests,[{kind:'free_question',message:'שאלה'}]);
  f.send.click();assert.equal(f.requests.length,2,'a separate keyboard/programmatic activation still works');
 });
 it(label+': empty input only focuses the field and local drawing intent keeps its existing route',()=>{
  const f=setup(source);f.field.value='  ';f.send.click();
  assert.equal(f.document.activeElement,f.field);assert.equal(f.requests.length,0);
  f.c.tryNoamLocalVisual=()=>true;f.field.value='סמן את A';f.send.click();
  assert.equal(f.requests.length,0);
 });
}
