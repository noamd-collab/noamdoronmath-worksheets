(function(root,factory){
  "use strict";
  var api=factory(root);
  if(typeof module==="object"&&module.exports){module.exports=api;}
  if(root){root.NoamCuratedHints=api;}
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  // Curated three-step hints live in Supabase (public.noam_ramzi_hints). Row
  // level security returns only rows marked 'verified' to the publishable key.
  // Each worksheet asks once, after its manifest loads, and registers the hints
  // as didactic guides, so הבנתי / לא הבנתי and the AI fallback stay unchanged.
  // Any failure leaves Ramzi exactly as it was.
  var TABLE="noam_ramzi_hints";
  var TIMEOUT_MS=4000;
  var MAX_HINT=600;
  var PREFIX=/^G[1-9]-T\d{2}$/;
  var LEVEL=/^[ABE]$/;
  var SUPABASE_URL=/^https:\/\/[a-z0-9-]+\.supabase\.co$/;
  var loaded=Object.create(null);

  function config(){
    var cfg=root&&root.NOAM_LEARNING_CONFIG;
    if(!cfg||typeof cfg.url!=="string"||typeof cfg.key!=="string"){return null;}
    if(!SUPABASE_URL.test(cfg.url)||!cfg.key){return null;}
    return cfg;
  }

  function hintList(row){
    var list=[row&&row.hint_1,row&&row.hint_2,row&&row.hint_3].map(function(item){
      return typeof item==="string"?item.trim():"";
    });
    return list.every(function(item){return item&&item.length<=MAX_HINT;})?list:null;
  }

  function request(cfg,worksheet,fetchImpl){
    var url=cfg.url+"/rest/v1/"+TABLE+"?select=exercise_id,hint_1,hint_2,hint_3"+
      "&exercise_id=like."+encodeURIComponent(worksheet+"-Q*");
    var controller=typeof AbortController==="function"?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},TIMEOUT_MS):null;
    function done(){if(timer){clearTimeout(timer);}}
    return fetchImpl(url,{
      method:"GET",
      headers:{apikey:cfg.key,Accept:"application/json"},
      cache:"no-store",
      credentials:"omit",
      signal:controller?controller.signal:undefined
    }).then(function(response){
      if(!response||!response.ok){throw new Error("CURATED_HINTS_HTTP");}
      return response.json();
    }).then(function(rows){done();return rows;},function(error){done();throw error;});
  }

  function waitForConfig(){
    var cfg=config();
    var doc=root&&root.document;
    if(cfg||!doc||doc.readyState==="complete"){return Promise.resolve(cfg);}
    // The public config script is deferred. A manifest can arrive while the
    // document is still interactive, so wait for whichever event comes first.
    return new Promise(function(resolve){
      var done=false;
      function finish(){if(done){return;}done=true;resolve(config());}
      doc.addEventListener("DOMContentLoaded",finish,{once:true});
      if(typeof root.addEventListener==="function"){root.addEventListener("load",finish,{once:true});}
    });
  }

  function prefetch(manifest,options){
    var opts=options||{};
    var guides=opts.guides||(root&&root.NoamDidacticGuides);
    var fetchImpl=opts.fetch||(root&&typeof root.fetch==="function"?root.fetch.bind(root):null);
    if(!manifest||!guides||typeof guides.register!=="function"||typeof fetchImpl!=="function"){
      return Promise.resolve(0);
    }
    var prefix=String(manifest.prefix||"");
    var level=String(manifest.levelCode||"");
    if(!PREFIX.test(prefix)||!LEVEL.test(level)||!Array.isArray(manifest.exercises)){
      return Promise.resolve(0);
    }
    var worksheet=prefix+"-"+level;
    var known=Object.create(null);
    manifest.exercises.forEach(function(exercise){
      if(exercise&&typeof exercise.id==="string"&&exercise.id.indexOf(worksheet+"-Q")===0){known[exercise.id]=true;}
    });
    if(!Object.keys(known).length&&manifest.exercises[0]&&typeof manifest.exercises[0].id==="string"){
      var alt=manifest.exercises[0].id.match(/^(G[1-9]-T\d{2}-[ABE])-Q/);
      if(alt&&alt[1].indexOf(prefix+"-")===0){
        worksheet=alt[1];
        manifest.exercises.forEach(function(exercise){
          if(exercise&&typeof exercise.id==="string"&&exercise.id.indexOf(worksheet+"-Q")===0){known[exercise.id]=true;}
        });
      }
    }
    if(loaded[worksheet]){return loaded[worksheet];}
    loaded[worksheet]=(opts.config?Promise.resolve(opts.config):waitForConfig()).then(function(cfg){
      if(!cfg){return [];}
      return request(cfg,worksheet,fetchImpl);
    }).then(function(rows){
      if(!Array.isArray(rows)){return 0;}
      var count=0;
      rows.forEach(function(row){
        var id=row&&row.exercise_id;
        // Only parts printed on this exact PDF can receive a curated hint.
        if(typeof id!=="string"||!known[id]){return;}
        var hints=hintList(row);
        if(hints&&guides.register(id,{hints:hints})){count+=1;}
      });
      return count;
    }).catch(function(){
      delete loaded[worksheet];
      return 0;
    });
    return loaded[worksheet];
  }

  return {prefetch:prefetch,table:TABLE};
});
