/** No-pointer play-through of "מכונת ההצבה": clicks on buttons and key presses only. */
export default async function (page, { vp, shot, wait, log }) {
  const read = (sel) => page.$eval(sel, (el) => (el.textContent || '').trim()).catch(() => null);
  const attr = (sel, a) => page.$eval(sel, (el, n) => el.getAttribute(n), a).catch(() => null);
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { idx: s.idx, ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(250); }
    await wait(700);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(200); }
    await wait(700);
  };
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const expect = (ok, message) => { if (!ok) throw new Error('flow: ' + message); };
  const noteText = () => read('#sceneNote');

  log(`${vp} start: ${await read('h1')}`);
  await click('#next');

  // ---- scene 1: build expressions (wrong first, then right; round 2 by keyboard) ----
  await click('#tkB0'); await click('#tkB2'); await click('#tkB1');
  await click('#chkBtn');
  const wrong1 = await noteText();
  log(`scene1 wrong 3+x note: ${wrong1}`);
  expect(/3 \+ x|חיבור|סימן חיבור/.test(wrong1 || ''), 'no specific note for 3+x');
  await click('#clrBtn');
  await click('#tkB0'); await click('#tkB1'); await click('#tkB2'); await click('#tkB3');
  await click('#chkBtn');
  log(`scene1 round1: ${await noteText()}`);
  await click('#nextStoryBtn');
  // round 2 with the keyboard on the SVG blocks: 4 n - 2 (wrong 4n+2 first)
  await focus('#tok0'); await press('Enter');
  await focus('#tok1'); await press('ArrowRight');
  await focus('#tok2'); await press('Enter');
  await focus('#tok4'); await press('Enter');
  await click('#chkBtn');
  const wrong2 = await noteText();
  log(`scene1 wrong 4n+2 note: ${wrong2}`);
  expect(/לוקחת|חיסור/.test(wrong2 || ''), 'no specific note for 4n+2');
  await focus('#tok4'); await press('ArrowLeft', 1);
  await focus('#tok2'); await press('ArrowLeft', 1);
  await focus('#tok3'); await press('Enter');
  await focus('#tok4'); await press('Enter');
  log(`scene1 bar: ${await page.$eval('#barTxt', (e) => e.textContent)}`);
  await click('#chkBtn');
  let st = await state();
  log(`scene1 solved: ${JSON.stringify(st)}`);
  expect(st && st.ready, 'scene 1 not solved');
  await shot('scene1');
  await click('#next');
  // ---- quiz 1: x^3 at x = 4, correct is option 1 ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next');
  // ---- scene 2: purely keyboard ----
  await focus('#knob');
  const before = await attr('#knob', 'aria-valuenow');
  await press('ArrowRight', 2);
  log(`scene2 wrong note at x=3: ${await noteText()}`);
  await press('ArrowLeft', 6);
  log(`scene2 knob ${before} -> ${await attr('#knob', 'aria-valuenow')}: ${await noteText()}`);
  await press('ArrowRight', 6);
  st = await state();
  log(`scene2 solved: ${JSON.stringify(st)}`);
  expect(st && st.ready, 'scene 2 not solved');
  await shot('scene2');
  await click('#next');
  // ---- quiz 2: correct is option 3 ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next');
  // ---- scene 3: stepper buttons; x from 1 to -2, then 3, then 4 ----
  await click('#xMinus', 3);
  log(`scene3 at -2: ${await noteText()}`);
  await click('#xPlus', 5);
  log(`scene3 at 3: ${await noteText()}`);
  await click('#xPlus', 1);
  st = await state();
  log(`scene3 solved: ${JSON.stringify(st)}`);
  expect(st && st.ready, 'scene 3 not solved');
  await shot('scene3');
  await click('#next');
  // ---- quiz 3 (correct 0), quiz 4 (correct 2) ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next');
  const total = await page.evaluate(() => (window.__lesson ? window.__lesson.report().total : null));
  st = await state();
  log(`finished ${JSON.stringify(st)}, total ${total}`);
  expect(total === 320, `total is ${total}, not 320`);
}
