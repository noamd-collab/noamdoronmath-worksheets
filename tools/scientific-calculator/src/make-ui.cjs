'use strict';
const fs=require('fs'),path=require('path');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The physical labels are small drawings, not Unicode placeholder characters.
// Fixed SVG viewBoxes keep every slot, fraction bar and exponent aligned.
const svg=(name,w,h,body)=>`<svg class="math-key-icon icon-${name}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${body}</svg>`;
const rect=(x,y,w,h,filled=false)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${filled?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"/>`;
const text=(x,y,value,size=18,italic=false)=>`<text x="${x}" y="${y}" fill="currentColor" font-family="${italic?'Times New Roman,serif':'Arial,sans-serif'}" font-size="${size}"${italic?' font-style="italic"':''}>${value}</text>`;
const stroke=d=>`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>`;
const icons={
 fraction:svg('fraction',34,38,rect(11,3,13,9,true)+stroke('M6 18H29')+rect(11,24,13,8)),
 mixed:svg('mixed',40,25,rect(2,9,7,7,true)+rect(19,2,11,5)+stroke('M15 12H34')+rect(19,17,11,5)),
 integral:svg('integral',42,38,stroke('M21 5C13 0 13 10 12 19L10 29C9 39 1 37 3 32')+rect(21,3,6,6)+rect(9,29,6,6)+rect(25,19,13,9,true)),
 derivative:svg('derivative',43,28,text(8,10,'d',13,true)+stroke('M4 14H23')+text(4,27,'dx',13,true)+rect(29,9,9,8,true)),
 logbase:svg('logbase',68,37,text(1,28,'log',28)+rect(43,23,7,8,true)+rect(55,9,9,22)),
 sum:svg('sum',39,34,rect(9,1,11,5)+stroke('M21 11H8L15 18L8 25H22')+rect(9,28,11,5)+rect(27,15,9,7,true)),
 sqrt:svg('sqrt',43,38,stroke('M3 23L9 21L15 33L22 7H40')+rect(25,16,12,13,true)),
 cbrt:svg('cbrt',37,31,text(1,11,'3',12)+stroke('M4 21L9 19L14 29L20 10H35')+rect(24,18,8,9,true)),
 power:svg('power',45,36,text(2,32,'x',36,true)+rect(29,3,10,10,true)),
 root:svg('root',39,28,rect(1,3,7,6,true)+stroke('M9 17L14 15L19 26L24 7H37')+rect(27,15,8,9)),
 square:svg('square',43,36,text(3,32,'x',36,true)+text(27,14,'2',19)),
 cube:svg('cube',35,27,text(3,25,'x',27,true)+text(22,10,'3',14)),
 inverse:svg('inverse',55,36,text(1,32,'x',36,true)+text(26,12,'−1',17)),
 factorial:svg('factorial',34,26,text(3,24,'x!',27,true)),
 pow10:svg('pow10',39,26,text(1,24,'10',22)+rect(29,1,7,7,true)),
 exp:svg('exp',30,26,text(1,24,'e',26,true)+rect(20,1,7,7,true)),
 mixedToggle:svg('mixed-toggle',79,30,text(1,23,'a',21,true)+text(19,11,'b',15,true)+stroke('M17 15H29')+text(19,29,'c',15,true)+stroke('M35 12H53M35 12L39 8M35 12L39 16M53 21H35M53 21L49 17M53 21L49 25')+text(63,11,'d',15,true)+stroke('M60 15H73')+text(63,29,'c',15,true)),
 expKey:svg('exp-key',74,40,stroke('M2 16L17 31M2 31L17 16')+text(19,33,'10',33)+text(58,14,'x',22,true)),
 dms:svg('dms',51,35,'<circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="3"/>'+stroke('M22 11C28 14 23 20 20 23M35 11C41 14 36 20 33 23M44 11C50 14 45 20 42 23'))
};
const keys=[
 ['calc','CALC','SOLVE','=', 'top-left'],['integral',icons.integral,icons.derivative,':','top-second'],['inverse',icons.inverse,icons.factorial,'','top-fifth'],['logbase',icons.logbase,icons.sum,'','top-last'],
 ['fraction',icons.fraction,icons.mixed,''],['sqrt',icons.sqrt,icons.cbrt,''],['square',icons.square,icons.cube,'','','DEC'],['power',icons.power,icons.root,'','','HEX'],['log','log',icons.pow10,'','','BIN'],['ln','ln',icons.exp,'','','OCT'],
 ['negative','(−)','∠','A'],['dms',icons.dms,'←','B'],['hyp','hyp','Abs','C'],['sin','sin','sin⁻¹','D'],['cos','cos','cos⁻¹','E'],['tan','tan','tan⁻¹','F'],
 ['rcl','RCL','STO',''],['eng','ENG','←','','','i'],['lparen','(','%',''],['rparen',')',',','X'],['sd','S⇔D',icons.mixedToggle,'Y'],['mplus','M+','M−','M']
];
const numbers=[['7','7','CONST'],['8','8','CONV'],['9','9','CLR'],['del','DEL','INS','','clear'],['ac','AC','OFF','','clear'],['4','4','MATRIX','','bracket-mode'],['5','5','VECTOR','','bracket-mode'],['6','6',''],['mul','×','nPr'],['div','÷','nCr'],['1','1','STAT','','bracket-mode'],['2','2','CMPLX','','bracket-mode complex-mode'],['3','3','BASE','','bracket-mode base-mode'],['add','+','Pol'],['sub','−','Rec'],['0','0','Rnd'],['dot','•','Ran#','RanInt'],['exp',icons.expKey,'π','e'],['ans','Ans','DRG▶'],['equals','=','']];
const names={integral:'אינטגרל עם גבולות',inverse:'הופכי x בחזקת מינוס אחת',logbase:'לוגריתם בבסיס משתנה',fraction:'שבר עם מונה ומכנה',sqrt:'שורש ריבועי',square:'ריבוע',power:'חזקה',negative:'סימן שלילי',dms:'מעלות דקות שניות',rcl:'שליפה מזיכרון',sd:'שבר או עשרוני S D',mplus:'הוספה לזיכרון M',del:'DEL מחיקה',ac:'AC ניקוי',exp:'כפול עשר בחזקה',equals:'שווה',mul:'כפל',div:'חילוק',add:'חיבור',sub:'חיסור',dot:'נקודה עשרונית'};
const shiftNames={integral:'d/dx',inverse:'x!',logbase:'Σ',fraction:'mixed fraction',sqrt:'cube root',square:'x³',power:'indexed root',log:'10^x',ln:'e^x',sd:'mixed/improper fraction'};
const capPath='M10 4Q50 -1 90 4Q99 5 99 15L96 34Q92 56 50 58Q8 56 4 34L1 15Q1 5 10 4Z';
function key([id,label,shift='',alpha='',extra='',base='']){
 const name=names[id]||label.replace(/<[^>]*>/g,''),shiftName=shiftNames[id]||shift.replace(/<[^>]*>/g,'');
 const letter=/^[ABCDEF]$/.test(alpha)?`<b class="mode-bracket">[</b>${alpha}<b class="mode-bracket">]</b>`:alpha;
 const surface=extra.includes('clear')?'orange':numbers.some(k=>k[0]===id)?'ivory':'science';
 return `<button type="button" class="device-key ${extra}" data-key="${id}" data-shift="${esc(shiftName)}" aria-label="${esc(name)}" title="${esc(name+(shiftName?' · SHIFT: '+shiftName:'')+(alpha?' · ALPHA: '+alpha:''))}"><span class="key-legend" aria-hidden="true"><span class="shift-legend">${shift}</span><span class="alpha-legend">${letter}</span>${base?'<span class="base-legend">'+base+'</span>':''}</span><span class="keycap" aria-hidden="true"><svg class="key-surface" viewBox="0 0 100 60" preserveAspectRatio="none" focusable="false"><path d="${capPath}" fill="url(#cap-${surface})"/><path class="cap-highlight" d="M11 7Q50 2 89 7"/></svg><span class="key-label">${label}</span></span></button>`;
}
const definitions=`<svg class="device-defs" aria-hidden="true" width="0" height="0"><defs><linearGradient id="cap-science" x2="0" y2="1"><stop offset="0" stop-color="#35373b"/><stop offset=".18" stop-color="#292b30"/><stop offset=".68" stop-color="#1d1f24"/><stop offset="1" stop-color="#0d0f13"/></linearGradient><linearGradient id="cap-ivory" x2="0" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset=".6" stop-color="#f8f8f3"/><stop offset="1" stop-color="#deded8"/></linearGradient><linearGradient id="cap-orange" x2="0" y2="1"><stop offset="0" stop-color="#ff781e"/><stop offset=".55" stop-color="#fa6410"/><stop offset="1" stop-color="#d94106"/></linearGradient></defs></svg>`;
const html=`<style>${fs.readFileSync(path.join(__dirname,'device.css'),'utf8')}</style>
<main class="calculator-page" aria-label="מחשבון מדעי">
<div class="device-stage"><section id="casio-calc" class="device-shell" dir="ltr" aria-label="סימולטור לימודי fx-991ES PLUS">
 ${definitions}
 <header class="device-brand"><div class="brand-name">CASIO</div><div class="solar-panel" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="model-name">fx-991ES PLUS</div><div class="natural-brand">NATURAL-V.P.A.M.</div><div class="power-brand">TWO WAY POWER</div></header>
 <div class="lcd-bezel"><div class="lcd" aria-label="מסך המחשבון"><div id="lcd-status" aria-live="off">D <span>Math</span></div><input id="lcd-input" type="text" inputmode="none" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="ביטוי לחישוב" dir="ltr"><div id="lcd-expression" aria-label="ביטוי מתמטי"></div><div id="lcd-result" aria-label="תוצאה">0</div><div id="lcd-menu" hidden></div></div></div>
 <div class="control-row"><svg class="panel-seam" viewBox="0 0 100 43" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0V20Q0 29 13 30L29 32Q34 33 36 37Q40 43 50 43Q60 43 64 37Q66 33 71 32L87 30Q100 29 100 20V0"/></svg><div class="control-pair"><button type="button" class="round-control shift-control" data-key="shift" aria-label="SHIFT" aria-pressed="false"><span>SHIFT</span><i></i></button><button type="button" class="round-control alpha-control" data-key="alpha" aria-label="ALPHA" aria-pressed="false"><span>ALPHA</span><i></i></button></div><div class="replay-pad" role="group" aria-label="REPLAY חיצי עריכה"><button data-key="up" aria-label="למעלה והיסטוריה" class="arrow up">▲</button><button data-key="left" aria-label="שמאלה" class="arrow left">◀</button><div class="replay-center" aria-hidden="true">REPLAY</div><button data-key="right" aria-label="ימינה" class="arrow right">▶</button><button data-key="down" aria-label="למטה והיסטוריה" class="arrow down">▼</button></div><div class="control-pair"><button type="button" class="round-control mode-control" data-key="mode" aria-label="MODE SETUP"><span>MODE <b>SETUP</b></span><i></i></button><button type="button" class="round-control on-control" data-key="on" aria-label="ON הפעלה"><span>ON</span><i></i></button></div></div>
 <div class="science-keypad" role="group" aria-label="מקשי מדע וזיכרון">${keys.map(key).join('')}</div>
 <div class="number-keypad" role="group" aria-label="מקשי ספרות וחשבון">${numbers.map(key).join('')}</div>
</section></div>
<p class="device-caption" dir="rtl">סימולטור לימודי לפי fx‑991ES PLUS · נועם דורון</p>
<details class="device-help" dir="rtl"><summary>עזרה בהפעלה</summary><p>לחצו על המקשים כמו במחשבון: SHIFT לפעולות הזהובות, ALPHA לסימונים האדומים, MODE לבחירת מצב ו־SHIFT ואז MODE להגדרות. אפשר גם להקליד מהמקלדת ולחשב עם Enter.</p><p>זהו סימולטור לימודי עצמאי בדפדפן. החיצים מזיזים את הסמן בתוך הביטוי ומחזירים חישובים קודמים. S⇔D מחליף בין תצוגה מדויקת לעשרונית.</p><p><a href="https://support.casio.com/pdf/004/fx-570_991ES_PLUS_E.pdf" target="_blank" rel="noopener">מדריך ההפעלה של fx-991ES PLUS המקורי</a></p></details>
<div id="calc-announcer" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
</main>`;
fs.writeFileSync(path.join(__dirname,'ui.html'),html);
console.log('Physical keypad: '+(keys.length+numbers.length+8)+' keys');
