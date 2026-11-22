import { fetchVerifiedRows, parsePartialHintIndex, reviewedPageNumbers, sha256Hex, validPdfId, type PartialHintIndex, type PartialPin, type VerifiedHints } from '../lib/partialWorksheetHints';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

interface ReaderWindow extends Window {
  NOAM_LEARNING_CONFIG?: unknown;
  pdfjsLib?: {
    GlobalWorkerOptions: {workerSrc: string};
    getDocument: (options: {data: Uint8Array; isEvalSupported: false; enableXfa: false}) => {promise: Promise<PDFDocumentProxy>};
  };
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('Missing reader control');
  return found as T;
}

function label(item: PartialPin): string {
  return 'שאלה '+item.q+(item.part ? ' · סעיף '+item.part+'׳' : '');
}

/** Display verified single-letter math in RTL prose. Other text remains literal. */
export function appendHintText(target: HTMLElement, text: string): void {
  let offset = 0;
  for (const match of text.matchAll(/\$([A-Za-z])\$/g)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (text[start-1] === '$' || text[start-1] === '\\' || text[end] === '$') continue;
    target.append(text.slice(offset,start));
    const variable = target.ownerDocument.createElement('bdi');
    variable.dir = 'ltr';
    variable.textContent = match[1];
    target.append(variable);
    offset = end;
  }
  target.append(text.slice(offset));
}

function showHintPanel(item: PartialPin, texts: VerifiedHints, pin: HTMLButtonElement): void {
  const panel = element('hints');
  const list = element<HTMLOListElement>('hint-list');
  const feedback = element('feedback');
  const last = element('last-hint');
  feedback.hidden = false;
  last.hidden = true;
  document.querySelectorAll('.hint-pin[aria-pressed="true"]').forEach(button => button.setAttribute('aria-pressed','false'));
  pin.setAttribute('aria-pressed','true');
  element('hint-title').textContent = 'רמזי · '+label(item);
  list.replaceChildren();
  let shown = 0;
  function reveal() {
    if (shown >= texts.length) return;
    const li = document.createElement('li');
    appendHintText(li,texts[shown++]);
    list.append(li);

  }
  panel.hidden = false;
  element('not-understood').onclick = () => {
    if (shown < texts.length) reveal();
    else { feedback.hidden = true; last.hidden = false; }
  };
  function close() {
    panel.hidden = true;
    list.replaceChildren();
    pin.setAttribute('aria-pressed','false');
    const current = document.querySelector<HTMLButtonElement>('.hint-pin[data-exercise-id="'+item.exerciseId+'"]');
    current?.setAttribute('aria-pressed','false');
    current?.focus();
  }
  element('understood').onclick = close;
  element('close-hints').onclick = close;
  reveal();
  panel.focus({preventScroll:true});
  panel.scrollIntoView({block:'nearest'});
}

function displayPins(index: PartialHintIndex, verified: Map<string, VerifiedHints>, page: number): void {
  const layer = element('pins');
  const list = element('pin-list');
  layer.replaceChildren();
  list.replaceChildren();
  list.hidden = true;
  const candidates = index.items.filter(item => item.pin.page === page && verified.has(item.exerciseId))
    .sort((a,b) => a.pin.y-b.pin.y);
  if (!candidates.length) return;
  const height = element('page').getBoundingClientRect().height;
  const width = element('page').getBoundingClientRect().width;
  const natural = candidates.map(item => item.pin.y*height);
  const spaced: number[] = [];
  for (let i=0;i<natural.length;i++) spaced.push(Math.max(natural[i],i ? spaced[i-1]+44 : 22));
  for (let i=spaced.length-1;i>=0;i--) spaced[i]=Math.min(spaced[i],i===spaced.length-1 ? height-22 : spaced[i+1]-44);
  // Extremely dense pages retain a separate full-size control for every reviewed item.
  const crowded = spaced.some((center,i) => Math.abs(center-natural[i])>15);
  list.hidden = !crowded;
  for (const [n,item] of candidates.entries()) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'hint-pin';
    pin.dataset.exerciseId = item.exerciseId;
    pin.title = 'פתיחת רמזי · '+label(item);
    pin.setAttribute('aria-label',pin.title);
    pin.setAttribute('aria-pressed','false');
    pin.setAttribute('aria-controls','hints');
    if (crowded) {
      pin.textContent = 'רמז · '+label(item);
      list.append(pin);
    } else {
      const mark = document.createElement('span');
      mark.className = 'pin-mark';
      mark.textContent = 'רמז';
      pin.append(mark);
      // Keep the visible mark in the outer margin so the printed Hebrew part stays visible.
      pin.style.left = Math.min(Math.max(0,(item.pin.x+.038)*width),width-44)+'px';
      pin.style.top = spaced[n]+'px';
      layer.append(pin);
    }
    pin.onclick = () => showHintPanel(item,verified.get(item.exerciseId)!,pin);
  }
}

async function renderPage(page: PDFPageProxy, width: number): Promise<HTMLCanvasElement> {
  const visible = page.getViewport({scale:1});
  // The same canvas remains legible when the reader zooms to 160% on a phone.
  const resolution = Math.min(2250, Math.max(1400,width*1.6*Math.min(window.devicePixelRatio || 1,2)));
  const viewport = page.getViewport({scale:resolution/visible.width});
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  await page.render({canvasContext:context,viewport}).promise;
  return canvas;
}

