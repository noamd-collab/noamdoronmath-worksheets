/* Optional progress. Guest data stays on this device; account data is never cached as guest data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NoamLearningCore=factory();})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 var STATES={started:'התחלתי',completed:'סיימתי',review:'צריך עוד תרגול'};
 var KEY='noam-learning-guest-v1';
 function create(options){
  var catalog=new Map(options.catalog.map(function(x){return[x.id,x];}));
  var storage=options.storage,client=options.client||null,account=null,cloud={},epoch=0,ready=!client,cloudReady=false;
  var listeners=[],pending=new Set(),storageError=false;
  function emit(){listeners.forEach(function(fn){fn();});}
  function clean(rows){var out={};if(!rows||typeof rows!=='object'||Array.isArray(rows))return out;
   Object.keys(rows).slice(0,2000).forEach(function(id){var r=rows[id];if(catalog.has(id)&&r&&Object.hasOwn(STATES,r.status)&&Number.isFinite(Date.parse(r.updated_at)))out[id]={status:r.status,updated_at:r.updated_at};});return out;}
  function guests(){try{return clean(JSON.parse(storage.getItem(KEY)||'{}'));}catch(e){storageError=true;return {};}}
  function saveGuest(data){storage.setItem(KEY,JSON.stringify(clean(data)));storageError=false;}
  function snapshot(){return{user:account,ready:ready,cloudReady:cloudReady,rows:account?Object.assign({},cloud):guests(),guestCount:Object.keys(guests()).length,pending:Array.from(pending),storageError:storageError};}
  async function refresh(){if(!account||!client)return;var version=epoch,user=account.id;cloudReady=false;emit();
   var result=await client.from('noam_learning_progress').select('worksheet_id,status,updated_at').eq('user_id',user).limit(1000);
   if(version!==epoch)return;
   if(result.error)throw result.error;
   var data={};(result.data||[]).forEach(function(r){data[r.worksheet_id]=r;});cloud=clean(data);cloudReady=true;emit();}
  async function setUser(user){epoch++;pending.clear();account=user?{id:user.id,email:user.email||''}:null;cloud={};ready=true;cloudReady=false;emit();if(account)await refresh();}
  async function change(id,status){
   if(!catalog.has(id)||status!==null&&!Object.hasOwn(STATES,status))throw Error('INVALID_PROGRESS');
   if(!ready||pending.has(id)||pending.has('*'))throw Error('BUSY');
   if(!account){var data=guests();if(status===null)delete data[id];else data[id]={status:status,updated_at:new Date().toISOString()};saveGuest(data);emit();return;}
   if(!cloudReady)throw Error('SYNC_NOT_READY');
   var version=epoch,user=account.id;pending.add(id);emit();
   try{var result=status===null?await client.from('noam_learning_progress').delete().eq('user_id',user).eq('worksheet_id',id):await client.from('noam_learning_progress').upsert({user_id:user,worksheet_id:id,status:status},{onConflict:'user_id,worksheet_id'}).select('worksheet_id,status,updated_at').single();
    if(result.error)throw result.error;
    if(version!==epoch)return;
    if(status===null)delete cloud[id];else cloud[id]={status:result.data.status,updated_at:result.data.updated_at};
   }finally{if(version===epoch){pending.delete(id);emit();}}
  }
  async function importGuest(){
   if(!account||!cloudReady||pending.size)throw Error('SYNC_NOT_READY');
   var version=epoch,user=account.id,local=guests();
   // Explicit import fills missing rows, never overwrites an existing account status.
   var rows=Object.keys(local).filter(function(id){return !cloud[id];}).map(function(id){return{user_id:user,worksheet_id:id,status:local[id].status};});
   pending.add('*');emit();try{if(rows.length){var result=await client.from('noam_learning_progress').upsert(rows,{onConflict:'user_id,worksheet_id',ignoreDuplicates:true});if(result.error)throw result.error;}
    if(version!==epoch)return;await refresh();
   }finally{if(version===epoch){pending.delete('*');emit();}}
  }
  async function clear(){if(pending.size||!ready)throw Error('BUSY');if(!account){storage.removeItem(KEY);emit();return;}
   if(!cloudReady)throw Error('SYNC_NOT_READY');var version=epoch,user=account.id;pending.add('*');emit();
   try{var result=await client.from('noam_learning_progress').delete().eq('user_id',user);if(result.error)throw result.error;if(version===epoch)cloud={};}
   finally{if(version===epoch){pending.delete('*');emit();}}
  }
  return{snapshot:snapshot,subscribe:function(fn){listeners.push(fn);},refresh:refresh,setUser:setUser,change:change,importGuest:importGuest,clear:clear,storageChanged:emit};
 }
 return{create:create,states:STATES,storageKey:KEY};
});
