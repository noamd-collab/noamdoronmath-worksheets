#!/usr/bin/env node
/*
 * validate.js — בדיקת תקינות ל-index.html (worksheets-ALL-GRADES.html) לפני כל פרסום.
 * הרצה:  node tools/validate.js index.html
 *
 * מה זה בודק (חוקי ברזל, לא תלוי במספר הנושאים בפועל — עובד גם אחרי שמוסיפים/מורידים נושאים):
 *   1. תחביר JS תקין בתוך ה-<script> (node --check אמיתי, לא ניחוש)
 *   2. לכל topic יש links תואם, ולהפך — אין יתומים בשני הכיוונים
 *   3. topic.ic חייב להיות מפתח קיים ב-ICONS
 *   4. topic.g חייב להיות מפתח קיים ב-groups של אותה כיתה
 *   5. כל מזהה PDF (hex) תואם בדיוק /^[0-9a-f]{32}$/ ואין אף מזהה כפול בכל הקובץ
 *   6. אזהרה (לא שגיאה) על ערכים יתומים ב-SEARCH_TERMS שמצביעים על topic id שכבר לא קיים
 *
 * יציאה עם קוד 1 אם יש שגיאה אחת לפחות. קוד 0 אם הכל תקין (גם אם יש אזהרות).
 */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var file = process.argv[2];
if (!file){ console.error('שימוש: node validate.js <path-to-index.html>'); process.exit(2); }
var src = fs.readFileSync(file, 'utf8');

var m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m){ console.error('לא נמצא בלוק <script> בקובץ'); process.exit(2); }
var scriptBody = m[1];

// --- 1. בדיקת תחביר אמיתית (לא regex) ---
var tmp = path.join(require('os').tmpdir(), 'validate_syntax_' + Date.now() + '.js');
fs.writeFileSync(tmp, scriptBody);
try {
  cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  console.error('שגיאת תחביר ב-<script>:\n' + e.stderr.toString());
  process.exit(1);
} finally {
  fs.unlinkSync(tmp);
}

// --- extract a top-level "var NAME = { ... };" block by brace-matching (robust to future edits/line shifts) ---
function extractBlock(text, varName){
  var re = new RegExp('var\\s+' + varName + '\\s*=\\s*\\{');
  var startMatch = re.exec(text);
  if (!startMatch) throw new Error('לא נמצא "' + varName + '"');
  var braceStart = startMatch.index + startMatch[0].length - 1;
  var depth = 0;
  for (var i = braceStart; i < text.length; i++){
    var c = text[i];
    if (c === '{') depth++;
    else if (c === '}'){
      depth--;
      if (depth === 0){
        return text.slice(startMatch.index, i + 1) + ';';
      }
    }
  }
  throw new Error('סוגריים לא מאוזנים עבור "' + varName + '"');
}

var dataSlice =
  extractBlock(scriptBody, 'DATA') + '\n' +
  extractBlock(scriptBody, 'ICONS') + '\n' +
  extractBlock(scriptBody, 'SEARCH_TERMS') + '\n' +
  extractBlock(scriptBody, 'GRADE_EMOJI') + '\n' +
  extractBlock(scriptBody, 'GRADE_NAME') + '\n';

var sandbox = {};
require('vm').createContext(sandbox);
require('vm').runInContext(dataSlice, sandbox, { filename: 'data-slice.js' });
var DATA = sandbox.DATA, ICONS = sandbox.ICONS, SEARCH_TERMS = sandbox.SEARCH_TERMS,
    GRADE_EMOJI = sandbox.GRADE_EMOJI, GRADE_NAME = sandbox.GRADE_NAME;

var errors = [], warnings = [];
var allHex = [];
var summary = {};

Object.keys(DATA).forEach(function(gk){
  var g = Number(gk);
  var gd = DATA[gk];
  var groupKeys = {};
  (gd.groups || []).forEach(function(gr){ groupKeys[gr.key] = true; });
  var topicIds = {};
  var linkCount = 0;

  (gd.topics || []).forEach(function(t){
    topicIds[t.id] = true;
    if (!groupKeys[t.g]) errors.push('כיתה ' + g + ' נושא ' + t.id + ' ("' + t.t + '"): קבוצה "' + t.g + '" לא קיימת ב-groups');
    if (!ICONS[t.ic]) errors.push('כיתה ' + g + ' נושא ' + t.id + ' ("' + t.t + '"): אייקון "' + t.ic + '" לא קיים ב-ICONS');

    var L = gd.links ? gd.links[t.id] : undefined;
    if (!L){ errors.push('כיתה ' + g + ' נושא ' + t.id + ' ("' + t.t + '"): אין רשומת links תואמת (יתום)'); return; }
    if (L.one !== undefined){
      linkCount += 1;
      allHex.push({ hex:L.one, where:'כיתה ' + g + ' נושא ' + t.id + '/one' });
    } else {
      ['a','b','c'].forEach(function(k){
        if (L[k] === undefined) warnings.push('כיתה ' + g + ' נושא ' + t.id + ' ("' + t.t + '"): חסר קישור רמה "' + k + '"');
        else { linkCount += 1; allHex.push({ hex:L[k], where:'כיתה ' + g + ' נושא ' + t.id + '/' + k }); }
      });
    }
  });

  Object.keys(gd.links || {}).forEach(function(lid){
    if (!topicIds[lid]) warnings.push('כיתה ' + g + ': links[' + lid + '] קיים בלי נושא תואם (יתום הפוך)');
  });

  summary[g] = { topics: (gd.topics || []).length, links: linkCount, groups: (gd.groups || []).length };
});

var hexRe = /^[0-9a-f]{32}$/;
var seen = {};
allHex.forEach(function(e){
  if (!hexRe.test(e.hex)) errors.push(e.where + ': מזהה "' + e.hex + '" לא תואם תבנית hex32');
  if (seen[e.hex]) errors.push('מזהה PDF כפול: ' + e.hex + '  (' + seen[e.hex] + '  <->  ' + e.where + ')');
  else seen[e.hex] = e.where;
});

Object.keys(SEARCH_TERMS || {}).forEach(function(gk){
  var gd = DATA[gk];
  if (!gd) { warnings.push('SEARCH_TERMS: מפתח כיתה "' + gk + '" לא קיים ב-DATA'); return; }
  var topicIds = {};
  (gd.topics || []).forEach(function(t){ topicIds[t.id] = true; });
  Object.keys(SEARCH_TERMS[gk]).forEach(function(tid){
    if (!topicIds[tid]) warnings.push('SEARCH_TERMS[' + gk + '][' + tid + ']: נושא לא קיים יותר בכיתה זו (רשומה יתומה — לא שוברת כלום, אבל שווה ניקוי)');
  });
});

console.log('--- סיכום לפי כיתה ---');
Object.keys(summary).forEach(function(g){
  console.log('כיתה ' + g + ': ' + summary[g].topics + ' נושאים, ' + summary[g].links + ' קישורי PDF, ' + summary[g].groups + ' קבוצות');
});
console.log('סה"כ מזהי PDF ייחודיים: ' + Object.keys(seen).length);

if (warnings.length){
  console.log('\n--- אזהרות (' + warnings.length + ') ---');
  warnings.forEach(function(w){ console.log('⚠ ' + w); });
}

if (errors.length){
  console.log('\n--- שגיאות (' + errors.length + ') ---');
  errors.forEach(function(e){ console.log('✗ ' + e); });
  console.log('\nנכשל.');
  process.exit(1);
}

console.log('\nהכל תקין. אפשר לפרסם.');
