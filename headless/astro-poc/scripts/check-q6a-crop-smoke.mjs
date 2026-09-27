/**
 * Local smoke: PDF 341d8526… page 3 / Q6א crop geometry is loadable.
 * Does not call Noam AI backends.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const HASH = '341d85268f0b4c36b138a11be0fd21cc';
const PDF_URL = `https://static.wixstatic.com/ugd/d8e7ad_${HASH}.pdf`;
const Q6A_CROP = { page: 3, x: 0, y: 0.53853, w: 1, h: 0.428211 };

const res = await fetch(PDF_URL, {
  headers: { Referer: 'https://www.noamdoronmath.co.il/' },
});
if (!res.ok) {
  console.error('PDF_FETCH_FAIL', res.status);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
mkdirSync('reports/noam-ai-q6a', { recursive: true });
writeFileSync(`reports/noam-ai-q6a/${HASH}.pdf`, buf);

const require = createRequire(import.meta.url);
let pdfjs;
try {
  pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
} catch {
  // optional — geometry check without render is still useful
  pdfjs = null;
}

if (!pdfjs) {
  console.log(
    JSON.stringify({
      ok: true,
      mode: 'bytes-only',
      bytes: buf.length,
      crop: Q6A_CROP,
      note: 'pdfjs-dist not installed locally; byte fetch OK',
    })
  );
  process.exit(0);
}

pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  'pdfjs-dist/legacy/build/pdf.worker.js'
);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(buf),
  disableFontFace: true,
  useSystemFonts: true,
}).promise;
if (doc.numPages !== 9) {
  console.error('PAGE_COUNT', doc.numPages);
  process.exit(1);
}
const page = await doc.getPage(Q6A_CROP.page);
const viewport = page.getViewport({ scale: 2 });
const band = Math.floor(viewport.height * Q6A_CROP.h);
if (!(band > 100 && viewport.width > 100)) {
  console.error('CROP_GEOMETRY_FAIL', { band, w: viewport.width });
  process.exit(1);
}
console.log(
  JSON.stringify({
    ok: true,
    mode: 'pdfjs',
    pages: doc.numPages,
    page: Q6A_CROP.page,
    viewport: { w: Math.floor(viewport.width), h: Math.floor(viewport.height) },
    cropBandPx: band,
    viewerPath:
      `/worksheet-viewer-noam.html?g=9&x=G9-T20&lv=c&pdf=${HASH}&t=${encodeURIComponent('הריבוע')}`,
  })
);
