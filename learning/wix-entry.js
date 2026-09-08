/* Optional entry only. No authentication, data collection or tokens on Wix. */
(()=>{'use strict';const id='noam-learning-home-entry';
function apply(){const parent=document.getElementById('comp-mtsd3jdp');if(!parent||document.getElementById(id))return;
 const box=document.createElement('div');box.id=id;box.style.cssText='width:100%;text-align:center;direction:rtl;padding:4px 0 10px;box-sizing:border-box';
 const a=document.createElement('a');a.href='https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html';a.textContent='הלמידה שלי — מעקב עבודה אישי';a.style.cssText='display:inline-block;color:#feff91;border:1px solid #feff91;border-radius:999px;padding:10px 20px;font:inherit;font-weight:700;text-decoration:underline;text-underline-offset:4px;max-width:100%;box-sizing:border-box';
 const p=document.createElement('p');p.textContent='אפשר לסמן התקדמות גם בלי להתחבר';p.style.cssText='color:#ffffb5;font:inherit;font-size:14px;line-height:1.5;margin:8px 0 0';box.append(a,p);parent.append(box);
}
let queued=false;function start(){apply();new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();
