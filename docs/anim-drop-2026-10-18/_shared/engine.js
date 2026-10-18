/* Standalone port of the helpers + engine in src/lib/conceptLoops.ts (same easing, same clock rules). */
(function(){
function cubicBezier(x1,y1,x2,y2){var cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
 var sx=function(t){return((ax*t+bx)*t+cx)*t},sy=function(t){return((ay*t+by)*t+cy)*t},sd=function(t){return(3*ax*t+2*bx)*t+cx};
 return function(x){if(x<=0)return 0;if(x>=1)return 1;var t=x;for(var i=0;i<8;i++){var e=sx(t)-x;if(Math.abs(e)<1e-6)break;var d=sd(t);if(Math.abs(d)<1e-6)break;t=Math.min(1,Math.max(0,t-e/d));}return sy(t);};}
var EASE=cubicBezier(.16,1,.3,1);
var H={
 EASE:EASE,
 ph:function(t,a,b){return EASE(Math.min(1,Math.max(0,(t-a)/(b-a))));},
 lerp:function(a,b,p){return a+(b-a)*p;},
 r2:function(n){return Math.round(n*100)/100;},
 q:function(root,name){return root.querySelector('[data-el="'+name+'"]');},
 qa:function(root,sel){return Array.prototype.slice.call(root.querySelectorAll(sel));},
 op:function(el,v){if(el)el.style.opacity=String(Math.round(Math.min(1,Math.max(0,v))*100)/100);},
 draw:function(el,p){if(el)el.style.strokeDashoffset=String(Math.round((1-Math.min(1,Math.max(0,p)))*100)/100);},
 move:function(el,x,y,rot){if(el)el.setAttribute('transform','translate('+Math.round(x*100)/100+' '+Math.round(y*100)/100+') rotate('+Math.round((rot||0)*100)/100+')');},
 shift:function(el,dx,dy){if(el)el.setAttribute('transform','translate('+Math.round(dx*100)/100+' '+Math.round(dy*100)/100+')');}
};
window.LoopHelpers=H;
var MAX_LAPS=4;
function motionOff(){var c=document.documentElement.classList;return c.contains('noam-a11y-motion')||c.contains('nd-motion-off');}
window.mountFilm=function(root,film){
 var svg=root.querySelector('.concept-loop__svg');
 svg.innerHTML=film.svgMarkup; svg.setAttribute('viewBox',film.viewBox||'0 0 560 340'); svg.setAttribute('aria-label',film.ariaLabel);
 var top=root.querySelector('.concept-loop__top'); top.textContent=film.top.text; if(film.top.ltr)top.setAttribute('dir','ltr');
 root.querySelector('.concept-loop__formula-slot').innerHTML=film.formulaHTML;
 var toggle=root.querySelector('[data-el="toggle"]');
 var t=0,lap=1,playing=false,done=false,inView=false,isStatic=false,raf=0,last=0;
 var draw=function(){film.render(root,t);};
 function tick(now){if(!playing)return;var dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;t+=dt;
  if(t>=film.duration){t-=film.duration;lap++;}
  if(lap>=MAX_LAPS&&t>=film.hold){t=film.hold;draw();playing=false;done=true;return;}
  draw();raf=requestAnimationFrame(tick);}
 function play(){if(playing||isStatic)return;playing=true;last=performance.now();raf=requestAnimationFrame(tick);}
 function pause(){playing=false;if(raf)cancelAnimationFrame(raf);raf=0;}
 function applyPrefs(){if(motionOff()){isStatic=true;pause();t=film.hold;draw();if(toggle)toggle.style.display='none';}}
 if('IntersectionObserver'in window){new IntersectionObserver(function(e){inView=e[0].isIntersecting;if(isStatic)return;if(inView&&!done)play();else if(!inView&&playing)pause();},{threshold:.35}).observe(root);}
 root.querySelector('.concept-loop__card').addEventListener('click',function(){if(isStatic)return;if(done){done=false;lap=1;t=0;play();}else if(playing)pause();else play();});
 applyPrefs();draw();
 root.__loop={seek:function(tt){t=Math.min(Math.max(tt,0),film.duration);draw();},pause:pause,play:play,state:function(){return{t:t,playing:playing,laps:lap,done:done,static:isStatic};}};
};
})();
