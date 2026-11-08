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
  var EDITION_TABLE="noam_worksheet_edition_hints",SHA=/^[a-f0-9]{64}$(?![\s\S])/;
  var EDITION=/^[a-z0-9][a-z0-9-]{0,63}$(?![\s\S])/,IDENTITY=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$(?![\s\S])/;
  var loaded=Object.create(null);
  function config(value){
    var cfg=value||(root&&root.NOAM_LEARNING_CONFIG);
    return cfg&&typeof cfg.url==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&
      typeof cfg.key==="string"&&cfg.key?cfg:null;
  }
  function editionManifest(manifest){
    return !!manifest&&(Object.prototype.hasOwnProperty.call(manifest,"editionId")||
      manifest.geometryContract==="measured-v1"||Object.prototype.hasOwnProperty.call(manifest,"canonicalSourceSha256"));
  }
  function editionScope(manifest){
    if(!manifest||!EDITION.test(manifest.editionId||"")||manifest.editionId==="legacy"||
      manifest.geometryContract!=="measured-v1"||manifest.publishable!==true||manifest.reviewRequired!==false||
      manifest.syntheticTestFixture===true||!/^G[1-9]-T\d{2}$/.test(manifest.prefix||"")||
      !/^(?:[ABE]|E2)$/.test(manifest.levelCode||"")||!/^[a-f0-9]{32}$/.test(manifest.pdfHash||"")||
      !SHA.test(manifest.sourceSha256||"")||!SHA.test(manifest.canonicalSourceSha256||"")||
      !Array.isArray(manifest.exercises)||!manifest.exercises.length){return null;}
    var known=Object.create(null),items=Object.create(null),questionHashes=Object.create(null),rows=[],invalid=false;
    var worksheet=manifest.prefix+"-"+manifest.levelCode;
    manifest.exercises.forEach(function(ex){
      if(!ex||!new RegExp("^"+worksheet+"-Q\\d{2}[\\u05d0-\\u05ea]?$").test(ex.id||"")||known[ex.id]||
        !IDENTITY.test(ex.canonicalItemId||"")||items[ex.canonicalItemId]||!IDENTITY.test(ex.canonicalQuestionId||"")||
        !SHA.test(ex.canonicalQuestionSha256||"")||!SHA.test(ex.sourceExerciseSha256||"")||
        typeof ex.text!=="string"||!ex.text.trim()||!Number.isSafeInteger(ex.q)||ex.q<1||ex.q>99||
        typeof ex.part!=="string"||!/^([\u05d0-\u05ea])?$/.test(ex.part)||
        ex.id!==worksheet+"-Q"+String(ex.q).padStart(2,"0")+ex.part){invalid=true;return;}
      if(questionHashes[ex.canonicalQuestionId]&&questionHashes[ex.canonicalQuestionId]!==ex.canonicalQuestionSha256){invalid=true;return;}
      questionHashes[ex.canonicalQuestionId]=ex.canonicalQuestionSha256;items[ex.canonicalItemId]=true;known[ex.id]={canonicalItemId:ex.canonicalItemId,canonicalQuestionSha256:ex.canonicalQuestionSha256,sourceExerciseSha256:ex.sourceExerciseSha256,text:ex.text};
      rows.push([ex.id,ex.canonicalQuestionId,ex.canonicalItemId,ex.canonicalQuestionSha256,ex.sourceExerciseSha256,ex.text]);
    });
    if(invalid){return null;}
    var binding=JSON.stringify([manifest.editionId,manifest.pdfHash,manifest.sourceSha256,manifest.canonicalSourceSha256]);
    return {edition:manifest.editionId,worksheet:worksheet,pdf:manifest.pdfHash,pdfSha:manifest.sourceSha256,
      canonical:manifest.canonicalSourceSha256,known:known,binding:binding,key:binding+":"+JSON.stringify(rows)};
  }
  function digest(bytes){
    if(!root||!root.crypto||!root.crypto.subtle){return Promise.reject(new Error("EDITION_SHA_UNAVAILABLE"));}
    return Promise.resolve().then(function(){return root.crypto.subtle.digest("SHA-256",bytes);}).then(function(result){
      return Array.from(new Uint8Array(result)).map(function(n){return n.toString(16).padStart(2,"0");}).join("");
    });
  }
  function verifyTaskText(source){
    if(!source.edition){return Promise.resolve();}
    return Promise.all(Object.keys(source.known).map(function(id){
      var ex=source.known[id],text=ex.text.replace(/\r/g,"").replace(/[ \t]+/g," ").trim().normalize("NFC");
      return digest(new TextEncoder().encode(text)).then(function(sha){
        if(sha!==ex.sourceExerciseSha256){throw new Error("EDITION_TASK_SHA");}
      });
    }));
  }
  // Called before the viewer enables the manifest. Bytes come from its existing
  // PDF.js document, not a second request or an unverified manifest flag.
  function validateViewerBinding(manifest,context,pdfBytes){
    var ctx=context||{};
    if(!editionManifest(manifest)&&!ctx.editionId){return Promise.resolve(true);}
    var source=editionScope(manifest);
    var prefixGrade=source?Number(manifest.prefix.slice(1,2)):null;
    if(!source||!Number.isInteger(ctx.gradeNumber)||ctx.gradeNumber!==prefixGrade||
      (Object.prototype.hasOwnProperty.call(manifest,"grade")&&manifest.grade!==prefixGrade)||
      ctx.editionId!==source.edition||ctx.pdfHash!==source.pdf||ctx.prefix!==manifest.prefix||
      ctx.levelCode!==manifest.levelCode){return Promise.resolve(false);}
    return Promise.all([digest(pdfBytes),verifyTaskText(source)]).then(function(results){return results[0]===source.pdfSha;}).catch(function(){return false;});
  }
  function scope(manifest){
    // Any canonical/edition signal selects the strict branch, even if malformed.
    // A broken new manifest must never become a legacy hint query.
    if(editionManifest(manifest)){return editionScope(manifest);}
    if(!manifest||!/^G[1-9]-T\d{2}$/.test(manifest.prefix)||!/^(?:[ABE]|E2)$/.test(manifest.levelCode)||
        !/^[a-f0-9]{32}$/.test(manifest.pdfHash)||!Array.isArray(manifest.exercises)){return null;}
    var native=manifest.nativeExportSha256||"";
    if(native&&!/^[a-f0-9]{64}$/.test(native)){return null;}
    var worksheet=manifest.prefix+"-"+manifest.levelCode,known=Object.create(null);
    manifest.exercises.forEach(function(exercise){
      var id=exercise&&exercise.id;
      if(typeof id==="string"&&new RegExp("^"+manifest.prefix+"-(?:[ABE]|E2)-Q\\d{2}[\\u05d0-\\u05ea]?$").test(id)){known[id]=true;}
    });
    var ids=Object.keys(known),levels=ids.map(function(id){return id.split("-Q")[0];});
    // Some single-level PDFs retain A exercise IDs in a B/E viewer. They must
    // still have exactly one worksheet identity and the same source prefix.
    if(!ids.length||levels.some(function(value){return value!==levels[0];})){return null;}
    // E2 is a separate worksheet, never an alias of the ordinary E level.
    if((manifest.levelCode==="E2")!==(levels[0]===manifest.prefix+"-E2")){return null;}
    worksheet=levels[0];
    var binding=manifest.pdfHash+":"+native;
    // questionPagesIdenticalTo names earlier PDFs of this sheet whose question
    // pages were verified identical; the new PDF only appends the final-answers
    // pages. Hints bound to such a PDF stay valid until the bank is rebound.
    var pdfs=Object.create(null);pdfs[manifest.pdfHash]=true;
    (Array.isArray(manifest.questionPagesIdenticalTo)?manifest.questionPagesIdenticalTo:[]).forEach(function(alias){
      if(typeof alias==="string"&&/^[a-f0-9]{32}$/.test(alias)){pdfs[alias]=true;}
    });
    return {worksheet:worksheet,known:known,pdf:manifest.pdfHash,pdfs:pdfs,native:native,binding:binding,
      key:worksheet+":"+binding+":"+ids.sort().join(",")};
  }
  function waitForConfig(deadline){
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
      timer=setTimeout(finish,Math.max(0,deadline-Date.now()));
    });
  }
  function request(cfg,source,fetchImpl,deadline){
    var remaining=deadline-Date.now();
    if(remaining<=0){return Promise.reject(new Error("CURATED_HINTS_TIMEOUT"));}
    var url=cfg.url+"/rest/v1/"+TABLE+"?select=exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256"+
      "&exercise_id=like."+encodeURIComponent(source.worksheet+"-Q*");
    if(source.edition){
      url=cfg.url+"/rest/v1/"+EDITION_TABLE+"?select=edition_id,exercise_id,source_pdf_hash,source_pdf_sha256,canonical_source_sha256,canonical_question_sha256,canonical_item_id,source_exercise_sha256,hint_1,hint_2,hint_3,status"+
        "&edition_id=eq."+encodeURIComponent(source.edition)+"&source_pdf_hash=eq."+source.pdf+
        "&source_pdf_sha256=eq."+source.pdfSha+"&canonical_source_sha256=eq."+source.canonical+
        "&status=eq.verified&exercise_id=like."+encodeURIComponent(source.worksheet+"-Q*");
    }
    var controller=typeof AbortController==="function"?new AbortController():null,timer;
    var timeout=new Promise(function(_,reject){timer=setTimeout(function(){
      if(controller){controller.abort();}reject(new Error("CURATED_HINTS_TIMEOUT"));
    },remaining);});
    var work=Promise.resolve().then(function(){
      if(Date.now()>=deadline){throw new Error("CURATED_HINTS_TIMEOUT");}
      return fetchImpl(url,{method:"GET",
      headers:{apikey:cfg.key,Accept:"application/json"},cache:"no-store",credentials:"omit",
      signal:controller?controller.signal:undefined});}).then(function(response){
      if(!response||!response.ok){throw new Error("CURATED_HINTS_HTTP");}
      return response.json();
    });
    return Promise.race([work,timeout]).then(function(rows){clearTimeout(timer);if(Date.now()>=deadline){throw new Error("CURATED_HINTS_TIMEOUT");}return rows;},function(error){clearTimeout(timer);throw error;});
  }
  function prefetch(manifest,options){
    var source=scope(manifest),opts=options||{};
    var fetchImpl=opts.fetch||(root&&typeof root.fetch==="function"?root.fetch.bind(root):null);
    if(!source||!fetchImpl){return Promise.resolve(0);}
    if(loaded[source.key]){return loaded[source.key].promise;}
    var deadline=Date.now()+TIMEOUT_MS;
    var entry={sets:Object.create(null),promise:null,ready:false};loaded[source.key]=entry;
    entry.promise=(opts.config?Promise.resolve(config(opts.config)):waitForConfig(deadline)).then(function(cfg){
      if(!cfg){throw new Error("CURATED_HINTS_CONFIG");}
      return verifyTaskText(source).then(function(){return request(cfg,source,fetchImpl,deadline);});
    }).then(function(rows){
      if(!Array.isArray(rows)||rows.length>1000){throw new Error("CURATED_HINTS_ROWS");}
      var seen=Object.create(null);
      rows.forEach(function(row){var id=row&&row.exercise_id;if(typeof id==="string"){seen[id]=(seen[id]||0)+1;}});
      rows.forEach(function(row){
        var id=row&&row.exercise_id;
        if(!source.known[id]||seen[id]!==1){return;}
        if(source.edition){
          var ex=source.known[id];
          if(row.status!=="verified"||row.edition_id!==source.edition||row.source_pdf_hash!==source.pdf||
            row.source_pdf_sha256!==source.pdfSha||row.canonical_source_sha256!==source.canonical||
            row.canonical_question_sha256!==ex.canonicalQuestionSha256||row.canonical_item_id!==ex.canonicalItemId||
            row.source_exercise_sha256!==ex.sourceExerciseSha256){return;}
        }else if(typeof row.source_pdf_hash!=="string"||source.pdfs[row.source_pdf_hash]!==true||
            (source.native&&row.source_native_sha256!==source.native)){return;}
        var hints=[row.hint_1,row.hint_2,row.hint_3].map(function(item){return typeof item==="string"?item.trim():"";});
        if(!hints.every(function(item){return item&&item.length<=MAX_HINT;})){return;}
        var itemBinding=source.edition?JSON.stringify([source.binding,id,source.known[id].canonicalQuestionSha256,
          source.known[id].canonicalItemId,source.known[id].sourceExerciseSha256]):source.binding;
        entry.sets[id]={hints:hints,binding:itemBinding,revision:JSON.stringify([itemBinding,id,hints])};
      });
      entry.ready=true;
      return Object.keys(entry.sets).length;
    }).catch(function(){if(loaded[source.key]===entry){delete loaded[source.key];}return 0;});
    return entry.promise;
  }
  function get(manifest,exerciseId){
    var source=scope(manifest),entry=source&&loaded[source.key],set=entry&&entry.sets[exerciseId];
    return set?{hints:set.hints.slice(),binding:set.binding,revision:set.revision}:null;
  }
  function status(manifest,exerciseId){
    var source=scope(manifest),entry=source&&loaded[source.key];
    return entry&&entry.ready?(entry.sets[exerciseId]?"available":"missing"):"unavailable";
  }
  function invalidate(manifest){var source=scope(manifest);if(source){delete loaded[source.key];}}
  return {prefetch:prefetch,get:get,status:status,invalidate:invalidate,table:TABLE,editionTable:EDITION_TABLE,
    isEditionManifest:editionManifest,validateViewerBinding:validateViewerBinding};
});
