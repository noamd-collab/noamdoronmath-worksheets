import {readFileSync,writeFileSync} from 'node:fs';
const slug=process.argv[2]; const dir=`/workspace/new-animations/${slug}`;
const css=readFileSync('/workspace/new-animations/_shared/card.css','utf8');
const engine=readFileSync('/workspace/new-animations/_shared/engine.js','utf8');
const film=readFileSync(`${dir}/film.js`,'utf8');
const html=`<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${slug} — film</title>
<style>${css}</style></head><body>
<main class="demo-panel"><div class="concept-loop" data-loop="${slug}">
<div class="concept-loop__card" role="button" tabindex="0" aria-label="השהיית הנפשה" data-pause-card>
<button type="button" class="concept-loop__toggle" data-el="toggle" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="3" y="2.5" width="3.4" height="11" rx="1.2"/><rect x="9.6" y="2.5" width="3.4" height="11" rx="1.2"/></svg></button>
<p class="concept-loop__top"></p>
<svg class="concept-loop__svg" role="img"></svg>
<div class="concept-loop__formula-slot"></div>
</div></div></main>
<script>${engine}</script>
<script>${film}
mountFilm(document.querySelector('.concept-loop'), window.FILM);</script>
</body></html>`;
writeFileSync(`${dir}/index.html`,html); console.log('built',slug,html.length);
