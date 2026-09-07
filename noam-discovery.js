/* Topic links and on-device saved topics; the worksheet catalog remains the source. */
(function(){
  'use strict';
  var base = 'https://noamd-collab.github.io/noamdoronmath-worksheets/';
  var storageKey = 'noam-saved-topics-v1';
  var aiDetails=document.createElement('details');aiDetails.className='ai-details';
  var aiSummary=document.createElement('summary');aiSummary.textContent='על העזרה של נועם AI';
  aiDetails.append(aiSummary,document.getElementById('aibanner'));
  document.querySelector('.toolbar').after(aiDetails);
  function readSaved(){ try { var items=JSON.parse(localStorage.getItem(storageKey)||'[]'); return Array.isArray(items)?items.filter(function(x){return x && DATA[x.grade] && DATA[x.grade].topics.some(function(t){return t.id===x.topic;});}).slice(0,30):[]; } catch(e){return [];} }
  function link(grade,topic){return base+'?grade='+grade+'&topic='+topic;}
  function topicFor(g,id){return DATA[g] && DATA[g].topics.find(function(t){return t.id===Number(id);});}
  function announce(message){document.getElementById('discovery-status').textContent=message;}
  var card=cardHTML;
  cardHTML=function(topic,grade,index){
    var html=card(topic,grade,index);
    var saved=readSaved().some(function(x){return x.grade===grade && x.topic===topic.id;});
    return html.replace('</article>','<div class="topic-actions"><a href="'+link(grade,topic.id)+'" target="_blank" rel="noopener">קישור לנושא</a><button type="button" data-share-topic="'+topic.id+'" data-grade="'+grade+'">העתקת קישור</button><button type="button" data-save-topic="'+topic.id+'" data-grade="'+grade+'" aria-pressed="'+saved+'">'+(saved?'נשמר במכשיר':'שמירה במכשיר')+'</button></div></article>');
  };
  var originalMatches=matchesIn;
  matchesIn=function(grade,useGroup){
    var matches=originalMatches(grade,useGroup);
    return state.topic && grade===state.grade ? matches.filter(function(t){return t.id===Number(state.topic);}) : matches;
  };
  var originalSheet=sheetHref;
  sheetHref=function(topic,grade,level,hex,row){
    var href=originalSheet(topic,grade,level,hex,row);
    if(href.indexOf(VIEWER.path+'?')===0){
      var parent=topic.parent || topic.id;
      href+='&topic='+parent;
      var back=new URL(location.href); back.searchParams.set('grade',grade);
      href+='&back='+encodeURIComponent(back.pathname+back.search);
    }
    return href;
  };
  var savedPanel=document.createElement('details');
  savedPanel.className='saved-topics';
  savedPanel.innerHTML='<summary>הנושאים ששמרתי במכשיר הזה</summary><div id="saved-topic-list"></div><button type="button" id="clear-saved-topics">מחיקת השמורים במכשיר</button>';
  document.getElementById('list').before(savedPanel);
  var status=document.createElement('p'); status.id='discovery-status';status.className='sr-only';status.setAttribute('role','status');savedPanel.after(status);
  function renderSaved(){var items=readSaved();document.getElementById('saved-topic-list').innerHTML=items.length?items.map(function(x){var t=topicFor(x.grade,x.topic);return '<a href="'+link(x.grade,x.topic)+'">'+esc(GRADE_NAME[x.grade]+' — '+t.t)+'</a>';}).join(''):'אפשר לשמור נושא בלחיצה על ״שמירה במכשיר״. השמירה מקומית וללא חשבון.';}
  document.getElementById('clear-saved-topics').addEventListener('click',function(){try{localStorage.removeItem(storageKey);render();renderSaved();announce('הנושאים השמורים נמחקו מהמכשיר.');}catch(e){announce('לא ניתן לגשת לאחסון במכשיר.');}});
  document.getElementById('list').addEventListener('click',function(e){
    var b=e.target.closest('[data-share-topic],[data-save-topic]');if(!b)return;
    var grade=Number(b.dataset.grade),id=Number(b.dataset.shareTopic||b.dataset.saveTopic);
    if(!topicFor(grade,id))return;
    if(b.dataset.shareTopic){
      if(!navigator.clipboard || !navigator.clipboard.writeText){announce('אפשר להעתיק את הכתובת דרך ״קישור לנושא״.');return;}
      navigator.clipboard.writeText(link(grade,id)).then(function(){announce('הקישור לנושא הועתק.');}).catch(function(){announce('ההעתקה לא זמינה. אפשר להעתיק את הכתובת דרך ״קישור לנושא״.');});return;}
    var items=readSaved(),exists=items.some(function(x){return x.grade===grade&&x.topic===id;});
    items=items.filter(function(x){return x.grade!==grade||x.topic!==id;});if(!exists)items.unshift({grade:grade,topic:id});
    try{localStorage.setItem(storageKey,JSON.stringify(items.slice(0,30)));b.setAttribute('aria-pressed',String(!exists));b.textContent=exists?'שמירה במכשיר':'נשמר במכשיר';renderSaved();announce(exists?'הנושא הוסר מהשמורים.':'הנושא נשמר במכשיר הזה.');}catch(e){announce('השמירה אינה זמינה במכשיר הזה. אפשר להעתיק קישור.');}
  });
  var params=new URL(location.href).searchParams;
  var initialTopic=topicFor(state.grade,params.get('topic'));
  if(initialTopic){state.topic=initialTopic.parent||initialTopic.id;state.track=TRACK_GROUPS[initialTopic.g]?'red':'reg';}
  state.q=params.get('q')||'';state.cross=params.get('cross')==='1';
  if(!initialTopic && params.get('track')==='red')state.track='red';
  if(DATA[state.grade].groups.some(function(g){return g.key===params.get('group');}))state.group=params.get('group');
  document.getElementById('q').value=state.q;document.getElementById('crossq').checked=state.cross;
  var originalRender=render;
  render=function(){
    var u=new URL(location.href);u.searchParams.set('grade',state.grade);
    ['q','topic','group','track','cross'].forEach(function(k){var v=state[k];if(v && v!=='all' && v!=='reg')u.searchParams.set(k,k==='cross'?'1':v);else u.searchParams.delete(k);});
    history.replaceState(null,'',u.pathname+u.search+u.hash);originalRender();
  };
  ['grades','jump','chips','trackbar','q','crossq'].forEach(function(id){document.getElementById(id).addEventListener(id==='q'?'input':id==='crossq'?'change':'click',function(){state.topic=null;},true);});
  syncTrackbar();buildChips();renderSaved();render();
})();
