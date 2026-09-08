/* Optional entry only. Authentication stays in the central learning area. */
(()=>{'use strict';
const id='noam-learning-home-entry',base='https://noamd-collab.github.io/noamdoronmath-worksheets/';
const styles=`
#noam-learning-home-entry{width:100%;text-align:center;direction:rtl;padding:4px 0 10px;box-sizing:border-box;scroll-margin-top:260px}
#noam-learning-home-entry *{box-sizing:border-box}
#noam-learning-home-entry .nl-entry-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px}
#noam-learning-home-entry a{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;max-width:100%;border:1px solid;border-radius:999px;padding:10px 18px;font:inherit;font-size:14px;line-height:20px;text-decoration:none}
#noam-learning-home-entry .nl-entry-google{background:#fff;color:#1f1f1f;border-color:#747775;font-family:'Google Sans',Arial,sans-serif;font-weight:500}
#noam-learning-home-entry .nl-entry-google:hover{background:#f2f2f2}
#noam-learning-home-entry .nl-entry-google img{width:20px;height:20px;object-fit:contain;flex:none}
#noam-learning-home-entry .nl-entry-local{color:#feff91;border-color:#feff91;background:transparent;font-weight:700}
#noam-learning-home-entry .nl-entry-local:hover{background:#feff9114}
#noam-learning-home-entry .nl-entry-local svg{width:20px;height:20px;flex:none}
#noam-learning-home-entry a:focus-visible{outline:3px solid #fff;outline-offset:4px}
#noam-learning-home-entry p{color:#ffffb5;font:inherit;font-size:14px;line-height:1.6;margin:10px 0 0}
#noam-learning-home-entry .nl-entry-sync{display:block;font-size:13px;color:#d5d6b7;margin-top:2px}
@media(max-width:640px){#noam-learning-home-entry{scroll-margin-top:24px}#noam-learning-home-entry .nl-entry-actions{flex-direction:column;gap:10px}#noam-learning-home-entry a{width:290px}#noam-learning-home-entry p{font-size:13px}}
`;
function apply(){
 const parent=document.getElementById('comp-mtsd3jdp');if(!parent||document.getElementById(id))return;
 if(!document.getElementById('noam-learning-entry-style')){const style=document.createElement('style');style.id='noam-learning-entry-style';style.textContent=styles;document.head.append(style);}
 const box=document.createElement('div');box.id=id;
 box.innerHTML='<div class="nl-entry-actions"><a class="nl-entry-google"><img alt="" width="20" height="20"><span>התחברות עם Google</span></a><a class="nl-entry-local"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke-linecap="round"/></svg><span>הלמידה שלי — מעקב עבודה אישי</span></a></div><p>אפשר לסמן התקדמות גם בלי להתחבר<span class="nl-entry-sync">עם Google אפשר להמשיך גם ממכשיר אחר.</span></p>';
 box.querySelector('.nl-entry-google').href=base+'learning.html?signin=google';
 box.querySelector('.nl-entry-google img').src=base+'learning/google-g-logo.png';
 box.querySelector('.nl-entry-local').href=base+'learning.html';
 parent.append(box);
}
let queued=false;function start(){apply();new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();
