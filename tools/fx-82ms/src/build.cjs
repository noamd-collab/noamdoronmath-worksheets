const fs=require('fs'),path=require('path');require('./make-ui.cjs');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const script=['node_modules/mathjs/lib/browser/math.js','core.js','algorithms.js','ms82.js','display.js','device.js'].map(read).join('\n;\n').replace(/<\/script/gi,'<\\/script');
const html='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light"><title>מחשבון fx-82MS — נועם דורון</title><style>'+read('device.css')+'</style></head><body>'+read('ui.html')+'<script>'+script+'</script></body></html>';
const out=path.resolve(__dirname,process.argv[2]||'.');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);console.log(JSON.stringify({bytes:Buffer.byteLength(html),file:path.join(out,'index.html')}));
