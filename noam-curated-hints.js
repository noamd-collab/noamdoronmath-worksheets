(function(root,factory){
  "use strict";
  var api=factory(root);
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamCuratedHints=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  // Public, RLS-filtered approved text. No model, student work or credentials
  // beyond the site's publishable key are involved in this catalog read.
  var TABLE="noam_ramzi_hints",TIMEOUT_MS=4000,MAX_HINT=600;
  var loaded=Object.create(null);
  function config(value){
    var cfg=value||(root&&root.NOAM_LEARNING_CONFIG);
    return cfg&&typeof cfg.url==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&
      typeof cfg.key==="string"&&cfg.key?cfg:null;
  }
  function scope(manifest){
    if(!manifest||!/^G[1-9]-T\d{2}$/.test(manifest.prefix)||!/^[ABE]$/.test(manifest.levelCode)||
        !/^[a-f0-9]{32}$/.test(manifest.pdfHash)||!Array.isArray(manifest.exercises)){return null;}
    var native=manifest.nativeExportSha256||"";
    if(native&&!/^[a-f0-9]{64}$/.test(native)){return null;}
    var worksheet=manifest.prefix+"-"+manifest.levelCode,known=Object.create(null);
    manifest.exercises.forEach(function(exercise){
      var id=exercise&&exercise.id;
      if(typeof id==="string"&&new RegExp("^"+manifest.prefix+"-[ABE]-Q\\d{2}[\\u05d0-\\u05ea]?$").test(id)){known[id]=true;}
    });
    var ids=Object.keys(known),levels=ids.map(function(id){return id.split("-Q")[0];});
    // Some single-level PDFs retain A exercise IDs in a B/E viewer. They must
    // still have exactly one worksheet identity and the same source prefix.
    if(!ids.length||levels.some(function(value){return value!==levels[0];})){return null;}
    worksheet=levels[0];
    var binding=manifest.pdfHash+":"+native;
    return {worksheet:worksheet,known:known,pdf:manifest.pdfHash,native:native,binding:binding,
      key:worksheet+":"+binding+":"+ids.sort().join(",")};
  }
  function waitForConfig(){
    var cfg=config(),doc=root&&root.document;
    if(cfg||!doc||doc.readyState==="complete"){return Promise.resolve(cfg);}
    return new Promise(function(resolve){
      var timer,done=false;
      function finish(){
        if(done){return;}done=true;clearTimeout(timer);
        if(typeof doc.removeEventListener==="function"){doc.removeEventListener("DOMContentLoaded",finish);}
        if(root&&typeof root.removeEventListener==="function"){root.removeEventListener("load",finish);}
        resolve(config());
      }
      doc.addEventListener("DOMContentLoaded",finish,{once:true});
      if(root&&typeof root.addEventListener==="function"){root.addEventListener("load",finish,{once:true});}
      timer=setTimeout(finish,TIMEOUT_MS);
    });
  }
  function request(cfg,source,fetchImpl){
    var url=cfg.url+"/rest/v1/"+TABLE+"?select=exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256"+
      "&exercise_id=like."+encodeURIComponent(source.worksheet+"-Q*");
    var controller=typeof AbortController==="function"?new AbortController():null,timer;
    var timeout=new Promise(function(_,reject){timer=setTimeout(function(){
      if(controller){controller.abort();}reject(new Error("CURATED_HINTS_TIMEOUT"));
    },TIMEOUT_MS);});
    var work=Promise.resolve().then(function(){return fetchImpl(url,{method:"GET",
      headers:{apikey:cfg.key,Accept:"application/json"},cache:"no-store",credentials:"omit",
      signal:controller?controller.signal:undefined});}).then(function(response){
      if(!response||!response.ok){throw new Error("CURATED_HINTS_HTTP");}
      return response.json();
    });
    return Promise.race([work,timeout]).then(function(rows){clearTimeout(timer);return rows;},function(error){clearTimeout(timer);throw error;});
  }
  function prefetch(manifest,options){
    var source=scope(manifest),opts=options||{};
    var fetchImpl=opts.fetch||(root&&typeof root.fetch==="function"?root.fetch.bind(root):null);
    if(!source||!fetchImpl){return Promise.resolve(0);}
    if(loaded[source.key]){return loaded[source.key].promise;}
    var entry={sets:Object.create(null),promise:null};loaded[source.key]=entry;
    entry.promise=(opts.config?Promise.resolve(config(opts.config)):waitForConfig()).then(function(cfg){
      if(!cfg){throw new Error("CURATED_HINTS_CONFIG");}return request(cfg,source,fetchImpl);
    }).then(function(rows){
      if(!Array.isArray(rows)||rows.length>1000){throw new Error("CURATED_HINTS_ROWS");}
      var seen=Object.create(null);
      rows.forEach(function(row){var id=row&&row.exercise_id;if(typeof id==="string"){seen[id]=(seen[id]||0)+1;}});
      rows.forEach(function(row){
        var id=row&&row.exercise_id;
        if(!source.known[id]||seen[id]!==1||row.source_pdf_hash!==source.pdf||
            (source.native&&row.source_native_sha256!==source.native)){return;}
        var hints=[row.hint_1,row.hint_2,row.hint_3].map(function(item){return typeof item==="string"?item.trim():"";});
        if(!hints.every(function(item){return item&&item.length<=MAX_HINT;})){return;}
        entry.sets[id]={hints:hints,binding:source.binding,revision:JSON.stringify([source.binding,id,hints])};
      });
      return Object.keys(entry.sets).length;
    }).catch(function(){if(loaded[source.key]===entry){delete loaded[source.key];}return 0;});
    return entry.promise;
  }
  function get(manifest,exerciseId){
    var source=scope(manifest),entry=source&&loaded[source.key],set=entry&&entry.sets[exerciseId];
    return set?{hints:set.hints.slice(),binding:set.binding,revision:set.revision}:null;
  }
  function invalidate(manifest){var source=scope(manifest);if(source){delete loaded[source.key];}}
  return {prefetch:prefetch,get:get,invalidate:invalidate,table:TABLE};
});