export async function openPartialReader(): Promise<void> {
  const controls = element('reader');
  const status = element('status');
  const link = element<HTMLAnchorElement>('pdf-link');
  const pdfId = new URL(window.location.href).searchParams.getAll('pdf');
  if (pdfId.length !== 1 || !validPdfId(pdfId[0])) {
    status.textContent='קישור דף העבודה אינו תקין.';
    return;
  }

  try {
    const indexResponse = await fetch('/noam-ai/partial-hints/'+pdfId[0]+'.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
    if (!indexResponse.ok) throw new Error('Index unavailable');
    const index = parsePartialHintIndex(await indexResponse.json(),pdfId[0]);
    if (!index) throw new Error('Inconsistent published index');
    element('sheet-title').textContent = index.title;
    const pdfUrl = 'https://static.wixstatic.com/ugd/d8e7ad_'+index.pdfId+'.pdf';
    const readerWindow = window as ReaderWindow;
    const verifiedPromise = fetchVerifiedRows(index,readerWindow.NOAM_LEARNING_CONFIG).catch(() => new Map<string, VerifiedHints>());
    const bytesResponse = await fetch(pdfUrl,{credentials:'omit',signal:AbortSignal.timeout(20000)});
    if (!bytesResponse.ok) throw new Error('PDF unavailable');
    const bytes = await bytesResponse.arrayBuffer();
    if (await sha256Hex(bytes) !== index.pdfSha256) throw new Error('PDF identity mismatch');
    link.href = pdfUrl;
    link.hidden = false;
    const engine = readerWindow.pdfjsLib;
    if (!engine) throw new Error('PDF reader unavailable');
    engine.GlobalWorkerOptions.workerSrc = element('partial-viewer').dataset.worker!;
    const pdf = await engine.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,enableXfa:false}).promise;
    if (index.items.some(item => item.pin.page > pdf.numPages)) throw new Error('Pin outside PDF');
    let page = 1;
    let rendered = 0;
    let sequence = 0;
    status.textContent = 'טוען את הרמזים הזמינים…';
    const verified = await verifiedPromise;
    const reviewedPages = reviewedPageNumbers(index,verified);
    const pageSelect = element<HTMLSelectElement>('reviewed-page');
    for (const n of reviewedPages) pageSelect.add(new Option('עמוד '+n,String(n)));
    element('reviewed-pages').hidden = reviewedPages.length === 0;
    const previous = element<HTMLButtonElement>('prev');
    const next = element<HTMLButtonElement>('next');
    const scroll = element('paper-scroll');
    const paper = element('paper');
    const zoom = element<HTMLButtonElement>('zoom');

    async function navigate(to: number) {
      if (to < 1 || to > pdf.numPages) return;
      page = to;
      const generation = ++sequence;
      rendered = 0;
      element('hints').hidden = true;
      element('hint-list').replaceChildren();
      element('pins').replaceChildren();
      element('pin-list').replaceChildren();
      element('pin-list').hidden = true;
      paper.style.visibility = 'hidden';
      scroll.setAttribute('aria-busy','true');
      pageSelect.value = reviewedPages.includes(to) ? String(to) : '';
      previous.disabled = to===1;
      next.disabled = to===pdf.numPages;
      element('page-number').textContent='עמוד '+to+' מתוך '+pdf.numPages;
      try {
        const pageData = await pdf.getPage(to);
        const canvas = await renderPage(pageData, scroll.clientWidth);
        if (generation !== sequence) return;
        canvas.id = 'page';
        canvas.setAttribute('aria-label', 'עמוד '+to+' מתוך '+pdf.numPages);
        element('page').replaceWith(canvas);
        paper.style.visibility = '';
        scroll.setAttribute('aria-busy','false');
        rendered = to;
        refreshPins();
      } catch {
        if (generation !== sequence) return;
        scroll.setAttribute('aria-busy','false');
        status.textContent = 'העמוד לא נטען. אפשר לפתוח את קובץ ה־PDF בראש הדף.';
      }
    }

    function refreshPins() {
      if (!rendered || !index) return;
      displayPins(index,verified,rendered);
      const onPage = index.items.some(item => item.pin.page === rendered && verified.has(item.exerciseId));
      status.textContent = onPage ? 'לחצו על ״רמז״ ליד הסעיף כדי להציג רמז.' : verified.size
        ? 'בעמוד הזה אין סעיפים עם רמזים זמינים.'
        : 'דף העבודה זמין לקריאה. כרגע אין רמזים זמינים להצגה.';
    }
    new ResizeObserver(() => {
      if (rendered) {
        const active = document.querySelector<HTMLElement>('.hint-pin[aria-pressed="true"]')?.dataset.exerciseId;
        refreshPins();
        if (active) document.querySelector<HTMLElement>('.hint-pin[data-exercise-id="'+active+'"]')?.setAttribute('aria-pressed','true');
      }
    }).observe(paper);
    pageSelect.onchange = () => {
      const selected = Number(pageSelect.value);
      if (reviewedPages.includes(selected)) void navigate(selected);
    };
    previous.onclick = () => { void navigate(page-1); };
    next.onclick = () => { void navigate(page+1); };
    zoom.onclick = () => {
      const enlarged = paper.classList.toggle('enlarged');
      zoom.setAttribute('aria-pressed',String(enlarged));
      zoom.textContent = enlarged ? 'חזרה לגודל רגיל' : 'הגדלה';
      if (enlarged) scroll.scrollLeft = scroll.scrollWidth-scroll.clientWidth;
    };
    controls.hidden = false;
    await navigate(reviewedPages[0] ?? 1);
  } catch {
    controls.hidden = true;
    status.textContent = link.hidden
      ? 'לא הצלחנו לאמת ולטעון את דף העבודה. אפשר לרענן ולנסות שוב.'
      : 'לא הצלחנו להציג את דף העבודה. אפשר לפתוח את קובץ ה־PDF בראש הדף.';
  }
}
