(function(){
 'use strict';
 var catalog=window.NOAM_LEARNING_CATALOG||[],Core=window.NoamLearningCore;if(!catalog.length||!Core)return;
 var cfg=window.NOAM_LEARNING_CONFIG||{},base='https://noamd-collab.github.io/noamdoronmath-worksheets/',portal=new URL('learning.html',location.href).href;
 var byId=new Map(catalog.map(function(x){return[x.id,x];})),client=null,engine,portalMode=!!document.getElementById('learning-app'),embedded=window.self!==window.top;
 var storage;try{storage=localStorage;}catch(e){storage={getItem:function(){throw e;},setItem:function(){throw e;},removeItem:function(){throw e;}};}
 if(cfg.googleEnabled&&window.supabase&&!embedded){try{client=window.supabase.createClient(cfg.url,cfg.key,{auth:{flowType:'pkce',storageKey:'noam-learning-auth-v1',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});}catch(e){client=null;}}
 engine=Core.create({catalog:catalog,storage:storage,client:client});
 var message=document.createElement('p');message.className='nl-message';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 function el(tag,text,cls){var e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
 function button(text,fn,cls){var b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
 function link(text,href){var a=el('a',text);a.href=href;return a;}
 function tell(text){message.textContent=text;}
 function fail(){tell('השינוי לא נשמר. בדקו את החיבור ונסו שוב. אפשר להמשיך לפתוח ולתרגל את כל הדפים.');}
 function openPdf(item){
  var raw=item.pdf,full=/^https:\/\//.test(raw)?raw:'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_'+raw+'.pdf';
  if(item.g<7||!item.x)return full;
  var u=new URL('worksheet-viewer-noam.html',location.href),p=u.searchParams;
  p.set('g',item.g);p.set('x',item.x);p.set('lv',item.l==='one'?'b':item.l);p.set('pdf',raw);p.set('t',item.title);p.set('topic',item.parent);p.set('back',new URL('learning.html',location.href).pathname);
  catalog.filter(function(x){return x.g===item.g&&x.t===item.t;}).forEach(function(x){if(x.l!=='one')p.set('p'+x.l,x.pdf);});return u.href;
 }
 function controls(item){var box=el('div',undefined,'nl-controls');box.dataset.learningId=item.id;box.setAttribute('role','group');box.setAttribute('aria-label',item.title+' — '+item.label+' — מצב עבודה');
  Object.keys(Core.states).forEach(function(s){var b=button(Core.states[s],function(){engine.change(item.id,s).then(function(){tell(engine.snapshot().user?'המצב נשמר בחשבון.':'המצב נשמר במכשיר הזה. אין צורך להתחבר.');}).catch(fail);});b.dataset.status=s;b.setAttribute('aria-pressed','false');box.append(b);});
  var undo=button('ביטול סימון',function(){engine.change(item.id,null).then(function(){tell('הסימון הוסר.');}).catch(fail);},'nl-reset');undo.dataset.status='';box.append(undo);return box;
 }
 function refreshControls(){var s=engine.snapshot();document.querySelectorAll('[data-learning-id]').forEach(function(box){var id=box.dataset.learningId,row=s.rows[id];box.querySelectorAll('button[data-status]').forEach(function(b){b.setAttribute('aria-pressed',String(!!row&&row.status===b.dataset.status));b.disabled=!s.ready||!!s.user&&!s.cloudReady||s.pending.includes(id)||s.pending.includes('*');if(!b.dataset.status)b.hidden=!row;});});}
 var authBox=el('section',undefined,'nl-account');authBox.setAttribute('aria-label','שמירת התקדמות');
 function renderAuth(){var s=engine.snapshot();authBox.replaceChildren();
  if(!s.ready){authBox.append(el('p','בודקים את החיבור לחשבון… התרגול פתוח כרגיל.'));return;}
  if(s.user){authBox.append(el('p','מחוברים: '+s.user.email));authBox.append(el('p',s.cloudReady?'ההתקדמות נשמרת בחשבון וניתן להמשיך ממכשיר אחר.':'ממתינים לטעינת ההתקדמות מהחשבון.'));
   authBox.append(button('רענון ההתקדמות',function(){engine.refresh().catch(fail);}));
   if(s.guestCount)authBox.append(button('הוספת הסימונים מהמכשיר לחשבון',function(){if(!confirm('להוסיף לחשבון הנוכחי את הסימונים המקומיים? סימונים שכבר קיימים בחשבון לא יוחלפו.'))return;engine.importGuest().then(function(){tell('הסימונים החסרים נוספו לחשבון. העותק המקומי נשאר במכשיר.');}).catch(fail);}));
   authBox.append(button('התנתקות',async function(){var r=await client.auth.signOut({scope:'local'});if(r.error){fail();return;}tell('התנתקתם. מוצגים כעת רק הסימונים המקומיים במכשיר.');}));
  }else{
   authBox.append(el('strong','אפשר לעבוד כאן בלי להתחבר.'));
   authBox.append(el('p','סימוני העבודה נשמרים בדפדפן הזה. במחשב משותף כדאי למחוק אותם בסיום.'));
   if(embedded){var a=link('פתיחת הלמידה שלי בחלון מלא',portal);a.target='_blank';a.rel='noopener';authBox.append(a);}
   else if(client){var b=button('המשך עם Google',async function(){b.disabled=true;try{var r=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:base+'learning.html',queryParams:{prompt:'select_account'}}});if(r.error)throw r.error;}catch(e){b.disabled=false;tell('לא הצלחנו לפתוח את הכניסה בגוגל. אפשר להמשיך ללא כניסה.');}},'nl-google');authBox.append(b,el('small','הכניסה אופציונלית ומאפשרת שמירה בין מכשירים. שם, כתובת דוא״ל ומזהה חשבון משמשים לזיהוי. איננו מבקשים גישה ל־Gmail או ל־Drive.'));}
   else authBox.append(el('small',cfg.googleEnabled?'חיבור Google אינו זמין כרגע. אפשר להמשיך במעקב המקומי ולנסות שוב לאחר רענון.':'שמירה בין מכשירים עם Google נמצאת בהכנה. המעקב במכשיר כבר זמין ללא כניסה.'));
  }
 }
 var cards=null,filter=null,search=null;
 function card(item,row){var a=el('article',undefined,'nl-card'),h=el('h2',item.title);a.append(el('p','כיתה '+('אבגדהוזחט'[item.g-1])+'׳ · '+item.label,'nl-meta'),h);
  var pdf=link('פתיחת דף העבודה',openPdf(item));pdf.target='_blank';pdf.rel='noopener noreferrer';a.append(pdf);
  if(row)a.append(el('p',Core.states[row.status]+' · עודכן '+new Date(row.updated_at).toLocaleDateString('he-IL'),'nl-meta'));
  a.append(controls(item));return a;
 }
 function renderPortal(){if(!cards)return;var s=engine.snapshot(),term=search.value.trim(),mode=filter.value;
  var rows=catalog.filter(function(x){var r=s.rows[x.id];return (mode==='all'||mode==='saved'&&r||r&&r.status===mode)&&(!term||(x.title+' '+x.label+' כיתה '+('אבגדהוזחט'[x.g-1])+'׳').includes(term));});
  rows.sort(function(a,b){return Date.parse((s.rows[b.id]||{}).updated_at||0)-Date.parse((s.rows[a.id]||{}).updated_at||0)||a.g-b.g||a.t-b.t;});
  cards.replaceChildren();document.getElementById('nl-count').textContent=rows.length===1?'דף עבודה אחד':rows.length+' דפי עבודה';
  if(!rows.length)cards.append(el('p',mode==='all'?'לא נמצאו דפים. נסו מילת חיפוש אחרת.':'עדיין אין כאן סימונים. בחרו ״כל הדפים״ או סמנו מצב עבודה במאגר.','nl-empty'));
  var chosen=new URL(location.href).searchParams.get('worksheet');if(chosen&&byId.has(chosen)&&!document.getElementById('nl-chosen')){var chosenBox=el('section');chosenBox.id='nl-chosen';chosenBox.append(el('h2','הדף שבחרתם'),card(byId.get(chosen),s.rows[chosen]));cards.before(chosenBox);}
  var page=rows.slice(0,60);page.forEach(function(x){cards.append(card(x,s.rows[x.id]));});
  if(rows.length>60)cards.append(el('p','מוצגים 60 הדפים הראשונים. השתמשו בחיפוש כדי לצמצם את הרשימה.'));
 }
 if(portalMode){var app=document.getElementById('learning-app');app.append(authBox,message);
  var bar=el('div',undefined,'nl-filters'),label=el('label','הצגת דפים ');filter=el('select');filter.setAttribute('aria-label','סינון מצב עבודה');
  [['saved','הדפים שלי'],['started','התחלתי'],['completed','סיימתי'],['review','צריך עוד תרגול'],['all','כל הדפים']].forEach(function(p){var o=el('option',p[1]);o.value=p[0];filter.append(o);});label.append(filter);
  search=el('input');search.type='search';search.placeholder='חיפוש נושא או כיתה';search.setAttribute('aria-label','חיפוש בדפי הלמידה');bar.append(label,search);app.append(bar);
  var count=el('p');count.id='nl-count';count.setAttribute('role','status');app.append(count);cards=el('div',undefined,'nl-cards');app.append(cards);
  filter.addEventListener('change',function(){renderPortal();refreshControls();});search.addEventListener('input',function(){renderPortal();refreshControls();});
  var footer=el('section',undefined,'nl-data');footer.append(el('h2','המידע שלי'));
  footer.append(button('הורדת ההתקדמות שלי',function(){var s=engine.snapshot();var entries=Object.entries(s.rows).map(function(p){var x=byId.get(p[0]);return{worksheet:p[0],title:x.title,grade:x.g,level:x.label,status:p[1].status,updated_at:p[1].updated_at};});var u=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),progress:entries},null,2)],{type:'application/json'}));var a=link('',u);a.download='noam-learning-progress.json';a.click();setTimeout(function(){URL.revokeObjectURL(u);},1000);}));
  footer.append(button('מחיקת סימוני ההתקדמות',function(){var s=engine.snapshot();if(!confirm(s.user?'למחוק את כל סימוני ההתקדמות בחשבון? הפעולה תסיר אותם גם מהמכשירים האחרים.':'למחוק את כל סימוני ההתקדמות בדפדפן הזה?'))return;engine.clear().then(function(){tell('סימוני ההתקדמות נמחקו.');}).catch(fail);}));app.append(footer);
 }else if(document.getElementById('list')){
  var bar=el('div',undefined,'nl-launch');var a=link('הלמידה שלי',portal);a.target='_blank';a.rel='noopener';bar.append(a,el('small','מעקב עבודה אישי · אפשר גם ללא כניסה'));document.querySelector('.toolbar').before(bar);
  var info=el('details',undefined,'nl-account-details');info.append(el('summary','על שמירת ההתקדמות'),authBox);bar.after(info,message);
  var original=levelLinksHTML;
  levelLinksHTML=function(topic,grade){var html=original(topic,grade),items=catalog.filter(function(x){return x.g===grade&&x.t===topic.id;});
   var details=el('details',undefined,'nl-topic-progress');details.append(el('summary','סימון מצב עבודה'+(topic.parent?' — '+topic.t:'')));
   items.forEach(function(item){var group=el('div',undefined,'nl-level-progress');group.append(el('strong',item.label),controls(item));details.append(group);});
   return html+(items.length?details.outerHTML:'');
  };
  // Generated catalog cards use delegated events, so keyboard and mouse both work after filters rerender.
  document.getElementById('list').addEventListener('click',function(e){var b=e.target.closest('[data-learning-id] button[data-status]');if(!b)return;var id=b.closest('[data-learning-id]').dataset.learningId;engine.change(id,b.dataset.status||null).then(function(){tell(engine.snapshot().user?'המצב נשמר בחשבון.':'המצב נשמר במכשיר הזה.');}).catch(fail);});
  var oldRender=render;render=function(){oldRender();refreshControls();};render();
 }else{
  var p=new URL(location.href).searchParams,item=catalog.find(function(x){return x.g===Number(p.get('g'))&&x.pdf===p.get('pdf')&&(x.l===p.get('lv')||x.l==='one');});
  var nav=document.querySelector('.header-actions')||document.querySelector('header');
  if(nav){var a=link('הלמידה שלי',portal);a.className='nl-viewer-link';nav.append(a);}
  if(item){var holder=el('details',undefined,'nl-viewer-progress');holder.append(el('summary','מצב העבודה שלי'),controls(item),authBox,message);var main=document.querySelector('main');main.before(holder);}
 }
 function update(){var active=document.activeElement,box=active&&active.closest('[data-learning-id]'),id=box&&box.dataset.learningId,status=active&&active.dataset.status;renderAuth();renderPortal();refreshControls();if(id&&status!==undefined){var target=document.querySelector('[data-learning-id="'+id+'"] button[data-status="'+status+'"]');if(target&&!target.disabled&&!target.hidden)target.focus({preventScroll:true});}}engine.subscribe(update);update();
 window.addEventListener('storage',function(e){if(e.key===Core.storageKey)engine.storageChanged();});
 if(client){client.auth.onAuthStateChange(function(event,session){setTimeout(function(){engine.setUser(session&&session.user).catch(fail);},0);});
  client.auth.getSession().then(function(r){if(r.error){tell('החיבור לחשבון אינו זמין. נסו לרענן את הדף.');}return engine.setUser(r.data&&r.data.session&&r.data.session.user);}).catch(fail);
  if(new URL(location.href).searchParams.has('code')){client.auth.getSession().finally(function(){var u=new URL(location.href);u.searchParams.delete('code');history.replaceState(null,'',u.pathname+u.search);});}
 }
})();
