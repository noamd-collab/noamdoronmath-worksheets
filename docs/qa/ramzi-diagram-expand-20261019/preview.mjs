// Static UI fixture only. Never calls the model or bypasses Google.
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../../headless/astro-poc/public/worksheet-viewer-noam.html',import.meta.url),'utf8');
const css=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const helper=source.slice(source.indexOf('function noamAddDiagramExpansion('),source.indexOf('function noamDiagramRuntime('));
const panel=fs.readFileSync(new URL('saved-panel.html',import.meta.url),'utf8');
fs.writeFileSync(process.argv[2],`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>בדיקת תצוגת שרטוט</title><style>${css}</style></head><body class="exact-viewer noam-pdf-tools-open noam-ai-on"><p>בס״ד · בדיקת תצוגה מקומית עם שרטוט שכבר נוצר באתר</p>${panel}<script>${helper}\ndocument.querySelectorAll('.noam-geometry').forEach(figure=>{const holder=document.createElement('div');noamAddDiagramExpansion(holder,figure);figure.before(holder.firstChild);});document.querySelector('.noam-diagram-expand').scrollIntoView({block:'center'});</script></body></html>`);
